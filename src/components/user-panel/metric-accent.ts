export type MetricAccent =
  | "lime"
  | "sky"
  | "violet"
  | "amber"
  | "mint"
  | "orange"
  | "emerald"
  | "blue"
  | "cyan"
  | "rose"
  | "slate";

export type MetricAccentStyle = {
  icon: string;
  iconGradient: string;
  spark: string;
};

export const metricAccentStyles: Record<MetricAccent, MetricAccentStyle> = {
  lime: {
    icon: "text-[#22C55E]",
    iconGradient: "from-[#DCFCE7] to-[#F0FDF4]",
    spark: "#22C55E",
  },
  sky: {
    icon: "text-[#3B82F6]",
    iconGradient: "from-[#DBEAFE] to-[#EFF6FF]",
    spark: "#3B82F6",
  },
  violet: {
    icon: "text-[#A855F7]",
    iconGradient: "from-[#F3E8FF] to-[#FAF5FF]",
    spark: "#A855F7",
  },
  amber: {
    icon: "text-[#F59E0B]",
    iconGradient: "from-[#FEF3C7] to-[#FFFBEB]",
    spark: "#F59E0B",
  },
  mint: {
    icon: "text-[#34D399]",
    iconGradient: "from-[#D1FAE5] to-[#ECFDF5]",
    spark: "#34D399",
  },
  orange: {
    icon: "text-[#F97316]",
    iconGradient: "from-[#FFEDD5] to-[#FFF7ED]",
    spark: "#F97316",
  },
  emerald: {
    icon: "text-[#10B981]",
    iconGradient: "from-[#D1FAE5] to-[#ECFDF5]",
    spark: "#10B981",
  },
  blue: {
    icon: "text-[#2563EB]",
    iconGradient: "from-[#DBEAFE] to-[#EFF6FF]",
    spark: "#2563EB",
  },
  cyan: {
    icon: "text-[#06B6D4]",
    iconGradient: "from-[#CFFAFE] to-[#ECFEFF]",
    spark: "#06B6D4",
  },
  rose: {
    icon: "text-[#F43F5E]",
    iconGradient: "from-[#FFE4E6] to-[#FFF1F2]",
    spark: "#F43F5E",
  },
  slate: {
    icon: "text-[#64748B]",
    iconGradient: "from-[#F1F5F9] to-[#F8FAFC]",
    spark: "#64748B",
  },
};

export function getMetricAccentStyles(accent: MetricAccent): MetricAccentStyle {
  return metricAccentStyles[accent];
}
