# Implementation Log 6

- Time: 2026-06-01T20:20:45Z
- Base Commit: af6a9ce5fcd4fee041ce62fbd7559089f1f2aafd
- Head Commit: Working Tree (Uncommitted)

## Tasks Completed in this Cycle (1)
1) Redesign photo identity, tags, galleries, and thumbnail upload intent flow around fileId.

## High-level Summary
- Reworked photo identity so `fileId` is the canonical primary key and `finalFileName` is only display-oriented metadata.
- Collapsed EXIF display metadata into `exif_json`, while keeping timeline/layout-critical fields as top-level columns.
- Kept `color_fingerprint_json` directly on `photos`; removed the separate fingerprint-table direction to avoid pointless schema spread.
- Added normalized tag tables with tag namespaces: `color`, `user`, and reserved `cv_labeled`.
- Added gallery tables with `url_slug` and `gallery_photos` membership.
- Split upload ticket handling by intent inside the Next API handler: `original` and `thumbnail` use separate functions while still sharing the same Worker upload bridge.
- Ensured thumbnails remain derived assets: they upload separately, do not commit metadata, do not get EXIF/color analysis, and never enter the database.
- Expanded Manage UI to create galleries, show user-tag defaults, edit single-photo tags/gallery membership, and batch add/remove tags or gallery membership.
- Removed the old `/api/photos/[id]` delete route because `fileId` contains `/`; deletion now uses `DELETE /api/photos?fileId=...`.

## Changes Since Last Snapshot
### Commit Summary

```txt
No new commits. Current changes are in the working tree.
```

### File Changes

```txt
M  .llm/state.json
D  src/app/api/photos/[id]/route.ts
M  src/app/api/photos/route.ts
M  src/app/api/photos/upload/commit/route.ts
M  src/app/api/photos/upload/route.ts
M  src/app/globals.css
M  src/app/manage-shell.tsx
M  src/app/photo-wall.tsx
M  src/app/upload-console.tsx
M  src/contracts/photo.ts
M  src/db/schema.ts
M  src/lib/client-photo-analysis.ts
M  src/lib/photo-layout.ts
M  src/lib/photo-metadata.ts
M  src/lib/server/photo-db.ts
M  src/lib/server/upload-ticket.ts
A  src/app/api/galleries/route.ts
A  src/app/api/galleries/photos/route.ts
A  src/app/api/galleries/[id]/photos/route.ts
A  src/app/api/photos/tags/route.ts
A  src/app/api/tags/route.ts
A  src/controllers/use-manage-photos-controller.ts
A  src/controllers/use-photo-wall-controller.ts
A  src/controllers/use-upload-controller.ts
A  src/lib/photo-url.ts
```

### Key Patches (Trimmed)

```diff
+ export const photos = sqliteTable("photos", {
+   fileId: text("file_id").primaryKey(),
+   finalFileName: text("final_file_name").notNull(),
+   originalFileName: text("original_file_name").notNull(),
+   fileUrl: text("file_url").notNull(),
+   metadataId: text("metadata_id"),
+   captureTime: text("capture_time"),
+   uploadTime: text("upload_time").notNull(),
+   width: integer("width").notNull(),
+   height: integer("height").notNull(),
+   aspectRatio: real("aspect_ratio").notNull(),
+   orientation: text("orientation", { enum: ["landscape", "portrait", "square"] }).notNull(),
+   colorFingerprintJson: text("color_fingerprint_json").notNull(),
+   exifJson: text("exif_json").notNull().default("{}"),
+ });
```

```diff
+ export const tags = sqliteTable("tags", {
+   kind: text("kind", { enum: ["color", "user", "cv_labeled"] }).notNull(),
+   name: text("name").notNull(),
+ }, (table) => [primaryKey({ columns: [table.kind, table.name] })]);
+
+ export const photoTags = sqliteTable("photo_tags", {
+   fileId: text("file_id").notNull().references(() => photos.fileId, { onDelete: "cascade" }),
+   tagKind: text("tag_kind", { enum: ["color", "user", "cv_labeled"] }).notNull(),
+   tagName: text("tag_name").notNull(),
+ });
```

```diff
+ function handleOriginalUploadTicket(input: UploadTicketRequest) {
+   const request = originalUploadTicketRequestSchema.parse(input);
+   const ticket = createUploadTicket(request.metadata, request.fileSize);
+   return Response.json({ uploadUrl: getUploadWorkerUrl(), ...ticket });
+ }
+
+ function handleThumbnailUploadTicket(input: UploadTicketRequest) {
+   const request = thumbnailUploadTicketRequestSchema.parse(input);
+   const ticket = createThumbnailUploadTicket(request);
+   return Response.json({ uploadUrl: getUploadWorkerUrl(), ...ticket });
+ }
```

```diff
+ const webpFile = await encodeToWebP(
+   file,
+   getPhotoThumbnailFileName(upload.data.finalFileName),
+ );
+ const thumbnailTicketResponse = await fetch("/api/photos/upload", {
+   method: "POST",
+   body: JSON.stringify({
+     intent: "thumbnail",
+     originalFileId: upload.data.fileId,
+     thumbnailFileName: webpFile.name,
+     fileSize: webpFile.size,
+   }),
+ });
+ // Thumbnail upload result is intentionally not committed.
```

## Decisions & Rationale

* `fileId` is the real backend/file API identity because it includes the namespace path. Using `finalFileName` as a key would be correctness garbage once namespaces enter the picture.
* Thumbnail rows are forbidden. A thumbnail is a derived asset, not a photo. Letting it into tags, EXIF, color analysis, or galleries would corrupt the model.
* `color_fingerprint_json` belongs on `photos` for now. A separate table only makes sense when multiple algorithm versions need to coexist.
* EXIF display metadata is stored as JSON because it is upload-time metadata and rarely queried. Capture time and layout-critical dimensions stay queryable.
* Tag kind belongs on `tags` as a namespace: `color` is system-generated/read-only, `user` feeds defaults/dropdowns, and `cv_labeled` is reserved for later computer-vision labels.
* Deleting by path segment was broken by design because `fileId` contains slashes. Query-param deletion is boring and correct.

## Risks & Follow-ups

* Drizzle migrations were intentionally not regenerated; the user said the database is mock data and destructive schema changes are acceptable.
* Manage UI is functional but blunt. It uses simple inputs/selects and should later get a better tag picker and gallery membership control.
* The gallery API has creation and membership mutation, but not full gallery edit/delete/reorder yet.
* The upload ticket split is at the Next API level only; Worker remains a byte-stream bridge and still does not know asset intent.
* Public gallery filtering/browsing has not been connected yet.

## References

* `project.md`: active direction points to `.llm/note-refined.md`.
* `note-refined.md`: upload-time processing, D1 metadata storage, tags, albums/galleries, precomputed color metadata, and performance rules.
