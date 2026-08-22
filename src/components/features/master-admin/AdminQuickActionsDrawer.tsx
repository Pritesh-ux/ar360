"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Mail, X, Zap } from "lucide-react";
import type { MasterAdminQuickAction } from "./nav";
import ViewportPortal from "@/components/shared/ViewportPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  actions: MasterAdminQuickAction[];
  onComposeMail?: () => void;
};

export default function AdminQuickActionsDrawer({ open, onClose, actions, onComposeMail }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ViewportPortal>
      <div className="fixed inset-0 z-[99999]" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
          aria-label="Close quick actions"
          onClick={onClose}
        />
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Quick Actions"
          className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[#4D9A00]">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-900">Quick Actions</p>
                <p className="text-xs font-medium text-slate-500">Shortcuts based on your role</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close quick actions panel"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {onComposeMail ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onComposeMail();
                }}
                className="flex w-full items-start gap-3 rounded-2xl border border-[#A6FF2E]/60 bg-[#F7FCE8] p-4 text-left transition hover:border-[#7BC800]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#4D9A00]">
                  <Mail size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">Compose mail</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    Manual email with quote / invoice / payment link · WhatsApp too
                  </p>
                </div>
                <ArrowRight size={16} className="mt-1 shrink-0 text-[#4D9A00]" />
              </button>
            ) : null}

            {actions.length === 0 && !onComposeMail ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
                No quick actions available for your current permissions.
              </p>
            ) : null}

            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href + action.name}
                  href={action.href}
                  onClick={onClose}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-white">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{action.name}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{action.description}</p>
                  </div>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300 group-hover:text-[#4D9A00]" />
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </ViewportPortal>
  );
}
