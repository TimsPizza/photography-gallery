import { listStoredPhotos } from "@/lib/server/photo-db";

export async function GET() {
  try {
    const photos = await listStoredPhotos();
    return Response.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list photos.";
    return Response.json({ error: message }, { status: 500 });
  }
}

