import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Container Navigation System",
  description: "Container Navigation System - コンテナ荷降ろし管理",
  manifest: "/Container/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CNS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#141720",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" type="image/svg+xml" href="/Container/icons/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/Container/icons/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/Container/icons/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
