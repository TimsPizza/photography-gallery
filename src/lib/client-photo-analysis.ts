"use client";

import {
  DominantColorRole,
  ExifMetadata,
  PhotoColorFingerprint,
  PhotoUploadMetadata,
} from "@/lib/photo-metadata";

const JPEG_SOI = 0xffd8;
const EXIF_HEADER = "Exif\0\0";
const ANALYSIS_SIZE = 192;
const DOMINANT_COLOR_LIMIT = 5;
const MIN_REPRESENTATIVE_COLOR_SHARE = 0.05;
const COLOR_CLIFF_RATIO = 0.4;

type ParsedExifMetadata = ExifMetadata & {
  captureTime: string | null;
};

export async function analyzePhotoFile(
  file: File,
): Promise<PhotoUploadMetadata> {
  const [image, exif] = await Promise.all([
    createImageBitmap(file),
    readExifMetadata(file),
  ]);

  const width = image.width;
  const height = image.height;
  const fingerprint = extractColorFingerprint(image);
  image.close();

  const aspectRatio = Number((width / height).toFixed(4));
  const orientation =
    Math.abs(width - height) <= 2
      ? "square"
      : width > height
        ? "landscape"
        : "portrait";

  return {
    originalFileName: file.name,
    captureTime: exif.captureTime,
    uploadTime: new Date().toISOString(),
    width,
    height,
    aspectRatio,
    orientation,
    exif: omitEmptyExif(exif),
    colorFingerprint: fingerprint,
    colorTags: buildColorTags(fingerprint, orientation),
  };
}

export async function encodeToWebP(
  file: File,
  newNameOverride?: string,
): Promise<File> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  const MAX_DIMENSION = 1080;
  let scale = 1;
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
    scale = Math.min(MAX_DIMENSION / image.width, MAX_DIMENSION / image.height);
  }

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context unavailable for WebP encoding.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode WebP."));
          return;
        }
        const newName =
          newNameOverride || file.name.replace(/\.[^/.]+$/, "") + ".webp";
        resolve(new File([blob], newName, { type: "image/webp" }));
      },
      "image/webp",
      0.75,
    );
  });
}

function extractColorFingerprint(image: ImageBitmap): PhotoColorFingerprint {
  const scale = Math.min(
    1,
    ANALYSIS_SIZE / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  } as CanvasRenderingContext2DSettings) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;

  if (!context) {
    throw new Error("Canvas is unavailable for photo analysis.");
  }

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const buckets = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();

  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  let warmthTotal = 0;
  const brightnessValues: number[] = [];
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 16) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const { brightness, saturation } = rgbStats(r, g, b);
    const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${
      Math.round(b / 24) * 24
    }`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };

    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);

    rTotal += r;
    gTotal += g;
    bTotal += b;
    brightnessTotal += brightness;
    saturationTotal += saturation;
    warmthTotal += (r - b + 255) / 510;
    brightnessValues.push(brightness);
    count += 1;
  }

  if (count === 0) {
    throw new Error("Photo contains no readable pixels.");
  }

  const averageColor = rgbToHex(rTotal / count, gTotal / count, bTotal / count);
  const brightness = brightnessTotal / count;
  const saturation = saturationTotal / count;
  const warmth = warmthTotal / count;
  const variance =
    brightnessValues.reduce(
      (sum, value) => sum + (value - brightness) ** 2,
      0,
    ) / brightnessValues.length;

  const dominantColors = trimDominantColors(
    Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .map((bucket, index) => ({
      color: rgbToHex(
        bucket.r / bucket.count,
        bucket.g / bucket.count,
        bucket.b / bucket.count,
      ),
      percentage: Number((bucket.count / count).toFixed(4)),
      role: dominantColorRole(index),
    })),
  );

  return {
    dominantColors,
    averageColor,
    brightness: roundMetric(brightness),
    saturation: roundMetric(saturation),
    contrast: roundMetric(Math.sqrt(variance)),
    warmth: roundMetric(warmth),
  };
}

async function readExifMetadata(file: File): Promise<ParsedExifMetadata> {
  if (!["image/jpeg", "image/jpg"].includes(file.type.toLowerCase())) {
    return { captureTime: null };
  }

  const buffer = await file.slice(0, 256 * 1024).arrayBuffer();
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0, false) !== JPEG_SOI) {
    return { captureTime: null };
  }

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;

    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2, false);
    if (
      marker === 0xe1 &&
      readAscii(view, offset + 4, EXIF_HEADER.length) === EXIF_HEADER
    ) {
      return parseExifTiff(view, offset + 10);
    }

    offset += 2 + size;
  }

  return { captureTime: null };
}

function parseExifTiff(
  view: DataView,
  tiffOffset: number,
): ParsedExifMetadata {
  const littleEndian = readAscii(view, tiffOffset, 2) === "II";
  const firstIfdOffset = readUint32(view, tiffOffset + 4, littleEndian);
  const root = readIfd(
    view,
    tiffOffset,
    tiffOffset + firstIfdOffset,
    littleEndian,
  );
  const exifOffset = readNumericTag(root, 0x8769);
  const exif = exifOffset
    ? readIfd(view, tiffOffset, tiffOffset + exifOffset, littleEndian)
    : new Map();

  const make = readStringTag(view, tiffOffset, root, 0x010f);
  const model = readStringTag(view, tiffOffset, root, 0x0110);
  const lens = readStringTag(view, tiffOffset, exif, 0xa434);
  const captureRaw =
    readStringTag(view, tiffOffset, exif, 0x9003) ??
    readStringTag(view, tiffOffset, exif, 0x9004);

  return {
    captureTime: parseExifDate(captureRaw),
    camera: [make, model].filter(Boolean).join(" ").trim() || undefined,
    lens,
    iso: readNumericTag(exif, 0x8827),
    aperture: formatFNumber(
      readRationalTag(view, tiffOffset, exif, 0x829d, littleEndian),
    ),
    shutter: formatShutter(
      readRationalTag(view, tiffOffset, exif, 0x829a, littleEndian),
    ),
    focalLength: formatFocalLength(
      readRationalTag(view, tiffOffset, exif, 0x920a, littleEndian),
    ),
  };
}

function readIfd(
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
): Map<
  number,
  { type: number; count: number; valueOffset: number; entryOffset: number }
> {
  const entries = new Map<
    number,
    { type: number; count: number; valueOffset: number; entryOffset: number }
  >();
  if (ifdOffset + 2 > view.byteLength) return entries;

  const count = readUint16(view, ifdOffset, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = readUint16(view, entryOffset, littleEndian);
    const type = readUint16(view, entryOffset + 2, littleEndian);
    const valueCount = readUint32(view, entryOffset + 4, littleEndian);
    const valueOffset = readUint32(view, entryOffset + 8, littleEndian);
    entries.set(tag, {
      type,
      count: valueCount,
      valueOffset,
      entryOffset: entryOffset + 8,
    });
  }

  return entries;
}

function readStringTag(
  view: DataView,
  tiffOffset: number,
  tags: Map<
    number,
    { type: number; count: number; valueOffset: number; entryOffset: number }
  >,
  tag: number,
): string | undefined {
  const entry = tags.get(tag);
  if (!entry || entry.type !== 2 || entry.count === 0) return undefined;

  const offset =
    entry.count <= 4 ? entry.entryOffset : tiffOffset + entry.valueOffset;
  if (offset + entry.count > view.byteLength) return undefined;

  return (
    readAscii(view, offset, entry.count).replace(/\0+$/, "").trim() || undefined
  );
}

function readNumericTag(
  tags: Map<
    number,
    { type: number; count: number; valueOffset: number; entryOffset: number }
  >,
  tag: number,
): number | undefined {
  const entry = tags.get(tag);
  if (!entry) return undefined;
  return entry.valueOffset;
}

function readRationalTag(
  view: DataView,
  tiffOffset: number,
  tags: Map<
    number,
    { type: number; count: number; valueOffset: number; entryOffset: number }
  >,
  tag: number,
  littleEndian: boolean,
): number | undefined {
  const entry = tags.get(tag);
  if (!entry || entry.type !== 5 || entry.count < 1) return undefined;

  const offset = tiffOffset + entry.valueOffset;
  if (offset + 8 > view.byteLength) return undefined;

  const numerator = readUint32(view, offset, littleEndian);
  const denominator = readUint32(view, offset + 4, littleEndian);
  return denominator === 0 ? undefined : numerator / denominator;
}

function parseExifDate(value?: string): string | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function formatFNumber(value?: number): string | undefined {
  return value ? `f/${Number(value.toFixed(1))}` : undefined;
}

function formatShutter(value?: number): string | undefined {
  if (!value) return undefined;
  return value >= 1
    ? `${Number(value.toFixed(2))}s`
    : `1/${Math.round(1 / value)}s`;
}

function formatFocalLength(value?: number): string | undefined {
  return value ? `${Math.round(value)}mm` : undefined;
}

function trimDominantColors(
  colors: {
    color: string;
    percentage: number;
    role: DominantColorRole;
  }[],
) {
  const trimmed: typeof colors = [];

  for (const color of colors) {
    const previous = trimmed[trimmed.length - 1];
    if (
      previous &&
      color.percentage < MIN_REPRESENTATIVE_COLOR_SHARE &&
      color.percentage / previous.percentage < COLOR_CLIFF_RATIO
    ) {
      break;
    }

    trimmed.push({
      ...color,
      role: dominantColorRole(trimmed.length),
    });

    if (trimmed.length >= DOMINANT_COLOR_LIMIT) break;
  }

  return trimmed.length > 0 ? trimmed : colors.slice(0, 1);
}

function buildColorTags(
  fingerprint: PhotoColorFingerprint,
  orientation: string,
): string[] {
  const tags = [orientation];

  if (fingerprint.brightness < 0.28) tags.push("low-key-shadow");
  if (fingerprint.brightness > 0.74) tags.push("soft-white");
  if (fingerprint.saturation < 0.16) tags.push("muted-gray");
  if (fingerprint.warmth > 0.58) tags.push("warm-film");
  if (fingerprint.warmth < 0.42) tags.push("cool-blue");
  if (fingerprint.contrast > 0.24) tags.push("high-contrast");

  return Array.from(new Set(tags));
}

function omitEmptyExif(exif: ParsedExifMetadata) {
  const { captureTime, ...displayExif } = exif;
  void captureTime;
  return displayExif;
}

function dominantColorRole(index: number): DominantColorRole {
  if (index === 0) return "dominant";
  if (index === 1) return "secondary";
  return "accent";
}

function rgbStats(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;

  return { brightness, saturation };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}

function readAscii(view: DataView, offset: number, length: number) {
  let output = "";
  for (let i = 0; i < length && offset + i < view.byteLength; i += 1) {
    output += String.fromCharCode(view.getUint8(offset + i));
  }
  return output;
}

function readUint16(view: DataView, offset: number, littleEndian: boolean) {
  return offset + 2 <= view.byteLength
    ? view.getUint16(offset, littleEndian)
    : 0;
}

function readUint32(view: DataView, offset: number, littleEndian: boolean) {
  return offset + 4 <= view.byteLength
    ? view.getUint32(offset, littleEndian)
    : 0;
}
