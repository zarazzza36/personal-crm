import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { db } from "@/db";
import { sessions, signInLinkRequests, users, verifications } from "@/db/schema";
import { getMailpitSignInLink } from "@/test/mailpit";

import { auth } from "./auth";
import { signInEmail } from "./sign-in-email-message";

const headers = new Headers({ origin: "http://localhost:3000", "x-real-ip": "127.0.0.1" });

it("отправляет одноразовую ссылку и входит под нормализованной почтой", async () => {
  const email = `test-${randomUUID()}@example.com`;
  await auth.api.signInMagicLink({ body: { email: ` ${email.toUpperCase()} ` }, headers });
  let link: string | null = null;
  await expect
    .poll(async () => {
      link = await getMailpitSignInLink(email);
      return link;
    })
    .toBeTruthy();
  const stored = await db.select().from(verifications);
  expect(stored).toHaveLength(1);
  expect(stored[0].expiresAt.getTime() - stored[0].createdAt.getTime()).toBeGreaterThan(
    14 * 60_000,
  );
  expect(stored[0].expiresAt.getTime() - stored[0].createdAt.getTime()).toBeLessThanOrEqual(
    15 * 60_000 + 1000,
  );
  expect(stored[0].identifier).not.toContain(new URL(link!).searchParams.get("token"));
  const result = await auth.handler(new Request(link!));
  expect(result.status).toBe(302);
  expect(result.headers.get("set-cookie")).toContain("session_token");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  expect(user).toBeDefined();
  const repeated = await auth.handler(new Request(link!));
  expect(repeated.headers.get("set-cookie") ?? "").not.toContain("session_token");
}, 30_000);

it("новая ссылка отменяет прежнюю, а четвёртый запрос не отменяет последнюю", async () => {
  const email = `limit-${randomUUID()}@example.com`;
  const call = () => auth.api.signInMagicLink({ body: { email }, headers });
  await call();
  const first = await getMailpitSignInLink(email);
  expect(first).toBeTruthy();
  await call();
  await call();
  const latest = await getMailpitSignInLink(email);
  expect(latest).toBeTruthy();
  expect(latest).not.toBe(first);
  await expect(call()).rejects.toMatchObject({ status: "TOO_MANY_REQUESTS" });
  expect(await db.$count(signInLinkRequests)).toBe(3);
  await auth.api.signInMagicLink({ body: { email: `other-${randomUUID()}@example.com` }, headers });
  expect(await db.$count(signInLinkRequests)).toBe(4);
  const old = await auth.handler(new Request(first!));
  expect(old.headers.get("set-cookie") ?? "").not.toContain("session_token");
  const current = await auth.handler(new Request(latest!));
  expect(current.headers.get("set-cookie")).toContain("session_token");
  await db.update(signInLinkRequests).set({ createdAt: new Date(Date.now() - 11 * 60_000) });
  await call();
  expect(await db.$count(signInLinkRequests)).toBe(1);
}, 75_000);

it("истёкшая ссылка не открывает сессию", async () => {
  const email = `expired-${randomUUID()}@example.com`;
  await auth.api.signInMagicLink({ body: { email }, headers });
  const link = await getMailpitSignInLink(email);
  expect(link).toBeTruthy();
  await db.update(verifications).set({ expiresAt: new Date(Date.now() - 1000) });
  const response = await auth.handler(new Request(link!));
  expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token");
}, 30_000);

it("прямой запрос проверяет почту и не отправляет письмо при ошибке", async () => {
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-real-ip": "10.10.20.1",
      },
      body: JSON.stringify({ email: "не адрес" }),
    }),
  );
  expect(response.status).toBe(400);
  expect(await db.$count(verifications)).toBe(0);
  expect(await db.$count(signInLinkRequests)).toBe(0);
});

it("параллельные прямые запросы соблюдают лимит и оставляют один токен", async () => {
  const email = `concurrent-${randomUUID()}@example.com`;
  const requests = Array.from({ length: 4 }, (_, i) =>
    auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-real-ip": `10.10.30.${i + 1}`,
        },
        body: JSON.stringify({ email: ` ${email.toUpperCase()} ` }),
      }),
    ),
  );
  const responses = await Promise.all(requests);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 429]);
  expect(await db.$count(signInLinkRequests)).toBe(3);
  expect(await db.$count(verifications)).toBe(1);
}, 45_000);

it("посещение продлевает сессию, а просроченная сессия не действует", async () => {
  const email = `session-${randomUUID()}@example.com`;
  await auth.api.signInMagicLink({ body: { email }, headers });
  const link = await getMailpitSignInLink(email);
  expect(link).toBeTruthy();
  const response = await auth.handler(new Request(link!));
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  await db.update(sessions).set({
    updatedAt: new Date(Date.now() - 29 * 86400_000),
    expiresAt: new Date(Date.now() + 86400_000),
  });
  const active = await auth.api.getSession({
    headers: new Headers({ cookie }),
    returnHeaders: true,
  });
  expect(active.response?.user.email).toBe(email);
  const [refreshed] = await db.select().from(sessions);
  expect(refreshed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
  await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
  const expired = await auth.api.getSession({ headers: new Headers({ cookie }) });
  expect(expired).toBeNull();
}, 30_000);

it("вход владельца использует пользователя, созданного при переносе", async () => {
  const email = `owner-${randomUUID()}@example.com`;
  const id = randomUUID();
  await db.insert(users).values({ id, name: "", email, emailVerified: true });
  await auth.api.signInMagicLink({ body: { email }, headers });
  const link = await getMailpitSignInLink(email);
  expect(link).toBeTruthy();
  await auth.handler(new Request(link!));
  const found = await db.select().from(users).where(eq(users.email, email));
  expect(found).toHaveLength(1);
  expect(found[0].id).toBe(id);
}, 30_000);

it("письмо содержит отправителя, ссылку и предупреждение", () => {
  const message = signInEmail("https://example.com/login?token=secret&x=1");
  expect(message.from).toContain("noreply@mail.crm.volki-lzkv.ru");
  expect(message.subject).toBe("Вход в Личную CRM");
  expect(message.text).toContain("Ссылка работает 15 минут");
  expect(message.text).toContain("Если вы не запрашивали вход — просто проигнорируйте письмо");
  expect(message.html).toContain("token=secret&amp;x=1");
});
