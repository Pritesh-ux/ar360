import assert from "node:assert/strict";
import test from "node:test";
import { selectEmailProvider } from "./delivery-config";

test("SMTP has priority when both live providers are configured", () => {
  assert.equal(
    selectEmailProvider({
      emailEnabled: true,
      smtpEnabled: true,
      smtpConfigured: true,
      resendEnabled: true,
      resendConfigured: true,
    }),
    "smtp",
  );
});

test("Resend becomes live provider when SMTP is off or incomplete", () => {
  assert.equal(
    selectEmailProvider({
      emailEnabled: true,
      smtpEnabled: false,
      smtpConfigured: false,
      resendEnabled: true,
      resendConfigured: true,
    }),
    "resend",
  );
  assert.equal(
    selectEmailProvider({
      emailEnabled: true,
      smtpEnabled: true,
      smtpConfigured: false,
      resendEnabled: true,
      resendConfigured: true,
    }),
    "resend",
  );
});

test("global email switch disables every provider", () => {
  assert.equal(
    selectEmailProvider({
      emailEnabled: false,
      smtpEnabled: true,
      smtpConfigured: true,
      resendEnabled: true,
      resendConfigured: true,
    }),
    "disabled",
  );
});

test("reports unconfigured when no enabled provider is ready", () => {
  assert.equal(
    selectEmailProvider({
      emailEnabled: true,
      smtpEnabled: true,
      smtpConfigured: false,
      resendEnabled: true,
      resendConfigured: false,
    }),
    "unconfigured",
  );
});
