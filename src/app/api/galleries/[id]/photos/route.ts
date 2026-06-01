import { listGalleryPhotos } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const photos = await listGalleryPhotos(id);

    return Response.json({ photos });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to list gallery photos.";
    return Response.json({ error: message }, { status: 500 });
  }
}
