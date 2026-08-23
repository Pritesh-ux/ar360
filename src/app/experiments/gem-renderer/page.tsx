import type { Metadata } from "next";
import { GemRendererPocClient } from "@/components/experiments/gem-renderer/GemRendererPocClient";

export const metadata: Metadata = {
  title: "Gem Renderer POC · AR360 Experiments",
  description:
    "Isolated real-time diamond optics proof-of-concept. Not production ModelViewer.",
  robots: { index: false, follow: false },
};

export default function GemRendererPocPage() {
  return <GemRendererPocClient />;
}
