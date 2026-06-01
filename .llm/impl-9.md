# Implementation Log 9

- Time: 2026-06-01T21:38:42Z
- Base Commit: af6a9ce5fcd4fee041ce62fbd7559089f1f2aafd
- Head Commit: Working Tree (Uncommitted)

## Tasks Completed in this Cycle (Ad Hoc)
1) Capture the current upload/manage implementation state and the resume-upload design boundary before further changes.

## High-level Summary
- Current upload handling is split out of TSX into `useUploadController`, with the UI limited to rendering queue state and controls.
- The upload path now treats original and thumbnail assets as separate upload-and-commit participants: originals provide photo metadata, thumbnails provide only their actual backend identity.
- Worker errors are rich enough to show upstream imgbed/Telegram failure context instead of collapsing everything into useless `502` noise.
- Upload concurrency is no longer single-threaded. The controller uses a token bucket around Telegram's practical message budget and retry/backoff for 429/5xx failures.
- Manage now has a three-row operational layout: upload queue, gallery/tag management, and searchable/filterable/paginated file grid.
- The upload queue is persisted with zustand/localStorage, but that only preserves serializable state. It does not preserve browser `File` bytes.
- A real upload state machine can be layered on this, but actual crash/reload resume requires an IndexedDB/OPFS blob store or File System Access handles. Otherwise the app can only mark active work as interrupted and ask for file re-selection.

## Changes Since Last Snapshot
### Commit Summary

```txt
No new commits. Current changes are in the working tree.
```

### File Changes

```txt
M  .llm/state.json
D  drizzle/0000_mature_stick.sql
M  drizzle/meta/0000_snapshot.json
M  drizzle/meta/_journal.json
M  package.json
M  pnpm-lock.yaml
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
M  worker/gallery-upload/src/index.ts
A  src/app/api/galleries/route.ts
A  src/app/api/galleries/photos/route.ts
A  src/app/api/galleries/[id]/photos/route.ts
A  src/app/api/photos/tags/route.ts
A  src/app/api/tags/route.ts
A  src/controllers/use-manage-photos-controller.ts
A  src/controllers/use-photo-wall-controller.ts
A  src/controllers/use-upload-controller.ts
A  src/lib/photo-url.ts
A  src/stores/upload-queue-store.ts
```

### Key Patches (Trimmed)

```diff
+ export type UploadState = {
+   id: string;
+   displayName: string;
+   status: "queued" | "analyzing" | "uploading" | "stored" | "failed";
+   message?: string;
+   photo?: StoredPhotoMetadata;
+   updatedAt: string;
+ };
+
+ export const useUploadQueueStore = create<UploadQueueStore>()(
+   persist(..., {
+     name: "photography-gallery-upload-queue",
+     partialize: (state) => ({ items: state.items }),
+     storage: createJSONStorage(() => localStorage),
+   }),
+ );
```

```diff
+ const CONCURRENCY_LIMIT = 4;
+ const TELEGRAM_MESSAGES_PER_MINUTE = 20;
+ const TELEGRAM_BUCKET_CAPACITY = TELEGRAM_MESSAGES_PER_MINUTE;
+ const TELEGRAM_TOKEN_REFILL_PER_MS = TELEGRAM_MESSAGES_PER_MINUTE / 60_000;
+ const ASSUMED_TELEGRAM_CHUNK_BYTES = 1024 * 1024;
+ const MAX_WORKER_UPLOAD_ATTEMPTS = 5;
```

```diff
+ async function waitForUploadBudget(file: File) {
+   const messageCost = estimateTelegramMessageCost(file);
+   while (true) {
+     const waitMs = reserveUploadBudget(rateLimiterRef.current, messageCost);
+     if (waitMs === 0) return;
+     await sleep(waitMs);
+   }
+ }
```

```diff
+ const thumbnailTicketResponse = await fetch("/api/photos/upload", {
+   method: "POST",
+   body: JSON.stringify({
+     intent: "thumbnail",
+     originalFileId: upload.data.fileId,
+     thumbnailFileName: webpFile.name,
+     fileSize: webpFile.size,
+   }),
+ });
```

```diff
+ thumbnailFileId: z.string().min(1),
+ thumbnailFinalFileName: z.string().min(1),
+ thumbnailFileUrl: z.url(),
```

```diff
+ if (!imgbedResponse.ok || !src) {
+   return json({
+     error: "Imgbed upload failed",
+     requestId,
+     upstream: {
+       service: "imgbed",
+       status: imgbedResponse.status,
+       statusText: imgbedResponse.statusText,
+       contentType: imgbedResponse.headers.get("Content-Type"),
+       bodyTruncated: imgbedPayload.truncated,
+       bodyJson: imgbedPayload.json,
+       bodyText: imgbedPayload.text,
+     },
+   }, 502, cors);
+ }
```

## Decisions & Rationale

* `fileId` remains the canonical identity. It includes the backend namespace and survives rename behavior. Using display filenames as identity would be broken.
* Thumbnails still must not enter the photo database as independent rows. They are derived assets stored on the owning photo row by actual backend result: `thumbnailFileId`, `thumbnailFinalFileName`, and `thumbnailFileUrl`.
* One upload API route is acceptable only because original and thumbnail handling split immediately into separate server functions. One giant intent `if` pile would be naming-and-control-flow vomit.
* The Worker remains a dumb bridge. It validates upload tickets, forwards bytes, and reports upstream diagnostics. It should not learn photo intent.
* `autoRetry=false` is deliberate because imgbed's internal Telegram retry burns budget inside the same request. The app-level retry can back off and lower pressure.
* The token bucket models the real limiting resource: Telegram messages per minute. JavaScript concurrency alone is the wrong knob.
* Zustand/localStorage persistence is useful for queue visibility and post-refresh history, but it cannot restore `File` objects. Treating it as real upload resume would be lying to the user.

## Resume Upload Design Note

The next sane version is a small upload task state machine backed by two stores:

```ts
type UploadTask = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status:
    | "queued"
    | "analyzing"
    | "ticketed"
    | "uploading_original"
    | "original_uploaded"
    | "generating_thumbnail"
    | "uploading_thumbnail"
    | "thumbnail_uploaded"
    | "committing"
    | "stored"
    | "failed"
    | "interrupted";
  metadata?: PhotoUploadMetadata;
  originalUpload?: WorkerUploadResult;
  thumbnailUpload?: WorkerUploadResult;
  blobKey?: string;
  thumbnailBlobKey?: string;
  error?: string;
  updatedAt: string;
};
```

* Zustand should store only task metadata and state transitions.
* IndexedDB or OPFS should store original blobs and generated thumbnail blobs by `blobKey`.
* On refresh, tasks with enough completed upload data can continue from the next idempotent phase.
* Tasks still in active network upload can only restart the current upload if the blob is available locally.
* If the blob is missing, mark the task `interrupted`; do not pretend recovery is possible.

Recoverable restart points:

```txt
queued/analyzing/uploading_original + original blob
  -> restart analysis/original upload

original_uploaded + original blob
  -> regenerate thumbnail and upload thumbnail

thumbnail_uploaded + metadata + originalUpload + thumbnailUpload
  -> retry commit

stored
  -> terminal success

failed + blob
  -> manual retry from last safe phase

missing blob
  -> interrupted
```

## Risks & Follow-ups

* Current persisted queue does not store blobs, so it is intentionally not resumable after tab close or refresh.
* The Telegram message-cost estimate assumes 1 MB chunks. If imgbed uses a different chunk size, the bucket will be either too conservative or still too aggressive.
* Token bucket state is per browser tab. Multiple tabs can still blow past Telegram's shared channel limit.
* True resumability needs IndexedDB/OPFS cleanup rules, quota handling, and a visible retry/interrupted UI. Otherwise stale blobs become disk trash.
* Current plain FormData upload cannot resume mid-request. Without a chunk-aware backend API, retry means restarting that asset upload.

## References

* `project.md`: active direction points to `.llm/note-refined.md`.
* `note-refined.md`: upload-time processing, thumbnail performance, galleries, tags, and manage workflow.
* `impl-8.md`: dynamic upload scheduler, persisted queue, and manage page redesign.
