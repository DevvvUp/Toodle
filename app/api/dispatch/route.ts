export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PublishCommand } from "@aws-sdk/client-sns";
import { GetCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getSnsClient, getDynamoDbClient } from "@/lib/aws-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeId, nodeName, fri, drainStatus, action, screenDetected, blockageDetected, kind, latitude, longitude } = body;
    const isField = kind === "field";
    if (isField && (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      return NextResponse.json({ success: false, error: "Field alerts need the capture coordinates" }, { status: 400 });
    }

    if (screenDetected === true) {
      return NextResponse.json({ success: false, error: "Image not verified as a real road" }, { status: 400 });
    }

    const isBlockage = blockageDetected === true || drainStatus === "Drain blockage detected (visual)";
    if (fri < 0.86 && !isBlockage) {
      return NextResponse.json({ success: false, error: "FRI below critical threshold" }, { status: 400 });
    }

    const ddbTable = process.env.DDB_TABLE?.trim();
    const snsTopic = process.env.SNS_TOPIC_ARN?.trim();
    // Field help requests go to HELP_TOPIC_ARN when it is set, so they can reach a different list from the existing alerts.
    const helpTopic = process.env.HELP_TOPIC_ARN?.trim();
    const topicArn = isField && helpTopic ? helpTopic : snsTopic;

    const ddb = getDynamoDbClient();
    const sns = getSnsClient();

    const now = Date.now();
    const getRes = await ddb.send(new GetCommand({
      TableName: ddbTable!,
      Key: { PK: `ALERT#${nodeId}`, SK: "COOLDOWN" }
    }));
    
    if (getRes.Item && getRes.Item.ttl > Math.floor(now / 1000)) {
      return NextResponse.json({ 
        success: false, 
        error: "Cooldown active",
        remainingSeconds: getRes.Item.ttl - Math.floor(now / 1000)
      }, { status: 429 });
    }

    const message = isField
      ? `[HELP REQUEST - FLOODGUARD AI]\nClogged road reported. Please send a crew to inspect and clear it.\nLocation: ${String(nodeName).slice(0, 120)}\nCoordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\nMap: https://maps.google.com/?q=${latitude},${longitude}\nRisk Score: ${fri} | Drain Status: ${drainStatus}\nRec. Action: ${action}`
      : `[CRITICAL ALERT - FLOODGUARD AI]\nNode: #${nodeId} (${nodeName})\nRisk Score: ${fri} | Drain Status: ${drainStatus}\nRec. Action: ${action}`;
    const subject = isField ? "Help request: clogged road" : `FloodGuard Alert: Node ${nodeId}`;

    const snsRes = await sns.send(new PublishCommand({
      TopicArn: topicArn!,
      Message: message,
      Subject: subject
    }));

    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [ddbTable!]: [
          {
            PutRequest: {
              Item: {
                PK: `ALERT#${nodeId}`,
                SK: "COOLDOWN",
                ttl: Math.floor(now / 1000) + 15 * 60
              }
            }
          },
          {
            PutRequest: {
              Item: {
                PK: `ALERT#${nodeId}`,
                SK: `STATUS#${now}`,
                messageId: snsRes.MessageId,
                fri
              }
            }
          }
        ]
      }
    }));

    return NextResponse.json({ success: true, messageId: snsRes.MessageId });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
