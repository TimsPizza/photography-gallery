import { StoredPhotoMetadata } from "@/contracts/photo";

export type TimelinePhotoLayout = {
  photo: StoredPhotoMetadata;
  width: number;
  height: number;
  emphasis: "quiet" | "standard" | "wide" | "feature";
};

export type TimelinePhotoRow = {
  key: string;
  gap: number;
  height: number;
  photos: TimelinePhotoLayout[];
};

const GRID_UNITS = 12;
const DEFAULT_GAP = 14;

export function calculateTimelineRows(
  photos: StoredPhotoMetadata[],
  containerWidth: number,
): TimelinePhotoRow[] {
  if (photos.length === 0) return [];

  const settings = getLayoutSettings(containerWidth);
  const unitWidth = containerWidth / GRID_UNITS;
  const rows: TimelinePhotoRow[] = [];
  let index = 0;

  while (index < photos.length) {
    const row = chooseBestRow(photos, index, containerWidth, unitWidth, settings);
    rows.push(row);
    index += row.photos.length;
  }

  return rows;
}

export function groupPhotosByMonth(photos: StoredPhotoMetadata[]) {
  const groups = new Map<string, StoredPhotoMetadata[]>();

  for (const photo of photos) {
    const date = getPhotoDate(photo);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = groups.get(key) ?? [];
    current.push(photo);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, groupPhotos]) => ({
    key,
    label: formatMonthLabel(getPhotoDate(groupPhotos[0])),
    photos: groupPhotos,
  }));
}

export function getPhotoDate(photo: StoredPhotoMetadata) {
  const value = photo.captureTime ?? photo.uploadTime;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(photo.uploadTime) : date;
}

function chooseBestRow(
  photos: StoredPhotoMetadata[],
  start: number,
  containerWidth: number,
  unitWidth: number,
  settings: ReturnType<typeof getLayoutSettings>,
) {
  let best: TimelinePhotoRow | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let candidates: RowCandidate[] = [];

  for (let end = start; end < photos.length; end += 1) {
    candidates = [
      ...candidates,
      createCandidate(photos[end], unitWidth, settings),
    ];

    const row = justifyCandidates(candidates, containerWidth, settings);
    if (!row) break;

    const score = scoreRow(row, settings, end === photos.length - 1);
    if (score < bestScore) {
      best = row;
      bestScore = score;
    }

    if (
      candidates.length >= settings.maxPhotosPerRow ||
      getMinimumRowWidth(candidates, settings.gap) > containerWidth
    ) {
      break;
    }
  }

  return best ?? justifyCandidates([createCandidate(photos[start], unitWidth, settings)], containerWidth, settings)!;
}

function justifyCandidates(
  candidates: RowCandidate[],
  containerWidth: number,
  settings: ReturnType<typeof getLayoutSettings>,
): TimelinePhotoRow | null {
  const gapWidth = settings.gap * Math.max(0, candidates.length - 1);
  const availableWidth = containerWidth - gapWidth;
  if (availableWidth <= 0) return null;

  const minWidth = candidates.reduce((sum, candidate) => sum + candidate.minWidth, 0);
  if (minWidth > availableWidth) return null;

  const basisWidth = candidates.reduce((sum, candidate) => sum + candidate.basisWidth, 0);
  const scale = availableWidth / basisWidth;

  const widths = distributeWidth(candidates, availableWidth, scale);
  const heights = widths.map((width, index) => width / candidates[index].photo.aspectRatio);
  const rowHeight = Math.min(
    settings.maxRowHeight,
    Math.max(settings.minRowHeight, average(heights)),
  );

  const normalizedWidths = candidates.map((candidate) => rowHeight * candidate.photo.aspectRatio);
  const correctedWidths = allocateAvailableWidth(candidates, normalizedWidths, availableWidth);

  return {
    key: candidates.map((candidate) => candidate.photo.fileId).join(":"),
    gap: settings.gap,
    height: rowHeight,
    photos: candidates.map((candidate, index) => ({
      photo: candidate.photo,
      width: correctedWidths[index],
      height: rowHeight,
      emphasis: getEmphasis(correctedWidths[index], containerWidth),
    })),
  };
}

function createCandidate(
  photo: StoredPhotoMetadata,
  unitWidth: number,
  settings: ReturnType<typeof getLayoutSettings>,
): RowCandidate {
  const idealWidth = photo.aspectRatio * settings.targetRowHeight;
  const unitWidthCeil = Math.ceil(idealWidth / unitWidth) * unitWidth;
  const minUnits = getMinimumUnits(photo);

  return {
    photo,
    basisWidth: Math.max(unitWidthCeil, minUnits * unitWidth),
    minWidth: minUnits * unitWidth,
  };
}

function distributeWidth(candidates: RowCandidate[], availableWidth: number, scale: number) {
  const widths = candidates.map((candidate) =>
    Math.max(candidate.minWidth, candidate.basisWidth * scale),
  );
  return correctRounding(widths, availableWidth);
}

function correctRounding(widths: number[], availableWidth: number) {
  const total = widths.reduce((sum, width) => sum + width, 0);
  const correction = availableWidth - total;
  const lastIndex = widths.length - 1;

  return widths.map((width, index) => (index === lastIndex ? width + correction : width));
}

function allocateAvailableWidth(
  candidates: RowCandidate[],
  desiredWidths: number[],
  availableWidth: number,
) {
  const minTotal = candidates.reduce((sum, candidate) => sum + candidate.minWidth, 0);
  const flexibleWidth = availableWidth - minTotal;
  if (flexibleWidth <= 0) {
    return candidates.map((candidate) => candidate.minWidth);
  }

  const desiredExtras = desiredWidths.map((width, index) =>
    Math.max(0, width - candidates[index].minWidth),
  );
  const desiredExtraTotal = desiredExtras.reduce((sum, width) => sum + width, 0);

  if (desiredExtraTotal === 0) {
    const evenExtra = flexibleWidth / candidates.length;
    return correctRounding(
      candidates.map((candidate) => candidate.minWidth + evenExtra),
      availableWidth,
    );
  }

  return correctRounding(
    candidates.map(
      (candidate, index) =>
        candidate.minWidth + (desiredExtras[index] / desiredExtraTotal) * flexibleWidth,
    ),
    availableWidth,
  );
}

function scoreRow(row: TimelinePhotoRow, settings: ReturnType<typeof getLayoutSettings>, isLastRow: boolean) {
  const heightError = Math.abs(row.height - settings.targetRowHeight) / settings.targetRowHeight;
  const countPenalty = row.photos.length === 1 && !isLastRow ? 0.7 : 0;
  const compressionPenalty = row.photos.some((item) => item.width / item.photo.aspectRatio < settings.minRowHeight)
    ? 0.3
    : 0;

  return heightError + countPenalty + compressionPenalty;
}

function getLayoutSettings(containerWidth: number) {
  if (containerWidth < 560) {
    return {
      gap: 10,
      targetRowHeight: 280,
      minRowHeight: 190,
      maxRowHeight: 420,
      maxPhotosPerRow: 1,
    };
  }

  if (containerWidth < 900) {
    return {
      gap: 12,
      targetRowHeight: 250,
      minRowHeight: 170,
      maxRowHeight: 360,
      maxPhotosPerRow: 3,
    };
  }

  return {
    gap: DEFAULT_GAP,
    targetRowHeight: Math.min(330, Math.max(240, containerWidth * 0.15)),
    minRowHeight: 180,
    maxRowHeight: 390,
    maxPhotosPerRow: 5,
  };
}

function getMinimumUnits(photo: StoredPhotoMetadata) {
  if (photo.orientation === "portrait") return 2;
  if (photo.orientation === "square") return 3;
  if (photo.aspectRatio >= 2) return 5;
  return 4;
}

function getMinimumRowWidth(candidates: RowCandidate[], gap: number) {
  return (
    candidates.reduce((sum, candidate) => sum + candidate.minWidth, 0) +
    gap * Math.max(0, candidates.length - 1)
  );
}

function getEmphasis(width: number, containerWidth: number): TimelinePhotoLayout["emphasis"] {
  const ratio = width / containerWidth;
  if (ratio > 0.76) return "feature";
  if (ratio > 0.48) return "wide";
  if (ratio < 0.26) return "quiet";
  return "standard";
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

type RowCandidate = {
  photo: StoredPhotoMetadata;
  basisWidth: number;
  minWidth: number;
};
