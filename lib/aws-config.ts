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

export type CredentialSource = "app-keys" | "env-keys" | "default-chain";

export const getCredentialSource = (): CredentialSource => {
  const appKeyId = process.env.APP_ACCESS_KEY_ID?.trim();
  const appSecret = process.env.APP_SECRET_ACCESS_KEY?.trim();
  if (appKeyId && appSecret) {
    return "app-keys";
  }

  const awsKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const awsSessionToken = process.env.AWS_SESSION_TOKEN?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (awsKeyId && awsSecret && !awsSessionToken && !isProduction) {
    return "env-keys";
  }

  return "default-chain";
};

export function getClientConfig() {
  const region = getAwsRegion();
  const source = getCredentialSource();

  if (source === "app-keys") {
    const accessKeyId = process.env.APP_ACCESS_KEY_ID!.trim();
    const secretAccessKey = process.env.APP_SECRET_ACCESS_KEY!.trim();
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  if (source === "env-keys") {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID!.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!.trim();
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  // "default-chain": create client without any "credentials" property
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
