import { updatePhotoGalleriesRequestSchema } from "@/contracts/photo";
import { updatePhotoGalleriesBatch } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const input = updatePhotoGalleriesRequestSchema.parse(await request.json());
    await updatePhotoGalleriesBatch(input);

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update gallery photos.";
    return Response.json({ error: message }, { status: 500 });
  }
}
