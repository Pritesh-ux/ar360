export type AutoSaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export function AutoSaveIndicator({ state }: { state: AutoSaveState }) {
  if (state === "idle") return null;

  const label =
    state === "saving"
      ? "Saving..."
      : state === "saved"
        ? "Saved"
        : state === "conflict"
          ? "Conflict — reload product"
          : state === "error"
            ? "Save failed"
            : "";

  const tone =
    state === "error" || state === "conflict"
      ? "text-amber-600"
      : state === "saved"
        ? "text-[#5FA800]"
        : "text-[#737373]";

  return <span className={`text-[12px] font-medium ${tone}`}>{label}</span>;
}
