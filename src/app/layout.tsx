import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const SITE_URL = "https://elasticmindfulness.com";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Elastic Mindfulness — A 60-Second Experiment in Slowness",
  description:
    "Stretch. Breathe. Let go. An interactive mindfulness experience that rewards being slow. Create shareable generative art with elastic light.",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Elastic Mindfulness — A 60-Second Experiment in Slowness",
    description:
      "Stretch. Breathe. Let go. An interactive mindfulness experience that rewards being slow. Create shareable generative art with elastic light.",
    type: "website",
    locale: "en_AU",
    siteName: "Elastic Mindfulness",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Elastic Mindfulness — warm gold elastic strands on a dark canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elastic Mindfulness — A 60-Second Experiment in Slowness",
    description:
      "Stretch. Breathe. Let go. An interactive mindfulness experience that rewards being slow. Create shareable generative art with elastic light.",
    site: "@kylebehrend",
    images: ["/og-image.png"],
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Elastic Mindfulness",
    url: SITE_URL,
    description:
      "A 60-second interactive mindfulness experience that rewards being slow.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Elastic Mindfulness",
    url: SITE_URL,
    applicationCategory: "HealthApplication",
    operatingSystem: "All",
    description:
      "Stretch. Breathe. Let go. An interactive mindfulness experience that rewards being slow. Create shareable generative art with elastic light.",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${instrumentSerif.variable} ${dmSans.variable} bg-background antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
