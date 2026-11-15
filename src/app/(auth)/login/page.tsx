import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-heading text-2xl font-bold">Вход</h1>
      <p className="mt-4 text-muted-foreground">Введите почту, и мы отправим ссылку для входа.</p>
      <LoginForm />
    </main>
  );
}
