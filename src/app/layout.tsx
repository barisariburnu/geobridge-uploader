import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeoServer Dosya Yükleyici - SSH/SCP ile Dosya Yükleme",
  description: "SSH/SCP kullanarak uzak sunucuya güvenli dosya yükleme. GeoServer Docker部署 için GeoTIFF ve Shapefile desteği.",
  keywords: ["GeoServer", "SSH", "SCP", "Dosya Yükleme", "GeoTIFF", "Shapefile", "Docker"],
  authors: [{ name: "GeoServer Admin" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
