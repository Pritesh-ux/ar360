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
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function authErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Authentication failed. Check database and form details.";
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
  if (!loginLimit.allowed) {
    withError("/login", "Too many login attempts. Please wait a few minutes.");
  }

  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  if (!email || !password) withError("/login", "Please enter email and password.");

  try {
    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      await writeLoginLog({ actorType: "customer", actorId: user?.id, email, status: "failed", reason: "invalid_credentials", ...meta });
      withError("/login", "Invalid email or password.");
    }

    if (user.status !== "Active") {
      await writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "blocked", reason: `user_${user.status.toLowerCase()}`, ...meta });
      withError("/login", "Your account is not active. Please contact support.");
    }

    if (!user.two_factor_enabled) {
      const customer = await ensureCustomerForUser(user);
      if (customer.status !== "Active") {
        await writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "blocked", reason: `customer_${customer.status.toLowerCase()}`, ...meta });
        withError("/login", "Your account is suspended. Please contact support.");
      }
      await createCustomerSession({ id: user.id, name: user.name, email: user.email, role: "user", customerUid: customer.customer_uid });
      await writeLoginLog({ actorType: "customer", actorId: user.id, email, status: "success", reason: "password_login", ...meta });
      const destination = await resolveCustomerPostAuthDestination(customer.customer_uid, {
        userStatus: user.status,
        customerStatus: customer.status,
      });
      redirect(destination);
    }

    const code = createTwoFactorCode();
    await setTwoFactorChallenge({ id: user.id, name: user.name, email: user.email, role: "user", customerUid: user.customerUid }, code);

    if (process.env.NODE_ENV !== "production") console.log(`AR360 customer 2FA code for ${user.email}: ${code}`);

    const devCode = process.env.NODE_ENV !== "production" ? `&devCode=${encodeURIComponent(code)}` : "";
    redirect(`/verify-2fa?email=${encodeURIComponent(user.email)}${devCode}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("CUSTOMER LOGIN ERROR:", error);
    withError("/login", authErrorMessage(error));
  }
}

export async function masterAdminLoginAction(formData: FormData) {
  const meta = await requestMeta();
  const loginLimit = await enforceRateLimitForKey(meta.ip || "unknown", { scope: "auth:admin-login", limit: 10, windowSec: 300 });
  if (!loginLimit.allowed) {
    withError("/master-admin/login", "Too many login attempts. Please wait a few minutes.");
  }

  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  if (!email || !password) withError("/master-admin/login", "Please enter email and password.");

  try {
    const user = await findMasterAdminByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      await writeLoginLog({ actorType: "master_admin", actorId: user?.id, email, status: "failed", reason: "invalid_credentials", ...meta });
      withError("/master-admin/login", "Invalid admin email or password.");
    }

    if (user.status !== "Active") {
      await writeLoginLog({ actorType: "master_admin", actorId: user.id, email, status: "blocked", reason: `admin_${user.status.toLowerCase()}`, ...meta });
      withError("/master-admin/login", "This admin account is disabled.");
    }

    if (!user.two_factor_enabled) {
      await createMasterAdminSession({ id: user.id, name: user.name, email: user.email, role: "admin" });
      await writeLoginLog({ actorType: "master_admin", actorId: user.id, email, status: "success", reason: "password_login", ...meta });
      redirect("/master-admin");
    }

    const code = createTwoFactorCode();
    await setTwoFactorChallenge({ id: user.id, name: user.name, email: user.email, role: "admin" }, code);

    if (process.env.NODE_ENV !== "production") console.log(`AR360 admin 2FA code for ${user.email}: ${code}`);

    const devCode = process.env.NODE_ENV !== "production" ? `&devCode=${encodeURIComponent(code)}` : "";
    redirect(`/verify-2fa?email=${encodeURIComponent(user.email)}${devCode}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("MASTER ADMIN LOGIN ERROR:", error);
    withError("/master-admin/login", authErrorMessage(error));
  }
}

export async function signupAction(formData: FormData) {
  const meta = await requestMeta();
  const signupLimit = await enforceRateLimitForKey(meta.ip || "unknown", { scope: "auth:signup", limit: 5, windowSec: 3600 });
  if (!signupLimit.allowed) {
    withError("/signup", "Too many signup attempts from this network. Please try again later.");
  }

  const signup = await registerCustomerAccount({
    name: getString(formData, "name"),
    email: getString(formData, "email").toLowerCase(),
    password: String(formData.get("password") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
    companyName: getString(formData, "companyName"),
    phone: getString(formData, "phone") || undefined,
    website: getString(formData, "website") || undefined,
  });

  if (signup.ok === false) {
    if (signup.code === OnboardingErrorCode.EMAIL_ALREADY_EXISTS) {
      withError("/signup", "An account with this email already exists. Please log in instead.");
    }
    withError("/signup", signup.message);
  }

  try {
    await createCustomerSession({
      id: signup.user.id,
      name: signup.user.name,
      email: signup.user.email,
      role: "user",
      customerUid: signup.user.customerUid,
    });
    await writeLoginLog({
      actorType: "customer",
      actorId: signup.user.id,
      email: signup.user.email,
      status: "success",
      reason: "signup",
      ...(await requestMeta()),
    });

    const plan = getString(formData, "plan");
    const period = getString(formData, "period") || "monthly";
    const destination = await resolveCustomerPostAuthDestination(signup.user.customerUid, {
      plan: plan || undefined,
      period,
      userStatus: "Active",
      customerStatus: "Active",
    });
    redirect(destination);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("SIGNUP ERROR:", error);
    withError("/signup", authErrorMessage(error));
  }
}

export async function verifyTwoFactorAction(formData: FormData) {
  const code = getString(formData, "code").replace(/\D/g, "");
  if (code.length !== 6) withError("/verify-2fa", "Enter the 6 digit verification code.");

  const user = await verifyTwoFactorCode(code);
  const meta = await requestMeta();
  if (!user) {
    await writeLoginLog({ actorType: "customer", email: "", status: "failed", reason: "invalid_2fa", ...meta }).catch(() => {});
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
