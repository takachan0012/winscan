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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
                navigator.serviceWorker.register('/sw.js', {
                  updateViaCache: 'none',
                  scope: '/'
                }).then(function(registration) {
                  console.log('[PWA] Service Worker registered');
                  
                  // Check for updates setiap 1 jam, tidak agresif
                  setInterval(function() {
                    registration.update();
                  }, 60 * 60 * 1000);
                }).catch(function(error) {
                  console.log('[PWA] Service Worker registration failed:', error);
                });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
