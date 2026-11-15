"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";

import { auth } from "@/auth/auth";
import { signInEmailSchema } from "@/lib/sign-in-email";

export type LoginState = { error?: string; email?: string };

export async function requestSignInLink(_state: LoginState, data: FormData): Promise<LoginState> {
  const email = signInEmailSchema.safeParse(data.get("email"));
  if (!email.success) return { error: "Проверьте адрес почты" };
  try {
    await auth.api.signInMagicLink({
      body: { email: email.data, callbackURL: "/", errorCallbackURL: "/login/link-expired" },
      headers: await headers(),
    });
    return { email: email.data };
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "TOO_MANY_REQUESTS")
      return { error: "Слишком часто, попробуйте через несколько минут" };
    if (error instanceof APIError && error.body?.code === "INVALID_EMAIL")
      return { error: "Проверьте адрес почты" };
    return { error: "Не удалось отправить письмо, попробуйте ещё раз" };
  }
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
}
