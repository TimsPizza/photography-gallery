"use client";

/* eslint-disable @next/next/no-img-element */

import { PhotoWall } from "@/app/photo-wall";
import CircularGallery from "@/components/CircularGallery";
import FluidGlass from "@/components/FluidGlass";
import Stack from "@/components/Stack";
import {
  moodClusterListResponseSchema,
  type MoodCluster,
  type StoredPhotoMetadata,
} from "@/contracts/photo";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

type GalleryShellProps = {
  initialPhotos: StoredPhotoMetadata[];
};

type GalleryMode = "timeline" | "mood";

const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    transition: { delay: 0.24, duration: 0.34, ease: "easeIn" as const },
  },
};

const moodContentVariants: Variants = {
  initial: { opacity: 0, y: 34 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.5, duration: 0.48, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: 24,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

const moodGridVariants: Variants = {
  initial: {},
  animate: {
    transition: { delayChildren: 0.58, staggerChildren: 0.065 },
  },
  exit: {
    transition: { staggerChildren: 0.035, staggerDirection: -1 },
  },
};

const moodItemVariants: Variants = {
  initial: { opacity: 0, y: 42, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: 28,
    scale: 0.97,
    transition: { duration: 0.18, ease: "easeIn" as const },
  },
};

type DisplayMoodCluster = Pick<
  MoodCluster,
  "id" | "name" | "slug" | "photoCount" | "previewColors" | "photoIds"
> & {
  photos: Array<{
    fileId: string;
    thumbnailFileUrl: string;
    originalFileName: string;
  }>;
};

export function GalleryShell({ initialPhotos }: GalleryShellProps) {
  const [mode, setMode] = useState<GalleryMode>("timeline");
  const [moodClusters, setMoodClusters] = useState<DisplayMoodCluster[]>([]);
  const [openMoodId, setOpenMoodId] = useState<string | null>(null);
  const hasRequestedMoodRef = useRef(false);

  useEffect(() => {
    if (mode === "mood") {
      document.body.setAttribute("data-mood-mode", "true");
    } else {
      document.body.removeAttribute("data-mood-mode");
    }

    return () => {
      document.body.removeAttribute("data-mood-mode");
    };
  }, [mode]);

  useEffect(() => {
    if (
      mode !== "mood" ||
      moodClusters.length > 0 ||
      hasRequestedMoodRef.current
    ) {
      return;
    }

    let isMounted = true;
    hasRequestedMoodRef.current = true;

    fetch("/api/mood/clusters?minPhotos=1")
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(getResponseError(json, response.status));
        }
        return moodClusterListResponseSchema.parse(json).clusters;
      })
      .then((clusters) => {
        if (!isMounted) return;
        const nextClusters =
          clusters.length > 0
            ? clusters.map(toDisplayMoodCluster)
            : buildLocalMoodClusters(initialPhotos);
        setMoodClusters(nextClusters);
      })
      .catch((error) => {
        console.warn("Falling back to local mood groups:", error);
        if (!isMounted) return;
        const nextClusters = buildLocalMoodClusters(initialPhotos);
        setMoodClusters(nextClusters);
      });

    return () => {
      isMounted = false;
    };
  }, [initialPhotos, mode, moodClusters.length]);

  const openMood = useMemo(
    () => moodClusters.find((cluster) => cluster.id === openMoodId) ?? null,
    [openMoodId, moodClusters],
  );
  const openMoodPhotos = useMemo(
    () => getMoodPhotos(openMood, initialPhotos),
    [initialPhotos, openMood],
  );

  return (
    <main className="gallery-shell">
      <FluidGlass
        className="gallery-topbar absolute top-2 left-1/2 z-10 w-[90vw] -translate-x-1/2 rounded-full"
        mode="bar"
        barProps={{
          scale: 0.17,
          thickness: mode === "mood" ? 14 : 10,
          chromaticAberration: mode === "mood" ? 0.12 : 0.07,
          attenuationDistance: mode === "mood" ? 0.18 : 0.26,
        }}
      >
        <button
          className="gallery-brand"
          type="button"
          onClick={() => {
            setMode("timeline");
            setOpenMoodId(null);
          }}
        >
          Photo Wall
        </button>
        <nav aria-label="Gallery modes">
          <button
            type="button"
            data-active={mode === "timeline"}
            onClick={() => {
              setMode("timeline");
              setOpenMoodId(null);
            }}
          >
            Timeline
          </button>
          <button
            type="button"
            data-active={mode === "mood"}
            onClick={() => setMode("mood")}
          >
            Mood
          </button>
          <button type="button">Tags</button>
          <button type="button">Albums</button>
        </nav>
      </FluidGlass>

      <section className="gallery-stage" id="timeline">
        <PhotoWall photos={initialPhotos} />
      </section>

      <AnimatePresence>
        {mode === "mood" && (
          <motion.section
            className="mood-overlay"
            aria-label="Mood mode"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => openMoodId && setOpenMoodId(null)}
          >
            <div className="mood-overlay-inner">
              <AnimatePresence mode="wait">
                {!openMood && (
                  <motion.div
                    className="mood-grid-panel"
                    key="mood-grid"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <motion.div
                      className="mood-heading"
                      variants={moodContentVariants}
                    >
                      <p className="eyebrow">Mood</p>
                      <h1>Color groups</h1>
                    </motion.div>
                    <motion.div
                      className="mood-cluster-grid"
                      variants={moodGridVariants}
                    >
                      {moodClusters.length === 0 && (
                        <motion.span
                          className="mood-loading"
                          variants={moodItemVariants}
                        >
                          No mood groups yet
                        </motion.span>
                      )}
                      {moodClusters.map((cluster) => (
                        <motion.button
                          className="mood-stack-item"
                          key={cluster.id}
                          type="button"
                          variants={moodItemVariants}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMoodId(cluster.id);
                          }}
                        >
                          <Stack
                            cards={getStackCards(cluster, initialPhotos)}
                          />
                          <span className="mood-swatch-row">
                            {cluster.previewColors.slice(0, 5).map((color) => (
                              <span
                                key={`${cluster.id}:${color}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </span>
                          <strong>{cluster.name}</strong>
                          <small>{cluster.photoCount} photos</small>
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {openMood && (
                  <motion.div
                    className="mood-gallery-panel"
                    key="mood-gallery"
                    variants={moodContentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <div className="mood-heading">
                      <p className="eyebrow">Mood</p>
                      <h1>{openMood.name}</h1>
                    </div>
                    <CircularGallery
                      items={openMoodPhotos.map((photo) => ({
                        image: getPhotoThumbnailUrl(photo),
                        text: photo.originalFileName,
                      }))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function toDisplayMoodCluster(cluster: MoodCluster): DisplayMoodCluster {
  return {
    id: cluster.id,
    name: cluster.name,
    slug: cluster.slug,
    photoCount: cluster.photoCount,
    previewColors: cluster.previewColors,
    photoIds: cluster.photoIds,
    photos: cluster.photos.map((photo) => ({
      fileId: photo.fileId,
      thumbnailFileUrl: photo.thumbnailFileUrl,
      originalFileName: photo.originalFileName,
    })),
  };
}

function buildLocalMoodClusters(
  photos: StoredPhotoMetadata[],
): DisplayMoodCluster[] {
  const groups = new Map<string, StoredPhotoMetadata[]>();

  for (const photo of photos) {
    const key = chooseLocalMoodName(photo);
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }

  return Array.from(groups.entries())
    .map(([name, groupPhotos]) => ({
      id: `local-${slugify(name)}`,
      name,
      slug: slugify(name),
      photoCount: groupPhotos.length,
      previewColors: getLocalPreviewColors(groupPhotos),
      photoIds: groupPhotos.map((photo) => photo.fileId),
      photos: groupPhotos.slice(0, 6).map((photo) => ({
        fileId: photo.fileId,
        thumbnailFileUrl: getPhotoThumbnailUrl(photo),
        originalFileName: photo.originalFileName,
      })),
    }))
    .sort(
      (a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name),
    );
}

function getMoodPhotos(
  cluster: DisplayMoodCluster | null,
  photos: StoredPhotoMetadata[],
) {
  if (!cluster) return [];

  const photoIds = new Set(cluster.photoIds);
  return photos.filter((photo) => photoIds.has(photo.fileId));
}

function getStackCards(
  cluster: DisplayMoodCluster,
  photos: StoredPhotoMetadata[],
) {
  const moodPhotos = getMoodPhotos(cluster, photos);
  const cardPhotos =
    moodPhotos.length > 0
      ? moodPhotos.slice(0, 5).map((photo) => ({
          fileId: photo.fileId,
          src: getPhotoThumbnailUrl(photo),
          alt: photo.originalFileName,
        }))
      : cluster.photos.slice(0, 5).map((photo) => ({
          fileId: photo.fileId,
          src: photo.thumbnailFileUrl,
          alt: photo.originalFileName,
        }));

  return cardPhotos.map((photo) => (
    <img
      alt={photo.alt}
      className="mood-stack-image"
      key={photo.fileId}
      src={photo.src}
    />
  ));
}

function chooseLocalMoodName(photo: StoredPhotoMetadata) {
  const tagNames = new Set(photo.tags.map((tag) => tag.name));
  const fingerprint = photo.colorFingerprint;

  if (tagNames.has("monochrome") || fingerprint.monochromeScore > 0.72) {
    return "Monochrome";
  }
  if (tagNames.has("low-key-shadow") || fingerprint.shadowShare > 0.5) {
    return "Low-key Shadow";
  }
  if (tagNames.has("soft-white") || fingerprint.highlightShare > 0.48) {
    return "Soft White";
  }
  if (tagNames.has("cool-blue") || tagNames.has("blue")) {
    return "Cool Blue";
  }
  if (tagNames.has("green")) {
    return "Fresh Green";
  }
  if (tagNames.has("warm-film") || fingerprint.warmth > 0.58) {
    return "Warm Film";
  }
  if (fingerprint.saturationKey === "muted") {
    return "Rain Gray";
  }
  if (fingerprint.meanChroma > 0.12) {
    return "Color Rich";
  }
  return "Muted Neutral";
}

function getLocalPreviewColors(photos: StoredPhotoMetadata[]) {
  const colors = new Map<string, number>();

  for (const photo of photos) {
    for (const color of photo.colorFingerprint.dominantColors.slice(0, 3)) {
      colors.set(color.hex, (colors.get(color.hex) ?? 0) + color.percentage);
    }
  }

  return Array.from(colors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([color]) => color);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getResponseError(json: unknown, status: number) {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof json.error === "string"
  ) {
    return json.error;
  }

  return `Request failed with HTTP ${status}`;
}
