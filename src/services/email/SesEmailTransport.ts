import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { EmailMessage, EmailTransport } from './EmailTransport';

/**
 * Production transport using AWS SES (v2). Credentials are resolved by the AWS
 * SDK's default chain — an IAM role on the instance/container is preferred, so
 * no AWS secret needs to live in the app's environment.
 *
 * Note: a brand-new SES account is in the *sandbox* and can only send to
 * verified addresses. Sending the interview invite to arbitrary requesters
 * requires requesting SES production access (documented in DEPLOY.md).
 */
export class SesEmailTransport implements EmailTransport {
  readonly name = 'ses';
  private readonly client: SESv2Client;

  constructor(region: string) {
    this.client = new SESv2Client({ region });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: message.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.text, Charset: 'UTF-8' },
              Html: { Data: message.html, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}
