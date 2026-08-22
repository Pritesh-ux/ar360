"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export const STUDIO_AR_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

export async function requestStudioArCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available in this browser.");
  }
  return navigator.mediaDevices.getUserMedia(STUDIO_AR_CAMERA_CONSTRAINTS);
}

export function studioArCameraErrorMessage(err: unknown): string {
  if (err instanceof Error && /denied|notallowed|permission/i.test(err.message)) {
    return "Camera permission is needed to see the product in your room.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Could not open the camera.";
}

export function stopMediaStream(stream?: MediaStream | null) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

function streamHasLiveVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  try {
    return stream.getVideoTracks().some((track) => track.readyState === "live");
  } catch {
    return false;
  }
}

type Props = {
  active: boolean;
  onExit: () => void;
  onCameraError?: (message: string) => void;
  /** Pass a stream started from a tap so iPhone Safari does not block the camera. */
  stream?: MediaStream | null;
};

/**
 * Camera backdrop for Studio Look AR.
 * The live model-viewer stays on top with the same HDRI / materials as the 3D viewer,
 * so iPhone and Android both keep Viewer color instead of Scene Viewer / Quick Look.
 */
export default function StudioLookArCamera({
  active,
  onExit,
  onCameraError,
  stream: incomingStream,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = streamHasLiveVideo(incomingStream)
      ? incomingStream!
      : null;
    // Only stop tracks we opened here. Parent-owned streams must survive React
    // Strict Mode remounts / effect re-runs, otherwise the camera goes black.
    let ownsStream = !stream;
    let cancelled = false;

    void (async () => {
      try {
        if (!stream) {
          stream = await requestStudioArCamera();
          ownsStream = true;
        }
        if (cancelled) {
          if (ownsStream) stopMediaStream(stream);
          return;
        }
        const video = videoRef.current;
        if (!video) {
          if (ownsStream) stopMediaStream(stream);
          return;
        }
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setPlaying(true);
      } catch (err) {
        if (ownsStream) stopMediaStream(stream);
        const message = studioArCameraErrorMessage(err);
        if (!cancelled) {
          setPlaying(false);
          setError(message);
          onCameraError?.(message);
        }
      }
    })();

    return () => {
      cancelled = true;
      setPlaying(false);
      const video = videoRef.current;
      if (video) video.srcObject = null;
      if (ownsStream) stopMediaStream(stream);
    };
  }, [active, incomingStream, onCameraError]);

  if (!active) return null;

  return (
    <>
      {/* fixed + z-[1] so the feed stays under the model but above page chrome */}
      <video
        ref={videoRef}
        className="pointer-events-none fixed inset-0 z-[1] h-[100dvh] w-full object-cover"
        muted
        playsInline
        autoPlay
        controls={false}
        disablePictureInPicture
        aria-hidden
        style={{
          backgroundColor: "#111",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] bg-gradient-to-b from-black/45 to-transparent px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold text-white/90">
            Studio AR · same look as 3D viewer
          </p>
          <button
            type="button"
            onClick={onExit}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white"
            aria-label="Exit AR"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      {error ? (
        <div className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[90] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl bg-black/75 px-4 py-3 text-center text-[13px] font-semibold text-white">
          {error}
        </div>
      ) : (
        <p className="pointer-events-none fixed bottom-[max(18px,env(safe-area-inset-bottom))] left-1/2 z-[90] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 text-center text-[12px] font-semibold text-white/80">
          {playing
            ? "Drag to rotate · pinch to zoom · color matches the 3D viewer"
            : "Starting camera…"}
        </p>
      )}
    </>
  );
}
