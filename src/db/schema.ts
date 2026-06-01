import {
  foreignKey,
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
    fileId: text("file_id").primaryKey(),
    finalFileName: text("final_file_name").notNull(),
    originalFileName: text("original_file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    thumbnailFileId: text("thumbnail_file_id").notNull(),
    thumbnailFinalFileName: text("thumbnail_final_file_name").notNull(),
    thumbnailFileUrl: text("thumbnail_file_url").notNull(),
    metadataId: text("metadata_id"),
    captureTime: text("capture_time"),
    uploadTime: text("upload_time").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    aspectRatio: real("aspect_ratio").notNull(),
    orientation: text("orientation", {
      enum: ["landscape", "portrait", "square"],
    }).notNull(),
    colorFingerprintJson: text("color_fingerprint_json").notNull(),
    exifJson: text("exif_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("photos_metadata_id_unique").on(table.metadataId),
    uniqueIndex("photos_thumbnail_file_id_unique").on(table.thumbnailFileId),
    index("photos_capture_time_idx").on(table.captureTime, table.uploadTime),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    kind: text("kind", { enum: ["color", "user", "cv_labeled"] }).notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.name] })],
);

export const photoTags = sqliteTable(
  "photo_tags",
  {
    fileId: text("file_id")
      .notNull()
      .references(() => photos.fileId, { onDelete: "cascade" }),
    tagKind: text("tag_kind", {
      enum: ["color", "user", "cv_labeled"],
    }).notNull(),
    tagName: text("tag_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fileId, table.tagKind, table.tagName] }),
    foreignKey({
      columns: [table.tagKind, table.tagName],
      foreignColumns: [tags.kind, tags.name],
    }).onDelete("cascade"),
  ],
);

export const galleries = sqliteTable(
  "galleries",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    urlSlug: text("url_slug"),
    description: text("description"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("galleries_url_slug_unique").on(table.urlSlug)],
);

export const galleryPhotos = sqliteTable(
  "gallery_photos",
  {
    galleryId: text("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => photos.fileId, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    addedAt: text("added_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.galleryId, table.fileId] }),
    index("gallery_photos_file_id_idx").on(table.fileId),
  ],
);

export type PhotoRow = typeof photos.$inferSelect;
export type NewPhotoRow = typeof photos.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
export type PhotoTagRow = typeof photoTags.$inferSelect;
export type GalleryRow = typeof galleries.$inferSelect;
export type NewGalleryRow = typeof galleries.$inferInsert;
export type GalleryPhotoRow = typeof galleryPhotos.$inferSelect;
