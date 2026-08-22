"use server";

import { headers } from "next/headers";
import { enforceRateLimitForKey } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  clearCustomerSession,
  createCustomerSession,
  createMasterAdminSession,
  createTwoFactorCode,
  ensureCustomerForUser,
  findMasterAdminByEmail,
  findUserByEmail,
  setTwoFactorChallenge,
  verifyPassword,
  verifyTwoFactorCode,
  writeLoginLog,
} from "@/lib/auth";
import { OnboardingErrorCode } from "@/lib/onboarding/onboarding-errors";
import { resolveCustomerPostAuthDestination } from "@/lib/onboarding/post-auth-destination";
import { registerCustomerAccount } from "@/lib/onboarding/signup.service";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function withError(path: string, message: string): never {
  const hasQueryParams = path.includes("?");
  const separator = hasQueryParams ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

async function requestMeta() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for") || "";
  return {
    ip: forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || "",
    userAgent: h.get("user-agent") || "",
  };
}

export async function loginAction(formData: FormData) {
  const meta = await requestMeta();
  const loginLimit = await enforceRateLimitForKey(meta.ip || "unknown", { scope: "auth:login", limit: 10, windowSec: 300 });

  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  const queryParams = new URLSearchParams();
  if (email) queryParams.set("email", email);
  const loginPath = `/login?${queryParams.toString()}`;

  if (!loginLimit.allowed) {
    withError(loginPath, "Too many login attempts. Please wait a few minutes.");
  }

  if (!email || !password) withError(loginPath, "Please enter email and password.");

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (error) {
    console.error("CUSTOMER LOGIN DB ERROR:", error);
    withError(loginPath, "Something went wrong. Please try again.");
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    void writeLoginLog({ actorType: "customer", actorId: user?.id, email, status: "failed", reason: "invalid_credentials", ...meta }).catch(() => {});
    withError(loginPath, "Invalid email or password.");
  }

  if (user.status === "Deleted") {
    void writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "blocked", reason: `user_${user.status.toLowerCase()}`, ...meta }).catch(() => {});
    withError(loginPath, "Your account is not active. Please contact support.");
  }

  if (user.status !== "Active" && user.status !== "Suspended") {
    void writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "blocked", reason: `user_${user.status.toLowerCase()}`, ...meta }).catch(() => {});
    withError(loginPath, "Your account is not active. Please contact support.");
  }

  try {
    if (!user.two_factor_enabled) {
      const customer = await ensureCustomerForUser(user);
      if (customer.status === "Deleted") {
        void writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "blocked", reason: `customer_${customer.status.toLowerCase()}`, ...meta }).catch(() => {});
        withError(loginPath, "Your account is not active. Please contact support.");
      }
      await createCustomerSession({ id: user.id, name: user.name, email: user.email, role: "user", customerUid: customer.customer_uid });
      void writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "success", reason: "password_login", ...meta }).catch(() => {});
      const destination = await resolveCustomerPostAuthDestination(customer.customer_uid, {
        userStatus: user.status,
        customerStatus: customer.status,
      });
      redirect(destination);
    }

    const code = createTwoFactorCode();
    await setTwoFactorChallenge({ id: user.id, name: user.name, email: user.email, role: "user", customerUid: user.customerUid }, code);

    const { sendTwoFactorCodeEmail } = await import("@/lib/email/two-factor-email");
    const mail = await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name,
      code,
      purpose: "login",
    }).catch((error) => {
      console.error("[customerLoginAction] 2FA email failed", error);
      return { delivered: false, mode: "skipped" as const };
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`AR360 customer 2FA code for ${user.email}: ${code}`);
    }

    if (!mail.delivered) {
      withError(loginPath, "Could not send the verification code email. Check email delivery settings and try again.");
    }

    const devCode = process.env.NODE_ENV !== "production" ? `&devCode=${encodeURIComponent(code)}` : "";
    redirect(`/verify-2fa?email=${encodeURIComponent(user.email)}${devCode}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("CUSTOMER LOGIN ERROR:", error);
    withError(loginPath, "Something went wrong. Please try again.");
  }
}

export async function masterAdminLoginAction(formData: FormData) {
  const meta = await requestMeta();
  const loginLimit = await enforceRateLimitForKey(meta.ip || "unknown", { scope: "auth:admin-login", limit: 10, windowSec: 300 });

  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  const queryParams = new URLSearchParams();
  if (email) queryParams.set("email", email);
  const adminLoginPath = `/master-admin/login?${queryParams.toString()}`;

  if (!loginLimit.allowed) {
    withError(adminLoginPath, "Too many login attempts. Please wait a few minutes.");
  }

  if (!email || !password) withError(adminLoginPath, "Please enter email and password.");

  let user;
  try {
    user = await findMasterAdminByEmail(email);
  } catch (error) {
    console.error("MASTER ADMIN LOGIN DB ERROR:", error);
    withError(adminLoginPath, "Something went wrong. Please try again.");
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    void writeLoginLog({ actorType: "master_admin", actorId: user?.id, email, status: "failed", reason: "invalid_credentials", ...meta }).catch(() => {});
    withError(adminLoginPath, "Invalid admin email or password.");
  }

  if (user.status !== "Active") {
    void writeLoginLog({ actorType: "master_admin", actorId: user.id, email, status: "blocked", reason: `admin_${user.status.toLowerCase()}`, ...meta }).catch(() => {});
    withError(adminLoginPath, "This admin account is disabled.");
  }

  try {
    if (!user.two_factor_enabled) {
      await createMasterAdminSession({ id: user.id, name: user.name, email: user.email, role: "admin" });
      void writeLoginLog({ actorType: "master_admin", actorId: user.id, email, status: "success", reason: "password_login", ...meta }).catch(() => {});
      redirect("/master-admin");
    }

    const code = createTwoFactorCode();
    await setTwoFactorChallenge({ id: user.id, name: user.name, email: user.email, role: "admin" }, code);

    const { sendTwoFactorCodeEmail } = await import("@/lib/email/two-factor-email");
    const mail = await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name,
      code,
      purpose: "login",
    }).catch((error) => {
      console.error("[masterAdminLoginAction] 2FA email failed", error);
      return { delivered: false, mode: "skipped" as const };
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`AR360 admin 2FA code for ${user.email}: ${code}`);
    }

    if (!mail.delivered) {
      withError(adminLoginPath, "Could not send the verification code email. Check email delivery settings and try again.");
    }

    const devCode = process.env.NODE_ENV !== "production" ? `&devCode=${encodeURIComponent(code)}` : "";
    redirect(`/verify-2fa?email=${encodeURIComponent(user.email)}${devCode}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("MASTER ADMIN LOGIN ERROR:", error);
    withError(adminLoginPath, "Something went wrong. Please try again.");
  }
}

export async function signupAction(formData: FormData) {
  const meta = await requestMeta();
  const signupLimit = await enforceRateLimitForKey(meta.ip || "unknown", { scope: "auth:signup", limit: 5, windowSec: 3600 });

  const name = getString(formData, "name");
  const email = getString(formData, "email").toLowerCase();
  const companyName = getString(formData, "companyName");
  const plan = getString(formData, "plan");
  const period = getString(formData, "period") || "monthly";

  // Build the path with pre-filled fields to preserve them on validation error
  const queryParams = new URLSearchParams();
  if (name) queryParams.set("name", name);
  if (email) queryParams.set("email", email);
  if (companyName) queryParams.set("companyName", companyName);
  if (plan) queryParams.set("plan", plan);
  if (period) queryParams.set("period", period);
  const signupPath = `/signup?${queryParams.toString()}`;

  if (!signupLimit.allowed) {
    withError(signupPath, "Too many signup attempts from this network. Please try again later.");
  }

  let signup;
  try {
    signup = await registerCustomerAccount({
      name,
      email,
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
      companyName,
      phone: getString(formData, "phone") || undefined,
      website: getString(formData, "website") || undefined,
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    withError(signupPath, "Something went wrong. Please try again.");
  }

  if (signup!.ok === false) {
    if (signup!.code === OnboardingErrorCode.EMAIL_ALREADY_EXISTS) {
      withError(signupPath, "An account with this email already exists. Please log in instead.");
    }
    withError(signupPath, signup!.message);
  }

  try {
    await createCustomerSession({
      id: signup!.user.id,
      name: signup!.user.name,
      email: signup!.user.email,
      role: "user",
      customerUid: signup!.user.customerUid,
    });
    void writeLoginLog({
      actorType: "customer",
      actorId: signup!.user.id,
      email: signup!.user.email,
      status: "success",
      reason: "signup",
      ...(await requestMeta()),
    }).catch(() => {});

    const destination = await resolveCustomerPostAuthDestination(signup!.user.customerUid, {
      plan: plan || undefined,
      period,
      userStatus: "Active",
      customerStatus: "Active",
    });
    redirect(destination);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("SIGNUP SESSION ERROR:", error);
    withError(signupPath, "Something went wrong. Please try again.");
  }
}

export async function verifyTwoFactorAction(formData: FormData) {
  const code = getString(formData, "code").replace(/\D/g, "");
  const email = getString(formData, "email");
  if (code.length !== 6) withError("/verify-2fa", "Enter the 6 digit verification code.");

  const user = await verifyTwoFactorCode(code, email || undefined);
  const meta = await requestMeta();
  if (!user) {
    await writeLoginLog({ actorType: "customer", email: email || "", status: "failed", reason: "invalid_2fa", ...meta }).catch(() => {});
    withError("/verify-2fa", "Invalid or expired verification code.");
  }

  if (user.role === "admin") {
    await createMasterAdminSession(user);
    await writeLoginLog({ actorType: "master_admin", actorId: user.id, email: user.email, status: "success", reason: "2fa_login", ...meta });
    redirect("/master-admin");
  } else {
    await createCustomerSession(user);
    await writeLoginLog({ actorType: "customer", actorId: user.id, email: user.email, status: "success", reason: "2fa_login", ...meta });
    const customer = await ensureCustomerForUser(user);
    const destination = await resolveCustomerPostAuthDestination(customer.customer_uid, {
      userStatus: "Active",
      customerStatus: customer.status,
    });
    redirect(destination);
  }
}

export async function logoutAction() {
  await clearCustomerSession();
  redirect("/login");
}
