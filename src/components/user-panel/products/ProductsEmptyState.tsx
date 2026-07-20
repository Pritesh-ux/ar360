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
      className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#ECECEC] bg-[#FAFAFA] px-6 text-center"
    >
      <div className="grid h-20 w-20 place-items-center rounded-[20px] bg-[#F3FAEB] text-[#84D400]">
        <UploadCloud size={36} />
      </div>
      <h2 className="mt-6 text-[22px] font-semibold text-[#111111]">No products found</h2>
      <p className="mt-2 max-w-md text-[14px] font-medium text-[#525252]">
        Upload your first 3D model to start building immersive AR product experiences.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#84D400] px-6 text-[14px] font-semibold text-[#102000] transition hover:bg-[#78C400]"
      >
        <UploadCloud size={18} />
        {uploading ? "Checking..." : "Upload Product"}
      </button>
    </motion.div>
  );
}
