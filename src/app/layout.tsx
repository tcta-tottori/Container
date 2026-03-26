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
        {/* favicon/apple-icon は src/app/icon.tsx, apple-icon.tsx で動的生成 */}
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
