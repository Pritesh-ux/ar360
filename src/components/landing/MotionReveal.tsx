"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type MotionRevealProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  scale?: number;
  className?: string;
};

export default function MotionReveal({
  children,
  delay = 0,
  duration = 0.45,
  y = 12,
  scale = 1,
  className = "",
}: MotionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, scale: scale < 1 ? scale : 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.18, margin: "0px 0px -32px 0px" }}
      transition={{ delay, duration, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
