"use client";

import { UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  onUpload: () => void;
  uploading?: boolean;
};

export default function ProductsEmptyState({ onUpload, uploading = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="up-fill-panel up-empty-dash flex w-full flex-1 flex-col items-center justify-center rounded-[20px] bg-[#FAFAFB] px-6 py-10 text-center md:min-h-[280px] md:flex-none"
      style={{ minHeight: "55dvh", borderStyle: "dashed", borderWidth: 2, borderColor: "#d1d5db" }}
    >
      <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-gradient-to-br from-[#B6FF38]/20 to-[#84D400]/10 text-[#5FA800] md:h-20 md:w-20">
        <UploadCloud size={32} strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-[#111827] md:mt-6 md:text-xl">
        No products found
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] font-medium leading-5 text-[#6B7280] md:mt-2 md:text-[14px] md:leading-6">
        Upload your first 3D model to start building immersive AR product experiences.
      </p>
      <button
        type="button"
        onClick={onUpload}
        disabled={uploading}
        className="dash-premium-btn-primary mt-4 md:mt-6 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UploadCloud size={18} />
        {uploading ? "Checking..." : "Upload Product"}
      </button>
    </motion.div>
  );
}
