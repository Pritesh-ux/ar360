"use client";

import { scorePasswordStrength, type PasswordStrengthLevel } from "@/lib/auth/password-strength";

const BAR_COLORS: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
  weak: "bg-red-500",
  fair: "bg-amber-500",
  good: "bg-lime-500",
  strong: "bg-emerald-600",
};

const LABEL_COLORS: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
  weak: "text-red-600",
  fair: "text-amber-700",
  good: "text-[#6b9008]",
  strong: "text-emerald-700",
};

export default function PasswordStrengthMeter({ password }: { password: string }) {
  const result = scorePasswordStrength(password);
  const active = result.level === "empty" ? 0 : result.score;
  const barColor =
    result.level === "empty" ? "bg-[#E5E7EB]" : BAR_COLORS[result.level];

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex gap-1.5" role="meter" aria-label="Password strength" aria-valuenow={active} aria-valuemin={0} aria-valuemax={4}>
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              active >= step ? barColor : "bg-[#E5E7EB]"
            }`}
          />
        ))}
      </div>
      {result.level === "empty" ? (
        <p className="text-[12px] text-[#A3A3A3]">
          At least 8 characters with uppercase, lowercase, and a number.
        </p>
      ) : (
        <p className="text-[12px] text-[#737373]">
          <span className={`font-semibold ${LABEL_COLORS[result.level]}`}>{result.label}</span>
          {" — "}
          {result.hint}
        </p>
      )}
    </div>
  );
}
