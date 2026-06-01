# Implementation Log 8

- Time: 2026-06-01T21:35:30Z
- Base Commit: af6a9ce5fcd4fee041ce62fbd7559089f1f2aafd
- Head Commit: Working Tree (Uncommitted)

## Tasks Completed in this Cycle (3)
1) Throttle uploads and retry Worker/imgbed failures with exponential backoff and jitter for Telegram rate limits.
2) Redesign manage page layout with persisted upload queue, gallery management, and paginated file grid.
3) Replace single-thread upload throttling with a dynamic token-bucket upload scheduler.

## High-level Summary
- Added Worker/imgbed retry handling for 429/5xx failures with exponential backoff and jitter.
- Disabled imgbed `autoRetry` in the Worker upload URL so Telegram 429s are not immediately retried inside the same upstream request.
- Reworked Manage into three operational rows: persisted upload queue, gallery/tag management, and a searchable/filterable/paginated file grid.
- Added a zustand-persisted upload queue store so upload history survives refresh, while explicitly not pretending browser `File` objects can resume after reload.
- Added file search, user tag filter, gallery filter, pagination, and fixed-height file cards with internal scrolling.
- Replaced the overly conservative single-thread upload path with a token-bucket scheduler based on Telegram's 20 messages/minute limit.
- Restored upload worker concurrency while requiring each Worker upload to reserve estimated Telegram message budget before starting.
- Added 429 cooldown penalties that clear the token bucket and push future upload starts behind the retry delay.

## Changes Since Last Snapshot
### Commit Summary

```txt
No new commits. Current changes are in the working tree.
```

### File Changes

```txt
M  .llm/state.json
M  src/app/manage-shell.tsx
M  src/app/upload-console.tsx
M  worker/gallery-upload/src/index.ts
A  src/controllers/use-manage-photos-controller.ts
A  src/controllers/use-upload-controller.ts
A  src/stores/upload-queue-store.ts
```

### Key Patches (Trimmed)

```diff
+ const CONCURRENCY_LIMIT = 4;
+ const TELEGRAM_MESSAGES_PER_MINUTE = 20;
+ const TELEGRAM_BUCKET_CAPACITY = TELEGRAM_MESSAGES_PER_MINUTE;
+ const TELEGRAM_TOKEN_REFILL_PER_MS = TELEGRAM_MESSAGES_PER_MINUTE / 60_000;
+ const ASSUMED_TELEGRAM_CHUNK_BYTES = 1024 * 1024;
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
+ function reportRateLimitPenalty(delayMs: number) {
+   const now = Date.now();
+   const limiter = refillUploadBudget(rateLimiterRef.current, now);
+   limiter.tokens = 0;
+   limiter.cooldownUntil = Math.max(limiter.cooldownUntil, now + delayMs);
+   rateLimiterRef.current = limiter;
+ }
```

```diff
+ export const useUploadQueueStore = create<UploadQueueStore>()(
+   persist(
+     (set) => ({
+       hasHydrated: false,
+       items: [],
+       clearItems: () => set({ items: [] }),
+       replaceItems: (items) => set({ items }),
+       updateItem: ...
+     }),
+     { name: "photography-gallery-upload-queue" },
+   ),
+ );
```

## Decisions & Rationale

* Single-thread upload was too blunt. The real constraint is Telegram message budget, not JavaScript concurrency.
* Token bucket scheduling lets multiple files analyze and prepare concurrently, but gates the expensive upstream message-producing operation.
* File cost is estimated from size with a 1 MB chunk assumption and capped by bucket capacity. This is intentionally conservative until imgbed exposes exact chunk count.
* Refresh persistence stores upload state/logs only. Browser `File` handles cannot be safely resurrected after reload, and pretending otherwise would be compatibility garbage.
* Manage page now uses Tailwind grid utilities for the main layout instead of growing another pile of CSS-only bespoke layout rules.

## Risks & Follow-ups

* The message-cost estimate may need tuning if imgbed's Telegram chunk size differs materially from 1 MB.
* Token bucket state is in-memory per browser tab. Multiple tabs can still exceed Telegram rate limits.
* The file grid now has usable search/filter/page controls, but gallery content management still needs richer editing and reorder flows.
* Upload queue persistence is local-only and intentionally does not resume interrupted uploads.

## References

* `project.md`: active direction points to `.llm/note-refined.md`.
* `note-refined.md`: upload concurrency, upload-time processing, manage workflow, and performance constraints.
