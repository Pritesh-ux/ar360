export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-bold text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-right font-black text-slate-800">
        {value}
      </span>
    </div>
  );
}
