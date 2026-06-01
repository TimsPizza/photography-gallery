import { z } from "zod";

export const COLOR_FINGERPRINT_VERSION = 1;

export const dominantColorRoleSchema = z.enum(["dominant", "secondary", "accent"]);

export const orientationSchema = z.enum(["landscape", "portrait", "square"]);

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

export const photoUploadMetadataSchema = z.object({
  id: z.uuid(),
  originalFileName: z.string().min(1),
  captureTime: z.string().min(1).nullable(),
  uploadTime: z.iso.datetime(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.number().positive(),
  orientation: orientationSchema,
  camera: z.string().min(1).optional(),
  lens: z.string().min(1).optional(),
  iso: z.number().int().positive().optional(),
  aperture: z.string().min(1).optional(),
  shutter: z.string().min(1).optional(),
  focalLength: z.string().min(1).optional(),
  colorFingerprintVersion: z.literal(COLOR_FINGERPRINT_VERSION),
  colorFingerprint: colorFingerprintSchema,
  manualTags: z.array(z.string().min(1)),
  autoMoodTags: z.array(z.string().min(1)),
});

export const storedPhotoMetadataSchema = photoUploadMetadataSchema.extend({
  finalFileName: z.string().min(1),
  fileId: z.string().min(1),
  fileUrl: z.url(),
});

export const uploadTicketRequestSchema = z.object({
  metadata: photoUploadMetadataSchema,
  fileSize: z.number().int().positive(),
});

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

export type DominantColorRole = z.infer<typeof dominantColorRoleSchema>;
export type PhotoOrientation = z.infer<typeof orientationSchema>;
export type PhotoColorFingerprint = z.infer<typeof colorFingerprintSchema>;
export type PhotoUploadMetadata = z.infer<typeof photoUploadMetadataSchema>;
export type StoredPhotoMetadata = z.infer<typeof storedPhotoMetadataSchema>;
export type UploadTicketRequest = z.infer<typeof uploadTicketRequestSchema>;
export type UploadTicketResponse = z.infer<typeof uploadTicketResponseSchema>;
export type WorkerUploadResult = z.infer<typeof workerUploadResultSchema>;
export type UploadCommitRequest = z.infer<typeof uploadCommitRequestSchema>;
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>;
export type PhotoListResponse = z.infer<typeof photoListResponseSchema>;
