import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanCtaLabel, getPlanSignupPath } from "./plan-links";
import { DEFAULT_PLAN_LIMITS, mapLegacyPlanId } from "./plan-enforcement";
import { BILLING_PLANS, getPlanById, type PlanId } from "./plans";

describe("standard plan regression contract", () => {
  it("keeps legacy aliases while separating Business and Enterprise", () => {
    assert.deepEqual(
      ["trial", "basic", "professional", "business", "enterprise"].map(mapLegacyPlanId),
      ["trial", "starter", "pro", "business", "enterprise"],
    );
    assert.deepEqual(
      ["trial", "basic", "professional", "business", "enterprise"].map((id) => getPlanById(id).id),
      ["trial", "starter", "pro", "business", "enterprise"],
    );
  });

  it("keeps CTA labels and signup destinations", () => {
    const mapped = ["trial", "basic", "professional", "business", "enterprise"].map(mapLegacyPlanId) as PlanId[];
    assert.deepEqual(mapped.map(getPlanCtaLabel), [
      "Start Free Trial",
      "Choose Plan",
      "Choose Plan",
      "Choose Plan",
      "Contact Sales",
    ]);
    assert.deepEqual(mapped.map((id) => getPlanSignupPath(id, "monthly")), [
      "/signup",
      "/signup?plan=starter&period=monthly",
      "/signup?plan=pro&period=monthly",
      "/signup?plan=business&period=monthly",
      "/contact?subject=Enterprise%20plan%20inquiry",
    ]);
  });

  it("keeps marketed standard plan capacity and feature flags unchanged", () => {
    assert.deepEqual(
      BILLING_PLANS.map((plan) => ({
        id: plan.id,
        storageGb: plan.storageGb,
        bandwidthGb: plan.bandwidthGb,
        products: plan.products,
        limits: plan.limits,
      })),
      [
        {
          id: "trial",
          storageGb: 0.1,
          bandwidthGb: 1,
          products: 1,
          limits: {
            customBranding: false,
            advancedAnalytics: false,
            embedViewer: false,
            priorityProcessing: false,
            prioritySupport: false,
          },
        },
        {
          id: "starter",
          storageGb: 0.5,
          bandwidthGb: 5,
          products: 5,
          limits: {
            customBranding: false,
            advancedAnalytics: false,
            embedViewer: false,
            priorityProcessing: false,
            prioritySupport: false,
          },
        },
        {
          id: "pro",
          storageGb: 5,
          bandwidthGb: 50,
          products: 50,
          limits: {
            customBranding: true,
            advancedAnalytics: true,
            embedViewer: true,
            priorityProcessing: true,
            prioritySupport: false,
          },
        },
        {
          id: "business",
          storageGb: 25,
          bandwidthGb: 250,
          products: 250,
          limits: {
            customBranding: true,
            advancedAnalytics: true,
            embedViewer: true,
            priorityProcessing: true,
            prioritySupport: true,
            allowCustomDomain: true,
          },
        },
        {
          id: "enterprise",
          storageGb: 25,
          bandwidthGb: 250,
          products: 250,
          limits: {
            customBranding: true,
            advancedAnalytics: true,
            embedViewer: true,
            priorityProcessing: true,
            prioritySupport: true,
            allowCustomDomain: true,
          },
        },
      ],
    );
  });

  it("keeps enforcement defaults unchanged for every standard plan", () => {
    assert.deepEqual(
      Object.fromEntries(
        ["trial", "starter", "pro", "business", "enterprise"].map((id) => {
          const plan = DEFAULT_PLAN_LIMITS[id];
          return [id, {
            products: plan.products,
            storageMb: plan.storageMb,
            bandwidthGb: plan.bandwidthGb,
            allowViewer: plan.allowViewer,
            allowUpload: plan.allowUpload,
            allowAr: plan.allowAr,
            allowCustomBranding: plan.allowCustomBranding,
          }];
        }),
      ),
      {
        trial: {
          products: 1,
          storageMb: 100,
          bandwidthGb: 1,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: false,
        },
        starter: {
          products: 5,
          storageMb: 512,
          bandwidthGb: 5,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: false,
        },
        pro: {
          products: 50,
          storageMb: 5120,
          bandwidthGb: 50,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: true,
        },
        business: {
          products: 250,
          storageMb: 25600,
          bandwidthGb: 250,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: true,
        },
        enterprise: {
          products: 250,
          storageMb: 25600,
          bandwidthGb: 250,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: true,
        },
      },
    );
  });
});
