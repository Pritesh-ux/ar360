/** Master Admin platform toggle for Object Capture availability. */
export async function isObjectCapturePlatformEnabled() {
  const { getPlatformSettings } = await import("@/lib/master-admin-settings");
  const settings = await getPlatformSettings();
  return settings.objectCaptureEnabled !== false;
}
