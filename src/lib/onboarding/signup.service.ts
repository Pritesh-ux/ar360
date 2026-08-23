import { randomBytes, randomInt } from "crypto";
import type { ResultSetHeader } from "mysql2";
import { getPool, query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { OnboardingErrorCode } from "@/lib/onboarding/onboarding-errors";
import { resolveDefaultSignupPlan } from "@/lib/onboarding/default-plan";
import { validateSignupForm, type SignupFormInput } from "@/lib/onboarding/signup-validation";
import { ensureOnboardingSchema, initializeCustomerOnboarding } from "@/lib/onboarding/onboarding.service";
import { createWelcomeNotification } from "@/lib/onboarding/notifications";
import { logOnboardingEvent } from "@/lib/onboarding/activity";
import { sendWelcomeEmail } from "@/lib/email/customer-lifecycle.service";
import { evaluatePublicSignupPolicy } from "@/lib/security/staging-policy";

export type SignupResult =
  | {
      ok: true;
      user: { id: number; name: string; email: string; customerUid: string };
    }
  | { ok: false; code: OnboardingErrorCode; message: string };

function createCustomerUid() {
  return `CUS-${randomInt(100000, 999999)}`;
}

function createUserUid() {
  return `USR-${randomBytes(10).toString("hex").toUpperCase()}`;
}

async function cleanupFailedSignup(userId: number, customerUid?: string) {
  try {
    if (customerUid) {
      await query("DELETE FROM customer_onboarding WHERE customer_uid = ?", [customerUid]);
      await query("DELETE FROM customer_subscriptions WHERE customer_uid = ?", [customerUid]);
      await query("DELETE FROM customers WHERE customer_uid = ?", [customerUid]);
    }
    await query("DELETE FROM users WHERE id = ?", [userId]);
  } catch (error) {
    console.error("[signup] cleanup failed", error);
  }
}

/** Transaction-safe customer registration with trial subscription and onboarding state. */
export async function registerCustomerAccount(input: SignupFormInput): Promise<SignupResult> {
  const validation = validateSignupForm(input);
  if (validation.ok === false) {
    return {
      ok: false,
      code: OnboardingErrorCode.SIGNUP_VALIDATION_FAILED,
      message: validation.message,
    };
  }

  const { name, normalizedEmail, password, companyName, phone, website } = validation.data;

  const signupPolicy = evaluatePublicSignupPolicy({ email: normalizedEmail });
  if (signupPolicy.allowed === false) {
    return {
      ok: false,
      code: OnboardingErrorCode.STAGING_SIGNUP_DISABLED,
      message: signupPolicy.message,
    };
  }

  const defaultPlan = await resolveDefaultSignupPlan();
  if (!defaultPlan) {
    return {
      ok: false,
      code: OnboardingErrorCode.DEFAULT_PLAN_NOT_CONFIGURED,
      message: "Signup is temporarily unavailable. Please contact support.",
    };
  }

  await ensureOnboardingSchema();

  const pool = await getPool();
  const connection = await pool.getConnection();

  let userId = 0;
  let customerUid = "";

  try {
    const [existing] = await connection.execute(
      "SELECT COUNT(*) AS total FROM users WHERE email = ?",
      [normalizedEmail],
    );
    const existingRows = existing as Array<{ total: number }>;
    if (Number(existingRows[0]?.total || 0) > 0) {
      return {
        ok: false,
        code: OnboardingErrorCode.EMAIL_ALREADY_EXISTS,
        message: "An account with this email already exists. Please log in instead.",
      };
    }

    await connection.beginTransaction();

    const userUid = createUserUid();
    const [userResult] = await connection.execute(
      `INSERT INTO users (user_uid, name, email, password_hash, role, status, email_verified, two_factor_enabled)
       VALUES (?, ?, ?, ?, 'user', 'Active', FALSE, TRUE)`,
      [userUid, name, normalizedEmail, hashPassword(password)],
    );
    userId = Number((userResult as ResultSetHeader).insertId || 0);
    if (!userId) throw new Error("User insert failed");

    customerUid = createCustomerUid();
    await connection.execute(
      `INSERT INTO customers (user_id, customer_uid, company_name, contact_name, email, phone, company_website, plan_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [userId, customerUid, companyName, name, normalizedEmail, phone || null, website || null, defaultPlan.slug],
    );

    await connection.execute(
      `INSERT INTO customer_onboarding (customer_uid, status, current_step, signup_source)
       VALUES (?, 'not_started', 1, 'signup')
       ON DUPLICATE KEY UPDATE customer_uid = customer_uid`,
      [customerUid],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("[signup] transaction failed", error);
    if (userId) await cleanupFailedSignup(userId, customerUid || undefined);
    return {
      ok: false,
      code: OnboardingErrorCode.SIGNUP_FAILED,
      message: "We could not create your account. Please try again.",
    };
  } finally {
    connection.release();
  }

  try {
    const { startTrialSubscription } = await import("@/server/billing/subscription.service");
    await startTrialSubscription(customerUid);
    await initializeCustomerOnboarding(customerUid, "signup");
  } catch (error) {
    console.error("[signup] post-create failed", error);
    await cleanupFailedSignup(userId, customerUid);
    return {
      ok: false,
      code: OnboardingErrorCode.SIGNUP_FAILED,
      message: "We could not finish setting up your account. Please try again.",
    };
  }

  await Promise.allSettled([
    createWelcomeNotification(customerUid),
    sendWelcomeEmail(customerUid),
    import("@/lib/master-admin/notifications").then(({ createAdminNotification }) =>
      createAdminNotification({
        notificationUid: `customer-signup:${customerUid}`,
        category: "customer",
        title: "New customer signup",
        body: `${name} (${normalizedEmail})${companyName ? ` — ${companyName}` : ""}`,
        href: `/master-admin/customers?search=${encodeURIComponent(normalizedEmail)}`,
      }),
    ),
    logOnboardingEvent({
      customerUid,
      eventType: "signup_completed",
      title: "Account created",
    }),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[signup] non-critical post-create task failed", result.reason);
      }
    }
  });

  return {
    ok: true,
    user: { id: userId, name, email: normalizedEmail, customerUid },
  };
}
