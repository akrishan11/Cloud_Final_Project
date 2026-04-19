import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const MARKETS_TABLE = process.env.MARKETS_TABLE!;
const POSITIONS_TABLE = process.env.POSITIONS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

interface JwtAuthorizerContext {
  jwt?: { claims?: Record<string, string> };
}

interface PositionRecord {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  costBasis: number;
  settledAt?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const ctx = event.requestContext as typeof event.requestContext & {
    authorizer?: JwtAuthorizerContext;
  };
  const userId = ctx.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  if (!ADMIN_USER_IDS.includes(userId)) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: "Admin access required" }) };
  }

  const marketId = event.pathParameters?.marketId;
  if (!marketId) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "marketId is required" }) };
  }

  let body: { outcome?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const outcome = body.outcome;
  if (outcome !== "YES" && outcome !== "NO") {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "outcome must be YES or NO" }) };
  }

  // Phase A: atomic market status transition (closed → resolved)
  const resolvedAt = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: MARKETS_TABLE,
      Key: { marketId },
      ConditionExpression: "#status = :closed",
      UpdateExpression: "SET #status = :resolved, outcome = :outcome, resolvedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":closed": "closed",
        ":resolved": "resolved",
        ":outcome": outcome,
        ":now": resolvedAt,
      },
    }));
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: "Market is not in closed status" }) };
    }
    throw err;
  }

  // Phase B: fan-out — page through byMarket GSI and settle each position
  let lastKey: Record<string, unknown> | undefined;
  let processed = 0;
  do {
    const page = await ddb.send(new QueryCommand({
      TableName: POSITIONS_TABLE,
      IndexName: "byMarket",
      KeyConditionExpression: "marketId = :mid",
      ExpressionAttributeValues: { ":mid": marketId },
      ExclusiveStartKey: lastKey,
    }));
    const positions = (page.Items ?? []) as PositionRecord[];
    for (const position of positions) {
      await settlePosition(position, outcome);
      processed++;
    }
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey !== undefined);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ marketId, outcome, resolvedAt, positionsSettled: processed }),
  };
};

async function settlePosition(position: PositionRecord, outcome: "YES" | "NO"): Promise<void> {
  const isWinner = position.side === outcome;
  const payout = isWinner ? Math.round(position.shares * 100) / 100 : 0; // 1 share = $1
  const realizedPnl = isWinner
    ? Math.round((payout - position.costBasis) * 100) / 100
    : 0;
  const now = new Date().toISOString();

  try {
    if (isWinner) {
      await ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: USERS_TABLE,
              Key: { userId: position.userId },
              UpdateExpression: "SET balance = balance + :payout",
              ExpressionAttributeValues: { ":payout": payout },
            },
          },
          {
            Update: {
              TableName: POSITIONS_TABLE,
              Key: { userId: position.userId, marketId: position.marketId },
              ConditionExpression: "attribute_not_exists(settledAt)",
              UpdateExpression:
                "SET settledAt = :now, outcome = :outcome, realizedPnl = :pnl, payout = :payout",
              ExpressionAttributeValues: {
                ":now": now,
                ":outcome": outcome,
                ":pnl": realizedPnl,
                ":payout": payout,
              },
            },
          },
        ],
      }));
    } else {
      await ddb.send(new UpdateCommand({
        TableName: POSITIONS_TABLE,
        Key: { userId: position.userId, marketId: position.marketId },
        ConditionExpression: "attribute_not_exists(settledAt)",
        UpdateExpression:
          "SET settledAt = :now, outcome = :outcome, realizedPnl = :zero, payout = :zero",
        ExpressionAttributeValues: {
          ":now": now,
          ":outcome": outcome,
          ":zero": 0,
        },
      }));
    }
  } catch (err: unknown) {
    const e = err as {
      name?: string;
      CancellationReasons?: Array<{ Code?: string }>;
    };
    if (
      e.name === "ConditionalCheckFailedException" ||
      (e.name === "TransactionCanceledException" &&
        e.CancellationReasons?.some((r) => r.Code === "ConditionalCheckFailed"))
    ) {
      return; // already settled — swallow for idempotent retry
    }
    throw err;
  }
}
