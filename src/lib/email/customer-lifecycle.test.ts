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
  assert.match(email.html, /cid:ar360-wordmark@ar360studio/);
  assert.match(email.text, /Your plan & invoice are ready/);
});

test("absoluteAppUrl joins application URL and paths", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const previousApp = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NEXT_PUBLIC_APP_URL = "https://ar360.example/";
  delete process.env.APP_URL;
  try {
    assert.equal(absoluteAppUrl("/dashboard/billing"), "https://ar360.example/dashboard/billing");
    assert.equal(absoluteAppUrl("dashboard"), "https://ar360.example/dashboard");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("absoluteAppUrl rejects localhost in production", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const previousApp = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  delete process.env.APP_URL;
  try {
    assert.equal(absoluteAppUrl("/dashboard/billing"), "https://ar360studio.com/dashboard/billing");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
    if (previousApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousApp;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
