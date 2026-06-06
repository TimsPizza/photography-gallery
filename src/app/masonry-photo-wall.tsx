"use client";

import Masonry, { type MasonryItem } from "@/components/Masonry";
import { OriginalPhotoViewer } from "@/components/original-photo-viewer";
import { EmptyState } from "@/components/ui";
import type { StoredPhotoMetadata } from "@/contracts/photo";
import { getPhotoThumbnailUrl } from "@/lib/photo-url";
import { useMemo, useState } from "react";

type MasonryPhotoWallProps = {
  photos: StoredPhotoMetadata[];
};

export function MasonryPhotoWall({ photos }: MasonryPhotoWallProps) {
  const [activePhoto, setActivePhoto] = useState<StoredPhotoMetadata | null>(
    null,
  );
  const photoById = useMemo(
    () => new Map(photos.map((photo) => [photo.fileId, photo])),
    [photos],
  );
  const items = useMemo<MasonryItem[]>(
    () =>
      photos.map((photo) => ({
        id: photo.fileId,
        img: getPhotoThumbnailUrl(photo),
        height:
          photo.orientation === "portrait"
            ? 620
            : photo.orientation === "square"
              ? 480
              : 360,
        aspectRatio: photo.aspectRatio,
        alt: photo.originalFileName,
      })),
    [photos],
  );

  if (photos.length === 0) {
    return (
      <EmptyState className="min-h-[42vh]">No photos yet.</EmptyState>
    );
  }

  return (
    <section className="relative min-h-[40vh] w-full">
      <Masonry
        animateFrom="bottom"
        blurToFocus
        duration={0.65}
        ease="power3.out"
        hoverScale={0.97}
        items={items}
        onItemClick={(item) => {
          const photo = photoById.get(item.id);
          if (photo) setActivePhoto(photo);
        }}
        scaleOnHover
        stagger={0.045}
      />

      {activePhoto ? (
        <OriginalPhotoViewer
          photo={activePhoto}
          onClose={() => setActivePhoto(null)}
        />
      ) : null}
    </section>
  );
}
