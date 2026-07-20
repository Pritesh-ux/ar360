import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteAppUrl,
  renderCustomerLifecycleEmail,
} from "./templates/customer-lifecycle";

test("customer lifecycle template escapes customer and event content", () => {
  const email = renderCustomerLifecycleEmail("<Admin>", {
    subject: "Plan active",
    title: "Welcome <script>",
    intro: "Your plan & invoice are ready.",
    details: [{ label: "Invoice", value: "INV-<1>" }],
    actionLabel: "Open billing",
    actionUrl: "https://example.com/dashboard?tab=billing&paid=1",
  });

  assert.equal(email.subject, "Plan active");
  assert.match(email.html, /Hi &lt;Admin&gt;/);
  assert.match(email.html, /Welcome &lt;script&gt;/);
  assert.match(email.html, /INV-&lt;1&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /Your plan & invoice are ready/);
});

test("absoluteAppUrl joins application URL and paths", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://ar360.example/";
  try {
    assert.equal(absoluteAppUrl("/dashboard/billing"), "https://ar360.example/dashboard/billing");
    assert.equal(absoluteAppUrl("dashboard"), "https://ar360.example/dashboard");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});
