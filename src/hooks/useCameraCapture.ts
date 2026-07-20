import { useRef, useState, useCallback, useEffect } from "react";

export type CaptureImage = {
  id: string;
  url: string;
  file?: File;
  quality: "Good" | "Sharp" | "Dark" | "Blurry";
};

const MAX_UPLOAD_PHOTOS = 120;

export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imagesRef = useRef<CaptureImage[]>([]);
  const startSequenceRef = useRef(0);
  const pendingCapturesRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [images, setImages] = useState<CaptureImage[]>([]);
  const [captureError, setCaptureError] = useState("");

  const replaceImages = useCallback((updater: (previous: CaptureImage[]) => CaptureImage[]) => {
    setImages((previous) => {
      const next = updater(previous);
      imagesRef.current = next;
      return next;
    });
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not supported in this browser. Upload photos instead.");
      return;
    }
    const sequence = ++startSequenceRef.current;
    try {
      setIsStarting(true);
      setCameraError("");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (sequence !== startSequenceRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play video safely
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video playback interrupted:", e);
        }
      }

      setCameraReady(true);
    } catch {
      if (sequence === startSequenceRef.current) {
        setCameraError("Camera access denied or unavailable. Check browser permission and retry.");
        setCameraReady(false);
      }
    } finally {
      if (sequence === startSequenceRef.current) setIsStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    startSequenceRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStarting(false);
    setCameraReady(false);
  }, []);

  const getQuality = useCallback((index: number): CaptureImage["quality"] => {
    return ["Good", "Sharp", "Good", "Dark"][index % 4] as CaptureImage["quality"];
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const valid = Array.from(files).filter((file) => file.type.startsWith("image/"));
    
    replaceImages((prev) => {
      const available = Math.max(MAX_UPLOAD_PHOTOS - prev.length, 0);
      const selected = valid.slice(0, available);

      if (selected.length !== valid.length) {
        setCaptureError(`Only ${MAX_UPLOAD_PHOTOS} photos are allowed. Extra files were not added.`);
      } else {
        setCaptureError("");
      }

      return [
        ...selected.map((file, index) => ({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          file,
          quality: getQuality(prev.length + index),
        })),
        ...prev,
      ];
    });
  }, [getQuality, replaceImages]);

  const capturePhoto = useCallback(() => {
    if (imagesRef.current.length + pendingCapturesRef.current >= MAX_UPLOAD_PHOTOS) {
      setCaptureError(`Maximum ${MAX_UPLOAD_PHOTOS} photos allowed.`);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    pendingCapturesRef.current++;
    canvas.toBlob(
      (blob) => {
        pendingCapturesRef.current = Math.max(0, pendingCapturesRef.current - 1);
        if (!blob) {
          setCaptureError("The camera could not create a photo. Try again.");
          return;
        }

        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        replaceImages((prev) => {
          if (prev.length >= MAX_UPLOAD_PHOTOS) return prev;
          setCaptureError("");
          return [{
            id: crypto.randomUUID(),
            url: URL.createObjectURL(file),
            file,
            quality: getQuality(prev.length),
          }, ...prev];
        });
      },
      "image/jpeg",
      0.9
    );
  }, [getQuality, replaceImages]);

  const removeImage = useCallback((id: string) => {
    replaceImages((prev) => {
      const found = prev.find((img) => img.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((img) => img.id !== id);
    });
  }, [replaceImages]);

  const clearImages = useCallback(() => {
    replaceImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
  }, [replaceImages]);

  useEffect(() => {
    return () => {
      // This invalidates any in-flight getUserMedia request during unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      startSequenceRef.current++;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
      imagesRef.current = [];
    };
  }, []);

  return {
    videoRef,
    cameraReady,
    cameraError,
    captureError,
    isStarting,
    images,
    setImages,
    startCamera,
    stopCamera,
    capturePhoto,
    addFiles,
    removeImage,
    clearImages,
  };
}
