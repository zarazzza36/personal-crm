import "server-only";

import nodemailer from "nodemailer";

import { signInEmail } from "./sign-in-email-message";

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

export async function sendSignInLink(email: string, url: string) {
  if (!process.env.SMTP_URL) throw new Error("SMTP_URL is not set");
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ ...signInEmail(url), to: email });
}
