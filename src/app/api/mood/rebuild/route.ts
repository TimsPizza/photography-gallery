import { rebuildMoodClusters } from "@/lib/server/mood-db";

export async function POST() {
  try {
    const result = await rebuildMoodClusters();
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to rebuild mood groups.";
    return Response.json({ error: message }, { status: 500 });
  }
}
