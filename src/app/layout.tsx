import type { Metadata } from "next";
import { IBM_Plex_Mono, Unbounded } from "next/font/google";
import { Reminders } from "@/components/reminders";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// The landing's fonts: Unbounded for headings and buttons, IBM Plex Mono for text.
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // Full addresses in the link preview tags, such as the image's, start with it.
  metadataBase: new URL("https://app.volki-lzkv.ru"),
  title: "Волки с Лизюкова",
  description: "Контакты людей, которых я знаю лично",
  // Link preview in messengers, the same as the landing's. The image is
  // opengraph-image.png next to this file, a copy of the landing's og-image.png.
  // Pages set no metadata of their own, so every page shows this preview.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Волки с Лизюкова",
    url: "/",
    title: "Волки с Лизюкова",
    description: "Все контакты и заметки в одном месте. Больше никакой путаницы при организации рейсов",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* The grid stays in place while the page scrolls, so a sticky header at the top
            of the page can repeat it and its lines match the page's. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-grid" />
        <Reminders>
          <SiteHeader />
          {children}
        </Reminders>
      </body>
    </html>
  );
}
