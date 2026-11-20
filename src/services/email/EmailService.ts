import type { EmailMessage, EmailTransport } from './EmailTransport';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wraps body HTML in a minimal, email-client-safe shell. */
function shell(title: string, bodyHtml: string): string {
  return (
    `<!doctype html><html><body style="margin:0;background:#0f0f12;padding:24px;` +
    `font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e9e7e2;">` +
    `<div style="max-width:560px;margin:0 auto;background:#17171c;border:1px solid #2a2a32;` +
    `border-radius:12px;padding:28px;">` +
    `<h1 style="font-size:18px;margin:0 0 16px;color:#fff;">${escapeHtml(title)}</h1>` +
    `${bodyHtml}` +
    `<p style="margin:24px 0 0;font-size:12px;color:#8a8a96;">Sent by the portfolio interview system.</p>` +
    `</div></body></html>`
  );
}

function button(href: string, label: string, color: string): string {
  return (
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#fff;` +
    `text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">` +
    `${escapeHtml(label)}</a>`
  );
}

export interface ApprovalRequestEmail {
  to: string;
  requesterEmail: string;
  requesterName: string | null;
  purpose: string | null;
  reviewUrl: string;
}

export interface InviteEmail {
  to: string;
  interviewUrl: string;
  expiresAtLabel: string;
  maxTurns: number;
}

/**
 * High-level email composition for the interview gate. Builds the text + HTML
 * for each message type and hands it to the configured {@link EmailTransport}.
 */
export class EmailService {
  constructor(
    private readonly transport: EmailTransport,
    private readonly fromEmail: string,
  ) {}

  /** Notifies Nathan that someone wants to interview the AI version of him. */
  async sendApprovalRequest(m: ApprovalRequestEmail): Promise<void> {
    const who = m.requesterName ? `${m.requesterName} (${m.requesterEmail})` : m.requesterEmail;
    const subject = `Interview request from ${m.requesterEmail}`;

    const text =
      `${who} has requested access to interview the AI version of you.\n\n` +
      (m.purpose ? `Why they say they want to:\n${m.purpose}\n\n` : '') +
      `Review and approve or decline here:\n${m.reviewUrl}\n\n` +
      `Approving emails them a single-use interview link. Declining does nothing else.`;

    const html = shell(
      'New interview request',
      `<p style="margin:0 0 8px;">${escapeHtml(who)} has requested access to interview the AI version of you.</p>` +
        (m.purpose
          ? `<p style="margin:16px 0 4px;color:#8a8a96;font-size:13px;">Their reason</p>` +
            `<blockquote style="margin:0 0 16px;padding:12px 14px;background:#0f0f12;border-left:3px solid #c8643c;border-radius:6px;">${escapeHtml(
              m.purpose,
            )}</blockquote>`
          : '') +
        `<p style="margin:20px 0;">${button(m.reviewUrl, 'Review request →', '#c8643c')}</p>` +
        `<p style="margin:0;font-size:13px;color:#8a8a96;">Approving emails them a single-use interview link. Declining does nothing else.</p>`,
    );

    await this.send(m.to, subject, text, html);
  }

  /** Sends the approved interviewer their single-use magic link. */
  async sendInvite(m: InviteEmail): Promise<void> {
    const subject = `You're approved to interview Nathan (AI)`;
    const text =
      `Your request was approved. Use the link below to start your interview with the AI version of Nathan.\n\n` +
      `${m.interviewUrl}\n\n` +
      `This link is single-use and tied to your email. The interview allows up to ${m.maxTurns} questions ` +
      `and the link expires ${m.expiresAtLabel}.`;

    const html = shell(
      "You're approved",
      `<p style="margin:0 0 16px;">Your request was approved. Start your interview with the AI version of Nathan below.</p>` +
        `<p style="margin:20px 0;">${button(m.interviewUrl, 'Start the interview →', '#3c7dc8')}</p>` +
        `<p style="margin:0;font-size:13px;color:#8a8a96;">Single-use and tied to your email · up to ${m.maxTurns} questions · expires ${escapeHtml(
          m.expiresAtLabel,
        )}.</p>`,
    );

    await this.send(m.to, subject, text, html);
  }

  private async send(to: string, subject: string, text: string, html: string): Promise<void> {
    const message: EmailMessage = { to, from: this.fromEmail, subject, text, html };
    await this.transport.send(message);
  }
}
