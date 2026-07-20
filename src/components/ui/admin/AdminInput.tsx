import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { adminInputClass, adminInputSoftClass } from "./tokens";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  soft?: boolean;
};

export function AdminInput({ soft = false, className = "", ...props }: InputProps) {
  return <input className={`${soft ? adminInputSoftClass : adminInputClass} ${className}`} {...props} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function AdminSelect({ className = "", ...props }: SelectProps) {
  return <select className={`${adminInputClass} ${className}`} {...props} />;
}
