import { deletePhotoFully, listStoredPhotos } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const photos = await listStoredPhotos();
    return Response.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list photos.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("fileId");
    if (!fileId) {
      return Response.json({ error: "Missing fileId." }, { status: 400 });
    }

    await deletePhotoFully(fileId);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete photo.";
    return Response.json({ error: message }, { status: 500 });
  }
}
