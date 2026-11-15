/** Read a unique test recipient's latest message from the local Mailpit API. */
export async function getMailpitSignInLink(email: string): Promise<string | null> {
  const search = await fetch(
    `http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!search.ok) throw new Error(`Mailpit search failed: ${search.status}`);
  const result = (await search.json()) as { messages?: { ID: string }[] };
  const id = result.messages?.[0]?.ID;
  if (!id) return null;
  const response = await fetch(`http://127.0.0.1:8025/api/v1/message/${id}`);
  if (!response.ok) throw new Error(`Mailpit message failed: ${response.status}`);
  const message = (await response.json()) as { HTML?: string; Text?: string };
  return (
    message.HTML?.match(/href=["']([^"']+)["']/i)?.[1]?.replaceAll("&amp;", "&") ??
    message.Text?.match(/https?:\/\/[^\s<>]+/)?.[0] ??
    null
  );
}
