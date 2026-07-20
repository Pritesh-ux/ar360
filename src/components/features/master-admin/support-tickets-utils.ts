import { resolveStatusClass } from "@/components/ui/admin/status-resolver";

export type TicketStatus = "Open" | "Pending" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High";

export function ticketStatusClass(status: TicketStatus | string) {
  return resolveStatusClass("ticketStatus", status);
}

export function ticketPriorityClass(priority: TicketPriority | string) {
  return resolveStatusClass("ticketPriority", priority);
}

export function ticketStatusLabel(status: string): TicketStatus {
  const key = status.toLowerCase();
  if (key === "pending") return "Pending";
  if (key === "resolved") return "Resolved";
  if (key === "closed") return "Closed";
  return "Open";
}

export function ticketPriorityLabel(priority: string): TicketPriority {
  const key = priority.toLowerCase();
  if (key === "high") return "High";
  if (key === "low") return "Low";
  return "Medium";
}

export function ticketCategoryLabel(category: string) {
  const key = category.toLowerCase();
  if (key === "billing") return "Billing & Payments";
  if (key === "account") return "Account & Access";
  if (key === "feature") return "Feature Request";
  if (key === "other") return "Other";
  return "Technical Issue";
}

export function fmtDateTime(d: string | Date | null) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateShort(d: string | Date | null) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
