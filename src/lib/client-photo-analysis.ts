"use client";

import {
  ColorSpaceSample,
  DominantColorRole,
  ExifMetadata,
  PhotoColorFingerprint,
  PhotoUploadMetadata,
} from "@/lib/photo-metadata";
import { converter } from "culori";
import exifr from "exifr";

const ANALYSIS_SIZE = 384;
const FINGERPRINT_ALGORITHM_VERSION = 2;
const DOMINANT_COLOR_LIMIT = 6;
const RGB_BUCKET_SIZE = 16;
const MIN_REPRESENTATIVE_COLOR_SHARE = 0.025;
const COLOR_CLIFF_RATIO = 0.28;
const HUE_BINS = 24;
const LIGHTNESS_BINS = 12;
const CHROMA_BINS = 12;
const CHROMA_HISTOGRAM_MAX = 0.4;

type ParsedExifMetadata = ExifMetadata & {
  captureTime: string | null;
};

type PixelSample = {
  r: number;
  g: number;
  b: number;
  brightness: number;
  saturation: number;
  warmth: number;
  chroma: number;
  hue: number | null;
  lightness: number;
};

type ColorBucket = {
  count: number;
  r: number;
  g: number;
  b: number;
};

type CuloriColor = {
  mode: string;
  r?: number;
  g?: number;
  b?: number;
  h?: number;
  s?: number;
  l?: number;
  a?: number;
  c?: number;
};

const toHsl = converter("hsl") as (color: CuloriColor) => CuloriColor;
const toOklab = converter("oklab") as (color: CuloriColor) => CuloriColor;
const toOklch = converter("oklch") as (color: CuloriColor) => CuloriColor;

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
  const samples: PixelSample[] = [];
  const buckets = new Map<string, ColorBucket>();
  const hueHistogram = createHistogram(HUE_BINS);
  const lightnessHistogram = createHistogram(LIGHTNESS_BINS);
  const chromaHistogram = createHistogram(CHROMA_BINS);

  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  let warmthTotal = 0;
  let chromaTotal = 0;
  let rgVarianceTotal = 0;
  let ybVarianceTotal = 0;
  let shadowCount = 0;
  let midtoneCount = 0;
  let highlightCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 16) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const color = createColorSample(r, g, b);
    const stats = rgbStats(r, g, b);
    const sample: PixelSample = {
      r,
      g,
      b,
      brightness: stats.brightness,
      saturation: stats.saturation,
      warmth: (r - b + 255) / 510,
      chroma: color.oklch.c,
      hue: color.oklch.h,
      lightness: color.oklch.l,
    };

    samples.push(sample);
    addToBucket(buckets, r, g, b);
    addHistogramValue(lightnessHistogram, sample.lightness);
    addHistogramValue(
      chromaHistogram,
      Math.min(1, sample.chroma / CHROMA_HISTOGRAM_MAX),
    );
    if (sample.hue !== null && sample.chroma > 0.015) {
      addHistogramValue(hueHistogram, sample.hue / 360);
    }

    rTotal += r;
    gTotal += g;
    bTotal += b;
    brightnessTotal += sample.brightness;
    saturationTotal += sample.saturation;
    warmthTotal += sample.warmth;
    chromaTotal += sample.chroma;
    rgVarianceTotal += (r - g) ** 2;
    ybVarianceTotal += ((r + g) / 2 - b) ** 2;

    if (sample.lightness < 0.28) {
      shadowCount += 1;
    } else if (sample.lightness > 0.78) {
      highlightCount += 1;
    } else {
      midtoneCount += 1;
    }
  }

  if (samples.length === 0) {
    throw new Error("Photo contains no readable pixels.");
  }

  const count = samples.length;
  const averageColor = createColorSample(
    rTotal / count,
    gTotal / count,
    bTotal / count,
  );
  const medianColor = getMedianLightnessColor(samples);
  const brightness = brightnessTotal / count;
  const saturation = saturationTotal / count;
  const warmth = warmthTotal / count;
  const meanChroma = chromaTotal / count;
  const brightnessVariance =
    samples.reduce(
      (sum, sample) => sum + (sample.brightness - brightness) ** 2,
      0,
    ) / count;
  const colorfulness =
    (Math.sqrt(rgVarianceTotal / count) + Math.sqrt(ybVarianceTotal / count)) /
    255;

  return {
    version: FINGERPRINT_ALGORITHM_VERSION,
    dominantColors: buildDominantColors(buckets, count),
    averageColor,
    medianColor,
    brightness: roundMetric(brightness),
    saturation: roundMetric(saturation),
    contrast: roundMetric(Math.sqrt(brightnessVariance)),
    warmth: roundMetric(warmth),
    colorfulness: roundMetric(colorfulness),
    meanChroma: roundMetric(meanChroma),
    monochromeScore: roundMetric(getMonochromeScore(saturation, meanChroma)),
    shadowShare: roundMetric(shadowCount / count),
    midtoneShare: roundMetric(midtoneCount / count),
    highlightShare: roundMetric(highlightCount / count),
    temperature: getTemperature(warmth),
    tonalKey: getTonalKey(brightness),
    saturationKey: getSaturationKey(saturation, meanChroma),
    hueHistogram: normalizeHistogram(hueHistogram),
    lightnessHistogram: normalizeHistogram(lightnessHistogram),
    chromaHistogram: normalizeHistogram(chromaHistogram),
    algorithm: {
      name: "canvas-oklch-bucket",
      version: FINGERPRINT_ALGORITHM_VERSION,
      resizedMaxDimension: ANALYSIS_SIZE,
      bucketSize: RGB_BUCKET_SIZE,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function readExifMetadata(file: File): Promise<ParsedExifMetadata> {
  const metadata = (await exifr.parse(file, {
    pick: [
      "Make",
      "Model",
      "LensModel",
      "Lens",
      "ISO",
      "FNumber",
      "ExposureTime",
      "FocalLength",
      "DateTimeOriginal",
      "CreateDate",
    ],
    tiff: true,
    exif: true,
    gps: false,
    xmp: false,
    icc: false,
    iptc: false,
    mergeOutput: true,
  }).catch(() => null)) as ExifPayload | null;

  if (!metadata) {
    return { captureTime: null };
  }

  const make = stringifyExifValue(metadata.Make);
  const model = stringifyExifValue(metadata.Model);

  return {
    captureTime: parseExifDate(metadata.DateTimeOriginal ?? metadata.CreateDate),
    camera: [make, model].filter(Boolean).join(" ").trim() || undefined,
    lens:
      stringifyExifValue(metadata.LensModel) ??
      stringifyExifValue(metadata.Lens),
    iso: toPositiveInteger(metadata.ISO),
    aperture: formatFNumber(toNumber(metadata.FNumber)),
    shutter: formatShutter(toNumber(metadata.ExposureTime)),
    focalLength: formatFocalLength(toNumber(metadata.FocalLength)),
  };
}

function buildDominantColors(
  buckets: Map<string, ColorBucket>,
  totalCount: number,
) {
  const colors = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .map((bucket, index) => ({
      ...createColorSample(
        bucket.r / bucket.count,
        bucket.g / bucket.count,
        bucket.b / bucket.count,
      ),
      percentage: Number((bucket.count / totalCount).toFixed(4)),
      role: dominantColorRole(index),
    }));

  return trimDominantColors(colors);
}

function createColorSample(r: number, g: number, b: number): ColorSpaceSample {
  const rgb = {
    r: clamp255(r),
    g: clamp255(g),
    b: clamp255(b),
  };
  const input = {
    mode: "rgb",
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  };
  const hsl = toHsl(input);
  const oklab = toOklab(input);
  const oklch = toOklch(input);

  return {
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    hsl: {
      h: normalizeHue(hsl.h),
      s: roundMetric(hsl.s ?? 0),
      l: roundMetric(hsl.l ?? 0),
    },
    oklab: {
      l: roundMetric(oklab.l ?? 0),
      a: roundMetric(oklab.a ?? 0),
      b: roundMetric(oklab.b ?? 0),
    },
    oklch: {
      l: roundMetric(oklch.l ?? 0),
      c: roundMetric(oklch.c ?? 0),
      h: normalizeHue(oklch.h),
    },
  };
}

function addToBucket(
  buckets: Map<string, ColorBucket>,
  r: number,
  g: number,
  b: number,
) {
  const key = [
    quantizeChannel(r),
    quantizeChannel(g),
    quantizeChannel(b),
  ].join(",");
  const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };

  bucket.count += 1;
  bucket.r += r;
  bucket.g += g;
  bucket.b += b;
  buckets.set(key, bucket);
}

function getMedianLightnessColor(samples: PixelSample[]) {
  const sorted = [...samples].sort((a, b) => a.lightness - b.lightness);
  const median = sorted[Math.floor(sorted.length / 2)];
  return createColorSample(median.r, median.g, median.b);
}

function createHistogram(size: number) {
  return Array.from({ length: size }, () => 0);
}

function addHistogramValue(histogram: number[], normalizedValue: number) {
  const index = Math.min(
    histogram.length - 1,
    Math.max(0, Math.floor(normalizedValue * histogram.length)),
  );
  histogram[index] += 1;
}

function normalizeHistogram(histogram: number[]) {
  const total = histogram.reduce((sum, value) => sum + value, 0);
  if (total === 0) return histogram;
  return histogram.map((value) => roundMetric(value / total));
}

function trimDominantColors(
  colors: {
    hex: string;
    rgb: ColorSpaceSample["rgb"];
    hsl: ColorSpaceSample["hsl"];
    oklab: ColorSpaceSample["oklab"];
    oklch: ColorSpaceSample["oklch"];
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
  const tags = [orientation, fingerprint.temperature, fingerprint.tonalKey];

  if (fingerprint.saturationKey !== "balanced") {
    tags.push(fingerprint.saturationKey);
  }
  if (fingerprint.monochromeScore > 0.72) tags.push("monochrome");
  if (fingerprint.brightness < 0.28) tags.push("low-key-shadow");
  if (fingerprint.brightness > 0.74) tags.push("soft-white");
  if (fingerprint.warmth > 0.58) tags.push("warm-film");
  if (fingerprint.warmth < 0.42) tags.push("cool-blue");
  if (fingerprint.contrast > 0.24) tags.push("high-contrast");
  if (fingerprint.meanChroma > 0.12) tags.push("color-rich");

  const dominantHue = fingerprint.dominantColors[0]?.oklch.h;
  const hueTag = dominantHue === null ? null : getHueFamilyTag(dominantHue);
  if (hueTag) tags.push(hueTag);

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

function getMonochromeScore(saturation: number, meanChroma: number) {
  const saturationScore = 1 - Math.min(1, saturation / 0.22);
  const chromaScore = 1 - Math.min(1, meanChroma / 0.08);
  return Math.max(0, Math.min(1, (saturationScore + chromaScore) / 2));
}

function getTemperature(warmth: number) {
  if (warmth >= 0.56) return "warm";
  if (warmth <= 0.44) return "cool";
  return "neutral";
}

function getTonalKey(brightness: number) {
  if (brightness <= 0.33) return "low-key";
  if (brightness >= 0.72) return "high-key";
  return "mid-key";
}

function getSaturationKey(saturation: number, meanChroma: number) {
  if (saturation <= 0.18 || meanChroma <= 0.035) return "muted";
  if (saturation >= 0.48 || meanChroma >= 0.11) return "vibrant";
  return "balanced";
}

function getHueFamilyTag(hue: number) {
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 80) return "yellow";
  if (hue < 165) return "green";
  if (hue < 205) return "cyan";
  if (hue < 265) return "blue";
  if (hue < 315) return "purple";
  return "pink";
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

function parseExifDate(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return stripTimezone(value.toISOString());
  }

  if (typeof value !== "string") return null;

  const exifDate = value.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (exifDate) {
    const [, year, month, day, hour, minute, second] = exifDate;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : stripTimezone(parsed.toISOString());
}

function stripTimezone(isoString: string) {
  return isoString.replace(/\.\d{3}Z$/, "");
}

function stringifyExifValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toPositiveInteger(value: unknown) {
  const number = toNumber(value);
  return number && number > 0 ? Math.round(number) : undefined;
}

function quantizeChannel(value: number) {
  return Math.round(value / RGB_BUCKET_SIZE) * RGB_BUCKET_SIZE;
}

function normalizeHue(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return null;
  return roundMetric(((value % 360) + 360) % 360);
}

function clamp255(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp255(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}

type ExifPayload = {
  Make?: unknown;
  Model?: unknown;
  LensModel?: unknown;
  Lens?: unknown;
  ISO?: unknown;
  FNumber?: unknown;
  ExposureTime?: unknown;
  FocalLength?: unknown;
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
};
