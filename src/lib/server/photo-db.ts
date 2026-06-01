import { storedPhotoMetadataSchema, StoredPhotoMetadata } from "@/contracts/photo";

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

const D1_QUERY_URL = "https://api.cloudflare.com/client/v4/accounts";

export async function savePhotoMetadata(photo: StoredPhotoMetadata) {
  await queryD1({
    batch: [
      {
        sql: `
          INSERT INTO photos (
            id, original_file_name, final_file_name, file_id, file_url, capture_time,
            upload_time, width, height, aspect_ratio, orientation, camera, lens,
            iso, aperture, shutter, focal_length, manual_tags_json,
            auto_mood_tags_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            original_file_name = excluded.original_file_name,
            final_file_name = excluded.final_file_name,
            file_id = excluded.file_id,
            file_url = excluded.file_url,
            capture_time = excluded.capture_time,
            upload_time = excluded.upload_time,
            width = excluded.width,
            height = excluded.height,
            aspect_ratio = excluded.aspect_ratio,
            orientation = excluded.orientation,
            camera = excluded.camera,
            lens = excluded.lens,
            iso = excluded.iso,
            aperture = excluded.aperture,
            shutter = excluded.shutter,
            focal_length = excluded.focal_length,
            manual_tags_json = excluded.manual_tags_json,
            auto_mood_tags_json = excluded.auto_mood_tags_json,
            updated_at = excluded.updated_at
        `,
        params: [
          photo.id,
          photo.originalFileName,
          photo.finalFileName,
          photo.fileId,
          photo.fileUrl,
          photo.captureTime,
          photo.uploadTime,
          photo.width,
          photo.height,
          photo.aspectRatio,
          photo.orientation,
          photo.camera ?? null,
          photo.lens ?? null,
          photo.iso ?? null,
          photo.aperture ?? null,
          photo.shutter ?? null,
          photo.focalLength ?? null,
          JSON.stringify(photo.manualTags),
          JSON.stringify(photo.autoMoodTags),
          photo.uploadTime,
          new Date().toISOString(),
        ],
      },
      {
        sql: `
          INSERT INTO photo_color_fingerprints (
            photo_id, version, fingerprint_json, created_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(photo_id, version) DO UPDATE SET
            fingerprint_json = excluded.fingerprint_json,
            created_at = excluded.created_at
        `,
        params: [
          photo.id,
          photo.colorFingerprintVersion,
          JSON.stringify(photo.colorFingerprint),
          new Date().toISOString(),
        ],
      },
    ],
  });
}

export async function listStoredPhotos(): Promise<StoredPhotoMetadata[]> {
  const response = await queryD1<{
    id: string;
    original_file_name: string;
    final_file_name: string;
    file_id: string;
    file_url: string;
    capture_time: string | null;
    upload_time: string;
    width: number;
    height: number;
    aspect_ratio: number;
    orientation: "landscape" | "portrait" | "square";
    camera: string | null;
    lens: string | null;
    iso: number | null;
    aperture: string | null;
    shutter: string | null;
    focal_length: string | null;
    manual_tags_json: string;
    auto_mood_tags_json: string;
    fingerprint_version: number;
    fingerprint_json: string;
  }>({
    sql: `
      SELECT
        photos.*,
        photo_color_fingerprints.version AS fingerprint_version,
        photo_color_fingerprints.fingerprint_json
      FROM photos
      LEFT JOIN photo_color_fingerprints
        ON photo_color_fingerprints.photo_id = photos.id
      ORDER BY
        COALESCE(photos.capture_time, photos.upload_time) DESC,
        photos.upload_time DESC
      LIMIT 200
    `,
  });

  return (
    response.result?.[0]?.results?.map((row) =>
      storedPhotoMetadataSchema.parse({
        id: row.id,
        originalFileName: row.original_file_name,
        finalFileName: row.final_file_name,
        fileId: row.file_id,
        fileUrl: row.file_url,
        captureTime: row.capture_time,
        uploadTime: row.upload_time,
        width: row.width,
        height: row.height,
        aspectRatio: row.aspect_ratio,
        orientation: row.orientation,
        camera: row.camera ?? undefined,
        lens: row.lens ?? undefined,
        iso: row.iso ?? undefined,
        aperture: row.aperture ?? undefined,
        shutter: row.shutter ?? undefined,
        focalLength: row.focal_length ?? undefined,
        colorFingerprintVersion: row.fingerprint_version,
        colorFingerprint: JSON.parse(row.fingerprint_json),
        manualTags: JSON.parse(row.manual_tags_json),
        autoMoodTags: JSON.parse(row.auto_mood_tags_json),
      }),
    ) ?? []
  );
}

async function queryD1<T = unknown>(body: D1Statement | { batch: D1Statement[] }) {
  const accountId = mustGetEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = mustGetEnv("CLOUDFLARE_D1_DATABASE_ID");
  const token = mustGetEnv("CLOUDFLARE_D1_API_TOKEN");

  const response = await fetch(`${D1_QUERY_URL}/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as D1ApiResponse<T> | null;

  if (!response.ok || !payload?.success || payload.result?.some((result) => !result.success)) {
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
