import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyShowcaseReorder,
  softDeleteShowcase,
} from "@/lib/website/landing-editor.service";
import {
  isSafeCardLinkOrLabel,
  isSafeLandingUrl,
  isSafeMediaPath,
  sanitizeStyleSettings,
  validateLandingDocument,
  LandingEditorValidationError,
} from "@/lib/website/landing-editor.validation";
import { resolveCmsTarget } from "@/lib/website/landing-editor.targets";
import type { LandingEditorDocument, LandingShowcaseDoc } from "@/lib/website/landing-editor.types";

function sampleDoc(): LandingEditorDocument {
  return validateLandingDocument({
    version: 1,
    settings: {
      free_trial_popup_title: "Try *AR360*",
      free_trial_popup_phone_image: "/home/free-trial-ar-phone.png",
      social_instagram: "https://instagram.com/ar360",
    },
    navigation: [
      {
        nav_uid: "wn_1",
        menu_type: "navbar",
        label: "Features",
        link_url: "#features",
        parent_uid: null,
        sort_order: 0,
        icon: null,
        visibility: true,
      },
    ],
    sections: [
      {
        section_uid: "ws_hero",
        page_uid: "wp_home",
        section_key: "hero",
        title: "Hero",
        subtitle: "Sub",
        description: "Desc",
        buttons: [{ label: "Start", href: "/signup", style: "primary" }],
        images: [],
        background: "bg-white",
        visibility: true,
        sort_order: 0,
        glb_model_uid: null,
        glb_settings: {},
        style_settings: { spacing: "normal", align: "left", fontSize: "md", textColor: "#111111" },
      },
    ],
    cards: [],
    categories: [
      {
        category_uid: "cat_furniture",
        slug: "furniture",
        name: "Furniture",
        icon: "sofa",
        color: null,
        description: "",
        sort_order: 0,
        visibility: true,
        deleted_at: null,
      },
    ],
    showcases: [
      {
        showcase_uid: "sh_furniture",
        category_uid: "cat_furniture",
        name: "Furniture",
        slug: "furniture",
        title: "In-room",
        subtitle: "Furniture",
        description: "Desc",
        cta_label: "Start",
        cta_link: "/signup",
        glb_model_uid: null,
        glb_settings: {},
        image_path: "/home/use-cases/furniture.webp",
        benefits: ["A", "B"],
        style_settings: {},
        sort_order: 0,
        visibility: true,
        deleted_at: null,
      },
      {
        showcase_uid: "sh_tiles",
        category_uid: "cat_tiles",
        name: "Tiles",
        slug: "tiles",
        title: "Tiles",
        subtitle: "Tiles",
        description: "Desc",
        cta_label: "Start",
        cta_link: "/signup",
        glb_model_uid: null,
        glb_settings: {},
        image_path: "/home/use-cases/tiles.webp",
        benefits: [],
        style_settings: {},
        sort_order: 1,
        visibility: true,
        deleted_at: null,
      },
    ],
  });
}

describe("landing-editor validation", () => {
  it("accepts allowlisted style presets and strips unknown keys", () => {
    const style = sanitizeStyleSettings({
      spacing: "spacious",
      align: "center",
      fontSize: "xl",
      textColor: "#B9FF2C",
      evil: "display:none",
      backgroundColor: "red",
    });
    assert.equal(style.spacing, "spacious");
    assert.equal(style.align, "center");
    assert.equal(style.fontSize, "xl");
    assert.equal(style.textColor, "#B9FF2C");
    assert.equal(style.backgroundColor, undefined);
    assert.equal((style as any).evil, undefined);
  });

  it("rejects unsafe URLs and javascript protocol", () => {
    assert.equal(isSafeLandingUrl("/signup"), true);
    assert.equal(isSafeLandingUrl("#features"), true);
    assert.equal(isSafeLandingUrl("https://ar360studio.com"), true);
    assert.equal(isSafeLandingUrl("javascript:alert(1)"), false);
    assert.equal(isSafeLandingUrl("//evil.com"), false);
    assert.equal(isSafeMediaPath("/uploads/assets/a.png"), true);
    assert.equal(isSafeMediaPath("/home/../etc/passwd"), false);
  });

  it("validates a full editor document", () => {
    const doc = sampleDoc();
    assert.equal(doc.version, 1);
    assert.equal(doc.sections[0].style_settings.textColor, "#111111");
    assert.deepEqual(doc.showcases[0].benefits, ["A", "B"]);
  });

  it("allows share-portal step labels in card.button_link", () => {
    const doc = validateLandingDocument({
      version: 1,
      settings: {},
      navigation: [],
      sections: [],
      cards: [
        {
          card_uid: "wcard_share_1",
          section_uid: "ws_share_portal",
          title: "Create QR",
          description: "Step",
          image_path: null,
          glb_path: null,
          button_label: "QrCode",
          button_link: "Generate QR",
          features: [],
          sort_order: 0,
          visibility: true,
          style_settings: {},
        },
      ],
      categories: [],
      showcases: [],
    });
    assert.equal(doc.cards[0].button_link, "Generate QR");
    assert.equal(isSafeCardLinkOrLabel("Generate QR"), true);
    assert.equal(isSafeCardLinkOrLabel("javascript:alert(1)"), false);
  });

  it("rejects invalid document version", () => {
    assert.throws(
      () =>
        validateLandingDocument({
          version: 99,
          settings: {},
          navigation: [],
          sections: [],
          cards: [],
          categories: [],
          showcases: [],
        }),
      LandingEditorValidationError,
    );
  });
});

describe("landing-editor showcases", () => {
  it("reorders deterministically", () => {
    const showcases = sampleDoc().showcases as LandingShowcaseDoc[];
    const next = applyShowcaseReorder(showcases, ["sh_tiles", "sh_furniture"]);
    assert.equal(next[0].showcase_uid, "sh_tiles");
    assert.equal(next[0].sort_order, 0);
    assert.equal(next[1].showcase_uid, "sh_furniture");
    assert.equal(next[1].sort_order, 1);
  });

  it("soft-deletes without removing the row from the document", () => {
    const showcases = sampleDoc().showcases as LandingShowcaseDoc[];
    const next = softDeleteShowcase(showcases, "sh_furniture", "2026-01-01T00:00:00.000Z");
    assert.equal(next[0].visibility, false);
    assert.equal(next[0].deleted_at, "2026-01-01T00:00:00.000Z");
    assert.equal(next.length, 2);
  });
});

describe("landing-editor targets", () => {
  it("resolves popup and showcase inspector fields", () => {
    const doc = sampleDoc();
    const popup = resolveCmsTarget("popup", doc);
    assert.ok(popup);
    assert.ok(popup!.fields.some((f) => f.kind === "media"));
    const showcase = resolveCmsTarget("showcase:sh_furniture", doc);
    assert.ok(showcase);
    assert.ok(showcase!.fields.some((f) => f.kind === "benefits"));
  });
});
