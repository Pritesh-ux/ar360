import { query } from "@/lib/db";

export const revalidate = 300;

export default async function DynamicDesignSystem() {
  let tokens = {
    primary: "#b9ff2c",
    secondary: "#111111",
    accent: "#b9ff2c",
    background: "#FFFFFF",
    surface: "#FAFAFA",
    border: "#ECECEC",
    text: "#111111",
    mutedText: "#5C6168",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#3B82F6",
    radiusCard: "24px",
    radiusBtn: "9999px",
  };

  try {
    const rows = await query<{ tokens: unknown }>(
      "SELECT tokens FROM website_themes WHERE is_active = 1 LIMIT 1",
    );
    if (rows.length > 0) {
      const parsed =
        typeof rows[0].tokens === "string" ? JSON.parse(rows[0].tokens) : rows[0].tokens;
      if (parsed && typeof parsed === "object") {
        tokens = { ...tokens, ...(parsed as typeof tokens) };
      }
    }
  } catch (e) {
    console.error("Failed to load active theme tokens", e);
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
            :root {
              --color-primary: ${tokens.primary};
              --color-secondary: ${tokens.secondary};
              --color-accent: ${tokens.accent};
              --color-bg: ${tokens.background};
              --color-surface: ${tokens.surface};
              --color-border: ${tokens.border};
              --color-text: ${tokens.text};
              --color-muted: ${tokens.mutedText};
              --color-success: ${tokens.success};
              --color-warning: ${tokens.warning};
              --color-danger: ${tokens.danger};
              --color-info: ${tokens.info};
              --radius-card: ${tokens.radiusCard};
              --radius-btn: ${tokens.radiusBtn};
              /* Use next/font variables from root layout — no extra Google Fonts download */
              --font-heading: var(--font-auth-display), system-ui, sans-serif;
              --font-body: var(--font-auth-body), system-ui, sans-serif;
            }

            body {
              background-color: var(--color-bg);
              color: var(--color-text);
              font-family: var(--font-body);
            }

            h1, h2, h3, h4, h5, h6 {
              font-family: var(--font-heading);
            }
          `,
      }}
    />
  );
}
