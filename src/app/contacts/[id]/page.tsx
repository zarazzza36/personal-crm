import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { ContactAvatar } from "@/components/contact-avatar";
import { EditContactButton } from "@/components/contact-dialog";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { getContact, listNotes } from "@/db/queries";
import { parseContactId } from "@/lib/contact-input";
import { formatDateTime } from "@/lib/format";

type Params = PageProps<"/contacts/[id]">["params"];

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <Link
        href="/"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
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
      <header className="mt-6 flex flex-wrap items-start gap-4">
        <ContactAvatar name={contact.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
            {contact.name}
          </h1>
          {contact.about && <p className="mt-1 text-muted-foreground">{contact.about}</p>}
        </div>
        {/* On a narrow screen the buttons move to their own row under the name. */}
        <div className="flex w-full gap-2 sm:w-auto">
          <EditContactButton contact={contact} />
          <DeleteContactButton contactId={contact.id} />
        </div>
      </header>

      <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl border p-4 sm:grid-cols-[auto_1fr]">
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
      </dl>

      <section className="mt-8" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-heading text-lg font-semibold">
          Заметки
        </h2>
        <div className="mt-3">
          <NoteForm contactId={contact.id} />
        </div>
        {notes.length > 0 ? (
          <ul className="mt-6 grid gap-3" aria-label="Заметки о контакте">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border p-4">
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1 break-words whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Заметок пока нет. Запишите первую после разговора.
          </p>
        )}
      </section>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        {children || <span className="text-muted-foreground">не указано</span>}
      </dd>
    </>
  );
}

function ContactFallback() {
  return (
    <div className="mt-6 animate-pulse" aria-busy aria-label="Загрузка контакта">
      <div className="flex items-center gap-4">
        <span className="size-14 rounded-full bg-muted" />
        <span className="grid flex-1 gap-2">
          <span className="h-6 w-56 max-w-full rounded bg-muted" />
          <span className="h-4 w-72 max-w-full rounded bg-muted" />
        </span>
      </div>
      <div className="mt-6 h-32 rounded-xl bg-muted" />
    </div>
  );
}
