const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupFormInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  phone?: string;
  website?: string;
};

export type SignupValidationResult =
  | { ok: true; data: SignupFormInput & { normalizedEmail: string } }
  | { ok: false; message: string };

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

export function validateSignupForm(input: SignupFormInput): SignupValidationResult {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const confirmPassword = String(input.confirmPassword || "");
  const companyName = String(input.companyName || "").trim();

  if (!name) return { ok: false, message: "Full name is required." };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, message: "A valid work email is required." };
  if (!companyName) return { ok: false, message: "Company name is required." };
  if (!password) return { ok: false, message: "Password is required." };

  const passwordError = validatePasswordPolicy(password);
  if (passwordError) return { ok: false, message: passwordError };

  if (password !== confirmPassword) return { ok: false, message: "Password confirmation does not match." };

  return {
    ok: true,
    data: {
      ...input,
      name,
      email,
      password,
      confirmPassword,
      companyName,
      normalizedEmail: email,
      phone: input.phone?.trim() || undefined,
      website: input.website?.trim() || undefined,
    },
  };
}
