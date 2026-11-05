import { Suspense } from "react";

import { AllContactsLink } from "@/components/all-contacts-link";
import { GroupRow } from "@/components/group-row";
import { NewGroupForm } from "@/components/new-group-form";
import { listGroups } from "@/db/groups";

export default function GroupsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-7 pb-16">
      <AllContactsLink />
      <h1 className="mt-7 font-heading text-26 leading-h1 font-bold tracking-heading sm:text-32">
        Группы
      </h1>
      <div className="mt-6">
        <NewGroupForm />
      </div>
      <Suspense fallback={<GroupsFallback />}>
        <Groups />
      </Suspense>
    </main>
  );
}

async function Groups() {
  const groups = await listGroups();

  if (groups.length === 0) {
    return <p className="mt-10 text-muted-foreground">Групп пока нет. Создайте первую.</p>;
  }

  return (
    <ul className="mt-6 divide-y" aria-label="Список групп">
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} />
      ))}
    </ul>
  );
}

function GroupsFallback() {
  return (
    <ul className="mt-6 divide-y" aria-busy aria-label="Загрузка групп">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="animate-pulse py-4">
          <span className="block h-5 w-48 max-w-full rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
