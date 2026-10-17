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
    <main className="pb-16">
      <Suspense fallback={<ContactsFallback />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
      <ScrollToTopButton />
    </main>
  );
}

// The header and its border span the whole width; its content keeps to the list's column.
const COLUMN = "mx-auto w-full max-w-3xl px-4";

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
      <header className="sticky top-0 z-10 border-b bg-grid">
        <div className={`${COLUMN} grid gap-4 pt-7 pb-4`}>
          <div className="flex min-h-11 items-center justify-between gap-3">
            {/* On a narrow screen the count goes under the heading to leave room for the button. */}
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <PageTitle />
              <span
                className="truncate text-xs tracking-[0.08em] text-dim uppercase"
                data-testid="contacts-count"
              >
                {query
                  ? `Найдено: ${formatNumber(firstPage.items.length)} из ${formatNumber(total)}`
                  : `Всего: ${formatNumber(total)}`}
              </span>
            </div>
            <AddContactButton />
          </div>
          <SearchInput query={query} />
        </div>
      </header>

      <div className={COLUMN}>
        {firstPage.items.length > 0 ? (
          <ContactList firstPage={firstPage} addedContact={addedContact ?? null} />
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            {query
              ? `Никого не нашлось по запросу «${query}»`
              : "Пока нет ни одного контакта. Добавьте первый."}
          </p>
        )}
      </div>
    </>
  );
}

/** The heading with the landing's yellow square in front of it. */
function PageTitle() {
  return (
    <h1 className="font-heading text-[22px] font-bold tracking-[-0.01em] whitespace-nowrap sm:text-[28px]">
      <span
        aria-hidden
        className="mr-2.5 inline-block size-3 rounded-[3px] bg-accent align-middle sm:mr-3 sm:size-3.5"
      />
      Контакты
    </h1>
  );
}

function ContactsFallback() {
  return (
    <div aria-busy aria-label="Загрузка контактов">
      <div className="border-b">
        <div className={`${COLUMN} grid gap-4 pt-7 pb-4`}>
          <div className="flex min-h-11 flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-start sm:gap-3">
            <PageTitle />
            <span className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-12 rounded-lg bg-muted" />
        </div>
      </div>
      <ul className={`${COLUMN} divide-y`}>
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex animate-pulse items-center gap-3.5 py-3">
            <span className="size-10 rounded-[10px] bg-muted" />
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
