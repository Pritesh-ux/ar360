import type { ReactNode } from "react";
import { adminTablePanelClass } from "./tokens";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function AdminTablePanel({ children, className = "" }: Props) {
  return <section className={`${adminTablePanelClass} ${className}`}>{children}</section>;
}
