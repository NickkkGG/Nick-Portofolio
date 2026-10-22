import type { Metadata } from "next";
import { IBM_Plex_Mono, VT323 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Analog horror 3D portfolio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${vt323.variable} ${plexMono.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
