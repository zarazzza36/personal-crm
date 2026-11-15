import { Suspense } from "react";

import { getCurrentUser } from "@/auth/session";
import { Reminders } from "@/components/reminders";
import { SiteHeader } from "@/components/site-header";
import { SignOutButton } from "@/components/sign-out-button";

async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="truncate text-xs" title={user.email}>
        {user.email}
      </span>
      <SignOutButton />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Reminders>
      <SiteHeader>
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </SiteHeader>
      {children}
    </Reminders>
  );
}
