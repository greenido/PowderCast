import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PowderCast - Ultimate Snowboarder's Weather Dashboard",
  description: "Hyper-local mountain weather data for US snowboarders. Get real-time snow quality, wind holds, and rider intelligence.",
  keywords: "snowboard, weather, ski resort, powder, snow forecast, mountain weather",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {children}
        </div>
      </body>
    </html>
  );
}
