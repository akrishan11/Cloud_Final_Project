import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
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

  const marketId = event.pathParameters?.marketId;
  if (!marketId) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: "Missing marketId" }),
    };
  }

  const result = await ddb.send(
    new GetCommand({ TableName: MARKETS_TABLE, Key: { marketId } })
  );

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: HEADERS,
      body: JSON.stringify({ error: "Market not found" }),
    };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ market: result.Item }),
  };
};
