import type { EmailMessage, EmailTransport } from './EmailTransport';

/* eslint-disable no-console */

/**
 * Dev transport: prints the email (including any action links) to the console
 * instead of sending it, so the whole flow can be walked through locally with
 * no email provider configured.
 */
export class ConsoleEmailTransport implements EmailTransport {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<void> {
    console.log('\n┌─ [email:console] ───────────────────────────────────────────');
    console.log(`│ To:      ${message.to}`);
    console.log(`│ From:    ${message.from}`);
    console.log(`│ Subject: ${message.subject}`);
    console.log('├──────────────────────────────────────────────────────────────');
    for (const line of message.text.split('\n')) console.log(`│ ${line}`);
    console.log('└──────────────────────────────────────────────────────────────\n');
  }
}
