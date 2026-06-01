import { z } from "zod";

export const dominantColorRoleSchema = z.enum([
  "dominant",
  "secondary",
  "accent",
]);

export const orientationSchema = z.enum(["landscape", "portrait", "square"]);

export const tagKindSchema = z.enum(["color", "user", "cv_labeled"]);

export const colorFingerprintSchema = z.object({
  dominantColors: z
    .array(
      z.object({
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        percentage: z.number().min(0).max(1),
        role: dominantColorRoleSchema,
      }),
    )
    .min(1),
  averageColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brightness: z.number().min(0).max(1),
  saturation: z.number().min(0).max(1),
  contrast: z.number().min(0),
  warmth: z.number().min(0).max(1),
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

export type DominantColorRole = z.infer<typeof dominantColorRoleSchema>;
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
