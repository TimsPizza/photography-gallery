"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "motion/react";
import { useMemo, useState } from "react";

export type CircularGalleryItem = {
  image: string;
  text: string;
};

type CircularGalleryProps = {
  items: CircularGalleryItem[];
};

export default function CircularGallery({ items }: CircularGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleItems = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        offset: getCircularOffset(index, activeIndex, items.length),
      })),
    [activeIndex, items],
  );

  if (!items.length) {
    return <div className="circular-gallery-empty">No photos in this group.</div>;
  }

  function step(delta: number) {
    setActiveIndex((current) =>
      (current + delta + items.length) % items.length,
    );
  }

  return (
    <div
      className="circular-gallery"
      onWheel={(event) => {
        event.stopPropagation();
        if (Math.abs(event.deltaY) < 6) return;
        step(event.deltaY > 0 ? 1 : -1);
      }}
    >
      <button
        aria-label="Previous photo"
        className="circular-control circular-control-prev"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          step(-1);
        }}
      >
        Prev
      </button>
      <div className="circular-stage">
        {visibleItems.map((item, index) => {
          const abs = Math.abs(item.offset);
          const isVisible = abs <= 3;

          return (
            <motion.figure
              className="circular-card"
              key={`${item.image}:${index}`}
              animate={{
                opacity: isVisible ? 1 : 0,
                x: `${item.offset * 58}%`,
                zIndex: 20 - abs,
                rotateY: item.offset * -18,
                rotateZ: item.offset * -2,
                scale: 1 - abs * 0.12,
              }}
              transition={{ type: "spring", stiffness: 150, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <img alt={item.text} src={item.image} />
              <figcaption>{item.text}</figcaption>
            </motion.figure>
          );
        })}
      </div>
      <button
        aria-label="Next photo"
        className="circular-control circular-control-next"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          step(1);
        }}
      >
        Next
      </button>
    </div>
  );
}

function getCircularOffset(index: number, activeIndex: number, length: number) {
  const raw = index - activeIndex;
  const half = length / 2;

  if (raw > half) return raw - length;
  if (raw < -half) return raw + length;
  return raw;
}
