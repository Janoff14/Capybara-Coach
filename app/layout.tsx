import type { Metadata } from "next";
import Script from "next/script";
import {
  Libre_Caslon_Text,
  Manrope,
  Plus_Jakarta_Sans,
  Special_Elite,
} from "next/font/google";

import { AppProviders } from "@/app/providers";
import "@/app/globals.css";

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
});

const libreCaslonText = Libre_Caslon_Text({
  variable: "--font-reader-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const specialElite = Special_Elite({
  variable: "--font-reader-typewriter",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Capybara Coach",
  description: "Read, explain, assess, and turn recall sessions into clean study notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${plusJakartaSans.variable} ${libreCaslonText.variable} ${specialElite.variable} min-h-full scroll-smooth`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Script id="reader-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("capy-reader-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.readerTheme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
