import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Hieu Pham — Caelestia Shell Web Replica";
  const description =
    "A faithful interactive web translation of the Caelestia Linux shell, rebuilt for Hieu Pham.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: {
      icon: "/caelestia-logo.svg",
      shortcut: "/caelestia-logo.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1680,
          height: 945,
          alt: "Hieu Pham Caelestia Shell web replica",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
