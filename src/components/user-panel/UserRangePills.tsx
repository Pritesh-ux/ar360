type Option = {
  id: string;
  label: string;
};

type Props = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export default function UserRangePills({ options, value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-1">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={`rounded-[14px] px-3.5 py-2 text-[12px] font-semibold transition-all duration-[250ms] disabled:opacity-60 ${
              active
                ? "dash-tab-pill--active bg-[#B6FF38] text-[#102000] shadow-[0_2px_8px_rgba(182,255,56,0.3)]"
                : "text-[#6B7280] hover:bg-white hover:text-[#111827]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
