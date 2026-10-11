export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { getDynamoDbClient, getSnsClient, getStsClient, getCredentialSource, getAwsRegion } from '@/lib/aws-config';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { GetCallerIdentityCommand } from '@aws-sdk/client-sts';

interface LiveCheckError {
  status: "Error";
  code: string;
  hint: string;
}

type LiveCheckResult = "OK" | "SKIPPED" | LiveCheckError;

interface AwsErrorLike {
  name?: string;
  code?: string;
  message?: string;
}

function formatLiveCheckError(err: unknown): LiveCheckError {
  const e = (typeof err === 'object' && err !== null ? err : {}) as AwsErrorLike;
  let code = "Error";

  if (e) {
    if (e.name === "AbortError" || e.name === "TimeoutError" || e.code === "ETIMEDOUT") {
      code = "TimeoutError";
    } else if (
      e.name === "CredentialsProviderError" ||
      (typeof e.message === "string" && e.message.includes("Could not load credentials"))
    ) {
      code = "CredentialsProviderError";
    } else if (
      e.name === "AccessDeniedException" ||
      e.name === "AccessDenied" ||
      e.name === "AuthorizationErrorException" ||
      (typeof e.message === "string" && (e.message.includes("AccessDenied") || e.message.includes("not authorized")))
    ) {
      code = "AccessDeniedException";
    } else if (
      e.name === "ResourceNotFoundException" ||
      e.name === "NotFoundException" ||
      (typeof e.message === "string" && (e.message.includes("ResourceNotFound") || e.message.includes("not found")))
    ) {
      code = "ResourceNotFoundException";
    } else if (typeof e.message === "string" && e.message.includes("Region not accepted")) {
      code = "InvalidRegionError";
    } else if (typeof e.name === "string" && /^[A-Za-z0-9_]+$/.test(e.name) && e.name !== "Error") {
      code = e.name;
    } else if (typeof e.code === "string" && /^[A-Za-z0-9_]+$/.test(e.code)) {
      code = e.code;
    }
  }

  let hint = "Check AWS configuration and IAM permissions";
  if (code === "CredentialsProviderError") {
    hint = "No credentials reached the server: attach the compute role in Amplify and redeploy";
  } else if (code === "AccessDeniedException" || code === "AuthorizationErrorException") {
    hint = "The role is attached but the policy denies this action or resource";
  } else if (code === "ResourceNotFoundException" || code === "NotFoundException") {
    hint = "Table or topic not found in this region";
  } else if (code === "TimeoutError") {
    hint = "Request timed out: check network connectivity and region";
  } else if (code === "InvalidRegionError") {
    hint = "APP_AWS_REGION is invalid (ensure it is ap-south-1 without leading tabs or whitespace)";
  }

  return {
    status: "Error",
    code,
    hint,
  };
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const requestId = crypto.randomUUID();

  const ddbTable = process.env.DDB_TABLE?.trim();
  const snsTopic = process.env.SNS_TOPIC_ARN?.trim();
  const appAwsRegion = process.env.APP_AWS_REGION?.trim();
  const activeRegion = getAwsRegion();
  const hasSessionToken = !!process.env.AWS_SESSION_TOKEN?.trim();

  const envVars = {
    DDB_TABLE: !!ddbTable,
    SNS_TOPIC_ARN: !!snsTopic,
    APP_AWS_REGION: !!appAwsRegion,
    AWS_SESSION_TOKEN: hasSessionToken,
  };

  const resolved = {
    ddbTable: JSON.stringify(process.env.DDB_TABLE ?? null),
    snsTopicArn: JSON.stringify(process.env.SNS_TOPIC_ARN ?? null),
    region: JSON.stringify(process.env.APP_AWS_REGION ?? process.env.AWS_REGION ?? null),
  };

  const credentialSource = getCredentialSource();

  // Lazy AWS clients created per request
  const stsClient = getStsClient();
  const dynamoDbClient = getDynamoDbClient();
  const snsClient = getSnsClient();

  // STS GetCallerIdentity with 8s timeout
  let identity: { account?: string; arn?: string } | LiveCheckError;
  const stsController = new AbortController();
  const stsTimeoutId = setTimeout(() => stsController.abort(), 8000);
  try {
    const callerId = await stsClient.send(
      new GetCallerIdentityCommand({}),
      { abortSignal: stsController.signal }
    );
    identity = {
      account: callerId.Account,
      arn: callerId.Arn,
    };
  } catch (err: unknown) {
    identity = formatLiveCheckError(err);
  } finally {
    clearTimeout(stsTimeoutId);
  }

  let ddbStatus: LiveCheckResult = "SKIPPED";
  if (ddbTable) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    try {
      await dynamoDbClient.send(
        new DescribeTableCommand({ TableName: ddbTable }),
        { abortSignal: controller.signal }
      );
      ddbStatus = "OK";
    } catch (err: unknown) {
      ddbStatus = formatLiveCheckError(err);
    } finally {
      clearTimeout(id);
    }
  }

  let snsStatus: LiveCheckResult = "SKIPPED";
  if (snsTopic) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    try {
      await snsClient.send(
        new GetTopicAttributesCommand({ TopicArn: snsTopic }),
        { abortSignal: controller.signal }
      );
      snsStatus = "OK";
    } catch (err: unknown) {
      snsStatus = formatLiveCheckError(err);
    } finally {
      clearTimeout(id);
    }
  }

  return NextResponse.json(
    {
      generatedAt,
      requestId,
      region: activeRegion,
      identity,
      resolved,
      envVars,
      credentialSource,
      awsSessionToken: hasSessionToken,
      liveChecks: {
        dynamoDb: ddbStatus,
        sns: snsStatus,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
