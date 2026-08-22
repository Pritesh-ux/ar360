/** Load Razorpay Checkout.js once; safe when the script tag already exists in the DOM. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const readyState = (existing as HTMLScriptElement & { readyState?: string }).readyState;
      if (readyState === "complete" || readyState === "loaded") {
        resolve(Boolean(window.Razorpay));
        return;
      }

      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Prefetch Checkout.js early so Pay click opens the gateway faster. */
export function prefetchRazorpayScript(): void {
  void loadRazorpayScript();
}

export function formatRazorpayFailure(response: unknown): string {
  const error =
    response && typeof response === "object" && "error" in response
      ? (response as { error?: { description?: string; reason?: string; code?: string } }).error
      : null;
  const description = String(error?.description || "").trim();
  if (description) return description;
  const reason = String(error?.reason || "").trim().replaceAll("_", " ");
  if (reason) return `Payment ${reason}. Try another method or retry.`;
  return "Payment failed. Please retry or use another method.";
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

export {};
