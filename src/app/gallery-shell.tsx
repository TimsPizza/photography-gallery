"use client";

/* eslint-disable @next/next/no-img-element */

import { MasonryPhotoWall } from "@/app/masonry-photo-wall";
import { PhotoWall } from "@/app/photo-wall";
import CircularGallery from "@/components/CircularGallery";
import FluidGlass from "@/components/FluidGlass";
import LightRays from "@/components/LightRays";
import Stack from "@/components/Stack";
import { Eyebrow, cx } from "@/components/ui";
import {
  moodClusterListResponseSchema,
  type MoodCluster,
  type StoredPhotoMetadata,
} from "@/contracts/photo";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type GalleryShellProps = {
  initialPhotos: StoredPhotoMetadata[];
  initialWallVariant?: GalleryWallVariant;
};

type GalleryMode = "timeline" | "mood";
export type GalleryWallVariant = "timeline" | "masonry";

const moodHeadingClass =
  "max-w-[12ch] font-[family-name:var(--font-lxgw)] text-[clamp(2.8rem,8vw,6.4rem)] font-normal leading-[0.98] text-[#fffaf0]";
const topbarButtonClass =
  "min-h-[2.35rem] cursor-pointer rounded-[10px] border-0 bg-transparent px-4 text-[0.95rem] text-[#1d1b18] no-underline transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-white/40 dark:text-[#eae6db] dark:hover:bg-white/10";

type GalleryNavButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  moodMode?: boolean;
};

function GalleryNavButton({
  active = false,
  className,
  moodMode = false,
  ...props
}: GalleryNavButtonProps) {
  return (
    <button
      className={cx(
        topbarButtonClass,
        moodMode && !active && "!text-white",
        active && "bg-white/55 font-bold !text-[#211f1b]",
        className,
      )}
      type="button"
      {...props}
    />
  );
}

function MoodHeading({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-[0.45rem]">
      <Eyebrow>Mood</Eyebrow>
      <h1 className={moodHeadingClass}>{children}</h1>
    </div>
  );
}

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

export function GalleryShell({
  initialPhotos,
  initialWallVariant = "timeline",
}: GalleryShellProps) {
  const [mode, setMode] = useState<GalleryMode>("timeline");
  const [wallVariant, setWallVariant] =
    useState<GalleryWallVariant>(initialWallVariant);
  const [moodClusters, setMoodClusters] = useState<DisplayMoodCluster[]>([]);
  const [openMoodId, setOpenMoodId] = useState<string | null>(null);
  const hasRequestedMoodRef = useRef(false);

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
    <main
      className={`relative min-h-screen overflow-visible bg-fixed p-4 transition-[background-color,filter] duration-260 max-[780px]:p-[0.65rem] ${
        mode === "mood"
          ? "bg-[radial-gradient(circle_at_50%_12%,rgb(255_222_159/14%),transparent_25rem),linear-gradient(135deg,#050505_0%,#11100e_58%,#191511_100%)]"
          : "bg-[radial-gradient(circle_at_12%_8%,rgb(255_231_177/25%),transparent_35rem),linear-gradient(135deg,#f6f2e8_0%,#e7e4dc_55%,#d8d5ce_100%)] dark:bg-[radial-gradient(circle_at_12%_8%,rgb(255_231_177/5%),transparent_35rem),linear-gradient(135deg,#12100d_0%,#1a1714_55%,#161310_100%)]"
      }`}
    >
      <FluidGlass
        className={`absolute top-2 left-1/2 z-30 block min-h-[3.35rem] w-[90vw] max-w-295 -translate-x-1/2 rounded-full border px-[0.55rem] py-[0.45rem] pl-5 backdrop-blur-[28px] backdrop-contrast-[0.9] backdrop-saturate-[1.9] transition-all duration-300 max-[780px]:top-[0.65rem] max-[780px]:rounded-xl ${
          mode === "mood"
            ? "border-white/15 bg-[rgb(12_11_10/46%)] shadow-[0_18px_50px_rgb(0_0_0/18%)] backdrop-blur-3xl"
            : "border-white/70 bg-[linear-gradient(135deg,rgb(255_252_244/45%),rgb(255_252_244/20%))] shadow-[0_8px_32px_rgb(0_0_0/4%),inset_0_1px_0_rgb(255_255_255/60%),inset_0_-1px_0_rgb(0_0_0/2%)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgb(44_41_37/55%),rgb(24_21_17/30%))] dark:shadow-[0_8px_32px_rgb(0_0_0/20%),inset_0_1px_0_rgb(255_255_255/10%),inset_0_-1px_0_rgb(0_0_0/20%)]"
        }`}
        contentClassName="flex min-h-[calc(3.35rem-0.9rem)] items-center justify-between gap-4 max-[780px]:flex-col max-[780px]:items-start"
        mode="bar"
        barProps={{
          scale: 0.17,
          thickness: mode === "mood" ? 14 : 10,
          chromaticAberration: mode === "mood" ? 0.12 : 0.07,
          attenuationDistance: mode === "mood" ? 0.18 : 0.26,
        }}
      >
        <button
          className={`cursor-pointer border-0 bg-transparent text-[1.1rem] font-bold no-underline ${
            mode === "mood"
              ? "text-white"
              : "text-[#1d1b18] dark:text-[#eae6db]"
          }`}
          type="button"
          onClick={() => {
            setMode("timeline");
            setOpenMoodId(null);
          }}
        >
          Photo Wall
        </button>
        <nav
          className="flex flex-wrap justify-end gap-2 max-[780px]:w-full max-[780px]:justify-start"
          aria-label="Gallery modes"
        >
          <GalleryNavButton
            active={mode === "timeline" && wallVariant === "timeline"}
            moodMode={mode === "mood"}
            data-active={mode === "timeline" && wallVariant === "timeline"}
            onClick={() => {
              setMode("timeline");
              setWallVariant("timeline");
              setOpenMoodId(null);
            }}
          >
            Timeline
          </GalleryNavButton>
          <GalleryNavButton
            active={mode === "timeline" && wallVariant === "masonry"}
            moodMode={mode === "mood"}
            data-active={mode === "timeline" && wallVariant === "masonry"}
            onClick={() => {
              setMode("timeline");
              setWallVariant("masonry");
              setOpenMoodId(null);
            }}
          >
            Masonry
          </GalleryNavButton>
          <GalleryNavButton
            active={mode === "mood"}
            moodMode={mode === "mood"}
            data-active={mode === "mood"}
            onClick={() => setMode("mood")}
          >
            Mood
          </GalleryNavButton>
          <GalleryNavButton moodMode={mode === "mood"}>
            Tags
          </GalleryNavButton>
          <GalleryNavButton moodMode={mode === "mood"}>
            Albums
          </GalleryNavButton>
        </nav>
      </FluidGlass>

      <section
        className="relative isolate z-10 mx-auto w-full max-w-[1180px] py-[clamp(3rem,8vw,6rem)] pb-24"
        id="timeline"
      >
        <div className="pointer-events-none sticky top-0 z-0 mb-[-100svh] h-[100svh] w-full overflow-hidden rounded-lg">
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={0.42}
            lightSpread={0.46}
            rayLength={1.55}
            fadeDistance={1.2}
            saturation={0.72}
            followMouse
            mouseInfluence={0.065}
            noiseAmount={0.075}
            distortion={0.08}
          />
        </div>
        <div
          className={`relative z-[1] min-h-[48vh] rounded-lg border border-white/65 bg-[linear-gradient(145deg,rgb(255_255_255_/_34%),rgb(255_250_238_/_15%))] p-[clamp(0.75rem,1.8vw,1.25rem)] shadow-[0_36px_100px_rgb(64_48_22_/_13%),inset_0_1px_0_rgb(255_255_255_/_82%),inset_0_-1px_0_rgb(91_70_37_/_8%)] backdrop-blur-3xl backdrop-contrast-[0.92] backdrop-saturate-[1.55] dark:border-white/15 dark:bg-[linear-gradient(145deg,rgb(36_34_30_/_48%),rgb(19_17_14_/_27%))] dark:shadow-[0_36px_110px_rgb(0_0_0_/_38%),inset_0_1px_0_rgb(255_255_255_/_13%),inset_0_-1px_0_rgb(0_0_0_/_18%)] dark:backdrop-contrast-95 dark:backdrop-saturate-[1.35] ${
            wallVariant === "timeline" ? "pl-[clamp(3.5rem,5vw,4.5rem)]" : ""
          }`}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(115deg,rgb(255_255_255_/_28%),transparent_24%),linear-gradient(to_bottom,rgb(255_255_255_/_9%),transparent_18rem)]"
            aria-hidden="true"
          />
          <div className="relative z-[1]">
            {wallVariant === "masonry" ? (
              <MasonryPhotoWall photos={initialPhotos} />
            ) : (
              <PhotoWall photos={initialPhotos} dimmed={mode === "mood"} />
            )}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {mode === "mood" && (
          <motion.section
            className="fixed inset-0 z-20 grid items-start overflow-y-auto bg-[radial-gradient(circle_at_50%_18%,rgb(255_222_159_/_14%),transparent_24rem),rgb(5_5_5_/_88%)] px-4 pt-[clamp(5.5rem,9vw,7rem)] pb-12"
            aria-label="Mood mode"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => openMoodId && setOpenMoodId(null)}
          >
            <div className="mx-auto grid w-full max-w-[1180px] gap-[clamp(1.4rem,3vw,2.4rem)]">
              <AnimatePresence mode="wait">
                {!openMood && (
                  <motion.div
                    className="grid gap-[clamp(1.4rem,3vw,2.4rem)]"
                    key="mood-grid"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <motion.div variants={moodContentVariants}>
                      <MoodHeading>Color groups</MoodHeading>
                    </motion.div>
                    <motion.div
                      className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[clamp(1rem,2vw,1.4rem)]"
                      variants={moodGridVariants}
                    >
                      {moodClusters.length === 0 && (
                        <motion.span
                          className="text-[0.95rem] font-bold text-[rgb(255_250_240_/_78%)]"
                          variants={moodItemVariants}
                        >
                          No mood groups yet
                        </motion.span>
                      )}
                      {moodClusters.map((cluster) => (
                        <motion.button
                          className="grid min-h-88 cursor-pointer gap-3 rounded-lg border border-white/15 bg-white/[8%] p-4 text-left text-[#fffaf0] backdrop-blur-[18px] transition-[background,border-color,transform] duration-[180ms] hover:-translate-y-0.5 hover:border-[rgb(255_250_240_/_38%)] hover:bg-white/[13%]"
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
                          <span className="flex gap-1">
                            {cluster.previewColors.slice(0, 5).map((color) => (
                              <span
                                className="block h-[0.42rem] w-full rounded-full"
                                key={`${cluster.id}:${color}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </span>
                          <strong className="text-[1.04rem]">
                            {cluster.name}
                          </strong>
                          <small className="text-[0.78rem] font-bold text-[rgb(255_250_240_/_68%)]">
                            {cluster.photoCount} photos
                          </small>
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {openMood && (
                  <motion.div
                    className="grid min-h-[min(68vh,680px)] gap-5"
                    key="mood-gallery"
                    variants={moodContentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <MoodHeading>{openMood.name}</MoodHeading>
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
      className="pointer-events-none block h-full w-full object-cover"
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
