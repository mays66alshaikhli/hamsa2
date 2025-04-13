import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "همسة - صديقتك الافتراضية",
  description: "Your Virtual AI Assistant",
  icons: {
    icon: [
      { rel: 'icon', url: '/hamsah.png' },
      { rel: 'shortcut icon', url: '/hamsah.png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar">
      <head>
        <link rel="icon" href="/hamsah.png" sizes="any" />
        <link rel="shortcut icon" href="/hamsah.png" sizes="any" />
        <link rel="apple-touch-icon" href="/hamsah.png" />
        <link rel="icon" type="image/png" href="/hamsah.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}