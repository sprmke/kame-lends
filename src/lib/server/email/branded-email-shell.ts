/**
 * Branded email shell for Kame Lends transactional mail.
 * Layout matches kame-homes `configurable-template-send` + logo frame.
 */

import { APP_NAME } from "$lib/brand";
import { resolveAppUrl } from "$lib/server/app-url";
import {
  EMAIL_BRAND_COLOR,
  escapeHtml,
  replacePlaceholders,
  withEmailShellStyleVars,
} from "./email-html";

const EMAIL_SHELL_HTML = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>{{emailTitle}}</title>
    <style type="text/css">
      .configurable-template-body .section-label {
        margin: 24px 0 10px 0;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: {{emailShellPrimaryHex}};
      }
      .configurable-template-body table.data-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .configurable-template-body .cta-btn {
        display: inline-block;
        text-decoration: none;
      }
      .configurable-template-body .meta-row td {
        padding: 8px 0;
        font-size: 14px;
        line-height: 1.5;
        vertical-align: top;
      }
      .configurable-template-body .meta-row td:first-child {
        color: #64748b;
        width: 36%;
        padding-right: 12px;
      }
      .configurable-template-body .meta-row td:last-child {
        color: #1e293b;
        font-weight: 600;
      }
    </style>
  </head>
  <body style="{{emailShellBodyStyle}}">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="{{emailShellTableOuterStyle}}"
    >
      <tr>
        <td align="center" style="{{emailShellTdShellPadStyle}}">
          <table
            role="presentation"
            align="center"
            width="600"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="{{emailShellTableWrapperStyle}}"
          >
            <tr>
              <td style="{{emailShellTdCardShellStyle}}">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="{{emailShellTableCardStyle}}"
                >
                  <tr>
                    <td style="{{emailShellTdAccentStyle}}">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="{{emailShellTdContentPadStyle}}">
                      {{emailHeaderLogo}}
                      <div style="{{emailShellBrandMicroStyle}};margin:0 0 4px 0;">
                        {{brandName}}
                      </div>
                      <div style="{{emailShellTextSubheadingStyle}};margin:0 0 16px 0;">
                        {{unitLabel}}
                      </div>
                      <h1 style="{{emailShellH1Style}};margin:0 0 16px 0;">
                        {{emailTitle}}
                      </h1>
                      {{dateLineBlock}}
                      <div
                        style="{{emailShellBodyCopyStyle}};margin:0;"
                        class="configurable-template-body"
                      >
                        {{bodyContent}}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="{{emailShellTdLegalFooterStyle}}">
                {{legalFooter}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const EMAIL_HEADER_LOGO_HTML = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td class="email-logo-wrap" style="{{emailLogoWrapTdStyle}}">
      <table
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
        align="center"
        style="{{emailLogoFrameTableStyle}}"
      >
        <tr>
          <!--[if mso]>
            <td
              width="80"
              height="80"
              style="width:80px;height:80px;border-radius:12px;overflow:hidden;background:url('{{logoUrl}}') center center / cover no-repeat;"
            >
              <span style="color: transparent; font-size: 0; line-height: 0">{{logoAlt}}</span>
            </td>
          <![endif]-->
          <!--[if !mso]><!-->
          <td class="email-logo-frame" style="{{emailLogoFrameTdStyle}}">
            <img
              src="{{logoUrl}}"
              width="80"
              height="80"
              alt="{{logoAlt}}"
              border="0"
              class="email-logo"
              style="{{emailLogoImgStyle}}"
            />
          </td>
          <!--<![endif]-->
        </tr>
      </table>
    </td>
  </tr>
</table>`;

export function resolveEmailLogoUrl(origin?: string): string {
  const base = (origin ?? resolveAppUrl()).replace(/\/$/, "");
  return `${base}/brand/kame-lends-icon-1024.png`;
}

function emailHeaderLogoHtml(logoUrl: string, logoAlt: string): string {
  return replacePlaceholders(
    EMAIL_HEADER_LOGO_HTML,
    withEmailShellStyleVars({
      logoUrl: escapeHtml(logoUrl),
      logoAlt: escapeHtml(logoAlt),
    }),
  );
}

/** Primary CTA button matching the branded email shell. */
export function buildEmailCtaHtml(
  label: string,
  url: string,
  brandColor: string = EMAIL_BRAND_COLOR,
): string {
  if (!url.trim()) return "";
  const ctaStyle = withEmailShellStyleVars(
    {},
    brandColor,
  ).emailShellCtaBtnStyle;
  return `<div class="cta-wrap" style="margin:28px 0 8px 0;text-align:center;"><a class="cta-btn" style="${ctaStyle}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>`;
}

/**
 * Wrap body HTML in the shared email shell (accent bar, logo, brand micro, card, legal footer).
 */
export function renderBrandedEmailShell(input: {
  emailTitle: string;
  /** Trusted HTML body (caller escapes user-controlled text). */
  bodyHtml: string;
  brandName?: string;
  /** Subtitle under brand micro (loan name, backup label, etc.). */
  unitLabel?: string;
  brandColor?: string | null;
  logoUrl?: string;
  dateLineBlock?: string;
}): string {
  const brandName = input.brandName?.trim() || APP_NAME;
  const logoUrl = input.logoUrl ?? resolveEmailLogoUrl();
  const legalFooter = `© ${brandName}. All rights reserved.`;

  return replacePlaceholders(
    EMAIL_SHELL_HTML,
    withEmailShellStyleVars(
      {
        emailHeaderLogo: emailHeaderLogoHtml(logoUrl, brandName),
        brandName: escapeHtml(brandName),
        unitLabel: escapeHtml(input.unitLabel?.trim() || brandName),
        emailTitle: escapeHtml(input.emailTitle.trim() || "Email"),
        dateLineBlock: input.dateLineBlock ?? "",
        bodyContent: input.bodyHtml,
        legalFooter: escapeHtml(legalFooter),
      },
      input.brandColor,
    ),
  );
}
