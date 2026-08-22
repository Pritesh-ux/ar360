import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkEnterpriseArExperienceEntitlement,
  checkEnterpriseModelEntitlement,
  DEFAULT_PLAN_LIMITS,
  mapLegacyPlanId,
  planAllowsProductContact,
  type PlanLimits,
} from "./plan-enforcement";
import { getPlanById } from "./plans";

describe("mapLegacyPlanId", () => {
  it("normalizes legacy aliases", () => {
    assert.equal(mapLegacyPlanId("free"), "trial");
    assert.equal(mapLegacyPlanId("basic"), "starter");
    assert.equal(mapLegacyPlanId("professional"), "pro");
    assert.equal(mapLegacyPlanId("business"), "business");
    assert.equal(mapLegacyPlanId("enterprise"), "enterprise");
    assert.equal(mapLegacyPlanId("organisation"), "enterprise");
    assert.equal(mapLegacyPlanId("organization"), "enterprise");
  });
});

describe("planAllowsProductContact", () => {
  it("allows trial, business, enterprise and custom enterprise only", () => {
    assert.equal(planAllowsProductContact("trial"), true);
    assert.equal(planAllowsProductContact("free"), true);
    assert.equal(planAllowsProductContact("business"), true);
    assert.equal(planAllowsProductContact("enterprise"), true);
    assert.equal(planAllowsProductContact("organisation"), true);
    assert.equal(planAllowsProductContact({ planId: "ecp_abc", isEnterpriseCustom: true }), true);
    assert.equal(planAllowsProductContact("starter"), false);
    assert.equal(planAllowsProductContact("intermediate"), false);
    assert.equal(planAllowsProductContact("pro"), false);
  });
});

describe("getPlanById", () => {
  it("resolves mapped plan ids", () => {
    assert.equal(getPlanById("free").id, "trial");
    assert.equal(getPlanById("starter").id, "starter");
    assert.equal(getPlanById("professional").id, "pro");
  });
});

describe("Enterprise custom resource limits", () => {
  const customPlan: PlanLimits = {
    ...DEFAULT_PLAN_LIMITS.enterprise,
    planId: "ecp_exact",
    isEnterpriseCustom: true,
    modelLimit: 2,
    arExperienceLimit: 1,
  };

  it("blocks new models and AR experiences at custom limits", () => {
    assert.equal(checkEnterpriseModelEntitlement(customPlan, 1).allowed, true);
    assert.equal(checkEnterpriseModelEntitlement(customPlan, 2).code, "MODEL_LIMIT_REACHED");
    assert.equal(checkEnterpriseArExperienceEntitlement(customPlan, 0).allowed, true);
    assert.equal(
      checkEnterpriseArExperienceEntitlement(customPlan, 1).code,
      "AR_EXPERIENCE_LIMIT_REACHED",
    );
  });

  it("does not apply Enterprise-only limits to standard plans", () => {
    const standard = { ...DEFAULT_PLAN_LIMITS.enterprise, modelLimit: 0, arExperienceLimit: 0 };
    assert.equal(checkEnterpriseModelEntitlement(standard, 99).allowed, true);
    assert.equal(checkEnterpriseArExperienceEntitlement(standard, 99).allowed, true);
  });
});
