"use client";

import React from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import ViewportPortal from "@/components/shared/ViewportPortal";

type Props = {
  isOpen: boolean;
  onClose?: () => void;
  reason?: string;
};

export default function UpgradeRequiredModal({ isOpen, onClose, reason }: Props) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <ViewportPortal>
    <div
      className="fixed inset-0 z-[99999] grid place-items-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.46)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        className="relative w-full max-w-md text-center"
        style={{
          background: "#ffffff",
          borderRadius: 28,
          padding: "28px 28px 24px",
          boxShadow: "0 30px 80px rgba(15, 23, 42, 0.22)",
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upgrade modal"
            className="absolute right-5 top-5 grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              background: "#ffffff",
              color: "#020617",
              border: "0",
              boxShadow: "none",
              cursor: "pointer",
            }}
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        )}

        <div
          className="mx-auto grid place-items-center"
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "#efffda",
            color: "#8fdc21",
            boxShadow: "0 12px 30px rgba(166,255,46,0.16)",
          }}
        >
          <AlertTriangle size={31} strokeWidth={2.4} />
        </div>

        <h2
          className="mt-6"
          style={{
            color: "#020617",
            fontSize: 26,
            lineHeight: "32px",
            fontWeight: 900,
            letterSpacing: "-0.03em",
          }}
        >
          Upgrade Required
        </h2>

        <p
          className="mx-auto mt-3"
          style={{
            maxWidth: 340,
            color: "#5f6b65",
            fontSize: 14,
            lineHeight: "22px",
            fontWeight: 700,
          }}
        >
          {reason ||
            "Your plan limits have been reached or your trial has ended. Upgrade to continue using this feature."}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/subscription#available-plans")}
            className="flex w-full items-center justify-center gap-2"
            style={{
              height: 50,
              borderRadius: 14,
              background: "#A6FF2E",
              color: "#020617",
              border: "0",
              fontSize: 14,
              fontWeight: 900,
              boxShadow: "0 12px 28px rgba(166,255,46,0.22)",
              cursor: "pointer",
            }}
          >
            Upgrade Plan <ArrowRight size={16} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={onClose || (() => router.push("/dashboard/products"))}
            className="w-full"
            style={{
              height: 50,
              borderRadius: 14,
              background: "#f5f7f9",
              color: "#5f6b65",
              border: "0",
              fontSize: 14,
              fontWeight: 900,
              boxShadow: "none",
              cursor: "pointer",
            }}
          >
            {onClose ? "Cancel" : "Back to Products"}
          </button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
}
