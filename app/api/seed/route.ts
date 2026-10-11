import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDbClient as docClient } from "@/lib/aws-config";
import { DELHI_NODES } from "@/lib/mock-data";

export async function GET() {
  const ddbTable = process.env.DDB_TABLE?.trim();
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
