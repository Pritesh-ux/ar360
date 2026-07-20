"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

export type UserActionMenuItem = {
  id?: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  /** Force a separator line above this item. Auto-added before the first danger item. */
  separatorBefore?: boolean;
};

type TriggerProps = {
  className?: string;
  "aria-label"?: string;
};

type Props = {
  items: UserActionMenuItem[];
  align?: "left" | "right";
  triggerClassName?: string;
  triggerProps?: TriggerProps;
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const PANEL_CLASS =
  "w-[190px] overflow-hidden rounded-[16px] border border-[#E8EAED] bg-white p-0 shadow-[0_12px_32px_rgba(15,23,42,0.12)]";

const TRIGGER_CLASS =
  "grid h-8 w-8 place-items-center rounded-full border border-[#111111] bg-white text-[#111111] transition hover:bg-[#FAFAFA]";

const ITEM_CLASS =
  "flex h-11 w-full items-center gap-3 px-4 text-left text-[13px] font-semibold transition-colors";

export function UserActionMenuPanel({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent) => void;
}) {
  return (
    <div className={`${PANEL_CLASS} ${className}`.trim()} onClick={onClick}>
      {children}
    </div>
  );
}

export function UserActionMenuItemButton({
  icon,
  label,
  onClick,
  href,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = [
    ITEM_CLASS,
    danger
      ? "text-red-600 hover:bg-red-50"
      : "text-[#525252] hover:bg-[#F5F5F5] hover:text-[#111111]",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        <span className="shrink-0 text-current [&_svg]:size-4">{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <span className="shrink-0 text-current [&_svg]:size-4">{icon}</span>
      {label}
    </button>
  );
}

function withSeparators(items: UserActionMenuItem[]) {
  let sawDanger = false;
  return items.map((item, index) => {
    const autoSep = Boolean(item.danger) && !sawDanger && index > 0;
    if (item.danger) sawDanger = true;
    return {
      ...item,
      separatorBefore: Boolean(item.separatorBefore || autoSep),
    };
  });
}

export function renderUserActionMenuItems(
  items: UserActionMenuItem[],
  onAfterSelect?: () => void,
) {
  return withSeparators(items).map((item, index) => (
    <div key={item.id || `${item.label}-${index}`}>
      {item.separatorBefore ? <div className="border-t border-[#ECECEC]" /> : null}
      <UserActionMenuItemButton
        icon={item.icon}
        label={item.label}
        href={item.href}
        danger={item.danger}
        onClick={() => {
          item.onClick?.();
          onAfterSelect?.();
        }}
      />
    </div>
  ));
}

export default function UserActionMenu({
  items,
  align = "right",
  triggerClassName = "",
  triggerProps,
  open: openProp,
  onOpenChange,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setUncontrolledOpen(next);
    },
    [onOpenChange, openProp],
  );

  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 190;
    const height = menuRef.current?.offsetHeight || items.length * 44 + 8;
    const gap = 8;
    const preferredLeft = align === "right" ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(12, preferredLeft),
      Math.max(12, window.innerWidth - width - 12),
    );
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 12;
    const top = fitsBelow ? rect.bottom + gap : Math.max(12, rect.top - height - gap);
    setCoords({ top, left });
  }, [align, items.length]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onViewport = () => updatePosition();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, setOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title="More actions"
        aria-label={triggerProps?.["aria-label"] || "More actions"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className={`${TRIGGER_CLASS} ${triggerClassName} ${triggerProps?.className || ""}`.trim()}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[9999] ${PANEL_CLASS}`}
              style={{ top: coords.top, left: coords.left }}
              onClick={(event) => event.stopPropagation()}
            >
              {renderUserActionMenuItems(items, () => setOpen(false))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
