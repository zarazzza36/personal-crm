import Link from "next/link";

/** The landing's header: the logo leads back to the contact list. */
export function SiteHeader() {
  return (
    // On a phone the logo lines up with the page content; wider, it spans the page like the landing,
    // whose header content is at most 1280px wide (1376px with the side padding).
    <header className="mx-auto flex w-full max-w-[1376px] items-center justify-between gap-4 px-4 py-[22px] sm:px-6 lg:px-12 lg:py-7">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-sm font-display text-[15px] font-bold tracking-[0.02em] whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:gap-3 lg:text-lg"
      >
        <span aria-hidden className="size-3.5 rounded-[3px] bg-accent lg:size-4" />
        Волки с Лизюкова
      </Link>
      {/* May wrap onto two lines on the narrowest phones rather than run off the screen. */}
      <span className="text-right text-[11px] tracking-[0.08em] text-dim lg:text-xs">
        ДЛЯ ЛОГИСТОВ
      </span>
    </header>
  );
}
