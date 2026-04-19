import type { DynamoDBStreamHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT!;

// Initialize once at module scope — endpoint is static per deployment (Pitfall 3)
const apigw = new ApiGatewayManagementApiClient({ endpoint: ENDPOINT });

interface ConnectionRecord {
  connectionId: string;
  subscribedMarketId: string;
}

// Minimal DynamoDB attribute value extractor for stream images.
// Handles S (string) and N (number-as-string) — the only types used in MarketsTable price fields.
function getStr(image: Record<string, { S?: string; N?: string }>, key: string): string | undefined {
  return image[key]?.S;
}
function getNum(image: Record<string, { S?: string; N?: string }>, key: string): number | undefined {
  const n = image[key]?.N;
  return n !== undefined ? Number(n) : undefined;
}

export const handler: DynamoDBStreamHandler = async (event) => {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    if (record.eventName !== "MODIFY") continue;
    if (!record.dynamodb?.NewImage || !record.dynamodb?.OldImage) continue;

    // DynamoDB Streams image values use the DynamoDB wire format (N/S/BOOL/etc).
    // Cast via `as any` — the @types/aws-lambda stream image type and @aws-sdk AttributeValue
    // types are structurally identical but declared differently; this is the AWS-documented escape hatch.
    const newImage = record.dynamodb.NewImage as any as Record<string, { S?: string; N?: string }>;
    const oldImage = record.dynamodb.OldImage as any as Record<string, { S?: string; N?: string }>;

    const newYesPrice = getNum(newImage, "yesPrice");
    const newNoPrice = getNum(newImage, "noPrice");
    const oldYesPrice = getNum(oldImage, "yesPrice");
    const oldNoPrice = getNum(oldImage, "noPrice");

    // Only broadcast when price actually changed — avoids spurious pushes on other field mutations
    if (newYesPrice === oldYesPrice && newNoPrice === oldNoPrice) continue;

    const marketId = getStr(newImage, "marketId");
    if (!marketId) continue;

    const payload = JSON.stringify({
      type: "PRICE_UPDATE",
      marketId,
      yesPrice: newYesPrice,
      noPrice: newNoPrice,
    });

    // Fan-out: query cm-connections byMarket GSI for all subscribers to this market
    let connections: ConnectionRecord[] = [];
    try {
      const result = await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: "byMarket",
        KeyConditionExpression: "subscribedMarketId = :mid",
        ExpressionAttributeValues: { ":mid": marketId },
      }));
      connections = (result.Items ?? []) as ConnectionRecord[];
    } catch (err) {
      console.error("[ws-broadcast] Failed to query connections for market", marketId, err);
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber! });
      continue;
    }

    for (const conn of connections) {
      try {
        await apigw.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(payload),
        }));
      } catch (err: unknown) {
        if (err instanceof GoneException) {
          // Stale connection (HTTP 410) — delete cm-connections row and continue.
          // Do NOT add to batchItemFailures — this is NOT a retriable error (Pitfall 1).
          console.log("[ws-broadcast] Stale connection, deleting:", conn.connectionId);
          await ddb.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          })).catch((delErr) => console.error("[ws-broadcast] Delete stale failed:", delErr));
        } else {
          console.error("[ws-broadcast] PostToConnection failed:", conn.connectionId, err);
          batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber! });
        }
      }
    }
  }

  return { batchItemFailures };
};
