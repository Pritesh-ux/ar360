import type { ReactNode } from "react";
import { adminCardClass } from "./tokens";

type Props = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

const PADDING_CLASSES = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export default function AdminCard({ children, className = "", padding = "md" }: Props) {
  return <div className={`${adminCardClass} ${PADDING_CLASSES[padding]} ${className}`}>{children}</div>;
}
