import type { ReactNode } from "react";

interface AdminTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
  alignRightIndex?: number[];
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
    <div className={`dash-premium-card ma-table-scroll w-full ${className}`}>
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] md:text-xs">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                scope="col"
                className={`whitespace-nowrap p-3 md:p-4 ${alignRightIndex.includes(idx) ? "text-right" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#ECECEC]">{children}</tbody>
      </table>
    </div>
  );
}
