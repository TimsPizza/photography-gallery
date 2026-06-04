import { listMoodClusters } from "@/lib/server/mood-db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const minPhotos = parseMinPhotos(
      request.nextUrl.searchParams.get("minPhotos"),
    );
    const clusters = await listMoodClusters({ minPhotos });
    return Response.json(clusters);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list mood groups.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseMinPhotos(value: string | null) {
  if (!value) return 3;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("minPhotos must be a positive number.");
  }

  return Math.floor(parsed);
}
