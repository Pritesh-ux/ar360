import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSignupForm, validatePasswordPolicy } from "./signup-validation";
import { isOnboardingExemptPath } from "./onboarding-paths";
import { isOnboardingComplete } from "./onboarding.service";

describe("validatePasswordPolicy", () => {
  it("requires mixed case and number", () => {
    assert.equal(validatePasswordPolicy("short"), "Password must be at least 8 characters.");
    assert.equal(validatePasswordPolicy("alllowercase1"), "Password must include at least one uppercase letter.");
    assert.equal(validatePasswordPolicy("ALLUPPERCASE1"), "Password must include at least one lowercase letter.");
    assert.equal(validatePasswordPolicy("NoNumbers"), "Password must include at least one number.");
    assert.equal(validatePasswordPolicy("ValidPass1"), null);
  });
});

describe("validateSignupForm", () => {
  it("rejects missing company name", () => {
    const result = validateSignupForm({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "ValidPass1",
      confirmPassword: "ValidPass1",
      companyName: "",
    });
    assert.equal(result.ok, false);
  });

  it("rejects password mismatch", () => {
    const result = validateSignupForm({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "ValidPass1",
      confirmPassword: "ValidPass2",
      companyName: "Acme",
    });
    assert.equal(result.ok, false);
  });

  it("accepts valid signup payload", () => {
    const result = validateSignupForm({
      name: "Jane Doe",
      email: "Jane@Example.com",
      password: "ValidPass1",
      confirmPassword: "ValidPass1",
      companyName: "Acme Studio",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.normalizedEmail, "jane@example.com");
  });
});

describe("onboarding route helpers", () => {
  it("treats missing onboarding as complete for legacy users", () => {
    assert.equal(isOnboardingComplete(null), true);
  });

  it("detects incomplete onboarding", () => {
    assert.equal(
      isOnboardingComplete({
        customerUid: "CUS-1",
        status: "in_progress",
        currentStep: 2,
        completedAt: null,
        skippedAt: null,
        businessType: null,
        primaryGoal: null,
        secondaryGoals: [],
        preferredCreationMethod: null,
        sampleProductCreated: false,
        sampleProductId: null,
        checklistDismissedAt: null,
      }),
      false,
    );
  });

  it("exempts billing and settings from onboarding redirect", () => {
    assert.equal(isOnboardingExemptPath("/dashboard/billing"), true);
    assert.equal(isOnboardingExemptPath("/dashboard/settings"), true);
    assert.equal(isOnboardingExemptPath("/dashboard/products"), false);
  });
});
