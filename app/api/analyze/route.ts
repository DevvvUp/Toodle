export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { getRekognitionClient } from "@/lib/aws-config";

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
    }
    
    const snsTopic = process.env.SNS_TOPIC_ARN?.trim();
    const ddbTable = process.env.DDB_TABLE?.trim();

    if (!snsTopic || !ddbTable) {
      return NextResponse.json({ success: false, error: "Server is not configured for AWS" }, { status: 503 });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const client = getRekognitionClient();

    try {
      const response = await client.send(
        new DetectLabelsCommand({
          Image: { Bytes: buffer },
          MaxLabels: 50,
          MinConfidence: 55,
        })
      );

      const labels = response.Labels || [];
      const isWater = labels.some(
        l => (l.Confidence ?? 0) >= 70 && (l.Name === "Water" || l.Name === "Flood" || l.Name === "Puddle")
      );
      const v_pooling = isWater ? 0.85 : 0.05;

      const SCREEN_LABELS = new Set([
        'monitor', 'screen', 'lcd screen', 'display', 'television', 'tv', 'laptop', 'computer', 'pc', 'tablet computer'
      ]);
      const ROAD_LABELS = new Set([
        'road', 'street', 'asphalt', 'tarmac', 'intersection', 'highway', 'freeway', 'path', 'zebra crossing',
        'alleyway', 'pavement', 'sidewalk', 'parking lot', 'urban', 'city', 'downtown', 'neighborhood',
        'car', 'vehicle', 'flood', 'flash flood'
      ]);
      const PRIMARY_ROAD_LABELS = new Set([
        'road', 'street', 'asphalt', 'tarmac', 'intersection', 'highway', 'freeway', 'pavement', 'zebra crossing'
      ]);
      const CONTEXT_LABELS = new Set([
        'car', 'vehicle', 'person', 'urban', 'city', 'building', 'transportation'
      ]);

      let maxScreenConfidence = 0;
      let maxRoadConfidence = 0;
      let hasPrimaryRoadAt60 = false;
      let maxFloodOrWater = 0;
      let maxContext = 0;

      for (const item of labels) {
        const name = (item.Name || '').toLowerCase().trim();
        const conf = typeof item.Confidence === 'number' ? item.Confidence : 0;

        if (SCREEN_LABELS.has(name)) {
          if (conf > maxScreenConfidence) maxScreenConfidence = conf;
        }
        if (ROAD_LABELS.has(name) || name === 'water') {
          if (conf > maxRoadConfidence) maxRoadConfidence = conf;
        }
        if (PRIMARY_ROAD_LABELS.has(name) && conf >= 60) {
          hasPrimaryRoadAt60 = true;
        }
        if ((name === 'flood' || name === 'water') && conf > maxFloodOrWater) {
          maxFloodOrWater = conf;
        }
        if (CONTEXT_LABELS.has(name) && conf > maxContext) {
          maxContext = conf;
        }
      }

      const hasRoadAt70 = maxRoadConfidence >= 70;
      const screenDetected = maxScreenConfidence >= 80 && !hasRoadAt70;
      const floodContextPassed = maxFloodOrWater >= 70 && maxContext >= 60;
      const isRoadScene = hasPrimaryRoadAt60 || floodContextPassed;
      const roadVerified = isRoadScene && !screenDetected;

      return NextResponse.json({ 
        success: true, 
        labels: response.Labels,
        v_pooling,
        flood_detected: isWater,
        roadVerified,
        screenDetected
      });
    } catch (rekErr: unknown) {
      if (rekErr instanceof Error) {
        console.error(`[AWS Rekognition Error] ${rekErr.name}`);
        if (rekErr.name === 'InvalidImageFormatException') {
          return NextResponse.json({ success: false, error: "Unsupported image format, use JPEG or PNG" }, { status: 400 });
        }
        if (rekErr.name === 'ImageTooLargeException') {
          return NextResponse.json({ success: false, error: "Image size is too large" }, { status: 413 });
        }
        if (rekErr.name === 'AccessDeniedException') {
          return NextResponse.json({ success: false, error: "AWS permission problem" }, { status: 502 });
        }
        if (rekErr.name === 'CredentialsProviderError' || rekErr.message.includes('credential')) {
           return NextResponse.json({ success: false, error: "Server is not configured for AWS" }, { status: 503 });
        }
      }
      return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
