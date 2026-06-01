import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    originalFileName: text("original_file_name").notNull(),
    finalFileName: text("final_file_name").notNull(),
    fileId: text("file_id").notNull(),
    fileUrl: text("file_url").notNull(),
    captureTime: text("capture_time"),
    uploadTime: text("upload_time").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    aspectRatio: real("aspect_ratio").notNull(),
    orientation: text("orientation", { enum: ["landscape", "portrait", "square"] }).notNull(),
    camera: text("camera"),
    lens: text("lens"),
    iso: integer("iso"),
    aperture: text("aperture"),
    shutter: text("shutter"),
    focalLength: text("focal_length"),
    manualTagsJson: text("manual_tags_json").notNull().default("[]"),
    autoMoodTagsJson: text("auto_mood_tags_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("photos_file_id_unique").on(table.fileId),
    index("photos_capture_time_idx").on(table.captureTime, table.uploadTime),
  ],
);

export const photoColorFingerprints = sqliteTable(
  "photo_color_fingerprints",
  {
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    fingerprintJson: text("fingerprint_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.photoId, table.version] }),
  ],
);

export type PhotoRow = typeof photos.$inferSelect;
export type NewPhotoRow = typeof photos.$inferInsert;
export type PhotoColorFingerprintRow = typeof photoColorFingerprints.$inferSelect;
export type NewPhotoColorFingerprintRow = typeof photoColorFingerprints.$inferInsert;
