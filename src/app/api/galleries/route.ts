import { createGallery, listGalleries } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const galleries = await listGalleries();
    return Response.json({ galleries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list galleries.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gallery = await createGallery(await request.json());
    return Response.json({ gallery }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create gallery.";
    return Response.json({ error: message }, { status: 500 });
  }
}
