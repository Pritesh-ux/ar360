"use client";

import { useState, type ChangeEventHandler } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInputClassName } from "./AuthFormPrimitives";

type PasswordInputProps = {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export default function PasswordInput({
  name,
  placeholder,
  autoComplete,
  required = true,
  className,
  value,
  onChange,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${authInputClassName()} ${className ?? ""} pr-11`}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] transition hover:text-[#525252]"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
