import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWhatsAppHref, normalizeWhatsAppDigits } from "./whatsapp";
import { resolveViewerContact } from "./resolve";

describe("viewer WhatsApp helpers", () => {
  it("normalizes phone digits and rejects short values", () => {
    assert.equal(normalizeWhatsAppDigits("+91 98765 43210"), "919876543210");
    assert.equal(normalizeWhatsAppDigits("7600020239"), "917600020239");
    assert.equal(normalizeWhatsAppDigits("123"), "");
  });

  it("builds an encoded wa.me URL with product details", () => {
    const href = buildWhatsAppHref({
      number: "+919876543210",
      productTitle: "Oak Chair",
      productId: "prod_1",
      viewerUrl: "https://ar360studio.com/viewer/prod_1",
    });
    assert.ok(href);
    assert.ok(href!.startsWith("https://wa.me/919876543210?text="));
    const text = decodeURIComponent(href!.split("text=")[1] || "");
    assert.ok(text.includes("Oak Chair"));
    assert.ok(text.includes("prod_1"));
    assert.ok(text.includes("https://ar360studio.com/viewer/prod_1"));
  });
});

describe("resolveViewerContact", () => {
  it("hides WhatsApp when workspace is disabled and product uses defaults", () => {
    const resolved = resolveViewerContact(
      {
        whatsappNumber: "919876543210",
        whatsappEnabled: false,
        enquireEnabled: false,
        enquireLabel: "Enquire",
        whatsappLabel: "WhatsApp",
      },
      { contactUseCustom: false },
    );
    assert.equal(resolved.whatsappEnabled, false);
    assert.equal(resolved.enquireEnabled, false);
  });

  it("uses product override number when custom settings are on", () => {
    const resolved = resolveViewerContact(
      {
        whatsappNumber: "919111111111",
        whatsappEnabled: true,
        enquireEnabled: true,
        enquireLabel: "Enquire",
        whatsappLabel: "WhatsApp",
      },
      {
        contactUseCustom: true,
        contactWhatsappEnabled: true,
        contactEnquireEnabled: false,
        contactWhatsappNumber: "+919222222222",
      },
    );
    assert.equal(resolved.enquireEnabled, false);
    assert.equal(resolved.whatsappEnabled, true);
    assert.equal(resolved.whatsappNumber, "919222222222");
  });

  it("hides Enquire and WhatsApp when the owner plan is not allowed", () => {
    const resolved = resolveViewerContact(
      {
        whatsappNumber: "919876543210",
        whatsappEnabled: true,
        enquireEnabled: true,
        enquireLabel: "Enquire",
        whatsappLabel: "WhatsApp",
      },
      { contactUseCustom: false },
      { planAllowed: false },
    );
    assert.equal(resolved.enquireEnabled, false);
    assert.equal(resolved.whatsappEnabled, false);
  });

  it("uses client profile phone over workspace and product numbers", () => {
    const resolved = resolveViewerContact(
      {
        whatsappNumber: "919111111111",
        whatsappEnabled: false,
        enquireEnabled: false,
        enquireLabel: "Enquire",
        whatsappLabel: "WhatsApp",
      },
      {
        contactUseCustom: true,
        contactWhatsappEnabled: true,
        contactEnquireEnabled: false,
        contactWhatsappNumber: "+919222222222",
      },
      { clientPhone: "7600020239" },
    );
    assert.equal(resolved.whatsappEnabled, true);
    assert.equal(resolved.whatsappNumber, "917600020239");
    assert.equal(resolved.enquireEnabled, true);
  });
});
