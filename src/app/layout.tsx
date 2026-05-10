import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "One Way Ticket - Flight Search",
  description: "Find the best flights to your destination",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${exo2.variable} antialiased`}>
        {/* Header */}
        <header className="bg-[#101010] border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center h-14">
              <Link href="/" className="text-lg font-light text-white">
                One Way Ticket
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>{children}</main>
      </body>
    </html>
  );
}
