import type { Metadata } from "next";
import "./globals.css";

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://seetalpick.pages.dev/");
const socialImage = new URL("og.png", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Seetal Pick — Find your shared yes",
    template: "%s · Seetal Pick",
  },
  description: "Swipe separately. Match instantly. Make choosing together the fun part.",
  applicationName: "Seetal Pick",
  appleWebApp: {
    capable: true,
    title: "Seetal Pick",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Seetal Pick",
    title: "Seetal Pick — Find your shared yes",
    description: "Two people. One great plan. Swipe separately and reveal the overlap.",
    images: [{ url: socialImage, width: 1728, height: 907, alt: "Seetal Pick — Find your shared yes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Seetal Pick — Find your shared yes",
    description: "Two people. One great plan. Swipe separately and reveal the overlap.",
    images: [socialImage],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5ef",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
