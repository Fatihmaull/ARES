import type { Metadata } from "next";
import { Instrument_Serif, Geist, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ares/theme-provider";
import "./globals.css";

const themeInitScript = `(() => { try {
  var k = "ares-theme", L = "ares-dashboard-theme";
  var t = localStorage.getItem(k) || localStorage.getItem(L);
  if (t !== "light" && t !== "dark") t = "dark";
  document.documentElement.classList.toggle("dark", t === "dark");
} catch (e) {} })();`;

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARES | Engineered For Defense",
  description:
    "Autonomous security protocol for on-chain infrastructure and agents. Run continuously, pay only for what you scan.",
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
      className={`${geist.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        <script
          // Apply saved theme before paint (no flash of wrong background)
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
