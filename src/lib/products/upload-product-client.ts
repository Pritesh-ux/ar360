import { CSRF_HEADER_NAME, ensureBrowserCsrfToken } from "@/lib/csrf-client";

export type ProductUploadResult = {
  product?: {
    id?: string;
    productUid?: string;
    customerUid?: string;
    modelUrl?: string;
    arLiteStatus?: string;
    [key: string]: unknown;
  };
  customer?: { customerUid?: string };
  warnings?: string[];
  error?: string;
  detail?: string;
};

/** Shared browser upload with real byte progress (XHR). */
export function uploadProductWithProgress(input: {
  formData: FormData;
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}): Promise<ProductUploadResult> {
  const { formData, onProgress, timeoutMs = 10 * 60 * 1000 } = input;

  return ensureBrowserCsrfToken().then((csrf) => {
    if (!csrf) {
      throw new Error("Invalid or missing CSRF token. Please try again.");
    }

    return new Promise((resolve, reject) => {
      // XHR bypasses the fetch interceptor — attach CSRF explicitly.
      if (!formData.has("_csrf")) {
        formData.append("_csrf", csrf);
      }

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/products/local-upload");
      xhr.responseType = "json";
      xhr.timeout = timeoutMs;
      xhr.setRequestHeader(CSRF_HEADER_NAME, csrf);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.max(1, Math.min(95, Math.round((event.loaded / event.total) * 100)));
        onProgress?.(pct);
      };

      xhr.onload = () => {
        const payload = (xhr.response || {}) as ProductUploadResult & {
          errno?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(payload);
          return;
        }
        const parts = [payload.error, payload.detail, payload.errno ? `(${payload.errno})` : ""]
          .map((part) => String(part || "").trim())
          .filter(Boolean);
        reject(new Error(parts.join(" — ") || `Upload failed (${xhr.status})`));
      };

      xhr.onerror = () => reject(new Error("Network error while uploading. Try again."));
      xhr.ontimeout = () =>
        reject(new Error("Upload timed out. Try a smaller GLB or check your connection."));
      xhr.send(formData);
    });
  });
}
