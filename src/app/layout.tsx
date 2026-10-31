import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const manrope = localFont({ src: "./fonts/Manrope-Variable.ttf", variable: "--font-manrope", weight: "200 800", display: "swap" });
const sourceSans = localFont({
  src: [
    { path: "./fonts/SourceSans3-Variable.ttf", style: "normal", weight: "200 900" },
    { path: "./fonts/SourceSans3-Italic-Variable.ttf", style: "italic", weight: "200 900" },
  ],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "DIAGNASSIS | Career readiness diagnostic", template: "%s | DIAGNASSIS" },
  description: "Compare your skills with current job-market requirements, see your gaps and get a personalised plan before placement season.",
  icons: { icon: "/brand/logo.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4F46E5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${sourceSans.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
