import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

import { db } from "@/db";
import { signInLinkRequests } from "@/db/schema";

it("ошибка SMTP не создаёт сессию и считается попыткой отправки", async () => {
  const previous = process.env.SMTP_URL;
  process.env.SMTP_URL = "smtp://127.0.0.1:1";
  vi.resetModules();
  try {
    const { auth } = await import("./auth");
    await expect(
      auth.api.signInMagicLink({
        body: { email: `failed-${randomUUID()}@example.com` },
        headers: new Headers({ origin: "http://localhost:3000", "x-real-ip": "10.9.9.9" }),
      }),
    ).rejects.toThrow();
    expect(await db.$count(signInLinkRequests)).toBe(1);
  } finally {
    process.env.SMTP_URL = previous;
  }
}, 30_000);
