type Props = {
  label?: string;
  className?: string;
};

export default function AdminLoadingState({ label = "Loading...", className = "" }: Props) {
  return (
    <div className={`flex items-center justify-center px-6 py-16 ${className}`}>
      <div className="flex items-center gap-3 text-[13px] font-semibold text-slate-400">
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        {label}
      </div>
    </div>
  );
}
