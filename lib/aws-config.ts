import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { SNSClient } from "@aws-sdk/client-sns";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { STSClient } from "@aws-sdk/client-sts";

export const STUB_MODE = false;

export const AWS_REGION =
  (process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim() || "ap-south-1");

function getClientConfig() {
  const region = AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (accessKeyId && secretAccessKey) {
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  return { region };
}

const config = getClientConfig();

export const rekognitionClient = new RekognitionClient(config);
export const snsClient = new SNSClient(config);
export const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient(config));
export const stsClient = new STSClient(config);

export const getCredentialSource = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  return accessKeyId && secretAccessKey ? "env-keys" : "default-chain";
};
