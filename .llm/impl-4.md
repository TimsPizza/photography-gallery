# Implementation Log 4

- Time: 2026-05-31T22:00:00Z
- Base Commit: Working Tree
- Head Commit: Working Tree (Uncommitted)

## Tasks Completed in this Cycle (4)

1. Implement Sidecar WebP Thumbnail Upload while preserving original EXIF and file extensions.
2. Fix robust thumbnail filename mapping to avoid fallback `.jpg` extensions.
3. Enhance manage page with concurrent uploads and multi-select batch deletion.
4. Redesign manage page photo list into a responsive CSS grid and integrate Radix UI Checkbox.

## High-level Summary

- Modified `analyzePhotoFile` to stop enforcing the `.webp` extension on the `originalFileName`, preserving the original file format (e.g. `.jpg`) and its EXIF data.
- Updated `encodeToWebP` to support a scaling limit (1080px max dimension) and reduced quality (0.75) to guarantee the generated WebP thumbnail stays under 300KB.
- Rewrote the upload flow in `src/app/upload-console.tsx` to handle a two-pass sidecar upload using the same ticket: uploading the original file first, capturing the final filename, generating the thumbnail with a `thumbnail_` prefix, and then uploading the thumbnail.
- Fixed a bug where files returned without extensions by the backend failed the regex replace. Built a robust base name extractor via `substring` across `upload-console.tsx`, `photo-wall.tsx`, and `manage-shell.tsx`.
- Refactored `upload-console.tsx` to process bulk uploads concurrently with a pool limit of 4 using a worker array and `Promise.all`.
- Added `@radix-ui/react-checkbox` primitive as a dependency.
- Implemented `handleDeleteBatch` with `Set<string>` state for selected photos in `src/app/manage-shell.tsx`, allowing users to cleanly delete multiple photos at once.
- Updated `globals.css` to render `.manage-photo-grid` as a grid, drastically improving the Manage page's visual layout for testing.

## Changes Since Last Snapshot

### File Changes

```
 M src/lib/client-photo-analysis.ts
 M src/app/upload-console.tsx
 M src/app/manage-shell.tsx
 M src/app/photo-wall.tsx
 M src/app/globals.css
 M package.json
 M pnpm-lock.yaml
```

### Key Patches (Trimmed)

```diff
--- a/src/lib/client-photo-analysis.ts
+++ b/src/lib/client-photo-analysis.ts
-  const originalFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
+  const originalFileName = file.name;
 
-export async function encodeToWebP(file: File): Promise<File> {
+export async function encodeToWebP(file: File, newNameOverride?: string): Promise<File> {
+  const MAX_DIMENSION = 1080;
+  let scale = 1;
+  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
+    scale = Math.min(MAX_DIMENSION / image.width, MAX_DIMENSION / image.height);
+  }

--- a/src/app/upload-console.tsx
+++ b/src/app/upload-console.tsx
+    const CONCURRENCY_LIMIT = 4;
+    let currentIndex = 0;
+    
+    const worker = async () => {
+      while (currentIndex < imageFiles.length) {
+        await processFile(imageFiles[currentIndex++]);
+      }
+    };
+
+    await Promise.all(
+      Array.from({ length: Math.min(CONCURRENCY_LIMIT, imageFiles.length) }, () => worker())
+    );

--- a/src/app/manage-shell.tsx
+++ b/src/app/manage-shell.tsx
+function getThumbnailUrl(photo: StoredPhotoMetadata) {
+  const finalName = photo.finalFileName;
+  const baseName = finalName.includes(".")
+    ? finalName.substring(0, finalName.lastIndexOf("."))
+    : finalName;
+  const thumbName = `thumbnail_${baseName}.webp`;
+  return photo.fileUrl.replace(finalName, thumbName);
+}
```

## Decisions & Rationale

- Kept the database schema untouched by computing the thumbnail URL dynamically (`thumbnail_${baseName}.webp`) on the frontend, enforcing a strict file naming convention instead of schema migration.
- Chose `Promise.all` with a while-loop worker pool to cap concurrent uploads at 4. This avoids choking the browser's network threads and the Cloudflare worker/Imgbed APIs when dropping bulk images.
- Replaced fragile Regex for extension substitution with standard string matching (`substring` to the last `.`) to correctly map extensionless backend responses, avoiding `.jpg` fallback by the image host.
- Used Radix Checkbox to standardize accessibility and state control for the multi-select batch deletion feature.

## Risks & Follow-ups

- Sidecar Upload relies on sequential execution per file (uploading original, waiting for its response, then uploading thumbnail). The Imgbed limits or timeouts might still affect very large raw file uploads.
- The `getThumbnailUrl` strictly relies on the `.webp` fallback naming. If the Worker logic for renaming ever drops the `thumbnail_` prefix logic or alters the upload schema, images will 404.
