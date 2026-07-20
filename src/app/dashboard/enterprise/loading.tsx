export default function EnterpriseDashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading Enterprise dashboard">
      <div className="h-16 rounded-[22px] bg-[#F0F0F0]" />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="h-72 rounded-[22px] bg-[#F0F0F0]" />
        <div className="h-72 rounded-[22px] bg-[#E5E5E5]" />
      </div>
      <div className="h-80 rounded-[22px] bg-[#F0F0F0]" />
      <div className="h-64 rounded-[22px] bg-[#F0F0F0]" />
    </div>
  );
}
