"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Не получилось загрузить данные</h1>
      <p className="text-muted-foreground">
        Скорее всего, не запущена база данных. Запустите Docker и попробуйте ещё раз.
      </p>
      <div>
        <Button onClick={() => retry()}>Попробовать ещё раз</Button>
      </div>
    </main>
  );
}
