"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

/** Search box that keeps the query in the URL (`/?q=...`), so the server filters the list. */
export function SearchInput({ query }: { query: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest query this input asked for.
  const requestedRef = useRef(query);

  const scheduleSearch = useCallback(
    (value: string) => {
      const next = value.trim();
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (next === requestedRef.current) return;
        requestedRef.current = next;
        startTransition(() => {
          router.replace(next ? `/?q=${encodeURIComponent(next)}` : "/", { scroll: false });
        });
      }, DEBOUNCE_MS);
    },
    [router],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    if (query !== requestedRef.current && document.activeElement !== input) {
      // The query changed from outside (e.g. it was reset after adding a contact):
      // show it, unless the user is typing right now.
      requestedRef.current = query;
      input.value = query;
    } else if (input.value.trim() !== requestedRef.current) {
      // The box holds text nobody searched for yet: it was typed before the page
      // became interactive, or the browser restored it. Run that search.
      scheduleSearch(input.value);
    }
  }, [query, scheduleSearch]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const Icon = isPending ? LoaderCircleIcon : SearchIcon;

  return (
    <div className="relative">
      <Icon
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground ${
          isPending ? "animate-spin" : ""
        }`}
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={query}
        onChange={(event) => scheduleSearch(event.target.value)}
        placeholder="Поиск по имени"
        aria-label="Поиск по имени"
        autoComplete="off"
        className="h-10 pl-9"
      />
    </div>
  );
}
