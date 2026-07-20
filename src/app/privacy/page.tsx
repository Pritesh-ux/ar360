import LegalLayout from "@/components/shared/LegalLayout";

export const metadata = {
  title: "Privacy Policy — AR360 Studio",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>Last updated: July 2026</p>

      <p>
        AR360 Studio (&quot;we&quot;, &quot;us&quot;) provides a SaaS platform for 3D and AR product
        experiences. This policy describes how we collect, use, and protect information when you use
        our website and dashboard.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details such as name, email, company, and billing information.</li>
        <li>Product assets and metadata you upload to the platform.</li>
        <li>Viewer analytics such as page views, device type, country, and engagement events.</li>
        <li>Technical logs required for security, abuse prevention, and service reliability.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Provide and improve the AR360 Studio service.</li>
        <li>Process subscriptions and invoices.</li>
        <li>Show analytics dashboards to account owners.</li>
        <li>Detect fraud, enforce plan limits, and protect customer assets.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell personal data. We use payment processors (such as Razorpay) and infrastructure
        providers only as needed to operate the service. Viewer analytics may include hashed IP data
        for abuse prevention.
      </p>

      <h2>Retention</h2>
      <p>
        Account data is retained while your subscription is active. Analytics may be trimmed per plan
        settings. You may request deletion by contacting support.
      </p>

      <h2>Security</h2>
      <p>
        We use encrypted sessions, tenant-isolated storage paths, rate limiting, and access controls.
        No method of transmission over the Internet is 100% secure; we continuously improve our
        safeguards.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href="mailto:privacy@ar360.studio">privacy@ar360.studio</a>
      </p>
    </LegalLayout>
  );
}
