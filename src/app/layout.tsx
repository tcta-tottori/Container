import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "コンテナ荷降ろし管理",
  description: "気高電機 コンテナ入荷・荷降ろし管理アプリ",
  manifest: "/Container/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "コンテナ管理",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/Container/icons/icon-192.svg" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
