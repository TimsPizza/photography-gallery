import {
  ColorSpaceSample,
  FingerprintColor,
  PhotoColorFingerprint,
} from "@/contracts/photo";

export const MOOD_CLUSTER_VERSION = 1;
export const DEFAULT_MIN_MOOD_CLUSTER_PHOTOS = 3;

export type MoodPhotoInput = {
  fileId: string;
  colorFingerprint: PhotoColorFingerprint;
};

export type MoodClusterSlug =
  | "warm-film"
  | "golden-light"
  | "cool-blue"
  | "fresh-green"
  | "rain-gray"
  | "low-key-shadow"
  | "soft-white"
  | "muted-neutral"
  | "color-rich"
  | "monochrome";

export type MoodAssignment = {
  photoId: string;
  clusterId: string;
  version: typeof MOOD_CLUSTER_VERSION;
  confidence: number;
  distance: number;
};

export type MoodClusterCentroid = {
  oklab: ColorSpaceSample["oklab"];
  oklch: ColorSpaceSample["oklch"];
  brightness: number;
  saturation: number;
  warmth: number;
  contrast: number;
  colorfulness: number;
  meanChroma: number;
  monochromeScore: number;
  shadowShare: number;
  midtoneShare: number;
  highlightShare: number;
  hueHistogram: number[];
  lightnessHistogram: number[];
  chromaHistogram: number[];
};

export type MoodClusterResult = {
  id: string;
  version: typeof MOOD_CLUSTER_VERSION;
  name: string;
  slug: MoodClusterSlug;
  photoCount: number;
  centroid: MoodClusterCentroid;
  previewColors: string[];
  photoIds: string[];
};

export type MoodClassificationResult = {
  version: typeof MOOD_CLUSTER_VERSION;
  clusters: MoodClusterResult[];
  assignments: MoodAssignment[];
  skippedPhotos: number;
};

type MoodBucketDefinition = {
  name: string;
  slug: MoodClusterSlug;
  score: (fingerprint: PhotoColorFingerprint) => number;
};

type ScoredBucket = MoodBucketDefinition & {
  scoreValue: number;
};

type ClusterAccumulator = {
  definition: MoodBucketDefinition;
  photos: MoodPhotoInput[];
};

const MOOD_BUCKETS: MoodBucketDefinition[] = [
  {
    name: "Monochrome",
    slug: "monochrome",
    score: (fingerprint) =>
      1.15 * fingerprint.monochromeScore +
      0.35 * inverseScore(fingerprint.saturation, 0.28) +
      0.25 * inverseScore(fingerprint.meanChroma, 0.08),
  },
  {
    name: "Low-key Shadow",
    slug: "low-key-shadow",
    score: (fingerprint) =>
      1.1 * inverseScore(fingerprint.brightness, 0.42) +
      0.75 * fingerprint.shadowShare +
      0.25 * fingerprint.contrast +
      0.2 * inverseScore(fingerprint.highlightShare, 0.22),
  },
  {
    name: "Soft White",
    slug: "soft-white",
    score: (fingerprint) =>
      0.95 * rangeScore(fingerprint.brightness, 0.64, 1) +
      0.75 * fingerprint.highlightShare +
      0.35 * inverseScore(fingerprint.saturation, 0.34) +
      0.25 * inverseScore(fingerprint.contrast, 0.2),
  },
  {
    name: "Rain Gray",
    slug: "rain-gray",
    score: (fingerprint) =>
      0.72 * inverseScore(fingerprint.meanChroma, 0.09) +
      0.5 * inverseScore(fingerprint.saturation, 0.24) +
      0.42 * rangeScore(fingerprint.brightness, 0.34, 0.74) +
      0.25 * coolnessScore(fingerprint) +
      0.18 * fingerprint.midtoneShare,
  },
  {
    name: "Golden Light",
    slug: "golden-light",
    score: (fingerprint) =>
      0.76 * warmthScore(fingerprint) +
      0.62 * hueFamilyScore(fingerprint, 72, 58) +
      0.45 * rangeScore(fingerprint.brightness, 0.54, 0.95) +
      0.24 * rangeScore(fingerprint.meanChroma, 0.045, 0.19),
  },
  {
    name: "Warm Film",
    slug: "warm-film",
    score: (fingerprint) =>
      0.82 * warmthScore(fingerprint) +
      0.45 * hueFamilyScore(fingerprint, 34, 70) +
      0.35 * rangeScore(fingerprint.brightness, 0.3, 0.78) +
      0.24 * inverseScore(fingerprint.contrast, 0.34),
  },
  {
    name: "Fresh Green",
    slug: "fresh-green",
    score: (fingerprint) =>
      0.94 * hueFamilyScore(fingerprint, 136, 56) +
      0.42 * rangeScore(fingerprint.meanChroma, 0.055, 0.22) +
      0.32 * rangeScore(fingerprint.brightness, 0.36, 0.86) +
      0.16 * rangeScore(fingerprint.saturation, 0.18, 0.72),
  },
  {
    name: "Cool Blue",
    slug: "cool-blue",
    score: (fingerprint) =>
      0.82 * coolnessScore(fingerprint) +
      0.76 * Math.max(
        hueFamilyScore(fingerprint, 220, 64),
        hueFamilyScore(fingerprint, 190, 48),
      ) +
      0.32 * rangeScore(fingerprint.meanChroma, 0.04, 0.22),
  },
  {
    name: "Color Rich",
    slug: "color-rich",
    score: (fingerprint) =>
      0.76 * rangeScore(fingerprint.meanChroma, 0.105, 0.28) +
      0.58 * rangeScore(fingerprint.colorfulness, 0.16, 0.5) +
      0.42 * rangeScore(fingerprint.saturation, 0.42, 1) +
      0.2 * inverseScore(fingerprint.monochromeScore, 0.4),
  },
  {
    name: "Muted Neutral",
    slug: "muted-neutral",
    score: (fingerprint) =>
      0.55 +
      0.46 * inverseScore(fingerprint.meanChroma, 0.13) +
      0.38 * inverseScore(fingerprint.saturation, 0.32) +
      0.22 * rangeScore(fingerprint.brightness, 0.28, 0.82),
  },
];

export function classifyMoodPhotos(
  photos: MoodPhotoInput[],
): MoodClassificationResult {
  const clusters = new Map<MoodClusterSlug, ClusterAccumulator>();
  const assignments: MoodAssignment[] = [];
  let skippedPhotos = 0;

  for (const photo of photos) {
    if (!isClassifiableFingerprint(photo.colorFingerprint)) {
      skippedPhotos += 1;
      continue;
    }

    const [winner, runnerUp] = scoreBuckets(photo.colorFingerprint);
    const clusterId = getClusterId(winner.slug);
    const confidence = getConfidence(winner.scoreValue, runnerUp?.scoreValue ?? 0);

    assignments.push({
      photoId: photo.fileId,
      clusterId,
      version: MOOD_CLUSTER_VERSION,
      confidence,
      distance: roundMetric(1 - confidence),
    });

    const accumulator = clusters.get(winner.slug) ?? {
      definition: winner,
      photos: [],
    };
    accumulator.photos.push(photo);
    clusters.set(winner.slug, accumulator);
  }

  return {
    version: MOOD_CLUSTER_VERSION,
    clusters: Array.from(clusters.values())
      .map(createClusterResult)
      .sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name)),
    assignments,
    skippedPhotos,
  };
}

export function filterSufficientMoodClusters(
  clusters: MoodClusterResult[],
  minPhotos = DEFAULT_MIN_MOOD_CLUSTER_PHOTOS,
) {
  return clusters.filter((cluster) => cluster.photoCount >= minPhotos);
}

function scoreBuckets(fingerprint: PhotoColorFingerprint): ScoredBucket[] {
  return MOOD_BUCKETS.map((bucket) => ({
    ...bucket,
    scoreValue: bucket.score(fingerprint),
  })).sort((a, b) => b.scoreValue - a.scoreValue);
}

function createClusterResult({
  definition,
  photos,
}: ClusterAccumulator): MoodClusterResult {
  return {
    id: getClusterId(definition.slug),
    version: MOOD_CLUSTER_VERSION,
    name: definition.name,
    slug: definition.slug,
    photoCount: photos.length,
    centroid: calculateCentroid(photos.map((photo) => photo.colorFingerprint)),
    previewColors: getPreviewColors(photos.map((photo) => photo.colorFingerprint)),
    photoIds: photos.map((photo) => photo.fileId),
  };
}

function calculateCentroid(
  fingerprints: PhotoColorFingerprint[],
): MoodClusterCentroid {
  const primaryColors = fingerprints.map((fingerprint) =>
    getPrimaryColor(fingerprint),
  );
  const meanOklab = {
    l: average(primaryColors.map((color) => color.oklab.l)),
    a: average(primaryColors.map((color) => color.oklab.a)),
    b: average(primaryColors.map((color) => color.oklab.b)),
  };
  const meanOklch = {
    l: average(primaryColors.map((color) => color.oklch.l)),
    c: average(primaryColors.map((color) => color.oklch.c)),
    h: averageHue(primaryColors.map((color) => color.oklch.h)),
  };

  return {
    oklab: roundOklab(meanOklab),
    oklch: roundOklch(meanOklch),
    brightness: averageMetric(fingerprints, "brightness"),
    saturation: averageMetric(fingerprints, "saturation"),
    warmth: averageMetric(fingerprints, "warmth"),
    contrast: averageMetric(fingerprints, "contrast"),
    colorfulness: averageMetric(fingerprints, "colorfulness"),
    meanChroma: averageMetric(fingerprints, "meanChroma"),
    monochromeScore: averageMetric(fingerprints, "monochromeScore"),
    shadowShare: averageMetric(fingerprints, "shadowShare"),
    midtoneShare: averageMetric(fingerprints, "midtoneShare"),
    highlightShare: averageMetric(fingerprints, "highlightShare"),
    hueHistogram: averageHistograms(fingerprints.map((item) => item.hueHistogram)),
    lightnessHistogram: averageHistograms(
      fingerprints.map((item) => item.lightnessHistogram),
    ),
    chromaHistogram: averageHistograms(
      fingerprints.map((item) => item.chromaHistogram),
    ),
  };
}

function getPreviewColors(fingerprints: PhotoColorFingerprint[]) {
  const colors = new Map<string, number>();

  for (const fingerprint of fingerprints) {
    for (const color of fingerprint.dominantColors.slice(0, 3)) {
      colors.set(color.hex, (colors.get(color.hex) ?? 0) + color.percentage);
    }
  }

  return Array.from(colors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);
}

function getPrimaryColor(fingerprint: PhotoColorFingerprint): FingerprintColor {
  return fingerprint.dominantColors[0];
}

function isClassifiableFingerprint(fingerprint: PhotoColorFingerprint) {
  return fingerprint.version === 2 && fingerprint.dominantColors.length > 0;
}

function getClusterId(slug: MoodClusterSlug) {
  return `mood-v${MOOD_CLUSTER_VERSION}-${slug}`;
}

function getConfidence(winner: number, runnerUp: number) {
  const gap = Math.max(0, winner - runnerUp);
  const base = Math.min(1, winner / 2.2);
  return roundMetric(Math.max(0.35, Math.min(0.98, 0.42 + base * 0.38 + gap * 0.32)));
}

function hueFamilyScore(
  fingerprint: PhotoColorFingerprint,
  centerHue: number,
  width: number,
) {
  const dominant = getPrimaryColor(fingerprint).oklch;
  const dominantScore =
    dominant.h === null ? 0 : circularRangeScore(dominant.h, centerHue, width);
  const histogramScore = getHueHistogramScore(
    fingerprint.hueHistogram,
    centerHue,
    width,
  );

  return Math.max(dominantScore, histogramScore);
}

function getHueHistogramScore(
  histogram: number[],
  centerHue: number,
  width: number,
) {
  if (histogram.length === 0) return 0;

  return histogram.reduce((score, share, index) => {
    const hue = ((index + 0.5) / histogram.length) * 360;
    return score + share * circularRangeScore(hue, centerHue, width);
  }, 0);
}

function circularRangeScore(value: number, center: number, width: number) {
  const distance = Math.abs((((value - center + 540) % 360) - 180));
  return Math.max(0, 1 - distance / width);
}

function warmthScore(fingerprint: PhotoColorFingerprint) {
  return rangeScore(fingerprint.warmth, 0.5, 0.78);
}

function coolnessScore(fingerprint: PhotoColorFingerprint) {
  return inverseScore(fingerprint.warmth, 0.5);
}

function rangeScore(value: number, low: number, high: number) {
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

function inverseScore(value: number, high: number) {
  if (value <= 0) return 1;
  if (value >= high) return 0;
  return 1 - value / high;
}

function averageMetric(
  fingerprints: PhotoColorFingerprint[],
  key:
    | "brightness"
    | "saturation"
    | "warmth"
    | "contrast"
    | "colorfulness"
    | "meanChroma"
    | "monochromeScore"
    | "shadowShare"
    | "midtoneShare"
    | "highlightShare",
) {
  return roundMetric(average(fingerprints.map((fingerprint) => fingerprint[key])));
}

function averageHistograms(histograms: number[][]) {
  const maxLength = Math.max(0, ...histograms.map((histogram) => histogram.length));
  if (maxLength === 0) return [];

  return Array.from({ length: maxLength }, (_, index) =>
    roundMetric(
      average(histograms.map((histogram) => histogram[index] ?? 0)),
    ),
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageHue(values: Array<number | null>) {
  const hues = values.filter((value): value is number => value !== null);
  if (hues.length === 0) return null;

  const radians = hues.map((hue) => (hue / 180) * Math.PI);
  const x = average(radians.map(Math.cos));
  const y = average(radians.map(Math.sin));
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;

  return roundMetric((degrees + 360) % 360);
}

function roundOklab(value: ColorSpaceSample["oklab"]) {
  return {
    l: roundMetric(value.l),
    a: roundMetric(value.a),
    b: roundMetric(value.b),
  };
}

function roundOklch(value: ColorSpaceSample["oklch"]) {
  return {
    l: roundMetric(value.l),
    c: roundMetric(value.c),
    h: value.h === null ? null : roundMetric(value.h),
  };
}

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}
