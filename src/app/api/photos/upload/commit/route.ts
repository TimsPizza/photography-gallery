import { NextRequest } from "next/server";
import { StoredPhotoMetadata, uploadCommitRequestSchema } from "@/contracts/photo";
import { savePhotoMetadata } from "@/lib/server/photo-db";

export async function POST(request: NextRequest) {
  try {
    const input = uploadCommitRequestSchema.parse(await request.json());

    if (input.upload.metadataId && input.upload.metadataId !== input.metadata.id) {
      return Response.json({ error: "Upload result does not match metadata id." }, { status: 400 });
    }

    if (input.upload.originalFileName !== input.metadata.originalFileName) {
      return Response.json(
        { error: "Upload result does not match original filename." },
        { status: 400 },
      );
    }

    const storedPhoto: StoredPhotoMetadata = {
      ...input.metadata,
      finalFileName: input.upload.finalFileName,
      fileId: input.upload.fileId,
      fileUrl: input.upload.fileUrl,
    };

    await savePhotoMetadata(storedPhoto);

    return Response.json({ photo: storedPhoto }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to commit upload metadata.";
    return Response.json({ error: message }, { status: 500 });
  }
}
