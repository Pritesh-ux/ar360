import { CheckCircle2, ClipboardList } from "lucide-react";

export default function ChecklistIllustration() {
  return (
    <div className="relative flex h-[120px] w-[88px] items-end justify-center">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,255,56,0.1),transparent_70%)]" />
      <div className="relative rounded-[16px] border border-[#ECECEC] bg-white p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
        <ClipboardList size={22} className="text-[#B6FF38]" strokeWidth={1.8} />
        <div className="mt-1.5 space-y-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <CheckCircle2
                size={9}
                className={i === 0 ? "text-[#22C55E]" : "text-[#E5E7EB]"}
              />
              <div
                className={`h-0.5 rounded-full ${i === 0 ? "w-7 bg-[#D1FAE5]" : "w-5 bg-[#F3F4F6]"}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
