import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const POSITIONS_TABLE = process.env.POSITIONS_TABLE!;
const MARKETS_TABLE = process.env.MARKETS_TABLE!;

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

interface JwtAuthorizerContext {
  jwt?: {
    claims?: Record<string, string>;
  };
}

interface PositionRecord {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  costBasis: number;
  createdAt: string;
  updatedAt?: string;
  settledAt?: string;
}

interface MarketRecord {
  marketId: string;
  title: string;
  status: string;
  yesPrice: number;
  noPrice: number;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const ctx = event.requestContext as typeof event.requestContext & {
    authorizer?: JwtAuthorizerContext;
  };
  const userId = ctx.authorizer?.jwt?.claims?.sub;
  if (!userId) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  // Query all open positions for this user (no settledAt)
  const positionsResult = await ddb.send(
    new QueryCommand({
      TableName: POSITIONS_TABLE,
      KeyConditionExpression: "userId = :uid",
      FilterExpression: "attribute_not_exists(settledAt)",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  const positions = (positionsResult.Items ?? []) as PositionRecord[];

  if (positions.length === 0) {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ positions: [] }),
    };
  }

  // BatchGet corresponding markets (current prices for unrealized P&L)
  const uniqueMarketIds = [...new Set(positions.map((p) => p.marketId))];
  const batchResult = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [MARKETS_TABLE]: {
          Keys: uniqueMarketIds.map((id) => ({ marketId: id })),
          ProjectionExpression: "marketId, title, yesPrice, noPrice, #st",
          ExpressionAttributeNames: { "#st": "status" },
        },
      },
    })
  );
  const marketRows = (batchResult.Responses?.[MARKETS_TABLE] ?? []) as MarketRecord[];
  const marketsById = Object.fromEntries(marketRows.map((m) => [m.marketId, m]));

  const enriched = positions.map((p) => {
    const market = marketsById[p.marketId];
    const currentPrice =
      market == null
        ? null
        : p.side === "YES"
        ? market.yesPrice
        : market.noPrice;
    const unrealizedPnl =
      currentPrice == null
        ? null
        : Math.round((p.shares * (currentPrice / 100) - p.costBasis) * 100) / 100;
    return {
      marketId: p.marketId,
      marketTitle: market?.title ?? null,
      marketStatus: market?.status ?? null,
      side: p.side,
      shares: p.shares,
      costBasis: p.costBasis,
      currentPrice,
      unrealizedPnl,
      createdAt: p.createdAt,
    };
  });

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ positions: enriched }),
  };
};
