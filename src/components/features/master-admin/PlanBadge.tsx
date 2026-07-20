import StatusBadge from "@/components/ui/admin/StatusBadge";
import { planLabel } from "./customers-utils";

type Props = {
  planId: string;
  className?: string;
};

export default function PlanBadge({ planId, className = "" }: Props) {
  return (
    <StatusBadge
      label={planLabel(planId)}
      domain="plan"
      value={planId}
      uppercase
      className={className}
    />
  );
}
