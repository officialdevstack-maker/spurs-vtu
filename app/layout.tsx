import type { Metadata } from "next";
import { Familjen_Grotesk, Figtree, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { THEME_SCRIPT } from "@/lib/theme";
import type { ReactNode } from "react";
import "./globals.css";

const display = Familjen_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spur VTU",
  description: "Airtime, data, cable TV and electricity from one wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${geistMono.variable} min-h-full flex flex-col font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
