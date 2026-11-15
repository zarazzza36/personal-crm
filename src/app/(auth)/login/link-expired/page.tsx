import Link from "next/link";

export default function LinkExpired() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-heading text-2xl font-bold">Ссылка устарела, запросите новую</h1>
      <Link className="mt-6 inline-block underline" href="/login">
        Получить новую ссылку
      </Link>
    </main>
  );
}
