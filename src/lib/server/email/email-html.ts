/**
 * Shared email HTML helpers (ported from kame-homes branded shell).
 * Inline styles stay Gmail-safe; placeholders use {{key}} replacement.
 */

export const EMAIL_BRAND_COLOR = "#fb9f44";
export const EMAIL_ON_PRIMARY = "#ffffff";

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) return null;
  const raw = match[1]!;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function toHexColor({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function lightenHexColor(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const t = Math.max(0, Math.min(1, amount));
  return toHexColor({
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t,
  });
}

export function resolveEmailPrimaryHex(brandColorHex?: string | null): string {
  const trimmed = brandColorHex?.trim();
  if (trimmed && parseHexColor(trimmed)) return trimmed;
  return EMAIL_BRAND_COLOR;
}

export function resolveEmailOnPrimaryHex(
  _brandColorHex?: string | null,
): string {
  return EMAIL_ON_PRIMARY;
}

export function escapeHtml(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function replacePlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => vars[key] ?? "",
  );
}

const EMAIL_SHELL_STYLE_VARS: Record<string, string> = {
  emailShellBodyStyle:
    "margin:0 !important;padding:0 !important;-webkit-text-size-adjust:100%;background-color:#f3f4f6;",
  emailShellTableOuterStyle:
    "width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#f3f4f6;",
  emailShellTdShellPadStyle: "padding:22px 12px 30px 12px;",
  emailShellTableWrapperStyle:
    "width:100%;max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;",
  emailShellTdAccentStyle: `height:5px;line-height:5px;font-size:0;background-color:${EMAIL_BRAND_COLOR};`,
  emailShellTdCardShellStyle: "padding:0;vertical-align:top;",
  emailShellTableCardStyle:
    "width:100%;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:2px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:none;",
  emailShellTdContentPadStyle:
    "padding:28px 24px 30px 24px;text-align:left;color:#333333;font-size:15px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTdLegalFooterStyle:
    "padding:22px 16px 0 16px;text-align:center;font-size:12px;line-height:1.55;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellH1Style:
    "margin:0 0 8px 0;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellDateLineStyle:
    "margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellBodyCopyStyle:
    "color:#333333;font-size:16px;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellBrandMicroStyle:
    "font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#666666;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellTextSubheadingStyle:
    "font-size:15px;font-weight:700;color:#333333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;",
  emailShellCtaBtnStyle: `display:inline-block;padding:14px 28px;background-color:${EMAIL_BRAND_COLOR} !important;color:${EMAIL_ON_PRIMARY} !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`,
  emailLogoWrapTdStyle: "padding:0 0 22px 0;text-align:center;",
  emailLogoFrameTableStyle:
    "margin:0 auto;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;",
  emailLogoFrameTdStyle:
    "width:80px;height:80px;max-width:80px;overflow:hidden;border-radius:12px;line-height:0;font-size:0;box-shadow:0 4px 14px rgba(15,23,42,0.08);",
  emailLogoImgStyle:
    "display:block;width:80px;height:80px;border:0;outline:none;text-decoration:none;object-fit:cover;object-position:center;",
};

function buildBrandedEmailShellStyleVars(
  brandColorHex?: string | null,
): Record<string, string> {
  const primary = resolveEmailPrimaryHex(brandColorHex);
  const onPrimary = resolveEmailOnPrimaryHex(brandColorHex);
  return {
    emailShellPrimaryHex: primary,
    emailShellTdAccentStyle: `height:5px;line-height:5px;font-size:0;background-color:${primary};`,
    emailShellCtaBtnStyle: `display:inline-block;padding:14px 28px;background-color:${primary} !important;color:${onPrimary} !important;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;`,
  };
}

/** Merge Gmail-safe inline style keys after per-email placeholders. */
export function withEmailShellStyleVars(
  vars: Record<string, string>,
  brandColorHex?: string | null,
): Record<string, string> {
  return {
    ...vars,
    ...EMAIL_SHELL_STYLE_VARS,
    ...buildBrandedEmailShellStyleVars(brandColorHex),
  };
}
