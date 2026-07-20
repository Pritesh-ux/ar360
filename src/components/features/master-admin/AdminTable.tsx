import type { ReactNode } from "react";
import { adminCardCompactClass } from "@/components/ui/admin/tokens";

interface AdminTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
  alignRightIndex?: number[]; // indices of columns to align right
  minWidth?: string;
}

export default function AdminTable({
  headers,
  children,
  className = "",
  alignRightIndex = [],
  minWidth = "1100px",
}: AdminTableProps) {
  return (
    <div className={`w-full overflow-x-auto ${adminCardCompactClass} ${className}`}>
      <table className="w-full text-left text-sm border-collapse" style={{ minWidth }}>
        <thead className="bg-slate-50 text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`p-3 md:p-4 font-black ${alignRightIndex.includes(idx) ? "text-right" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {children}
        </tbody>
      </table>
    </div>
  );
}
