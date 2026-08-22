import { getPlatformSettings } from "@/lib/master-admin-settings";
import ArViewClient from "./ArViewClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ArViewPage() {
  const settings = await getPlatformSettings();
  const modelSrc = settings.landingHeroModel || "/models/chair_01.glb";

  return <ArViewClient modelSrc={modelSrc} />;
}
