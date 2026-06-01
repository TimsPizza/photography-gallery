import { deletePhotoFully } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deletePhotoFully(id);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete photo.";
    return Response.json({ error: message }, { status: 500 });
  }
}
