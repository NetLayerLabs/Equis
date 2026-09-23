import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import Script from "next/script";
import { TelegramMiniApp } from "@/components/TelegramMiniApp";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Equis - Margin credit against tokenized stocks on X Layer",
  description:
    "Deposit tokenized shares as collateral and borrow USD₮0 on X Layer without selling. Chainlink-priced, EIP-7702 agent guards.",
};

// viewport-fit=cover lets the Telegram Mini App webview use the full screen on notched phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable} ${display.variable} font-sans antialiased`}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers>
          <TelegramMiniApp />
          {children}
        </Providers>
      </body>
    </html>
  );
}
