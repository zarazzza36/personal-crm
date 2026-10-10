import { Suspense } from "react";
import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { AddContactButton } from "@/components/contact-dialog";
import { JustAddedBadge } from "@/components/just-added-badge";
import { SearchInput } from "@/components/search-input";
import { countContacts, listContacts } from "@/db/queries";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = PageProps<"/">["searchParams"];

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <Suspense fallback={<ContactsFallback />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Contacts({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim();
  const addedId = Number(firstValue(params.added)) || null;

  const [contacts, total] = await Promise.all([listContacts(query), countContacts()]);

  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 grid grid-cols-1 gap-3 border-b bg-background px-4 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Контакты</h1>
            <span className="truncate text-sm text-muted-foreground" data-testid="contacts-count">
              {query
                ? `Найдено: ${formatNumber(contacts.length)} из ${formatNumber(total)}`
                : `Всего: ${formatNumber(total)}`}
            </span>
          </div>
          <AddContactButton />
        </div>
        <SearchInput query={query} />
      </header>

      {contacts.length > 0 ? (
        <ul className="divide-y" aria-label="Список контактов">
          {contacts.map((contact) => {
            const isAdded = contact.id === addedId;
            return (
              <li key={contact.id} data-contact-id={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className={cn(
                    "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-muted focus-visible:bg-muted",
                    isAdded && "bg-amber-50 hover:bg-amber-100",
                  )}
                >
                  <ContactAvatar name={contact.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{contact.name}</span>
                      {isAdded && <JustAddedBadge />}
                    </div>
                    {contact.about && (
                      <div className="truncate text-sm text-muted-foreground">{contact.about}</div>
                    )}
                  </div>
                  <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                    {contact.phone && <div>{contact.phone}</div>}
                    {contact.email && <div>{contact.email}</div>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-16 text-center text-muted-foreground">
          {query
            ? `Никого не нашлось по запросу «${query}»`
            : "Пока нет ни одного контакта. Добавьте первый."}
        </p>
      )}
    </>
  );
}

function ContactsFallback() {
  return (
    <div aria-busy aria-label="Загрузка контактов">
      <div className="grid gap-3 border-b pt-6 pb-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Контакты</h1>
        <div className="h-10 rounded-lg bg-muted" />
      </div>
      <ul className="divide-y">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex animate-pulse items-center gap-3 py-2.5">
            <span className="size-10 rounded-full bg-muted" />
            <span className="grid flex-1 gap-2">
              <span className="h-4 w-40 rounded bg-muted" />
              <span className="h-3 w-64 max-w-full rounded bg-muted" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
