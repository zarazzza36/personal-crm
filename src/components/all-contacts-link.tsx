import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

/** "Все контакты" at the top of a page that is not the list: leads back to the list. */
export function AllContactsLink() {
  return (
    <Link
      href="/"
      className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 text-13 text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      Все контакты
    </Link>
  );
}
