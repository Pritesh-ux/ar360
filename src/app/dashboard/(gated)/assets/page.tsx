import { redirect } from "next/navigation";

export default function AssetsRemovedPage() {
  redirect("/dashboard/products");
}
