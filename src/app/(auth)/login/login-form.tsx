"use client";

import { useActionState } from "react";

import { requestSignInLink } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(requestSignInLink, {});
  return (
    <form action={action} noValidate className="mt-6 grid gap-3">
      <label htmlFor="email">Почта</label>
      <input id="email" name="email" type="email" required className="rounded border px-3 py-2" />
      <button
        disabled={pending}
        className="rounded bg-accent px-4 py-3 text-ink disabled:opacity-50"
      >
        Получить ссылку
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.email && <p role="status">Ссылка для входа отправлена на {state.email}</p>}
    </form>
  );
}
