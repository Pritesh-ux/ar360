import LegalLayout from "@/components/shared/LegalLayout";

export const metadata = {
  title: "Terms of Service — AR360 Studio",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of service">
      <p>Last updated: July 2026</p>

      <p>
        By accessing AR360 Studio you agree to these terms. If you do not agree, do not use the
        service.
      </p>

      <h2>Service</h2>
      <p>
        AR360 Studio provides tools to host 3D models, publish viewers, generate QR/embed links, and
        view analytics. Features vary by plan and may change as the product evolves.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for safeguarding login credentials and for activity under your account.
        You must provide accurate registration information and comply with applicable laws.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Upload only content you have rights to distribute.</li>
        <li>Do not upload malware, illegal content, or material that infringes third-party rights.</li>
        <li>Do not attempt to bypass plan limits, security controls, or other customers&apos; data.</li>
      </ul>

      <h2>Plans &amp; billing</h2>
      <p>
        Paid plans renew according to the billing cycle selected at checkout unless cancelled. Fees
        are non-refundable except where required by law or explicitly approved by AR360 Studio support.
      </p>

      <h2>Availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. Maintenance, third-party
        outages, or force majeure may cause downtime.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, AR360 Studio is not liable for indirect or consequential
        damages arising from use of the platform. Our total liability is limited to fees paid in the
        twelve months before the claim.
      </p>

      <h2>Contact</h2>
      <p>
        Legal inquiries: <a href="mailto:legal@ar360.studio">legal@ar360.studio</a>
      </p>
    </LegalLayout>
  );
}
