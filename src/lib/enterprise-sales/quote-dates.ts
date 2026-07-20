/** Client-safe date helpers for Enterprise quotes (no pdfkit / Node fs). */

export function parseQuoteDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly && !raw.includes("T") && raw.length <= 10) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatQuoteDate(value: string | Date | null | undefined): string {
  const d = parseQuoteDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function addBillingPeriod(start: Date, cycle: "monthly" | "yearly"): Date {
  const end = new Date(start);
  if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return end;
}

export function resolveQuoteServicePeriod(input: {
  billing_cycle: "monthly" | "yearly";
  created_at?: string | Date | null;
  period_starts_on?: string | Date | null;
  period_ends_on?: string | Date | null;
}): {
  startsOn: Date;
  endsOn: Date;
  isEstimated: boolean;
} {
  const explicitStart = parseQuoteDate(input.period_starts_on);
  const explicitEnd = parseQuoteDate(input.period_ends_on);
  if (explicitStart && explicitEnd) {
    return { startsOn: explicitStart, endsOn: explicitEnd, isEstimated: false };
  }
  const start = parseQuoteDate(input.created_at) || new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  return {
    startsOn: startDay,
    endsOn: addBillingPeriod(startDay, input.billing_cycle),
    isEstimated: true,
  };
}
