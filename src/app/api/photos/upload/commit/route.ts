import { NextRequest } from "next/server";
import { uploadCommitRequestSchema } from "@/contracts/photo";
import { saveUploadedPhoto } from "@/lib/server/photo-db";

export async function POST(request: NextRequest) {
  try {
    const input = uploadCommitRequestSchema.parse(await request.json());
    const storedPhoto = await saveUploadedPhoto(input);

    return Response.json({ photo: storedPhoto }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to commit upload metadata.";
    return Response.json({ error: message }, { status: 500 });
  }
}
