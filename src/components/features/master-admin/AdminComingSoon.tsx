import Link from "next/link";
import AdminPageHeader from "./AdminPageHeader";

type Props = {
  title: string;
  subtitle?: string;
  sections?: string[];
  existingHref?: string;
  existingLabel?: string;
};

export default function AdminComingSoon({
  title,
  subtitle = "This module is part of the master admin redesign and will be available in the next phase.",
  sections = [],
  existingHref,
  existingLabel,
}: Props) {
  return (
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader title={title} subtitle={subtitle} />

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 md:p-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#A6FF2E]/15 text-2xl">
            🚧
          </div>
          <h2 className="mt-5 text-xl font-black text-slate-900">Coming in next phase</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            The shell, navigation, and dashboard have been updated. This section will be built out with
            full data wiring next.
          </p>

          {sections.length > 0 && (
            <ul className="mt-8 grid gap-2 text-left sm:grid-cols-2">
              {sections.map((section) => (
                <li
                  key={section}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7AE02E]" />
                  {section}
                </li>
              ))}
            </ul>
          )}

          {existingHref && (
            <Link
              href={existingHref}
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#A6FF2E] px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-[#96F01E]"
            >
              {existingLabel || "Open related page"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
