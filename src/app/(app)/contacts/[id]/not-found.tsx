import Link from "next/link";

export default function ContactNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-7">
      <h1>Контакт не найден</h1>
      <Link href="/">Все контакты</Link>
    </main>
  );
}
