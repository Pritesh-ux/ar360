export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export type PasswordStrengthResult = {
  level: PasswordStrengthLevel;
  score: number;
  label: string;
  hint: string;
  met: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    special: boolean;
  };
};

/** Live password strength for signup UI (aligned with signup policy). */
export function scorePasswordStrength(password: string): PasswordStrengthResult {
  const value = String(password || "");
  const met = {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };

  if (!value) {
    return {
      level: "empty",
      score: 0,
      label: "",
      hint: "At least 8 characters with uppercase, lowercase, and a number.",
      met,
    };
  }

  let score = 0;
  if (met.length) score += 1;
  if (met.upper) score += 1;
  if (met.lower) score += 1;
  if (met.number) score += 1;
  if (met.special) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;

  const policyOk = met.length && met.upper && met.lower && met.number;

  let level: PasswordStrengthLevel = "weak";
  if (!policyOk) {
    level = "weak";
  } else if (score <= 4) {
    level = "fair";
  } else if (score <= 5) {
    level = "good";
  } else {
    level = "strong";
  }

  const labels: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  const hints: Record<Exclude<PasswordStrengthLevel, "empty">, string> = {
    weak: "Add uppercase, lowercase, and a number (min 8 characters).",
    fair: "Meets the minimum. Add a symbol or make it longer.",
    good: "Solid password. A bit longer is even better.",
    strong: "Strong password.",
  };

  return {
    level,
    score: Math.min(4, level === "weak" ? 1 : level === "fair" ? 2 : level === "good" ? 3 : 4),
    label: labels[level],
    hint: hints[level],
    met,
  };
}
