"use client";

import { CSRF_HEADER_NAME, getBrowserCsrfToken } from "@/lib/csrf-client";

let fetchPatched = false;

function installCsrfFetchInterceptor() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function csrfFetch(input, init) {
    const method = (
      init?.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"];

    if (stateChangingMethods.includes(method)) {
      const token = getBrowserCsrfToken();

      if (token) {
        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );

        if (!headers.has(CSRF_HEADER_NAME)) {
          headers.set(CSRF_HEADER_NAME, token);
        }

        if (input instanceof Request) {
          return originalFetch(
            new Request(input, {
              ...init,
              headers,
            }),
          );
        }

        return originalFetch(input, { ...init, headers });
      }
    }

    return originalFetch(input, init);
  };
}

installCsrfFetchInterceptor();

export default function CsrfFetchInterceptor() {
  installCsrfFetchInterceptor();
  return null;
}
