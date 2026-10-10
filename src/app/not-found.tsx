import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Ничего не нашлось</h1>
      <p className="text-muted-foreground">Такой страницы или контакта нет.</p>
      <div>
        <Link href="/" className="font-medium underline underline-offset-4">
          Ко всем контактам
        </Link>
      </div>
    </main>
  );
}
