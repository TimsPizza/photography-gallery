"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "motion/react";
import { cx } from "@/components/ui";
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useMemo,
  useState,
} from "react";

export type CircularGalleryItem = {
  image: string;
  text: string;
};

type CircularGalleryProps = {
  items: CircularGalleryItem[];
};

type GalleryControlProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  side: "left" | "right";
  children: ReactNode;
};

function GalleryControl({
  children,
  className,
  side,
  ...props
}: GalleryControlProps) {
  return (
    <button
      className={cx(
        "absolute top-1/2 z-40 min-h-[2.4rem] -translate-y-1/2 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 text-[0.8rem] font-bold text-[#fffaf0] backdrop-blur-2xl",
        side === "left" ? "left-4" : "right-4",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

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
    return (
      <div className="grid min-h-72 place-items-center font-bold text-[rgb(255_250_240_/_72%)]">
        No photos in this group.
      </div>
    );
  }

  function step(delta: number) {
    setActiveIndex((current) =>
      (current + delta + items.length) % items.length,
    );
  }

  return (
    <div
      className="relative grid min-h-[min(62vh,620px)] items-center overflow-hidden rounded-lg border border-white/15 bg-white/[7%] backdrop-blur-[20px]"
      onWheel={(event) => {
        event.stopPropagation();
        if (Math.abs(event.deltaY) < 6) return;
        step(event.deltaY > 0 ? 1 : -1);
      }}
    >
      <GalleryControl
        aria-label="Previous photo"
        side="left"
        onClick={(event) => {
          event.stopPropagation();
          step(-1);
        }}
      >
        Prev
      </GalleryControl>
      <div className="relative h-[min(52vh,520px)] [perspective:1000px]">
        {visibleItems.map((item, index) => {
          const abs = Math.abs(item.offset);
          const isVisible = abs <= 3;

          return (
            <motion.figure
              className="absolute top-1/2 left-1/2 m-0 grid w-[min(54vw,520px)] max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 gap-[0.7rem] [transform-style:preserve-3d]"
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
              <img
                className="aspect-[4/3] w-full rounded-lg object-cover shadow-[0_30px_90px_rgb(0_0_0_/_34%)]"
                alt={item.text}
                src={item.image}
              />
              <figcaption className="wrap-anywhere text-center text-[0.86rem] font-bold text-[rgb(255_250_240_/_82%)]">
                {item.text}
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
      <GalleryControl
        aria-label="Next photo"
        side="right"
        onClick={(event) => {
          event.stopPropagation();
          step(1);
        }}
      >
        Next
      </GalleryControl>
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
