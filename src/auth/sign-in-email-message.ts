export function signInEmail(url: string) {
  const safeUrl = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return {
    from: '"Личная CRM" <noreply@mail.crm.volki-lzkv.ru>',
    subject: "Вход в Личную CRM",
    text: `Войти: ${url}\n\nСсылка работает 15 минут.\nЕсли вы не запрашивали вход — просто проигнорируйте письмо.`,
    html: `<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none">Войти</a></p><p>Ссылка работает 15 минут.</p><p>Если вы не запрашивали вход — просто проигнорируйте письмо.</p>`,
  };
}
