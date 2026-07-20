type Props = {
  message: string;
  variant?: "success" | "error" | "info";
  className?: string;
};

const styles = {
  success: "border-emerald-100 bg-emerald-50 text-emerald-800",
  error: "border-red-100 bg-red-50 text-red-700",
  info: "border-sky-100 bg-sky-50 text-sky-800",
};

export default function AdminActionMessage({ message, variant = "info", className = "" }: Props) {
  if (!message) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-[13px] font-semibold ${styles[variant]} ${className}`}
      role="status"
    >
      {message}
    </div>
  );
}
