import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Data Room <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDownloadLinkEmail(params: {
  to: string;
  projectTitle: string;
  productionCompany: string;
  documentTitle: string;
  downloadUrl: string;
  accentColor: string;
}) {
  const subject = `Your watermarked copy of "${params.documentTitle}" — ${params.projectTitle}`;
  const html = `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #8a8a8a; margin: 0 0 8px;">
      ${escapeHtml(params.productionCompany)}
    </p>
    <h1 style="font-size: 22px; margin: 0 0 20px; font-weight: 600;">
      ${escapeHtml(params.projectTitle)}
    </h1>
    <p style="font-size: 14px; line-height: 1.6; color: #333; margin: 0 0 24px; font-family: Helvetica, Arial, sans-serif;">
      You requested a copy of <strong>${escapeHtml(params.documentTitle)}</strong> from the private data room.
      Your download link is below — the file is watermarked with your email address, so please keep it confidential.
    </p>
    <p style="margin: 0 0 28px;">
      <a href="${params.downloadUrl}"
         style="display: inline-block; background: ${params.accentColor}; color: #14120a; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.03em;">
        Download watermarked copy
      </a>
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #8a8a8a; font-family: Helvetica, Arial, sans-serif; margin: 0;">
      This link expires in 7 days and is uniquely watermarked to ${escapeHtml(
        params.to
      )}. Materials are confidential and provided for authorized recipients only — please do not redistribute.
    </p>
  </div>`;

  const text = `${params.projectTitle} — ${params.productionCompany}

You requested a copy of "${params.documentTitle}" from the private data room.

Download it here (expires in 7 days, watermarked to ${params.to}):
${params.downloadUrl}

Materials are confidential and provided for authorized recipients only — please do not redistribute.`;

  if (!resend) {
    // No email provider configured — log instead of failing, so the app
    // stays usable in local development. Set RESEND_API_KEY in production.
    console.log(
      `[email:dev-fallback] Would send "${subject}" to ${params.to}\n${params.downloadUrl}`
    );
    return { delivered: false as const };
  }

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Failed to send download email: ${error.message}`);
  }

  return { delivered: true as const };
}
