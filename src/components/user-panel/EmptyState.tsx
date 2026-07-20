import type { ReactNode } from "react";
import Link from "next/link";
import UserButton from "@/components/user-panel/UserButton";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
};

export default function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--ar-radius-xl)] border border-dashed border-[var(--ar-border)] bg-white px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-[var(--ar-radius-lg)] bg-[var(--ar-primary-soft)] text-[var(--ar-text)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--ar-text)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-[14px] leading-6 text-[var(--ar-text-muted)]">{description}</p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            primaryAction.href ? (
              <Link href={primaryAction.href}>
                <UserButton>{primaryAction.label}</UserButton>
              </Link>
            ) : (
              <UserButton onClick={primaryAction.onClick}>{primaryAction.label}</UserButton>
            )
          ) : null}
          {secondaryAction ? (
            secondaryAction.href ? (
              <Link href={secondaryAction.href}>
                <UserButton variant="outline">{secondaryAction.label}</UserButton>
              </Link>
            ) : (
              <UserButton variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </UserButton>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
