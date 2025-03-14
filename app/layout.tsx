import "../styles/globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Metadata } from "next";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/react"
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "SchemaForge - Database Schema Editor",
  description: "Create and visualize database schemas with ease",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {children}
            <Analytics/>

          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}