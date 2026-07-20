"use client";

import { Search } from "lucide-react";
import { InputHTMLAttributes } from "react";

interface AdminSearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function AdminSearch({
  value,
  onChange,
  placeholder = "Search...",
  ...props
}: AdminSearchProps) {
  return (
    <div className="relative w-full sm:w-[390px]">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-semibold outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all"
        {...props}
      />
    </div>
  );
}
