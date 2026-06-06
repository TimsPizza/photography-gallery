"use client";

/* eslint-disable @next/next/no-img-element */

import { StoredPhotoMetadata } from "@/contracts/photo";
import { getPhotoDate } from "@/lib/photo-layout";
import { motion } from "motion/react";

type OriginalPhotoViewerProps = {
  photo: StoredPhotoMetadata;
  onClose: () => void;
};

export function OriginalPhotoViewer({
  photo,
  onClose,
}: OriginalPhotoViewerProps) {
  const { exif } = photo;
  const date = getPhotoDate(photo);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-[clamp(1rem,4vw,3rem)]"
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute inset-0 cursor-zoom-out border-0 bg-[rgb(14_12_10_/_80%)] backdrop-blur-3xl backdrop-saturate-[1.2] transition-opacity duration-[400ms]"
        aria-label="Close photo"
        onClick={onClose}
        type="button"
      />
      <motion.figure
        className="relative z-[1] m-0 flex max-h-[94vh] max-w-[min(1240px,94vw)] flex-col gap-5"
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <img
          className="mx-auto max-h-[calc(86vh-4rem)] max-w-full rounded-sm object-contain shadow-[0_40px_100px_rgb(0_0_0_/_50%)]"
          alt={photo.originalFileName}
          src={photo.fileUrl}
        />
        <figcaption className="flex flex-wrap items-start justify-between gap-6 px-2 text-[0.95rem] font-light text-[#fffaf0] opacity-90">
          <div className="flex flex-col gap-[0.4rem]">
            {(exif?.camera || exif?.lens) && (
              <div className="flex items-center gap-2 font-medium tracking-[0.02em]">
                {exif?.camera && (
                  <span>{exif.camera}</span>
                )}
                {exif?.camera && exif?.lens && (
                  <span className="font-light text-white/30">/</span>
                )}
                {exif?.lens && <span>{exif.lens}</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-[0.8rem] font-[family-name:var(--font-geist-mono)] text-[0.85rem] text-white/65">
              {exif?.focalLength && <span>{exif.focalLength}</span>}
              {exif?.aperture && (
                <span>ƒ/{exif.aperture.replace(/^f\//i, "")}</span>
              )}
              {exif?.shutter && <span>{exif.shutter}s</span>}
              {exif?.iso && <span>ISO {exif.iso}</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-[0.2rem] text-right text-[0.85rem] text-white/50">
            <strong className="wrap-anywhere font-medium text-[#fffaf0]">
              {photo.originalFileName}
            </strong>
            <span>{formatFullDate(date)}</span>
          </div>
        </figcaption>
      </motion.figure>
    </div>
  );
}

const fullDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatFullDate(date: Date) {
  return fullDateFormatter.format(date);
}
