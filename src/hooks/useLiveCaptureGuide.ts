import { useEffect, useMemo, useState } from "react";

type GuideState = {
  message: string;
  severity: "good" | "warning" | "info";
  progress: number;
  nextAngle: string;
  canCapture: boolean;
};

const ANGLES = ["Front", "Left", "Back", "Right", "Top", "Bottom"];

export function useLiveCaptureGuide(photoCount: number, cameraReady: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1200);
    return () => clearInterval(timer);
  }, []);

  return useMemo<GuideState>(() => {
    if (!cameraReady) {
      return {
        message: "Start camera or upload photos manually.",
        severity: "info",
        progress: 0,
        nextAngle: "Front",
        canCapture: false,
      };
    }

    const angleIndex = Math.min(ANGLES.length - 1, Math.floor(photoCount / 14));
    const nextAngle = ANGLES[angleIndex];
    const progress = Math.min(100, Math.round((photoCount / 80) * 100));

    const hints = [
      `Capture ${nextAngle} angle`,
      "Rotate product slowly",
      "Keep product centered",
      "Avoid motion blur",
      "Keep background clean",
      "Use soft light",
    ];

    const message = progress >= 100 ? "Coverage complete. Ready to upload." : hints[tick % hints.length];

    return {
      message,
      severity: progress >= 100 ? "good" : tick % 5 === 0 ? "warning" : "info",
      progress,
      nextAngle,
      canCapture: true,
    };
  }, [photoCount, cameraReady, tick]);
}
