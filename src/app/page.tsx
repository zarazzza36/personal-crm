import { Suspense } from "react";

import { AddContactButton } from "@/components/contact-dialog";
import { ContactList } from "@/components/contact-list";
import { GroupFilter } from "@/components/group-filter";
import { KeepInTouch } from "@/components/keep-in-touch";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { SearchInput } from "@/components/search-input";
import { listGroups } from "@/db/groups";
import {
  countContacts,
  getContactListItem,
  listContactsPage,
  listDueContacts,
  searchContacts,
} from "@/db/queries";
import { parseContactId } from "@/lib/contact-input";
import { CONTACTS_PAGE_SIZE, parseGroupId, type ContactsPage } from "@/lib/contact-list";
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

  // The group of the address counts only while it exists: a link to a deleted group, or a
  // made-up number, shows the whole list.
  const groups = await listGroups();
  const requestedGroupId = parseGroupId(firstValue(params.group));
  const group = groups.find((candidate) => candidate.id === requestedGroupId);
  const groupId = group?.id ?? null;

  // A search or a group shows only what it has found, without the just-added contact on top.
  const addedId = query || group ? null : parseContactId(firstValue(params.added));

  const [firstPage, total, matching, addedContact, dueContacts] = await Promise.all([
    // A search shows everything it has found at once; the full list loads part by part.
    query
      ? searchContacts(query, groupId).then((items): ContactsPage => ({ items, nextCursor: null }))
      : listContactsPage(null, CONTACTS_PAGE_SIZE, groupId),
    countContacts(),
    // With a group and no query the list comes in parts: how many it has in all is asked apart.
    group && !query ? countContacts(group.id) : undefined,
    addedId ? getContactListItem(addedId) : undefined,
    // A search or a group shows only what it has found, without "Пора связаться".
    query || group ? [] : listDueContacts(),
  ]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-grid">
        {/* grid-cols-1: the column may be narrower than its content, so the row of group buttons
            scrolls inside itself and does not widen the page. */}
        <div className={`${COLUMN} grid grid-cols-1 gap-4 pt-7 pb-4`}>
          <div className="flex min-h-11 items-center justify-between gap-3">
            {/* On a narrow screen the count goes under the heading to leave room for the button. */}
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
              <PageTitle />
              <span
                className="truncate text-xs tracking-label text-dim uppercase"
                data-testid="contacts-count"
              >
                {query || group
                  ? `Найдено: ${formatNumber(matching ?? firstPage.items.length)} из ${formatNumber(total)}`
                  : `Всего: ${formatNumber(total)}`}
              </span>
            </div>
            <AddContactButton groups={groups} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <SearchInput query={query} groupId={groupId} />
            <GroupFilter groups={groups} selectedId={groupId} query={query} />
          </div>
        </div>
      </header>

      <div className={COLUMN}>
        {dueContacts.length > 0 && <KeepInTouch contacts={dueContacts} />}
        {firstPage.items.length > 0 ? (
          // Another group is another list: it starts over, without what was loaded for the last one.
          <ContactList
            key={groupId ?? "all"}
            firstPage={firstPage}
            addedContact={addedContact ?? null}
            groupId={groupId}
          />
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            {emptyListText(query, group?.name)}
          </p>
        )}
      </div>
    </>
  );
}

/** What the page says when the list is empty: nobody is added, found, or in the group. */
function emptyListText(query: string, groupName: string | undefined) {
  if (query && groupName) return `Никого не нашлось по запросу «${query}» в группе «${groupName}»`;
  if (query) return `Никого не нашлось по запросу «${query}»`;
  if (groupName) return `В группе «${groupName}» пока никого нет`;
  return "Пока нет ни одного контакта. Добавьте первый.";
}

// No yellow square here: on the landing it belongs to the logo only.
function PageTitle() {
  return (
    <h1 className="font-heading text-22 font-bold tracking-heading whitespace-nowrap sm:text-28">
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
            <span className="size-10 rounded-10 bg-muted" />
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
