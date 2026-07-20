import { Box, Eye, Smartphone } from "lucide-react";

type Props = {
  views?: number;
  arOpens?: number;
  qrScans?: number;
};

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return value.toLocaleString("en-IN");
}

export default function ProductStats({ views = 0, arOpens = 0, qrScans = 0 }: Props) {
  const items = [
    { icon: Eye, label: "Views", value: views },
    { icon: Smartphone, label: "AR", value: arOpens },
    { icon: Box, label: "QR", value: qrScans },
  ];

  return (
    <div className="up-product-card-stats grid grid-cols-3 gap-1 border-t border-[#F0F0F0] pt-2.5">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="min-w-0 text-center">
          <Icon size={13} strokeWidth={2} className="mx-auto text-[#A3A3A3]" />
          <p className="mt-1 text-[13px] font-semibold leading-none text-[#111111]">{formatCount(value)}</p>
          <p className="mt-0.5 text-[10px] font-medium text-[#737373]">{label}</p>
        </div>
      ))}
    </div>
  );
}
