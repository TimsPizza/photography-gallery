/// <reference types="@cloudflare/workers-types" />

type Env = {
  IMGBED_BASE_URL: string;
  IMGBED_TOKEN: string;
  UPLOAD_TICKET_SECRET: string;
  ALLOWED_ORIGINS?: string;
  MAX_UPLOAD_BYTES?: string;
};

type UploadTicketPayload = {
  exp: number;
  originalFileName: string;
  uploadFolder: string;
  maxBytes?: number;
  metadataId?: string;
};

type ImgbedUploadResponse = {
  src?: string;
}[];

const UPLOAD_NAME_TYPE = "origin";
const RETURN_FORMAT = "full";
const AUTO_RETRY = "false";
const AUTH_PREFIX = "UploadTicket ";
const MAX_CLOCK_SKEW_SECONDS = 30;
const MAX_UPSTREAM_DIAGNOSTIC_BYTES = 16 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json(
        {
          ok: true,
          hasAllowedOrigins: Boolean(env.ALLOWED_ORIGINS),
        },
        200,
        cors,
      );
    }

    if (url.pathname !== "/upload") {
      return json({ error: "Not found" }, 404, cors);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, {
        ...cors,
        Allow: "POST, OPTIONS",
      });
    }

    if (!isOriginAllowed(request, env)) {
      return json({ error: "Origin is not allowed" }, 403, cors);
    }

    if (!request.body) {
      return json({ error: "Missing request body" }, 400, cors);
    }

    const envError = validateEnv(env);
    if (envError) {
      return json({ error: envError }, 500, cors);
    }

    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 415, cors);
    }

    const ticket = readUploadTicket(request);
    if (!ticket) {
      return json({ error: "Missing upload ticket" }, 401, cors);
    }

    const payload = await verifyUploadTicket(ticket, env.UPLOAD_TICKET_SECRET);
    if (!payload.ok) {
      return json({ error: payload.error }, 401, cors);
    }

    const sizeCheck = validateContentLength(request, env, payload.value);
    if (!sizeCheck.ok) {
      return json(
        {
          error: sizeCheck.error,
          contentLength: sizeCheck.contentLength,
          maxBytes: sizeCheck.maxBytes,
        },
        413,
        cors,
      );
    }

    const uploadUrl = buildImgbedUploadUrl(env, payload.value);
    const imgbedResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.IMGBED_TOKEN}`,
        "Content-Type": contentType,
      },
      body: request.body,
    });

    const requestId = crypto.randomUUID();
    const imgbedPayload = await readUpstreamPayload(imgbedResponse);
    const src = parseImgbedSrc(imgbedPayload.json);
    if (!imgbedResponse.ok || !src) {
      return json(
        {
          error: "Imgbed upload failed",
          requestId,
          upstream: {
            service: "imgbed",
            status: imgbedResponse.status,
            statusText: imgbedResponse.statusText,
            contentType: imgbedResponse.headers.get("Content-Type"),
            bodyTruncated: imgbedPayload.truncated,
            bodyJson: imgbedPayload.json,
            bodyText: imgbedPayload.text,
          },
          upload: {
            originalFileName: payload.value.originalFileName,
            uploadFolder: payload.value.uploadFolder,
            uploadNameType: UPLOAD_NAME_TYPE,
            returnFormat: RETURN_FORMAT,
            autoRetry: AUTO_RETRY,
          },
          expected: {
            responseShape: `[{ "src": "https://.../file/..." }]`,
          },
        },
        502,
        cors,
      );
    }

    let identity: { fileId: string; finalFileName: string };
    try {
      identity = extractFileIdentity(src, env.IMGBED_BASE_URL);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid imgbed upload response",
          requestId,
          upstream: {
            service: "imgbed",
            status: imgbedResponse.status,
            statusText: imgbedResponse.statusText,
            contentType: imgbedResponse.headers.get("Content-Type"),
            bodyTruncated: imgbedPayload.truncated,
            bodyJson: imgbedPayload.json,
            bodyText: imgbedPayload.text,
          },
        },
        502,
        cors,
      );
    }

    return json(
      {
        originalFileName: payload.value.originalFileName,
        finalFileName: identity.finalFileName,
        fileId: identity.fileId,
        fileUrl: src,
        metadataId: payload.value.metadataId,
      },
      200,
      cors,
    );
  },
} satisfies ExportedHandler<Env>;

function buildImgbedUploadUrl(env: Env, payload: UploadTicketPayload) {
  const url = new URL("/upload", env.IMGBED_BASE_URL);
  url.searchParams.set("uploadNameType", UPLOAD_NAME_TYPE);
  url.searchParams.set("returnFormat", RETURN_FORMAT);
  url.searchParams.set("uploadFolder", payload.uploadFolder);
  url.searchParams.set("autoRetry", AUTO_RETRY);
  return url;
}

function readUploadTicket(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith(AUTH_PREFIX)) {
    return authorization.slice(AUTH_PREFIX.length).trim();
  }

  return request.headers.get("X-Upload-Ticket")?.trim() ?? null;
}

async function verifyUploadTicket(
  token: string,
  secret: string,
): Promise<
  { ok: true; value: UploadTicketPayload } | { ok: false; error: string }
> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Malformed upload ticket" };
  }

  const [payloadPart, signaturePart] = parts;
  const expectedSignature = await hmacSha256(payloadPart, secret);
  let actualSignature: Uint8Array;
  try {
    actualSignature = base64UrlToBytes(signaturePart);
  } catch {
    return { ok: false, error: "Malformed upload ticket signature" };
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return { ok: false, error: "Invalid upload ticket signature" };
  }

  const parsed = parseTicketPayload(payloadPart);
  if (!parsed.ok) {
    return parsed;
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.value.exp + MAX_CLOCK_SKEW_SECONDS < now) {
    return { ok: false, error: "Upload ticket expired" };
  }

  return parsed;
}

function parseTicketPayload(
  payloadPart: string,
): { ok: true; value: UploadTicketPayload } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)));
  } catch {
    return { ok: false, error: "Invalid upload ticket payload" };
  }

  if (!value || typeof value !== "object") {
    return { ok: false, error: "Invalid upload ticket payload" };
  }

  const payload = value as Partial<UploadTicketPayload>;
  if (
    typeof payload.exp !== "number" ||
    typeof payload.originalFileName !== "string" ||
    typeof payload.uploadFolder !== "string" ||
    payload.originalFileName.length === 0 ||
    payload.uploadFolder.length === 0
  ) {
    return { ok: false, error: "Upload ticket missing required fields" };
  }

  if (
    payload.uploadFolder.includes("..") ||
    payload.uploadFolder.startsWith("/")
  ) {
    return { ok: false, error: "Invalid upload folder" };
  }

  if (
    payload.maxBytes !== undefined &&
    (!Number.isInteger(payload.maxBytes) || payload.maxBytes <= 0)
  ) {
    return { ok: false, error: "Invalid upload byte limit" };
  }

  return {
    ok: true,
    value: {
      exp: payload.exp,
      originalFileName: payload.originalFileName,
      uploadFolder: payload.uploadFolder,
      maxBytes: payload.maxBytes,
      metadataId: payload.metadataId,
    },
  };
}

function validateContentLength(
  request: Request,
  env: Env,
  ticket: UploadTicketPayload,
): { ok: true } | { ok: false; error: string; contentLength?: number; maxBytes?: number } {
  const contentLength = request.headers.get("Content-Length");
  if (!contentLength) return { ok: true };

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, error: "Invalid Content-Length" };
  }

  const dashboardLimit = env.MAX_UPLOAD_BYTES
    ? Number(env.MAX_UPLOAD_BYTES)
    : undefined;
  const limits = [ticket.maxBytes, dashboardLimit].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const maxBytes = limits.length ? Math.min(...limits) : undefined;

  if (maxBytes !== undefined && size > maxBytes) {
    return {
      ok: false,
      error: "Upload is too large",
      contentLength: size,
      maxBytes,
    };
  }

  return { ok: true };
}

function parseImgbedSrc(value: unknown) {
  if (!Array.isArray(value)) return null;

  const first = value[0] as Partial<ImgbedUploadResponse[number]> | undefined;
  return typeof first?.src === "string" && first.src.length > 0
    ? first.src
    : null;
}

async function readUpstreamPayload(response: Response) {
  const { text, truncated } = await readLimitedText(
    response,
    MAX_UPSTREAM_DIAGNOSTIC_BYTES,
  );
  const json = parseJsonOrNull(text);

  return {
    json,
    text,
    truncated,
  };
}

async function readLimitedText(response: Response, maxBytes: number) {
  if (!response.body) {
    return { text: "", truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (totalBytes + value.byteLength > maxBytes) {
      const remainingBytes = Math.max(0, maxBytes - totalBytes);
      if (remainingBytes > 0) {
        chunks.push(value.slice(0, remainingBytes));
        totalBytes += remainingBytes;
      }
      truncated = true;
      await reader.cancel();
      break;
    }

    chunks.push(value);
    totalBytes += value.byteLength;
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder().decode(bytes),
    truncated,
  };
}

function parseJsonOrNull(value: string) {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractFileIdentity(src: string, baseUrl: string) {
  const url = new URL(src, baseUrl);
  const marker = "/file/";

  if (!url.pathname.startsWith(marker)) {
    throw new Error(`Upload response did not return a /file/ URL: ${src}`);
  }

  const fileId = url.pathname
    .slice(marker.length)
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
  const finalFileName = fileId.split("/").at(-1);

  if (!finalFileName) {
    throw new Error(`Upload response did not include a final filename: ${src}`);
  }

  return { fileId, finalFileName };
}

async function hmacSha256(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return new Uint8Array(signature);
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let i = 0; i < maxLength; i += 1) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return mismatch === 0;
}

function buildCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = getAllowedOrigins(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Upload-Ticket",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "false";
  }

  return headers;
}

function isOriginAllowed(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  return getAllowedOrigins(env).includes(origin);
}

function getAllowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function validateEnv(env: Env) {
  if (!env.IMGBED_BASE_URL) return "Missing IMGBED_BASE_URL";
  if (!env.IMGBED_TOKEN) return "Missing IMGBED_TOKEN";
  if (!env.UPLOAD_TICKET_SECRET) return "Missing UPLOAD_TICKET_SECRET";
  if (!env.ALLOWED_ORIGINS) return "Missing ALLOWED_ORIGINS";
  return null;
}
