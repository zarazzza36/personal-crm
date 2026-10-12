import { Suspense } from "react";

import { AddContactButton } from "@/components/contact-dialog";
import { ContactList } from "@/components/contact-list";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { SearchInput } from "@/components/search-input";
import {
  countContacts,
  getContactListItem,
  listContactsPage,
  searchContacts,
} from "@/db/queries";
import { parseContactId } from "@/lib/contact-input";
import { CONTACTS_PAGE_SIZE, type ContactsPage } from "@/lib/contact-list";
import { formatNumber } from "@/lib/format";

type SearchParams = PageProps<"/">["searchParams"];

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <Suspense fallback={<ContactsFallback />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
      <ScrollToTopButton />
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Contacts({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim();
  // A search shows only what it has found, without the just-added contact on top.
  const addedId = query ? null : parseContactId(firstValue(params.added));

  const [firstPage, total, addedContact] = await Promise.all([
    // A search shows everything it has found at once; the full list loads part by part.
    query
      ? searchContacts(query).then((items): ContactsPage => ({ items, nextCursor: null }))
      : listContactsPage(null, CONTACTS_PAGE_SIZE),
    countContacts(),
    addedId ? getContactListItem(addedId) : undefined,
  ]);

  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 grid grid-cols-1 gap-3 border-b bg-background px-4 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Контакты</h1>
            <span className="truncate text-sm text-muted-foreground" data-testid="contacts-count">
              {query
                ? `Найдено: ${formatNumber(firstPage.items.length)} из ${formatNumber(total)}`
                : `Всего: ${formatNumber(total)}`}
            </span>
          </div>
          <AddContactButton />
        </div>
        <SearchInput query={query} />
      </header>

      {firstPage.items.length > 0 ? (
        <ContactList firstPage={firstPage} addedContact={addedContact ?? null} />
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
