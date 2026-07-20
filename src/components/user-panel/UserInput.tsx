import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const INPUT_CLASS =
  "user-panel-input h-11 w-full rounded-[14px] border border-[#ECECEC] bg-white px-4 text-sm text-[#111111] outline-none transition";

export function UserInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${INPUT_CLASS} ${className}`.trim()} {...rest} />;
}

export function UserSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${INPUT_CLASS} ${className}`.trim()} {...rest} />;
}

export function UserTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      className={`user-panel-input min-h-[120px] w-full rounded-[14px] border border-[#ECECEC] bg-white px-4 py-2.5 text-sm text-[#111111] outline-none transition ${className}`.trim()}
      {...rest}
    />
  );
}

export function UserField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ""}`.trim()}>
      <span className="mb-1.5 block text-sm font-semibold text-[#525252]">{label}</span>
      {children}
      {hint ? <span className="up-hint mt-1 block text-xs">{hint}</span> : null}
    </label>
  );
}
