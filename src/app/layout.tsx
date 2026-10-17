import type { Metadata } from "next";
import { IBM_Plex_Mono, Unbounded } from "next/font/google";
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
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* The grid stays in place while the page scrolls, so a sticky header at the top
            of the page can repeat it and its lines match the page's. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-grid" />
        {children}
      </body>
    </html>
  );
}
