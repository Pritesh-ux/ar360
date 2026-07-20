import AdminComingSoon from "@/components/features/master-admin/AdminComingSoon";

export default function DatabaseManagerPage() {
  return (
    <AdminComingSoon
      title="Database Manager"
      sections={[
        "Users, Products, Materials modules",
        "Orders & Invoices browser",
        "Logs & settings tables",
        "Read-only query tools",
      ]}
    />
  );
}
