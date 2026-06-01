import { tagKindSchema } from "@/contracts/photo";
import { listTags } from "@/lib/server/photo-db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const kindParam = request.nextUrl.searchParams.get("kind");
    const kind = kindParam ? tagKindSchema.parse(kindParam) : undefined;
    const tags = await listTags(kind);

    return Response.json({ tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list tags.";
    return Response.json({ error: message }, { status: 500 });
  }
}
