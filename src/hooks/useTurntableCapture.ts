import { useEffect, useRef, useState } from "react";

type Options = {
  enabled: boolean;
  intervalMs?: number;
  maxPhotos?: number;
  onCapture: () => void;
};

export function useTurntableCapture({ enabled, intervalMs = 1800, maxPhotos = 80, onCapture }: Options) {
  const [isRunning, setIsRunning] = useState(false);
  const [captured, setCaptured] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
    if (!enabled || isRunning) return;
    setCaptured(0);
    setIsRunning(true);
  }

  function stop() {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function reset() {
    stop();
    setCaptured(0);
  }

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setCaptured((prev) => {
        if (prev >= maxPhotos) {
          stop();
          return prev;
        }

        onCapture();
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRunning, intervalMs, maxPhotos, onCapture]);

  return {
    isRunning,
    captured,
    progress: Math.min(100, Math.round((captured / maxPhotos) * 100)),
    start,
    stop,
    reset,
  };
}
