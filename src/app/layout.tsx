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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/Container/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/Container/icons/icon-192.png" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
