export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDbClient } from "@/lib/aws-config";
import { DELHI_NODES } from "@/lib/mock-data";

export async function GET() {
  const ddbTable = process.env.DDB_TABLE?.trim();
  const docClient = getDynamoDbClient();
  try {
    for (const node of DELHI_NODES) {
      await docClient.send(new PutCommand({
        TableName: ddbTable!,
        Item: {
          PK: `NODE#${node.id}`,
          SK: `METADATA`,
          ...node
        }
      }));
    }
    return NextResponse.json({ success: true, message: "12 NODE# METADATA items exist" });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
