import {
  batchPhotoTagsRequestSchema,
  setPhotoUserTagsRequestSchema,
} from "@/contracts/photo";
import {
  setPhotoUserTags,
  updatePhotoUserTagsBatch,
} from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const input = setPhotoUserTagsRequestSchema.parse(await request.json());
    await setPhotoUserTags(input.fileId, input.tags);

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update tags.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = batchPhotoTagsRequestSchema.parse(await request.json());
    await updatePhotoUserTagsBatch(input);

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update tags.";
    return Response.json({ error: message }, { status: 500 });
  }
}
