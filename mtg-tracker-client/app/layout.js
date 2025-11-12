import { Inter } from "next/font/google";
import { Button } from "@/components/ui/button";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MTG Collection Tracker",
  description: "Track your Magic: The Gathering card collection and prices",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Button className="fixed top-4 right-4">Dark Mode</Button>
        {children}
        
      </body>
    </html>
  );
}
