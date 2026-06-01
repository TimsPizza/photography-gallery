"use client";

import {
  photoUploadResponseSchema,
  StoredPhotoMetadata,
  uploadTicketResponseSchema,
  workerUploadResultSchema,
} from "@/contracts/photo";
import { analyzePhotoFile, encodeToWebP } from "@/lib/client-photo-analysis";
import { getPhotoThumbnailFileName } from "@/lib/photo-url";
import { UploadState, useUploadQueueStore } from "@/stores/upload-queue-store";
import { ChangeEvent, useRef, useState } from "react";

type UploadControllerOptions = {
  onStored?: (photo: StoredPhotoMetadata) => void;
};

const CONCURRENCY_LIMIT = 4;
const TELEGRAM_MESSAGES_PER_MINUTE = 20;
const TELEGRAM_BUCKET_CAPACITY = TELEGRAM_MESSAGES_PER_MINUTE;
const TELEGRAM_TOKEN_REFILL_PER_MS = TELEGRAM_MESSAGES_PER_MINUTE / 60_000;
const ASSUMED_TELEGRAM_CHUNK_BYTES = 1024 * 1024;
const MAX_WORKER_UPLOAD_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 15_000;
const RETRY_MAX_DELAY_MS = 120_000;

type UploadRateLimiter = {
  cooldownUntil: number;
  tokens: number;
  updatedAt: number;
};

export function useUploadController({
  onStored,
}: UploadControllerOptions = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rateLimiterRef = useRef<UploadRateLimiter>({
    cooldownUntil: 0,
    tokens: TELEGRAM_BUCKET_CAPACITY,
    updatedAt: 0,
  });
  const clearItems = useUploadQueueStore((state) => state.clearItems);
  const hasHydrated = useUploadQueueStore((state) => state.hasHydrated);
  const items = useUploadQueueStore((state) => state.items);
  const replaceItems = useUploadQueueStore((state) => state.replaceItems);
  const storeUpdateItem = useUploadQueueStore((state) => state.updateItem);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || isUploading) return;

    const uploadItems = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file, index) => ({
        file,
        id: `${file.name}-${file.lastModified}-${file.size}-${index}`,
      }));

    if (!uploadItems.length) return;

    replaceItems(
      uploadItems.map(({ file, id }) => ({
        id,
        displayName: file.name,
        status: "queued",
        updatedAt: new Date().toISOString(),
      })),
    );
    setIsUploading(true);

    let currentIndex = 0;
    const worker = async () => {
      while (currentIndex < uploadItems.length) {
        const item = uploadItems[currentIndex];
        currentIndex += 1;
        await processFile(item.file, item.id);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, uploadItems.length) },
        () => worker(),
      ),
    );

    setIsUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  async function processFile(file: File, itemId: string) {
    updateItem(itemId, {
      status: "analyzing",
      message: "Reading EXIF and color fingerprint",
    });

    try {
      const metadata = await analyzePhotoFile(file);

      updateItem(itemId, {
        status: "uploading",
        message: "Requesting upload ticket",
      });

      const ticketResponse = await fetch("/api/photos/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "original",
          metadata,
          fileSize: file.size,
        }),
      });
      const ticketJson = await ticketResponse.json();
      const ticket = uploadTicketResponseSchema.safeParse(ticketJson);

      if (!ticketResponse.ok || !ticket.success) {
        throw new Error(getUploadError(ticketJson, ticketResponse.status));
      }

      updateItem(itemId, {
        status: "uploading",
        message: `${metadata.width}x${metadata.height} · uploading original to Worker`,
      });

      const originalFormData = new FormData();
      originalFormData.set("file", file, file.name);

      const { json: workerJson, response: workerResponse } =
        await uploadToWorkerWithRetry({
          file,
          formData: originalFormData,
          itemId,
          phase: "original",
          ticket: ticket.data.ticket,
          reportRateLimitPenalty,
          updateItem,
          uploadUrl: ticket.data.uploadUrl,
          waitForUploadBudget,
        });
      const upload = workerUploadResultSchema.safeParse(workerJson);

      if (!workerResponse.ok || !upload.success) {
        throw new Error(getUploadError(workerJson, workerResponse.status));
      }

      updateItem(itemId, {
        status: "analyzing",
        message: "Transcoding thumbnail to WebP",
      });

      const webpFile = await encodeToWebP(
        file,
        getPhotoThumbnailFileName(upload.data.finalFileName),
      );

      updateItem(itemId, {
        status: "uploading",
        message: "Requesting thumbnail upload ticket",
      });

      const thumbnailTicketResponse = await fetch("/api/photos/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "thumbnail",
          originalFileId: upload.data.fileId,
          thumbnailFileName: webpFile.name,
          fileSize: webpFile.size,
        }),
      });
      const thumbnailTicketJson = await thumbnailTicketResponse.json();
      const thumbnailTicket =
        uploadTicketResponseSchema.safeParse(thumbnailTicketJson);

      if (!thumbnailTicketResponse.ok || !thumbnailTicket.success) {
        throw new Error(
          getUploadError(thumbnailTicketJson, thumbnailTicketResponse.status),
        );
      }

      updateItem(itemId, {
        status: "uploading",
        message: "uploading thumbnail to Worker",
      });

      const thumbFormData = new FormData();
      thumbFormData.set("file", webpFile, webpFile.name);

      const { json: thumbJson, response: thumbResponse } =
        await uploadToWorkerWithRetry({
          file: webpFile,
          formData: thumbFormData,
          itemId,
          phase: "thumbnail",
          ticket: thumbnailTicket.data.ticket,
          reportRateLimitPenalty,
          updateItem,
          uploadUrl: thumbnailTicket.data.uploadUrl,
          waitForUploadBudget,
        });
      const thumbnailUpload = workerUploadResultSchema.safeParse(thumbJson);

      if (!thumbResponse.ok || !thumbnailUpload.success) {
        throw new Error(getUploadError(thumbJson, thumbResponse.status));
      }

      updateItem(itemId, {
        status: "uploading",
        message: "Committing metadata",
      });

      const commitResponse = await fetch("/api/photos/upload/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata,
          thumbnailUpload: thumbnailUpload.data,
          upload: upload.data,
        }),
      });
      const commitJson = await commitResponse.json();
      const payload = photoUploadResponseSchema.safeParse(commitJson);

      if (!commitResponse.ok || !payload.success) {
        throw new Error(getUploadError(commitJson, commitResponse.status));
      }

      updateItem(itemId, {
        status: "stored",
        message:
          payload.data.photo.originalFileName ===
          payload.data.photo.finalFileName
            ? payload.data.photo.fileId
            : `${payload.data.photo.originalFileName} -> ${payload.data.photo.fileId}`,
        photo: payload.data.photo,
      });
      onStored?.(payload.data.photo);
    } catch (error) {
      updateItem(itemId, {
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  function updateItem(itemId: string, patch: Partial<UploadState>) {
    storeUpdateItem(itemId, patch);
  }

  async function waitForUploadBudget(file: File) {
    const messageCost = estimateTelegramMessageCost(file);

    while (true) {
      const waitMs = reserveUploadBudget(rateLimiterRef.current, messageCost);
      if (waitMs === 0) return;
      await sleep(waitMs);
    }
  }

  function reportRateLimitPenalty(delayMs: number) {
    const now = Date.now();
    const limiter = refillUploadBudget(rateLimiterRef.current, now);
    limiter.tokens = 0;
    limiter.cooldownUntil = Math.max(limiter.cooldownUntil, now + delayMs);
    rateLimiterRef.current = limiter;
  }

  return {
    handleInputChange,
    hasHydrated,
    inputRef,
    isUploading,
    items,
    clearItems,
    openFilePicker,
  };
}

type WorkerUploadAttempt = {
  file: File;
  formData: FormData;
  itemId: string;
  phase: "original" | "thumbnail";
  reportRateLimitPenalty: (delayMs: number) => void;
  ticket: string;
  updateItem: (itemId: string, patch: Partial<UploadState>) => void;
  uploadUrl: string;
  waitForUploadBudget: (file: File) => Promise<void>;
};

async function uploadToWorkerWithRetry({
  file,
  formData,
  itemId,
  phase,
  reportRateLimitPenalty,
  ticket,
  updateItem,
  uploadUrl,
  waitForUploadBudget,
}: WorkerUploadAttempt) {
  let lastFailure: { json: unknown; response: Response } | null = null;

  for (let attempt = 1; attempt <= MAX_WORKER_UPLOAD_ATTEMPTS; attempt += 1) {
    await waitForUploadBudget(file);

    updateItem(itemId, {
      status: "uploading",
      message: `Uploading ${phase} to Worker${attempt > 1 ? ` · retry ${attempt}/${MAX_WORKER_UPLOAD_ATTEMPTS}` : ""}`,
    });

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `UploadTicket ${ticket}`,
      },
      body: formData,
    });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      return { json, response };
    }

    lastFailure = { json, response };
    if (
      attempt >= MAX_WORKER_UPLOAD_ATTEMPTS ||
      !isRetryableUploadFailure(json, response.status)
    ) {
      return lastFailure;
    }

    const delayMs = getRetryDelayMs(attempt);
    if (isRateLimitUploadFailure(json, response.status)) {
      reportRateLimitPenalty(delayMs);
    }
    updateItem(itemId, {
      status: "uploading",
      message: `${phase} upload rate limited or temporarily failed; retrying in ${formatDelay(delayMs)}`,
    });
    await sleep(delayMs);
  }

  return lastFailure!;
}

function estimateTelegramMessageCost(file: File) {
  return Math.min(
    TELEGRAM_BUCKET_CAPACITY,
    Math.max(1, Math.ceil(file.size / ASSUMED_TELEGRAM_CHUNK_BYTES)),
  );
}

function isRetryableUploadFailure(json: unknown, status: number) {
  if (status === 429 || [500, 502, 503, 504].includes(status)) {
    return true;
  }

  const upstream = getUpstreamRecord(json);
  const upstreamStatus = upstream?.status;
  if (
    typeof upstreamStatus === "number" &&
    (upstreamStatus === 429 || [500, 502, 503, 504].includes(upstreamStatus))
  ) {
    return true;
  }

  const bodyText = typeof upstream?.bodyText === "string" ? upstream.bodyText : "";
  return /429|too many requests|rate limit/i.test(bodyText);
}

function isRateLimitUploadFailure(json: unknown, status: number) {
  if (status === 429) return true;

  const upstream = getUpstreamRecord(json);
  if (upstream?.status === 429) return true;

  const bodyText = typeof upstream?.bodyText === "string" ? upstream.bodyText : "";
  return /429|too many requests|rate limit/i.test(bodyText);
}

function reserveUploadBudget(
  limiter: UploadRateLimiter,
  messageCost: number,
) {
  const now = Date.now();
  const next = refillUploadBudget(limiter, now);
  const cooldownWaitMs = Math.max(0, next.cooldownUntil - now);

  if (cooldownWaitMs > 0) {
    return cooldownWaitMs;
  }

  if (next.tokens >= messageCost) {
    next.tokens -= messageCost;
    next.updatedAt = now;
    return 0;
  }

  const missingTokens = messageCost - next.tokens;
  next.tokens = 0;
  next.updatedAt = now;
  return Math.ceil(missingTokens / TELEGRAM_TOKEN_REFILL_PER_MS);
}

function refillUploadBudget(limiter: UploadRateLimiter, now: number) {
  if (limiter.updatedAt === 0) {
    limiter.updatedAt = now;
    return limiter;
  }

  const elapsedMs = Math.max(0, now - limiter.updatedAt);
  limiter.tokens = Math.min(
    TELEGRAM_BUCKET_CAPACITY,
    limiter.tokens + elapsedMs * TELEGRAM_TOKEN_REFILL_PER_MS,
  );
  limiter.updatedAt = now;
  return limiter;
}

function getRetryDelayMs(attempt: number) {
  const exponentialDelay = Math.min(
    RETRY_MAX_DELAY_MS,
    RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
  );
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.round(exponentialDelay * jitter);
}

function formatDelay(delayMs: number) {
  return `${Math.ceil(delayMs / 1000)}s`;
}

function sleep(delayMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function getUploadError(json: unknown, status: number) {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof json.error === "string"
  ) {
    const details = getUploadErrorDetails(json);
    return details ? `${json.error} (${details})` : json.error;
  }

  return `Upload failed with HTTP ${status}`;
}

function getUploadErrorDetails(json: object) {
  const upstream = getUpstreamRecord(json);
  if (!upstream) {
    return null;
  }

  const status =
    typeof upstream.status === "number" ? `upstream ${upstream.status}` : null;
  const bodyText =
    typeof upstream.bodyText === "string" && upstream.bodyText.length > 0
      ? upstream.bodyText.slice(0, 240)
      : null;

  return [status, bodyText].filter(Boolean).join(": ");
}

function getUpstreamRecord(json: unknown) {
  if (
    !json ||
    typeof json !== "object" ||
    !("upstream" in json) ||
    !json.upstream ||
    typeof json.upstream !== "object"
  ) {
    return null;
  }

  return json.upstream as Record<string, unknown>;
}
