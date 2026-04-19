import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

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

  const result = await ddb.send(new ScanCommand({ TableName: MARKETS_TABLE }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ markets: result.Items ?? [] }),
  };
};
