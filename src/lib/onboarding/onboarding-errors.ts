export const OnboardingErrorCode = {
  SIGNUP_VALIDATION_FAILED: "SIGNUP_VALIDATION_FAILED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  STAGING_SIGNUP_DISABLED: "STAGING_SIGNUP_DISABLED",
  SIGNUP_FAILED: "SIGNUP_FAILED",
  DEFAULT_PLAN_NOT_CONFIGURED: "DEFAULT_PLAN_NOT_CONFIGURED",
  ONBOARDING_NOT_FOUND: "ONBOARDING_NOT_FOUND",
  ONBOARDING_UPDATE_FAILED: "ONBOARDING_UPDATE_FAILED",
  SAMPLE_PRODUCT_ALREADY_EXISTS: "SAMPLE_PRODUCT_ALREADY_EXISTS",
  SAMPLE_PRODUCT_CREATION_FAILED: "SAMPLE_PRODUCT_CREATION_FAILED",
  PRODUCT_LIMIT_REACHED: "PRODUCT_LIMIT_REACHED",
  STORAGE_LIMIT_REACHED: "STORAGE_LIMIT_REACHED",
} as const;

export type OnboardingErrorCode = (typeof OnboardingErrorCode)[keyof typeof OnboardingErrorCode];

const MESSAGES: Record<OnboardingErrorCode, string> = {
  SIGNUP_VALIDATION_FAILED: "Please check your signup details and try again.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists. Please log in instead.",
  STAGING_SIGNUP_DISABLED: "Registration is currently disabled on staging.",
  SIGNUP_FAILED: "We could not create your account. Please try again.",
  DEFAULT_PLAN_NOT_CONFIGURED: "Signup is temporarily unavailable. Please contact support.",
  ONBOARDING_NOT_FOUND: "Onboarding state not found.",
  ONBOARDING_UPDATE_FAILED: "Could not save onboarding progress. Please try again.",
  SAMPLE_PRODUCT_ALREADY_EXISTS: "Your sample product is already ready.",
  SAMPLE_PRODUCT_CREATION_FAILED: "Could not create the sample product. Please try again.",
  PRODUCT_LIMIT_REACHED: "You have reached your product limit. Upgrade your plan to continue.",
  STORAGE_LIMIT_REACHED: "You do not have enough storage for the sample product. Delete unused assets or upgrade.",
};

export function onboardingErrorMessage(code: OnboardingErrorCode) {
  return MESSAGES[code] || "Something went wrong.";
}
