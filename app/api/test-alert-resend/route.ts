export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyToken } from "@clerk/backend";
import { PublishCommand } from "@aws-sdk/client-sns";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDbClient, getSnsClient } from "@/lib/aws-config";

export async function POST(req: Request) {
  const jwtKey = process.env.CLERK_JWT_KEY_B64
    ? Buffer.from(process.env.CLERK_JWT_KEY_B64, "base64").toString("utf8")
    : "";
  const topicArn = process.env.SNS_TOPIC_ARN?.trim();
  const tableName = process.env.DDB_TABLE?.trim();
  const allowed = new Set((process.env.TEST_ALERT_ALLOWED_USER_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  if (!jwtKey || !topicArn || !tableName || allowed.size === 0) {
    return NextResponse.json({ error: "Test alert resend is not configured" }, { status: 503 });
  }

  const bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ error: "Sign in is required" }, { status: 401 });
  let userId: string;
  try {
    const token = await verifyToken(bearer, { jwtKey });
    userId = token.sub;
  } catch {
    return NextResponse.json({ error: "Session could not be verified" }, { status: 401 });
  }
  if (!allowed.has(userId)) return NextResponse.json({ error: "Test alert resend is not enabled for this account" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const nodeId = typeof body.nodeId === "string" ? body.nodeId.trim() : "";
  const nodeName = typeof body.nodeName === "string" ? body.nodeName.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const drainStatus = typeof body.drainStatus === "string" ? body.drainStatus.trim() : "";
  const fri = typeof body.fri === "number" ? body.fri : NaN;
  if (!nodeId || nodeId.length > 100 || !nodeName || nodeName.length > 120 || !action || action.length > 200 || drainStatus.length > 200 || !Number.isFinite(fri) || fri < 0 || fri > 1) {
    return NextResponse.json({ error: "Invalid alert details" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const ddb = getDynamoDbClient();
  try {
    const initial = await ddb.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `ALERT#${nodeId}`, SK: "COOLDOWN" },
      ConsistentRead: true
    }));
    const expires = Number(initial.Item?.ttl);
    if (!Number.isFinite(expires) || expires <= now) {
      return NextResponse.json({ error: "No recent accepted alert to resend" }, { status: 409 });
    }
    if (expires > now + 860) {
      return NextResponse.json({ error: "Please wait 40 seconds after the first alert" }, { status: 429 });
    }
  } catch (error) {
    console.error("Test resend initial alert lookup failed", error);
    return NextResponse.json({ error: "Resend unavailable" }, { status: 503 });
  }
  const sharedKey = { PK: `TEST_RESEND#${userId}#${nodeId}`, SK: "RATE" };
  try {
    await ddb.send(new PutCommand({
      TableName: tableName,
      Item: { ...sharedKey, expiresAt: now + 40, ttl: now + 3600 },
      ConditionExpression: "attribute_not_exists(PK) OR expiresAt <= :now",
      ExpressionAttributeValues: { ":now": now }
    }));
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Please wait before resending", remainingSeconds: 40 }, { status: 429 });
    }
    console.error("Test resend rate limit failed", error);
    return NextResponse.json({ error: "Resend unavailable" }, { status: 503 });
  }

  try {
    const sns = getSnsClient();
    const message = `[TEST ALERT RESEND - TOODLE]\nNode: #${nodeId} (${nodeName})\nRisk Score: ${fri} | Drain Status: ${drainStatus}\nRec. Action: ${action}`;
    const published = await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      Subject: `Toodle Test Alert Resend: Node ${nodeId}`
    }));
    return NextResponse.json({ success: true, messageId: published.MessageId });
  } catch (error) {
    console.error("Test alert resend failed", error);
    return NextResponse.json({ error: "Resend delivery unconfirmed" }, { status: 502 });
  }
}
