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
    <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#ECECEC] bg-[#FAFAFA] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          disabled={disabled}
          className={`rounded-xl px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-60 ${
            value === option.id
              ? "bg-white text-[#111111] shadow-sm ring-1 ring-[#ECECEC]"
              : "text-[#737373] hover:bg-white/70 hover:text-[#111111]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
