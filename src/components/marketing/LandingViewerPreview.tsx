import { Box, Cuboid, Maximize2, RotateCw, Smartphone } from "lucide-react";

const LIME = "#C9FF57";

type Variant = "editor" | "viewer" | "ar";

export default function LandingViewerPreview({ variant }: { variant: Variant }) {
  if (variant === "editor") {
    return (
      <div className="relative h-full min-h-[460px] overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,rgba(201,255,87,.14),transparent_55%),linear-gradient(180deg,#111820,#050607)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[72%] w-[58%]">
            <div
              className="absolute inset-x-[8%] bottom-[18%] h-[14%] rounded-2xl"
              style={{ background: "linear-gradient(180deg,#8fa86a,#5c6f45)" }}
            />
            <div
              className="absolute inset-x-[4%] bottom-[30%] h-[28%] rounded-3xl"
              style={{ background: "linear-gradient(180deg,#c8d4b8,#9aab88)" }}
            />
            <div
              className="absolute left-[2%] right-[2%] top-[8%] h-[34%] rounded-3xl"
              style={{ background: "linear-gradient(180deg,#b5c4a3,#7d8f6c)" }}
            />
            <div className="absolute -left-[6%] bottom-[32%] h-[10%] w-[18%] rounded-xl bg-[#6b5344]" />
            <div className="absolute -right-[6%] bottom-[32%] h-[10%] w-[18%] rounded-xl bg-[#6b5344]" />
            {[14, 72].map((left) => (
              <div
                key={left}
                className="absolute bottom-[2%] h-[22%] w-[7%] rounded-lg bg-[#5c4030]"
                style={{ left: `${left}%` }}
              />
            ))}
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-2xl bg-black/50 p-2 backdrop-blur-xl">
          {["Studio", "Soft", "Sunset", "Interior"].map((x) => (
            <span key={x} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white">
              {x}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "viewer") {
    return (
      <div className="relative h-full min-h-[560px] overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_center,rgba(201,255,87,.20),transparent_55%),#f8fafc]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[58%] w-[46%]">
            <ChairSilhouette />
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-3 rounded-3xl bg-white/80 p-3 shadow-xl backdrop-blur-xl">
          {[
            { label: "Rotate", icon: RotateCw },
            { label: "Zoom", icon: Maximize2 },
            { label: "Fullscreen", icon: Box },
            { label: "AR", icon: Smartphone },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-950"
            >
              <Icon size={16} className="text-[#7ed600]" />
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[460px] overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_center,rgba(201,255,87,.18),transparent_55%),linear-gradient(135deg,#151b20,#050708)]">
      <div className="absolute inset-0 grid place-items-center p-8">
        <div className="relative w-full max-w-[280px] rounded-[36px] border-[10px] border-slate-800 bg-slate-950 p-3 shadow-2xl">
          <div className="overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_center,rgba(201,255,87,.22),transparent_60%),#0f1418]">
            <div className="flex h-8 items-center justify-center gap-1 border-b border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <span className="h-1.5 w-8 rounded-full bg-white/20" />
            </div>
            <div className="relative flex h-[360px] items-end justify-center px-6 pb-10">
              <div className="relative h-[58%] w-[72%]">
                <ChairSilhouette compact />
              </div>
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-black text-slate-950"
                style={{ background: LIME }}
              >
                View in your room
              </div>
            </div>
          </div>
        </div>
      </div>
      <Cuboid className="absolute right-8 top-8 text-[#C9FF57]/40" size={48} />
    </div>
  );
}

function ChairSilhouette({ compact = false }: { compact?: boolean }) {
  const scale = compact ? "scale-90" : "scale-100";
  return (
    <div className={`relative h-full w-full ${scale}`}>
      <div className="absolute inset-x-[10%] bottom-[12%] h-[12%] rounded-2xl bg-[#6b5344]" />
      <div className="absolute inset-x-[6%] bottom-[22%] h-[24%] rounded-3xl bg-[#aab892]" />
      <div className="absolute inset-x-[4%] top-[10%] h-[30%] rounded-3xl bg-[#95a67f]" />
      <div className="absolute -left-[4%] bottom-[24%] h-[9%] w-[16%] rounded-xl bg-[#6b5344]" />
      <div className="absolute -right-[4%] bottom-[24%] h-[9%] w-[16%] rounded-xl bg-[#6b5344]" />
      <div className="absolute bottom-[0%] left-[18%] h-[20%] w-[8%] rounded-lg bg-[#5c4030]" />
      <div className="absolute bottom-[0%] right-[18%] h-[20%] w-[8%] rounded-lg bg-[#5c4030]" />
      <div
        className="absolute left-[22%] top-[18%] h-[8%] w-[56%] rounded-full opacity-80"
        style={{ background: LIME }}
      />
    </div>
  );
}
