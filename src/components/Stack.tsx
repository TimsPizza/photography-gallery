"use client";

import { motion } from "motion/react";
import { ReactNode, useMemo } from "react";

type StackProps = {
  cards: ReactNode[];
  randomRotation?: boolean;
};

const ROTATIONS = [-7, 4, -2, 6, -5, 3];

export default function Stack({ cards, randomRotation = true }: StackProps) {
  const visibleCards = cards.slice(0, 5);
  const rotations = useMemo(
    () =>
      visibleCards.map((_, index) =>
        randomRotation ? ROTATIONS[index % ROTATIONS.length] : 0,
      ),
    [randomRotation, visibleCards],
  );

  return (
    <motion.div
      className="relative aspect-square w-full [perspective:700px]"
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      {visibleCards.map((card, index) => {
        const depth = visibleCards.length - index - 1;

        return (
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-[0_20px_60px_rgb(0_0_0_/_28%)]"
            key={index}
            variants={{
              rest: {
                rotateZ: rotations[index] + depth * 2,
                scale: 1 - depth * 0.045,
                x: depth * 5,
                y: depth * 5,
              },
              hover: {
                rotateZ: rotations[index] + depth * 5,
                scale: 1 - depth * 0.035,
                x: depth * 11,
                y: depth * 9,
              },
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {card}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
