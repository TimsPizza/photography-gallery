import {
  colorFingerprintSchema,
  moodClusterListResponseSchema,
  moodRebuildResponseSchema,
  type MoodCluster,
  type MoodClusterListResponse,
  type MoodRebuildResponse,
  type PhotoColorFingerprint,
} from "@/contracts/photo";
import {
  classifyMoodPhotos,
  filterSufficientMoodClusters,
  MOOD_CLUSTER_VERSION,
  type MoodClusterResult,
} from "@/lib/server/mood-classifier";

type D1ApiResponse<T = unknown> = {
  success: boolean;
  errors?: { message: string }[];
  result?: {
    success: boolean;
    results?: T[];
  }[];
};

type D1Statement = {
  sql: string;
  params?: unknown[];
};

type MoodPhotoRow = {
  file_id: string;
  color_fingerprint_json: string;
};

type MoodClusterRow = {
  id: string;
  version: number;
  name: string;
  slug: string;
  photo_count: number;
  centroid_json: string;
  preview_colors_json: string;
};

type MoodPreviewPhotoRow = {
  cluster_id: string;
  file_id: string;
  thumbnail_file_url: string;
  file_url: string;
  original_file_name: string;
  width: number;
  height: number;
};

const D1_QUERY_URL = "https://api.cloudflare.com/client/v4/accounts";
const DEFAULT_PREVIEW_PHOTO_LIMIT = 6;

export async function rebuildMoodClusters(): Promise<MoodRebuildResponse> {
  const now = new Date().toISOString();
  const photoRows = await selectD1<MoodPhotoRow>({
    sql: `
      SELECT file_id, color_fingerprint_json
      FROM photos
      ORDER BY COALESCE(capture_time, upload_time) DESC, upload_time DESC
    `,
  });
  const classification = classifyMoodPhotos(
    photoRows.map((row) => ({
      fileId: row.file_id,
      colorFingerprint: parseFingerprint(row.color_fingerprint_json),
    })),
  );

  await queryD1({
    batch: [
      { sql: `DELETE FROM photo_mood_assignments` },
      { sql: `DELETE FROM mood_clusters` },
      ...classification.clusters.map((cluster) =>
        createClusterInsertStatement(cluster, now),
      ),
      ...classification.assignments.map((assignment) => ({
        sql: `
          INSERT INTO photo_mood_assignments (
            photo_id, cluster_id, version, confidence, distance, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [
          assignment.photoId,
          assignment.clusterId,
          assignment.version,
          assignment.confidence,
          assignment.distance,
          now,
        ],
      })),
    ],
  });

  return moodRebuildResponseSchema.parse({
    version: MOOD_CLUSTER_VERSION,
    clustersCreated: classification.clusters.length,
    assignmentsCreated: classification.assignments.length,
    skippedPhotos: classification.skippedPhotos,
  });
}

export async function listMoodClusters({
  minPhotos = 3,
  previewPhotoLimit = DEFAULT_PREVIEW_PHOTO_LIMIT,
}: {
  minPhotos?: number;
  previewPhotoLimit?: number;
} = {}): Promise<MoodClusterListResponse> {
  const rows = await selectD1<MoodClusterRow>({
    sql: `
      SELECT *
      FROM mood_clusters
      WHERE version = ? AND photo_count >= ?
      ORDER BY photo_count DESC, name ASC
    `,
    params: [MOOD_CLUSTER_VERSION, minPhotos],
  });

  if (rows.length === 0) {
    return moodClusterListResponseSchema.parse({
      version: MOOD_CLUSTER_VERSION,
      clusters: [],
    });
  }

  const clusterIds = rows.map((row) => row.id);
  const placeholders = clusterIds.map(() => "?").join(", ");
  const previewRows = await selectD1<MoodPreviewPhotoRow>({
    sql: `
      SELECT
        photo_mood_assignments.cluster_id,
        photos.file_id,
        photos.thumbnail_file_url,
        photos.file_url,
        photos.original_file_name,
        photos.width,
        photos.height
      FROM photo_mood_assignments
      INNER JOIN photos
        ON photos.file_id = photo_mood_assignments.photo_id
      WHERE photo_mood_assignments.cluster_id IN (${placeholders})
      ORDER BY
        photo_mood_assignments.cluster_id ASC,
        photo_mood_assignments.confidence DESC,
        photos.upload_time DESC
    `,
    params: clusterIds,
  });
  const previewRowsByCluster = groupBy(previewRows, (row) => row.cluster_id);

  return moodClusterListResponseSchema.parse({
    version: MOOD_CLUSTER_VERSION,
    clusters: rows.map((row) =>
      parseMoodClusterRow(
        row,
        previewRowsByCluster.get(row.id) ?? [],
        previewPhotoLimit,
      ),
    ),
  });
}

function createClusterInsertStatement(
  cluster: MoodClusterResult,
  now: string,
): D1Statement {
  return {
    sql: `
      INSERT INTO mood_clusters (
        id, version, name, slug, photo_count, centroid_json,
        preview_colors_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      cluster.id,
      cluster.version,
      cluster.name,
      cluster.slug,
      cluster.photoCount,
      JSON.stringify(cluster.centroid),
      JSON.stringify(cluster.previewColors),
      now,
      now,
    ],
  };
}

function parseMoodClusterRow(
  row: MoodClusterRow,
  photos: MoodPreviewPhotoRow[],
  previewPhotoLimit: number,
): MoodCluster {
  return {
    id: row.id,
    version: MOOD_CLUSTER_VERSION,
    name: row.name,
    slug: row.slug,
    photoCount: row.photo_count,
    centroid: JSON.parse(row.centroid_json),
    previewColors: JSON.parse(row.preview_colors_json),
    photoIds: photos.map((photo) => photo.file_id),
    photos: photos.slice(0, previewPhotoLimit).map((photo) => ({
      fileId: photo.file_id,
      thumbnailFileUrl: photo.thumbnail_file_url,
      fileUrl: photo.file_url,
      originalFileName: photo.original_file_name,
      width: photo.width,
      height: photo.height,
    })),
  };
}

function parseFingerprint(value: string): PhotoColorFingerprint {
  return colorFingerprintSchema.parse(JSON.parse(value));
}

export function keepSufficientMoodClustersForDebug(
  clusters: MoodClusterResult[],
  minPhotos?: number,
) {
  return filterSufficientMoodClusters(clusters, minPhotos);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

async function selectD1<T = unknown>(statement: D1Statement) {
  const response = await queryD1<T>(statement);
  return response.result?.[0]?.results ?? [];
}

async function queryD1<T = unknown>(body: D1Statement | { batch: D1Statement[] }) {
  const accountId = mustGetEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = mustGetEnv("CLOUDFLARE_D1_DATABASE_ID");
  const token = mustGetEnv("CLOUDFLARE_D1_API_TOKEN");

  const response = await fetch(
    `${D1_QUERY_URL}/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json().catch(() => null)) as D1ApiResponse<T> | null;

  if (
    !response.ok ||
    !payload?.success ||
    payload.result?.some((result) => !result.success)
  ) {
    const message =
      payload?.errors?.map((error) => error.message).join("; ") ||
      `D1 request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function mustGetEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
