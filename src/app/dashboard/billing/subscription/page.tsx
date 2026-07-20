import { redirect } from "next/navigation";

export default async function LegacySubscriptionPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;
  const queryString = new URLSearchParams(searchParams).toString();
  redirect(`/dashboard/subscription${queryString ? `?${queryString}` : ""}`);
}
