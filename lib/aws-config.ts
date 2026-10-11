import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { SNSClient } from "@aws-sdk/client-sns";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { STSClient } from "@aws-sdk/client-sts";

export const STUB_MODE = false;

export function getAwsRegion(): string {
  return (process.env.APP_AWS_REGION?.trim() || process.env.AWS_REGION?.trim() || "ap-south-1");
}

export const AWS_REGION = getAwsRegion();

export function getClientConfig() {
  const region = getAwsRegion();
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

export function getRekognitionClient(): RekognitionClient {
  return new RekognitionClient(getClientConfig());
}

export function getSnsClient(): SNSClient {
  return new SNSClient(getClientConfig());
}

export function getDynamoDbClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient(getClientConfig()));
}

export function getStsClient(): STSClient {
  return new STSClient(getClientConfig());
}

// Lazy client proxies that instantiate clients only when accessed inside a request handler
export const rekognitionClient = new Proxy({} as RekognitionClient, {
  get(_target, prop) {
    const client = getRekognitionClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export const snsClient = new Proxy({} as SNSClient, {
  get(_target, prop) {
    const client = getSnsClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export const dynamoDbClient = new Proxy({} as DynamoDBDocumentClient, {
  get(_target, prop) {
    const client = getDynamoDbClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export const stsClient = new Proxy({} as STSClient, {
  get(_target, prop) {
    const client = getStsClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

export const getCredentialSource = () => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  return accessKeyId && secretAccessKey ? "env-keys" : "default-chain";
};
