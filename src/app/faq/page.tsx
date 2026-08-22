import LegalLayout from "@/components/shared/LegalLayout";
import Link from "next/link";
import { getMarketingChrome } from "@/lib/website/marketing-chrome";

export const metadata = {
  title: "FAQ — AR360 Studio",
};

export const revalidate = 15;

export default async function FaqPage() {
  const chrome = await getMarketingChrome();

  return (
    <LegalLayout title="Frequently asked questions" chrome={chrome}>
      <p>
        Answers to common questions about AR360 Studio — 3D viewers, AR previews, billing, and
        sharing.
      </p>

      <h2>What is AR360 Studio?</h2>
      <p>
        AR360 Studio lets furniture and product brands upload 3D models, publish interactive viewers,
        generate QR codes, and track customer engagement across web and mobile AR.
      </p>

      <h2>Which file formats are supported?</h2>
      <p>
        GLB is the primary format for web and Android AR. USDZ is supported for iOS Quick Look AR.
        Posters and thumbnails can be JPG, PNG, or WebP.
      </p>

      <h2>How do customers view products in AR?</h2>
      <p>
        Share the product link or QR code. On supported devices, customers tap View in AR to place
        the model in their space using the device camera.
      </p>

      <h2>Can I embed the viewer on my website?</h2>
      <p>
        Yes. Each product includes an embed snippet for Shopify, WooCommerce, or any site that
        supports iframe embeds.
      </p>

      <h2>How does billing work?</h2>
      <p>
        Plans include product, storage, and bandwidth limits. You can start on a trial, upgrade from
        Settings → Billing, and download invoices from the same area.
      </p>

      <h2>Where is my data stored?</h2>
      <p>
        Product assets are stored in your tenant folder on disk or cloud storage (when configured).
        Analytics events are stored in your AR360 database account.
      </p>

      <h2>Need more help?</h2>
      <p>
        Visit the <Link href="/contact">contact page</Link> or email support from your dashboard
        settings.
      </p>
    </LegalLayout>
  );
}
