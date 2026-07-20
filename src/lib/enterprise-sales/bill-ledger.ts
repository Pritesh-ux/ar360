import type { CollectionStatus } from "./types";

export function computeCollectionStatus(totalPaise: number, paidPaise: number): CollectionStatus {
  const total = Math.max(0, Number(totalPaise) || 0);
  const paid = Math.max(0, Number(paidPaise) || 0);
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

export function remainingBalancePaise(totalPaise: number, paidPaise: number): number {
  return Math.max(0, Math.max(0, Number(totalPaise) || 0) - Math.max(0, Number(paidPaise) || 0));
}

/** Throws a message string if installment amount is not allowed against remaining balance. */
export function assertInstallmentFitsRemaining(
  amountPaise: number,
  remainingPaise: number,
): void {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Payment amount must be a positive paise amount");
  }
  if (amountPaise > remainingPaise) {
    throw new Error(
      `Payment amount exceeds remaining balance of ${(remainingPaise / 100).toFixed(2)}`,
    );
  }
}
