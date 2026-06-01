# Implementation Log 1

- Time: 2026-06-01T00:54:19Z
- Base Commit: N/A
- Head Commit: 58d41dfa1241295776cf8a42c9524e561ec31a09

## Tasks Completed in this Cycle (3)
1) Implement upload analysis and metadata persistence path
2) Normalize photo contracts and D1 schema with Zod and Drizzle
3) Split original and final upload filenames

## High-level Summary
- Added the first upload intake path: browser-side image analysis, server-side fs-api upload proxy, and D1 metadata persistence.
- Centralized photo metadata contracts in Zod so frontend/server API boundaries validate the same shapes.
- Replaced ad hoc SQL schema with Drizzle D1 schema and generated an initial migration.
- Corrected file identity modeling for the non-idempotent fs-api upload endpoint: `originalFileName` is display metadata, while `finalFileName`, `fileId`, and `fileUrl` come from the upload response and drive file access.

## Changes Since Last Snapshot
### Commit Summary

```txt
58d41df (HEAD -> main, origin/main) first commit
e3a26f6 Initial commit from Create Next App
```

### File Changes

```txt
D  CLAUDE.md
M  package.json
M  pnpm-lock.yaml
M  src/app/globals.css
M  src/app/layout.tsx
M  src/app/page.tsx
?? drizzle.config.ts
?? drizzle/
?? src/app/api/
?? src/app/upload-console.tsx
?? src/contracts/
?? src/db/
?? src/lib/
```

### Key Patches (Trimmed)

```diff
+ export const photoUploadMetadataSchema = z.object({
+   id: z.uuid(),
+   originalFileName: z.string().min(1),
+   captureTime: z.string().min(1).nullable(),
+   ...
+ });
+
+ export const storedPhotoMetadataSchema = photoUploadMetadataSchema.extend({
+   finalFileName: z.string().min(1),
+   fileId: z.string().min(1),
+   fileUrl: z.url(),
+ });
```

```diff
+ uploadUrl.searchParams.set("uploadNameType", "origin");
+ uploadUrl.searchParams.set("returnFormat", "full");
+ uploadUrl.searchParams.set("uploadFolder", getUploadFolder(metadata));
+ ...
+ return {
+   fileUrl: src,
+   ...extractFileIdentity(src, baseUrl),
+ };
```

```diff
+ CREATE TABLE `photos` (
+   `id` text PRIMARY KEY NOT NULL,
+   `original_file_name` text NOT NULL,
+   `final_file_name` text NOT NULL,
+   `file_id` text NOT NULL,
+   `file_url` text NOT NULL,
+   ...
+ );
+ CREATE UNIQUE INDEX `photos_file_id_unique` ON `photos` (`file_id`);
```

## Decisions & Rationale

* The app owns metadata only. File storage, serving, and cache behavior stay behind the external fs-api.
* `uploadNameType=origin` is hard-coded in the upload proxy because omitting it lets the image-bed backend rename files unpredictably.
* The upload endpoint is non-idempotent. Original and final names must be separate fields; using one `fileName` for both display and fetch identity is wrong.
* Drizzle schema is the database source of truth. Runtime `CREATE TABLE` was removed to avoid schema drift.
* Zod contracts are the API source of truth. Type-only assertions at boundaries are not enough.

## Risks & Follow-ups

* The upload flow still needs a better duplicate/retry policy, because retrying can create `name(1).jpg` records.
* Current EXIF parsing is intentionally small and JPEG-focused; broader format support should be explicit, not accidental.
* D1 writes currently use the Cloudflare REST API directly; later code should decide whether to keep that or move to a Worker-bound D1 client.
* Existing uncommitted deletion of `CLAUDE.md` predates this cycle and was not resolved here.

## References

* `project.md`: active direction points to `.llm/note-refined.md`
* `note-refined.md`: upload-time processing, D1 metadata storage, precomputed color fingerprints
* `fs-api-doc.md`: `/upload`, `/file/{fileId}`, `uploadNameType=origin`, array upload response
```

