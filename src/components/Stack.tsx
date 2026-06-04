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
      className="stack-root"
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      {visibleCards.map((card, index) => {
        const depth = visibleCards.length - index - 1;

        return (
          <motion.div
            className="stack-card"
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
