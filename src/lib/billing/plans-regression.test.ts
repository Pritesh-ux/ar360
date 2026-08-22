import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPlanCtaLabel, getPlanSignupPath } from "./plan-links";
import { DEFAULT_PLAN_LIMITS, mapLegacyPlanId } from "./plan-enforcement";
import { BILLING_PLANS, getPlanById, type PlanId } from "./plans";

describe("standard plan regression contract", () => {
  it("keeps legacy aliases while separating Business and Organisation", () => {
    assert.deepEqual(
      ["trial", "basic", "professional", "business", "enterprise", "organisation"].map(mapLegacyPlanId),
      ["trial", "starter", "pro", "business", "enterprise", "enterprise"],
    );
    assert.deepEqual(
      ["trial", "basic", "professional", "business", "enterprise", "organisation"].map((id) => getPlanById(id).id),
      ["trial", "starter", "pro", "business", "enterprise", "enterprise"],
    );
  });

  it("keeps CTA labels and signup destinations", () => {
    const mapped = ["trial", "basic", "professional", "business", "enterprise"].map(mapLegacyPlanId) as PlanId[];
    assert.deepEqual(mapped.map(getPlanCtaLabel), [
      "Start Free Trial",
      "Choose Plan",
      "Choose Plan",
      "Choose Plan",
      "Custom quote",
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
          products: 10,
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
          bandwidthGb: 2,
          products: 10,
          limits: {
            customBranding: false,
            advancedAnalytics: false,
            embedViewer: false,
            priorityProcessing: false,
            prioritySupport: false,
          },
        },
        {
          id: "intermediate",
          storageGb: 2,
          bandwidthGb: 100,
          products: 50,
          limits: {
            customBranding: false,
            advancedAnalytics: false,
            embedViewer: true,
            priorityProcessing: false,
            prioritySupport: false,
          },
        },
        {
          id: "pro",
          storageGb: 5,
          bandwidthGb: 250,
          products: 100,
          limits: {
            customBranding: true,
            advancedAnalytics: true,
            embedViewer: true,
            priorityProcessing: false,
            prioritySupport: true,
          },
        },
        {
          id: "business",
          storageGb: 10,
          bandwidthGb: 500,
          products: 200,
          limits: {
            customBranding: true,
            advancedAnalytics: true,
            embedViewer: true,
            priorityProcessing: true,
            prioritySupport: true,
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
        ["trial", "starter", "intermediate", "pro", "business", "enterprise"].map((id) => {
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
          products: 10,
          storageMb: 100,
          bandwidthGb: 1,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: false,
        },
        starter: {
          products: 10,
          storageMb: 512,
          bandwidthGb: 2,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: false,
        },
        intermediate: {
          products: 50,
          storageMb: 2048,
          bandwidthGb: 100,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: false,
        },
        pro: {
          products: 100,
          storageMb: 5120,
          bandwidthGb: 250,
          allowViewer: true,
          allowUpload: true,
          allowAr: true,
          allowCustomBranding: true,
        },
        business: {
          products: 200,
          storageMb: 10240,
          bandwidthGb: 500,
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

  it("shows Enterprise as the public name for enterprise id", () => {
    assert.equal(getPlanById("enterprise").name, "ENTERPRISE");
    assert.equal(getPlanById("organisation").id, "enterprise");
  });
});
