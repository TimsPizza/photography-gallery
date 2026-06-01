import {
  createGalleryRequestSchema,
  Gallery,
  gallerySchema,
  PhotoColorFingerprint,
  PhotoTag,
  PhotoTagKind,
  photoTagSchema,
  PhotoUploadMetadata,
  storedPhotoMetadataSchema,
  StoredPhotoMetadata,
  WorkerUploadResult,
} from "@/contracts/photo";

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

type PhotoRow = {
  file_id: string;
  final_file_name: string;
  original_file_name: string;
  file_url: string;
  thumbnail_file_id: string;
  thumbnail_final_file_name: string;
  thumbnail_file_url: string;
  metadata_id: string | null;
  capture_time: string | null;
  upload_time: string;
  width: number;
  height: number;
  aspect_ratio: number;
  orientation: "landscape" | "portrait" | "square";
  color_fingerprint_json: string;
  exif_json: string;
  created_at: string;
  updated_at: string;
};

type PhotoTagRow = {
  file_id: string;
  tag_kind: PhotoTagKind;
  tag_name: string;
};

type GalleryRow = {
  id: string;
  title: string;
  url_slug: string | null;
  description: string | null;
  photo_count?: number;
  created_at: string;
  updated_at: string;
};

type GalleryMembershipRow = {
  file_id: string;
  id: string;
  title: string;
  url_slug: string | null;
};

const D1_QUERY_URL = "https://api.cloudflare.com/client/v4/accounts";

export async function saveUploadedPhoto({
  metadata,
  thumbnailUpload,
  upload,
}: {
  metadata: PhotoUploadMetadata;
  thumbnailUpload: WorkerUploadResult;
  upload: WorkerUploadResult;
}) {
  const now = new Date().toISOString();
  const statements: D1Statement[] = [
    {
      sql: `
        INSERT INTO photos (
          file_id, final_file_name, original_file_name, file_url, metadata_id,
          thumbnail_file_id, thumbnail_final_file_name, thumbnail_file_url,
          capture_time, upload_time, width, height, aspect_ratio, orientation,
          color_fingerprint_json, exif_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_id) DO UPDATE SET
          final_file_name = excluded.final_file_name,
          original_file_name = excluded.original_file_name,
          file_url = excluded.file_url,
          metadata_id = excluded.metadata_id,
          thumbnail_file_id = excluded.thumbnail_file_id,
          thumbnail_final_file_name = excluded.thumbnail_final_file_name,
          thumbnail_file_url = excluded.thumbnail_file_url,
          capture_time = excluded.capture_time,
          upload_time = excluded.upload_time,
          width = excluded.width,
          height = excluded.height,
          aspect_ratio = excluded.aspect_ratio,
          orientation = excluded.orientation,
          color_fingerprint_json = excluded.color_fingerprint_json,
          exif_json = excluded.exif_json,
          updated_at = excluded.updated_at
      `,
      params: [
        upload.fileId,
        upload.finalFileName,
        metadata.originalFileName,
        upload.fileUrl,
        upload.metadataId ?? null,
        thumbnailUpload.fileId,
        thumbnailUpload.finalFileName,
        thumbnailUpload.fileUrl,
        metadata.captureTime,
        metadata.uploadTime,
        metadata.width,
        metadata.height,
        metadata.aspectRatio,
        metadata.orientation,
        JSON.stringify(metadata.colorFingerprint),
        JSON.stringify(metadata.exif),
        metadata.uploadTime,
        now,
      ],
    },
    {
      sql: `DELETE FROM photo_tags WHERE file_id = ? AND tag_kind = 'color'`,
      params: [upload.fileId],
    },
    ...metadata.colorTags.flatMap((tagName) =>
      createTagStatements({
        fileId: upload.fileId,
        kind: "color",
        name: tagName,
        now,
      }),
    ),
  ];

  await queryD1({ batch: statements });

  return storedPhotoMetadataSchema.parse({
    ...metadata,
    fileId: upload.fileId,
    finalFileName: upload.finalFileName,
    fileUrl: upload.fileUrl,
    thumbnailFileId: thumbnailUpload.fileId,
    thumbnailFinalFileName: thumbnailUpload.finalFileName,
    thumbnailFileUrl: thumbnailUpload.fileUrl,
    metadataId: upload.metadataId,
    tags: metadata.colorTags.map((name) => ({ kind: "color", name })),
    galleries: [],
  });
}

export async function listStoredPhotos(): Promise<StoredPhotoMetadata[]> {
  const photos = await selectD1<PhotoRow>({
    sql: `
      SELECT *
      FROM photos
      ORDER BY
        COALESCE(capture_time, upload_time) DESC,
        upload_time DESC
      LIMIT 200
    `,
  });

  return hydratePhotos(photos);
}

export async function listGalleryPhotos(
  galleryId: string,
): Promise<StoredPhotoMetadata[]> {
  const photos = await selectD1<PhotoRow>({
    sql: `
      SELECT photos.*
      FROM photos
      INNER JOIN gallery_photos
        ON gallery_photos.file_id = photos.file_id
      WHERE gallery_photos.gallery_id = ?
      ORDER BY gallery_photos.order_index ASC, gallery_photos.added_at ASC
    `,
    params: [galleryId],
  });

  return hydratePhotos(photos);
}

export async function listTags(kind?: PhotoTagKind): Promise<PhotoTag[]> {
  const rows = await selectD1<{ kind: PhotoTagKind; name: string }>({
    sql: `
      SELECT kind, name
      FROM tags
      ${kind ? "WHERE kind = ?" : ""}
      ORDER BY kind ASC, name ASC
    `,
    params: kind ? [kind] : [],
  });

  return rows.map((row) => photoTagSchema.parse(row));
}

export async function setPhotoUserTags(fileId: string, tags: string[]) {
  const now = new Date().toISOString();
  const uniqueTags = normalizeUserTags(tags);

  await queryD1({
    batch: [
      {
        sql: `DELETE FROM photo_tags WHERE file_id = ? AND tag_kind = 'user'`,
        params: [fileId],
      },
      ...uniqueTags.flatMap((name) =>
        createTagStatements({ fileId, kind: "user", name, now }),
      ),
    ],
  });
}

export async function updatePhotoUserTagsBatch({
  action,
  fileIds,
  tags,
}: {
  action: "add" | "remove";
  fileIds: string[];
  tags: string[];
}) {
  const now = new Date().toISOString();
  const uniqueTags = normalizeUserTags(tags);

  if (action === "remove") {
    await queryD1({
      batch: fileIds.flatMap((fileId) =>
        uniqueTags.map((tag) => ({
          sql: `
            DELETE FROM photo_tags
            WHERE file_id = ? AND tag_kind = 'user' AND tag_name = ?
          `,
          params: [fileId, tag],
        })),
      ),
    });
    return;
  }

  await queryD1({
    batch: fileIds.flatMap((fileId) =>
      uniqueTags.flatMap((name) =>
        createTagStatements({ fileId, kind: "user", name, now }),
      ),
    ),
  });
}

export async function listGalleries(): Promise<Gallery[]> {
  const rows = await selectD1<GalleryRow>({
    sql: `
      SELECT
        galleries.*,
        COUNT(gallery_photos.file_id) AS photo_count
      FROM galleries
      LEFT JOIN gallery_photos
        ON gallery_photos.gallery_id = galleries.id
      GROUP BY galleries.id
      ORDER BY galleries.created_at DESC
    `,
  });

  return rows.map(parseGalleryRow);
}

export async function createGallery(input: unknown): Promise<Gallery> {
  const data = createGalleryRequestSchema.parse(input);
  const now = new Date().toISOString();
  const gallery = {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    urlSlug: data.urlSlug?.trim() || null,
    description: data.description?.trim() || null,
    photoCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await queryD1({
    sql: `
      INSERT INTO galleries (
        id, title, url_slug, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    params: [
      gallery.id,
      gallery.title,
      gallery.urlSlug,
      gallery.description,
      gallery.createdAt,
      gallery.updatedAt,
    ],
  });

  return gallerySchema.parse(gallery);
}

export async function updatePhotoGalleriesBatch({
  action,
  fileIds,
  galleryIds,
}: {
  action: "add" | "remove";
  fileIds: string[];
  galleryIds: string[];
}) {
  if (galleryIds.length === 0) return;

  if (action === "remove") {
    await queryD1({
      batch: galleryIds.flatMap((galleryId) =>
        fileIds.map((fileId) => ({
          sql: `
            DELETE FROM gallery_photos
            WHERE gallery_id = ? AND file_id = ?
          `,
          params: [galleryId, fileId],
        })),
      ),
    });
    return;
  }

  const now = new Date().toISOString();
  await queryD1({
    batch: galleryIds.flatMap((galleryId) =>
      fileIds.map((fileId) => ({
        sql: `
          INSERT INTO gallery_photos (
            gallery_id, file_id, order_index, added_at
          )
          VALUES (
            ?,
            ?,
            COALESCE(
              (SELECT MAX(order_index) + 1 FROM gallery_photos WHERE gallery_id = ?),
              0
            ),
            ?
          )
          ON CONFLICT(gallery_id, file_id) DO NOTHING
        `,
        params: [galleryId, fileId, galleryId, now],
      })),
    ),
  });
}

export async function getPhotoById(
  fileId: string,
): Promise<StoredPhotoMetadata | null> {
  const rows = await selectD1<PhotoRow>({
    sql: `SELECT * FROM photos WHERE file_id = ?`,
    params: [fileId],
  });

  const [photo] = await hydratePhotos(rows);
  return photo ?? null;
}

export async function deletePhotoFully(fileId: string) {
  const photo = await getPhotoById(fileId);
  if (!photo) return;

  await Promise.all([
    deleteImgbedFile(photo.fileId),
    deleteImgbedFile(photo.thumbnailFileId),
  ]);

  await deletePhotoMetadata(fileId);
}

export async function deletePhotoMetadata(fileId: string) {
  await queryD1({
    sql: `DELETE FROM photos WHERE file_id = ?`,
    params: [fileId],
  });
}

async function deleteImgbedFile(fileId: string) {
  const imgbedBaseUrl = mustGetEnv("IMGBED_BASE_URL");
  const imgbedToken = mustGetEnv("IMGBED_TOKEN");
  const encodedFileId = fileId.split("/").map(encodeURIComponent).join("/");
  const deleteUrl = `${imgbedBaseUrl}/api/manage/delete/${encodedFileId}`;

  const imgbedResponse = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${imgbedToken}`,
    },
  });

  if (!imgbedResponse.ok) {
    const errorText = await imgbedResponse.text();
    console.error(
      `Failed to delete from imgbed: ${imgbedResponse.status} ${errorText}`,
    );
  }
}

async function hydratePhotos(rows: PhotoRow[]) {
  if (rows.length === 0) return [];

  const fileIds = rows.map((row) => row.file_id);
  const placeholders = fileIds.map(() => "?").join(", ");
  const [tagRows, galleryRows] = await Promise.all([
    selectD1<PhotoTagRow>({
      sql: `
        SELECT file_id, tag_kind, tag_name
        FROM photo_tags
        WHERE file_id IN (${placeholders})
        ORDER BY tag_kind ASC, tag_name ASC
      `,
      params: fileIds,
    }),
    selectD1<GalleryMembershipRow>({
      sql: `
        SELECT
          gallery_photos.file_id,
          galleries.id,
          galleries.title,
          galleries.url_slug
        FROM gallery_photos
        INNER JOIN galleries
          ON galleries.id = gallery_photos.gallery_id
        WHERE gallery_photos.file_id IN (${placeholders})
        ORDER BY galleries.title ASC
      `,
      params: fileIds,
    }),
  ]);

  const tagsByFileId = groupBy(tagRows, (row) => row.file_id);
  const galleriesByFileId = groupBy(galleryRows, (row) => row.file_id);

  return rows.map((row) =>
    storedPhotoMetadataSchema.parse({
      fileId: row.file_id,
      finalFileName: row.final_file_name,
      originalFileName: row.original_file_name,
      fileUrl: row.file_url,
      thumbnailFileId: row.thumbnail_file_id,
      thumbnailFinalFileName: row.thumbnail_final_file_name,
      thumbnailFileUrl: row.thumbnail_file_url,
      metadataId: row.metadata_id ?? undefined,
      captureTime: row.capture_time,
      uploadTime: row.upload_time,
      width: row.width,
      height: row.height,
      aspectRatio: row.aspect_ratio,
      orientation: row.orientation,
      exif: JSON.parse(row.exif_json),
      colorFingerprint: JSON.parse(row.color_fingerprint_json) as PhotoColorFingerprint,
      colorTags:
        tagsByFileId
          .get(row.file_id)
          ?.filter((tag) => tag.tag_kind === "color")
          .map((tag) => tag.tag_name) ?? [],
      tags:
        tagsByFileId.get(row.file_id)?.map((tag) => ({
          kind: tag.tag_kind,
          name: tag.tag_name,
        })) ?? [],
      galleries:
        galleriesByFileId.get(row.file_id)?.map((gallery) => ({
          id: gallery.id,
          title: gallery.title,
          urlSlug: gallery.url_slug,
        })) ?? [],
    }),
  );
}

function createTagStatements({
  fileId,
  kind,
  name,
  now,
}: {
  fileId: string;
  kind: PhotoTagKind;
  name: string;
  now: string;
}): D1Statement[] {
  return [
    {
      sql: `
        INSERT INTO tags (kind, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(kind, name) DO UPDATE SET updated_at = excluded.updated_at
      `,
      params: [kind, name, now, now],
    },
    {
      sql: `
        INSERT INTO photo_tags (file_id, tag_kind, tag_name, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(file_id, tag_kind, tag_name) DO NOTHING
      `,
      params: [fileId, kind, name, now],
    },
  ];
}

function parseGalleryRow(row: GalleryRow) {
  return gallerySchema.parse({
    id: row.id,
    title: row.title,
    urlSlug: row.url_slug,
    description: row.description,
    photoCount: row.photo_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function normalizeUserTags(tags: string[]) {
  return Array.from(
    new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  );
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
