"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircleIcon } from "lucide-react";

import { loadContactsPage } from "@/app/actions";
import { ContactAvatar } from "@/components/contact-avatar";
import { JustAddedBadge } from "@/components/just-added-badge";
import { Button } from "@/components/ui/button";
import { bodyTypeLabels } from "@/lib/body-types";
import {
  CONTACTS_PAGE_SIZE,
  type ContactCursor,
  type ContactListItem,
  type ContactsPage,
} from "@/lib/contact-list";
import { formatCubicMeters, formatTons } from "@/lib/format";
import { cn } from "@/lib/utils";

// The next contacts start loading this far before the end of the list comes into view.
const LOAD_AHEAD = "600px";

/** What scrolling has added to the first page of the list. */
type Loaded = {
  /** The first page these contacts continue. */
  firstPage: ContactsPage;
  items: ContactListItem[];
  nextCursor: ContactCursor | null;
  /** Rows that continued the previous first page: shown until `items` are loaded again. */
  outdatedItems: ContactListItem[];
};

type ContactListProps = {
  /** The start of the list; the whole list when its `nextCursor` is `null`. */
  firstPage: ContactsPage;
  /** The just-added contact: it goes first and is highlighted. */
  addedContact: ContactListItem | null;
};

/** Contact list that loads its next part when scrolled to the end. */
export function ContactList({ firstPage, addedContact }: ContactListProps) {
  const [loaded, setLoaded] = useState<Loaded>({
    firstPage,
    items: [],
    nextCursor: firstPage.nextCursor,
    outdatedItems: [],
  });
  // How many contacts scrolling has asked to add to the first page.
  const [wanted, setWanted] = useState(0);
  // The state that could not be continued: no new attempt until the user asks for it.
  const [failedFor, setFailedFor] = useState<Loaded | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const moreItems = loaded.outdatedItems.length > 0 ? loaded.outdatedItems : loaded.items;

  if (loaded.firstPage !== firstPage) {
    // The server has sent the list again: the search changed, or a contact was added, edited
    // or deleted. What scrolling had added may have changed too, so it is loaded again.
    const reload = firstPage.nextCursor !== null && moreItems.length > 0;
    setLoaded({
      firstPage,
      items: [],
      nextCursor: firstPage.nextCursor,
      outdatedItems: reload ? moreItems : [],
    });
    if (!reload) {
      setWanted(0);
    }
  }

  const loadedCount = loaded.items.length;
  const hasMore = loaded.nextCursor !== null;
  const missing = hasMore ? Math.max(wanted - loadedCount, 0) : 0;
  const hasFailed = failedFor === loaded;

  useEffect(() => {
    if (!loaded.nextCursor || missing === 0 || hasFailed) return;

    let ignore = false;
    loadContactsPage(loaded.nextCursor, missing).then(
      (page) => {
        if (ignore) return;
        setLoaded({
          firstPage: loaded.firstPage,
          items: [...loaded.items, ...page.items],
          nextCursor: page.nextCursor,
          outdatedItems: [],
        });
      },
      () => {
        if (!ignore) setFailedFor(loaded);
      },
    );
    return () => {
      ignore = true;
    };
  }, [loaded, missing, hasFailed]);

  useEffect(() => {
    const end = endRef.current;
    if (!end) return;

    // A new observer reports at once, so after each loaded part the list goes on loading
    // for as long as its end stays in view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWanted((current) => Math.max(current, loadedCount + CONTACTS_PAGE_SIZE));
        }
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD}` },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [loadedCount, hasMore]);

  // The just-added contact goes first and is not repeated at its alphabetical place.
  const seen = new Set<number>();
  const contacts: ContactListItem[] = [];
  for (const contact of [addedContact, ...firstPage.items, ...moreItems]) {
    if (contact && !seen.has(contact.id)) {
      seen.add(contact.id);
      contacts.push(contact);
    }
  }

  return (
    <>
      <ul className="divide-y" aria-label="Список контактов">
        {contacts.map((contact) => (
          <ContactRow
            key={contact.id}
            contact={contact}
            isAdded={contact.id === addedContact?.id}
          />
        ))}
      </ul>
      {hasMore && (
        <div
          ref={endRef}
          className="flex min-h-16 items-center justify-center gap-3 text-13 text-dim"
        >
          {hasFailed ? (
            <>
              <span role="alert">Не удалось загрузить контакты</span>
              <Button variant="outline" onClick={() => setFailedFor(null)}>
                Повторить
              </Button>
            </>
          ) : (
            <>
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
              Загружаю контакты…
            </>
          )}
        </div>
      )}
    </>
  );
}

// Memoized: a newly loaded part must not re-render the rows that are already on the page.
const ContactRow = memo(function ContactRow({
  contact,
  isAdded,
}: {
  contact: ContactListItem;
  isAdded: boolean;
}) {
  const truck = [
    contact.capacityTons !== null && formatTons(contact.capacityTons),
    contact.volumeCubicMeters !== null && formatCubicMeters(contact.volumeCubicMeters),
    contact.bodyType && bodyTypeLabels[contact.bodyType],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li data-contact-id={contact.id}>
      <Link
        href={`/contacts/${contact.id}`}
        className={cn(
          "-mx-3 flex items-center gap-3.5 rounded-xl px-3 py-3 outline-none hover:bg-muted focus-visible:bg-muted",
          isAdded && "bg-accent/10 hover:bg-accent/15",
        )}
      >
        <ContactAvatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-15 font-medium">{contact.name}</span>
            {isAdded && <JustAddedBadge />}
          </div>
          {contact.about && (
            <div className="mt-0.5 truncate text-13 text-muted-foreground">{contact.about}</div>
          )}
          {truck && <div className="mt-1 truncate text-xs text-accent">{truck}</div>}
        </div>
        <div className="hidden shrink-0 text-right text-13 text-dim sm:block">
          {contact.phone && <div>{contact.phone}</div>}
          {contact.email && <div>{contact.email}</div>}
        </div>
      </Link>
    </li>
  );
});
