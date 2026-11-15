"use client";

import { signOut } from "@/app/(auth)/login/actions";

export function SignOutButton() {
  return (
    <button
      className="shrink-0 text-xs underline"
      type="button"
      onClick={async () => {
        await signOut();
        window.location.replace("/login");
      }}
    >
      Выйти
    </button>
  );
}
