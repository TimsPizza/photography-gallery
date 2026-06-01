import { createHmac } from "node:crypto";
import { PhotoUploadMetadata } from "@/contracts/photo";

type UploadTicketPayload = {
  exp: number;
  originalFileName: string;
  uploadFolder: string;
  maxBytes: number;
  metadataId: string;
};

const DEFAULT_TICKET_TTL_SECONDS = 5 * 60;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export function createUploadTicket(metadata: PhotoUploadMetadata, fileSize: number) {
  const ttlSeconds = getOptionalNumberEnv("UPLOAD_TICKET_TTL_SECONDS") ?? DEFAULT_TICKET_TTL_SECONDS;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
  const uploadFolder = getUploadFolder(metadata);
  const maxBytes = getMaxUploadBytes(fileSize);
  const payload: UploadTicketPayload = {
    exp: expiresAtSeconds,
    originalFileName: metadata.originalFileName,
    uploadFolder,
    maxBytes,
    metadataId: metadata.id,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signaturePart = createHmac("sha256", mustGetEnv("UPLOAD_TICKET_SECRET"))
    .update(payloadPart)
    .digest("base64url");

  return {
    ticket: `${payloadPart}.${signaturePart}`,
    uploadFolder,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function getUploadWorkerUrl() {
  return mustGetEnv("GALLERY_UPLOAD_WORKER_URL").replace(/\/+$/, "") + "/upload";
}

function getUploadFolder(metadata: PhotoUploadMetadata) {
  const baseFolder = (process.env.PHOTO_UPLOAD_FOLDER || "photos").replace(/^\/+|\/+$/g, "");
  const date = metadata.captureTime ? new Date(metadata.captureTime) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return baseFolder;
  }

  return `${baseFolder}/${date.getFullYear()}`;
}

function getMaxUploadBytes(fileSize: number) {
  const multipartSizeLimit = fileSize + MULTIPART_OVERHEAD_BYTES;
  const configured = getOptionalNumberEnv("MAX_UPLOAD_BYTES");
  if (configured === undefined) {
    return multipartSizeLimit;
  }

  if (fileSize > configured) {
    throw new Error("File exceeds configured upload limit.");
  }

  return Math.min(multipartSizeLimit, configured + MULTIPART_OVERHEAD_BYTES);
}

function getOptionalNumberEnv(name: string) {
  const value = process.env[name];
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return Math.floor(parsed);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function mustGetEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
