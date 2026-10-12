export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { getRekognitionClient } from "@/lib/aws-config";
import { validateRoadImage } from "@/lib/imageValidation";

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

      const validation = validateRoadImage(labels);
      const roadVerified = validation.valid;
      const screenDetected = !validation.valid && validation.screenConfidence >= 80 && validation.roadConfidence < 70;

      return NextResponse.json({ 
        success: true, 
        labels: response.Labels,
        v_pooling,
        flood_detected: isWater,
        roadVerified,
        screenDetected,
        blockageDetected: validation.blockageDetected,
        blockageConfidence: validation.blockageConfidence
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
