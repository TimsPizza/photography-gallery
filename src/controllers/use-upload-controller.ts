"use client";

import {
  photoUploadResponseSchema,
  StoredPhotoMetadata,
  type UploadTicketRequest,
  type UploadTicketResponse,
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
const API_TIMEOUT_MS = 20_000;
const COMMIT_TIMEOUT_MS = 30_000;
const WORKER_UPLOAD_TIMEOUT_MS = 180_000;

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
  const uploadBudgetQueueRef = useRef<Promise<void>>(Promise.resolve());
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
      attempt: 1,
      progress: undefined,
      message: "Reading EXIF and color fingerprint",
    });

    try {
      const metadata = await analyzePhotoFile(file);

      const { json: workerJson, status: workerStatus } =
        await uploadToWorkerWithRetry({
          file,
          getTicket: () =>
            requestUploadTicket({
              intent: "original",
              metadata,
              fileSize: file.size,
            }),
          itemId,
          phase: "original",
          reportRateLimitPenalty,
          updateItem,
          waitForUploadBudget,
        });
      const upload = workerUploadResultSchema.safeParse(workerJson);

      if (workerStatus < 200 || workerStatus >= 300 || !upload.success) {
        throw new Error(getUploadError(workerJson, workerStatus));
      }

      updateItem(itemId, {
        status: "analyzing",
        progress: undefined,
        message: "Transcoding thumbnail to WebP",
      });

      const webpFile = await encodeToWebP(
        file,
        getPhotoThumbnailFileName(upload.data.finalFileName),
      );

      const { json: thumbJson, status: thumbStatus } =
        await uploadToWorkerWithRetry({
          file: webpFile,
          getTicket: () =>
            requestUploadTicket({
              intent: "thumbnail",
              originalFileId: upload.data.fileId,
              thumbnailFileName: webpFile.name,
              fileSize: webpFile.size,
            }),
          itemId,
          phase: "thumbnail",
          reportRateLimitPenalty,
          updateItem,
          waitForUploadBudget,
        });
      const thumbnailUpload = workerUploadResultSchema.safeParse(thumbJson);

      if (thumbStatus < 200 || thumbStatus >= 300 || !thumbnailUpload.success) {
        throw new Error(getUploadError(thumbJson, thumbStatus));
      }

      updateItem(itemId, {
        status: "processing",
        progress: 100,
        message: "Committing metadata",
      });

      const commitResponse = await fetchWithTimeout(
        "/api/photos/upload/commit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadata,
            thumbnailUpload: thumbnailUpload.data,
            upload: upload.data,
          }),
        },
        COMMIT_TIMEOUT_MS,
      );
      const commitJson = await commitResponse.json();
      const payload = photoUploadResponseSchema.safeParse(commitJson);

      if (!commitResponse.ok || !payload.success) {
        throw new Error(getUploadError(commitJson, commitResponse.status));
      }

      updateItem(itemId, {
        status: "stored",
        progress: 100,
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
        progress: undefined,
        message: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  function updateItem(itemId: string, patch: Partial<UploadState>) {
    storeUpdateItem(itemId, patch);
  }

  function waitForUploadBudget(
    file: File,
    itemId: string,
    phase: "original" | "thumbnail",
  ) {
    const messageCost = estimateTelegramMessageCost(file);
    const reservation = uploadBudgetQueueRef.current.then(async () => {
      while (true) {
        const waitMs = reserveUploadBudget(
          rateLimiterRef.current,
          messageCost,
        );
        if (waitMs === 0) return;
        await sleepWithCountdown(waitMs, (remainingMs) => {
          updateItem(itemId, {
            status: "waiting",
            progress: 0,
            message: `Waiting ${formatDelay(remainingMs)} for upload budget before ${phase}`,
          });
        });
      }
    });

    uploadBudgetQueueRef.current = reservation.catch(() => {});
    return reservation;
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
  getTicket: () => Promise<UploadTicketResponse>;
  itemId: string;
  phase: "original" | "thumbnail";
  reportRateLimitPenalty: (delayMs: number) => void;
  updateItem: (itemId: string, patch: Partial<UploadState>) => void;
  waitForUploadBudget: (
    file: File,
    itemId: string,
    phase: "original" | "thumbnail",
  ) => Promise<void>;
};

async function uploadToWorkerWithRetry({
  file,
  getTicket,
  itemId,
  phase,
  reportRateLimitPenalty,
  updateItem,
  waitForUploadBudget,
}: WorkerUploadAttempt) {
  let lastFailure: { json: unknown; status: number } | null = null;

  for (let attempt = 1; attempt <= MAX_WORKER_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      await waitForUploadBudget(file, itemId, phase);

      updateItem(itemId, {
        status: attempt > 1 ? "retrying" : "uploading",
        attempt,
        progress: 0,
        message: `Requesting fresh ${phase} upload ticket`,
      });
      const ticket = await getTicket();

      const result = await uploadFileToWorker({
        file,
        itemId,
        phase,
        ticket,
        updateItem,
      });

      if (result.status >= 200 && result.status < 300) {
        return result;
      }

      lastFailure = result;
      if (
        attempt >= MAX_WORKER_UPLOAD_ATTEMPTS ||
        !isRetryableUploadFailure(result.json, result.status)
      ) {
        return result;
      }

      const delayMs = getRetryDelayMs(attempt);
      if (isRateLimitUploadFailure(result.json, result.status)) {
        reportRateLimitPenalty(delayMs);
      }
      await waitBeforeRetry({
        attempt,
        delayMs,
        itemId,
        phase,
        updateItem,
      });
    } catch (error) {
      if (attempt >= MAX_WORKER_UPLOAD_ATTEMPTS) {
        throw error;
      }

      const delayMs = getRetryDelayMs(attempt);
      await waitBeforeRetry({
        attempt,
        delayMs,
        itemId,
        phase,
        updateItem,
        reason:
          error instanceof UploadTransportError && error.bytesSent > 0
            ? "connection timed out after bytes were sent; remote outcome is unknown"
            : error instanceof Error
              ? error.message
              : "network failure",
      });
    }
  }

  return lastFailure!;
}

async function requestUploadTicket(
  request: UploadTicketRequest,
): Promise<UploadTicketResponse> {
  const response = await fetchWithTimeout(
    "/api/photos/upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    API_TIMEOUT_MS,
  );
  const json = await response.json().catch(() => ({}));
  const ticket = uploadTicketResponseSchema.safeParse(json);

  if (!response.ok || !ticket.success) {
    throw new Error(getUploadError(json, response.status));
  }

  return ticket.data;
}

function uploadFileToWorker({
  file,
  itemId,
  phase,
  ticket,
  updateItem,
}: {
  file: File;
  itemId: string;
  phase: "original" | "thumbnail";
  ticket: UploadTicketResponse;
  updateItem: (itemId: string, patch: Partial<UploadState>) => void;
}) {
  return new Promise<{ json: unknown; status: number }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    let bytesSent = 0;

    formData.set("file", file, file.name);
    request.open("POST", ticket.uploadUrl);
    request.timeout = WORKER_UPLOAD_TIMEOUT_MS;
    request.setRequestHeader("Authorization", `UploadTicket ${ticket.ticket}`);

    request.upload.onprogress = (event) => {
      bytesSent = event.loaded;
      if (!event.lengthComputable || event.total <= 0) return;

      const progress = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );
      updateItem(itemId, {
        status: progress >= 100 ? "processing" : "uploading",
        progress,
        message:
          progress >= 100
            ? `${phase} bytes sent; Worker is waiting for file backend`
            : `Sending ${phase} to Worker · ${progress}%`,
      });
    };

    request.onload = () => {
      resolve({
        json: parseJsonOrEmpty(request.responseText),
        status: request.status,
      });
    };
    request.onerror = () => {
      reject(
        new UploadTransportError(
          `Network error while uploading ${phase}`,
          bytesSent,
        ),
      );
    };
    request.ontimeout = () => {
      reject(
        new UploadTransportError(
          `${phase} upload timed out after ${formatDelay(WORKER_UPLOAD_TIMEOUT_MS)}`,
          bytesSent,
        ),
      );
    };
    request.onabort = () => {
      reject(new UploadTransportError(`${phase} upload was aborted`, bytesSent));
    };

    updateItem(itemId, {
      status: "uploading",
      progress: 0,
      message: `Starting ${phase} upload to Worker`,
    });
    request.send(formData);
  });
}

async function waitBeforeRetry({
  attempt,
  delayMs,
  itemId,
  phase,
  reason = "rate limited or temporarily failed",
  updateItem,
}: {
  attempt: number;
  delayMs: number;
  itemId: string;
  phase: "original" | "thumbnail";
  reason?: string;
  updateItem: (itemId: string, patch: Partial<UploadState>) => void;
}) {
  await sleepWithCountdown(delayMs, (remainingMs) => {
    updateItem(itemId, {
      status: "retrying",
      attempt: attempt + 1,
      progress: 0,
      message: `${phase} ${reason}; retry ${attempt + 1}/${MAX_WORKER_UPLOAD_ATTEMPTS} in ${formatDelay(remainingMs)}`,
    });
  });
}

class UploadTransportError extends Error {
  constructor(
    message: string,
    readonly bytesSent: number,
  ) {
    super(message);
    this.name = "UploadTransportError";
  }
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

  const bodyText =
    typeof upstream?.bodyText === "string" ? upstream.bodyText : "";
  return /429|too many requests|rate limit/i.test(bodyText);
}

function isRateLimitUploadFailure(json: unknown, status: number) {
  if (status === 429) return true;

  const upstream = getUpstreamRecord(json);
  if (upstream?.status === 429) return true;

  const bodyText =
    typeof upstream?.bodyText === "string" ? upstream.bodyText : "";
  return /429|too many requests|rate limit/i.test(bodyText);
}

function reserveUploadBudget(limiter: UploadRateLimiter, messageCost: number) {
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

async function sleepWithCountdown(
  delayMs: number,
  onTick: (remainingMs: number) => void,
) {
  const deadline = Date.now() + delayMs;

  while (true) {
    const remainingMs = Math.max(0, deadline - Date.now());
    onTick(remainingMs);
    if (remainingMs === 0) return;
    await sleep(Math.min(1_000, remainingMs));
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${formatDelay(timeoutMs)}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseJsonOrEmpty(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
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
  const requestId =
    "requestId" in json && typeof json.requestId === "string"
      ? `request ${json.requestId}`
      : null;
  const status =
    typeof upstream?.status === "number"
      ? `upstream ${upstream.status}`
      : null;
  const bodyText =
    typeof upstream?.bodyText === "string" && upstream.bodyText.length > 0
      ? upstream.bodyText.slice(0, 240)
      : null;

  return [requestId, status, bodyText].filter(Boolean).join(": ");
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
