import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { ContactAvatar } from "@/components/contact-avatar";
import { EditContactButton } from "@/components/contact-dialog";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { getContact, listNotes } from "@/db/queries";
import { bodyTypeLabels } from "@/lib/body-types";
import { parseContactId } from "@/lib/contact-input";
import { formatCubicMeters, formatDateTime, formatTons } from "@/lib/format";
import { cn } from "@/lib/utils";

type Params = PageProps<"/contacts/[id]">["params"];

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-7 pb-16">
      <Link
        href="/"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Все контакты
      </Link>
      <Suspense fallback={<ContactFallback />}>
        <ContactCard params={params} />
      </Suspense>
    </main>
  );
}

async function ContactCard({ params }: { params: Params }) {
  const { id } = await params;
  const contactId = parseContactId(id);
  if (contactId === null) {
    notFound();
  }

  const [contact, notes] = await Promise.all([getContact(contactId), listNotes(contactId)]);
  if (!contact) {
    notFound();
  }

  return (
    <>
      <header className="mt-7 flex flex-wrap items-start gap-4">
        <ContactAvatar name={contact.name} className="size-16 rounded-[14px] text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[26px] leading-[1.12] font-bold tracking-[-0.01em] break-words sm:text-[32px]">
            {contact.name}
          </h1>
          {contact.about && <p className="mt-2 text-muted-foreground">{contact.about}</p>}
        </div>
        {/* On a narrow screen the buttons move to their own row under the name. */}
        <div className="flex w-full gap-2 sm:w-auto">
          <EditContactButton contact={contact} />
          <DeleteContactButton contactId={contact.id} />
        </div>
      </header>

      {/* A light card on the dark page, like the contact card on the landing */}
      <div className="mt-8 grid gap-5 rounded-[18px] bg-paper p-5 text-ink shadow-card sm:gap-6 sm:p-7">
        <Details>
          <Detail label="Откуда знакомы">{contact.howWeMet}</Detail>
          <Detail label="Телефон">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                {contact.phone}
              </a>
            )}
          </Detail>
          <Detail label="Почта">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="break-all hover:underline">
                {contact.email}
              </a>
            )}
          </Detail>
        </Details>
        {/* The truck: a group of its own under the contact details */}
        <Details className="border-t border-ink/10 pt-5 sm:pt-6">
          <Detail label="Тонны">
            {contact.capacityTons !== null && formatTons(contact.capacityTons)}
          </Detail>
          <Detail label="Кубы">
            {contact.volumeCubicMeters !== null && formatCubicMeters(contact.volumeCubicMeters)}
          </Detail>
          <Detail label="Тип кузова">{contact.bodyType && bodyTypeLabels[contact.bodyType]}</Detail>
        </Details>
      </div>

      <section className="mt-12" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-heading text-[28px] font-bold tracking-[-0.01em]">
          Заметки
        </h2>
        <div className="mt-4">
          <NoteForm contactId={contact.id} />
        </div>
        {notes.length > 0 ? (
          <ul className="mt-6 grid gap-2.5" aria-label="Заметки о контакте">
            {notes.map((note) => (
              <li key={note.id} className="rounded-[16px] bg-asphalt p-5">
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-xs tracking-[0.08em] text-accent"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-2 leading-normal break-words whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-muted-foreground">
            Заметок пока нет. Запишите первую после разговора.
          </p>
        )}
      </section>
    </>
  );
}

// Both groups of the card share the label column width, so their values line up.
function Details({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-1.5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-y-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[11px] tracking-[0.08em] text-card-label uppercase">{label}</dt>
      <dd className="min-w-0 not-last:mb-3 sm:not-last:mb-0">
        {children || <span className="text-card-label">не указано</span>}
      </dd>
    </>
  );
}

function ContactFallback() {
  return (
    <div className="mt-7 animate-pulse" aria-busy aria-label="Загрузка контакта">
      <div className="flex items-center gap-4">
        <span className="size-16 rounded-[14px] bg-muted" />
        <span className="grid flex-1 gap-2">
          <span className="h-7 w-56 max-w-full rounded bg-muted" />
          <span className="h-4 w-72 max-w-full rounded bg-muted" />
        </span>
      </div>
      <div className="mt-8 h-72 rounded-[18px] bg-muted" />
    </div>
  );
}
