import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WalletProvider } from "@/contexts/WalletContext";

export const metadata: Metadata = {
  title: "WinScan",
  description: "Multi-chain blockchain explorer powered by WinScan",
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WinScan',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WinScan" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </LanguageProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
