import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { contactsUrl } from "@/lib/contact-list";
import type { Group } from "@/lib/groups";
import { cn } from "@/lib/utils";

/**
 * The row under the search box: a button for every group, and the link "Группы" after them.
 * A button shows the list of that group only; the chosen one is highlighted, and pressing it
 * again shows everybody. The search query stays whatever is pressed. Only the buttons scroll
 * sideways, so on a phone the link stays in view however many groups there are.
 */
export function GroupFilter({
  groups,
  selectedId,
  query,
}: {
  /** Every group, in alphabetical order. */
  groups: Group[];
  /** The group the list is filtered by, or `null`. */
  selectedId: number | null;
  query: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {groups.length > 0 && (
        <nav
          aria-label="Фильтр по группе"
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
        >
          {groups.map((group) => {
            const isSelected = group.id === selectedId;
            return (
              <Link
                key={group.id}
                // Like the search, a filter does not pile up history: "Back" leaves the list.
                replace
                scroll={false}
                href={contactsUrl({ query, groupId: isSelected ? null : group.id })}
                aria-current={isSelected ? "true" : undefined}
                // `cn` lets the smaller height and padding win over the button's own.
                className={cn(
                  buttonVariants({ variant: isSelected ? "default" : "outline" }),
                  "h-9 px-4",
                )}
              >
                {group.name}
              </Link>
            );
          })}
        </nav>
      )}
      <Link
        href="/groups"
        className={cn(buttonVariants({ variant: "ghost" }), "ml-auto h-9 shrink-0 px-3")}
      >
        Группы
      </Link>
    </div>
  );
}
