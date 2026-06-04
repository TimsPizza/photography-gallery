import { z } from "zod";

export const dominantColorRoleSchema = z.enum([
  "dominant",
  "secondary",
  "accent",
]);

export const orientationSchema = z.enum(["landscape", "portrait", "square"]);

export const tagKindSchema = z.enum(["color", "user", "cv_labeled"]);

export const colorRgbSchema = z.object({
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255),
});

export const colorHslSchema = z.object({
  h: z.number().min(0).max(360).nullable(),
  s: z.number().min(0).max(1),
  l: z.number().min(0).max(1),
});

export const colorOklabSchema = z.object({
  l: z.number(),
  a: z.number(),
  b: z.number(),
});

export const colorOklchSchema = z.object({
  l: z.number(),
  c: z.number().min(0),
  h: z.number().min(0).max(360).nullable(),
});

export const colorSpaceSampleSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  rgb: colorRgbSchema,
  hsl: colorHslSchema,
  oklab: colorOklabSchema,
  oklch: colorOklchSchema,
});

export const fingerprintColorSchema = colorSpaceSampleSchema.extend({
  percentage: z.number().min(0).max(1),
  role: dominantColorRoleSchema,
});

export const colorFingerprintSchema = z.object({
  version: z.literal(2),
  dominantColors: z
    .array(fingerprintColorSchema)
    .min(1),
  averageColor: colorSpaceSampleSchema,
  medianColor: colorSpaceSampleSchema,
  brightness: z.number().min(0).max(1),
  saturation: z.number().min(0).max(1),
  contrast: z.number().min(0),
  warmth: z.number().min(0).max(1),
  colorfulness: z.number().min(0),
  meanChroma: z.number().min(0),
  monochromeScore: z.number().min(0).max(1),
  shadowShare: z.number().min(0).max(1),
  midtoneShare: z.number().min(0).max(1),
  highlightShare: z.number().min(0).max(1),
  temperature: z.enum(["warm", "cool", "neutral"]),
  tonalKey: z.enum(["low-key", "mid-key", "high-key"]),
  saturationKey: z.enum(["muted", "balanced", "vibrant"]),
  hueHistogram: z.array(z.number().min(0).max(1)),
  lightnessHistogram: z.array(z.number().min(0).max(1)),
  chromaHistogram: z.array(z.number().min(0).max(1)),
  algorithm: z.object({
    name: z.string().min(1),
    version: z.number().int().positive(),
    resizedMaxDimension: z.number().int().positive(),
    bucketSize: z.number().int().positive(),
    generatedAt: z.iso.datetime(),
  }),
});

export const exifMetadataSchema = z.object({
  camera: z.string().min(1).optional(),
  lens: z.string().min(1).optional(),
  iso: z.number().int().positive().optional(),
  aperture: z.string().min(1).optional(),
  shutter: z.string().min(1).optional(),
  focalLength: z.string().min(1).optional(),
});

export const photoTagSchema = z.object({
  kind: tagKindSchema,
  name: z.string().min(1),
});

export const gallerySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  urlSlug: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  photoCount: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const photoUploadMetadataSchema = z.object({
  originalFileName: z.string().min(1),
  captureTime: z.string().min(1).nullable(),
  uploadTime: z.iso.datetime(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.number().positive(),
  orientation: orientationSchema,
  exif: exifMetadataSchema,
  colorFingerprint: colorFingerprintSchema,
  colorTags: z.array(z.string().min(1)),
});

export const storedPhotoMetadataSchema = photoUploadMetadataSchema.extend({
  fileId: z.string().min(1),
  finalFileName: z.string().min(1),
  fileUrl: z.url(),
  thumbnailFileId: z.string().min(1),
  thumbnailFinalFileName: z.string().min(1),
  thumbnailFileUrl: z.url(),
  metadataId: z.string().min(1).optional(),
  tags: z.array(photoTagSchema),
  galleries: z.array(gallerySchema.pick({ id: true, title: true, urlSlug: true })),
});

export const originalUploadTicketRequestSchema = z.object({
  intent: z.literal("original"),
  metadata: photoUploadMetadataSchema,
  fileSize: z.number().int().positive(),
});

export const thumbnailUploadTicketRequestSchema = z.object({
  intent: z.literal("thumbnail"),
  originalFileId: z.string().min(1),
  thumbnailFileName: z
    .string()
    .min(1)
    .regex(/^thumbnail_.+\.webp$/),
  fileSize: z.number().int().positive(),
});

export const uploadTicketRequestSchema = z.discriminatedUnion("intent", [
  originalUploadTicketRequestSchema,
  thumbnailUploadTicketRequestSchema,
]);

export const uploadTicketResponseSchema = z.object({
  uploadUrl: z.url(),
  ticket: z.string().min(1),
  uploadFolder: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

export const workerUploadResultSchema = z.object({
  originalFileName: z.string().min(1),
  finalFileName: z.string().min(1),
  fileId: z.string().min(1),
  fileUrl: z.url(),
  metadataId: z.string().min(1).optional(),
});

export const uploadCommitRequestSchema = z.object({
  metadata: photoUploadMetadataSchema,
  upload: workerUploadResultSchema,
  thumbnailUpload: workerUploadResultSchema,
});

export const fsUploadResponseSchema = z.array(
  z.object({
    src: z.string().min(1),
  }),
);

export const photoUploadResponseSchema = z.object({
  photo: storedPhotoMetadataSchema,
});

export const photoListResponseSchema = z.object({
  photos: z.array(storedPhotoMetadataSchema),
});

export const tagListResponseSchema = z.object({
  tags: z.array(photoTagSchema),
});

export const setPhotoUserTagsRequestSchema = z.object({
  fileId: z.string().min(1),
  tags: z.array(z.string().min(1)),
});

export const batchPhotoTagsRequestSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)).min(1),
  action: z.enum(["add", "remove"]),
});

export const galleryListResponseSchema = z.object({
  galleries: z.array(gallerySchema),
});

export const createGalleryRequestSchema = z.object({
  title: z.string().min(1),
  urlSlug: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
});

export const updatePhotoGalleriesRequestSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1),
  galleryIds: z.array(z.uuid()),
  action: z.enum(["add", "remove"]),
});

export const moodClusterCentroidSchema = z.object({
  oklab: colorOklabSchema,
  oklch: colorOklchSchema,
  brightness: z.number(),
  saturation: z.number(),
  warmth: z.number(),
  contrast: z.number(),
  colorfulness: z.number(),
  meanChroma: z.number(),
  monochromeScore: z.number(),
  shadowShare: z.number(),
  midtoneShare: z.number(),
  highlightShare: z.number(),
  hueHistogram: z.array(z.number()),
  lightnessHistogram: z.array(z.number()),
  chromaHistogram: z.array(z.number()),
});

export const moodPreviewPhotoSchema = z.object({
  fileId: z.string().min(1),
  thumbnailFileUrl: z.url(),
  fileUrl: z.url(),
  originalFileName: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const moodClusterSchema = z.object({
  id: z.string().min(1),
  version: z.literal(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  photoCount: z.number().int().nonnegative(),
  centroid: moodClusterCentroidSchema,
  previewColors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  photoIds: z.array(z.string().min(1)),
  photos: z.array(moodPreviewPhotoSchema),
});

export const moodClusterListResponseSchema = z.object({
  version: z.literal(1),
  clusters: z.array(moodClusterSchema),
});

export const moodRebuildResponseSchema = z.object({
  version: z.literal(1),
  clustersCreated: z.number().int().nonnegative(),
  assignmentsCreated: z.number().int().nonnegative(),
  skippedPhotos: z.number().int().nonnegative(),
});

export type DominantColorRole = z.infer<typeof dominantColorRoleSchema>;
export type ColorSpaceSample = z.infer<typeof colorSpaceSampleSchema>;
export type FingerprintColor = z.infer<typeof fingerprintColorSchema>;
export type PhotoOrientation = z.infer<typeof orientationSchema>;
export type PhotoTagKind = z.infer<typeof tagKindSchema>;
export type PhotoColorFingerprint = z.infer<typeof colorFingerprintSchema>;
export type ExifMetadata = z.infer<typeof exifMetadataSchema>;
export type PhotoTag = z.infer<typeof photoTagSchema>;
export type Gallery = z.infer<typeof gallerySchema>;
export type PhotoUploadMetadata = z.infer<typeof photoUploadMetadataSchema>;
export type StoredPhotoMetadata = z.infer<typeof storedPhotoMetadataSchema>;
export type UploadTicketRequest = z.infer<typeof uploadTicketRequestSchema>;
export type UploadTicketResponse = z.infer<typeof uploadTicketResponseSchema>;
export type WorkerUploadResult = z.infer<typeof workerUploadResultSchema>;
export type UploadCommitRequest = z.infer<typeof uploadCommitRequestSchema>;
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;
export type PhotoListResponse = z.infer<typeof photoListResponseSchema>;
export type MoodCluster = z.infer<typeof moodClusterSchema>;
export type MoodClusterListResponse = z.infer<typeof moodClusterListResponseSchema>;
export type MoodRebuildResponse = z.infer<typeof moodRebuildResponseSchema>;
