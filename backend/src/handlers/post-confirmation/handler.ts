import { PostConfirmationTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env.USERS_TABLE!;

export const handler: PostConfirmationTriggerHandler = async (event) => {
  // Guard: only run on email confirmation, not on password reset confirmation
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }

  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  try {
    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId,
          email,
          balance: 1000,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === "ConditionalCheckFailedException") {
      // Idempotent: user record already exists (Cognito retry), swallow silently
      return event;
    }
    throw err;
  }

  return event;
};
