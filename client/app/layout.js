import { Inter } from "next/font/google";
import Header from "@/components/header";
import buildClient from './api/build-client';
import { Toaster } from "@/components/ui/sonner";
import { SymbologyProvider } from "@/contexts/SymbologyContext";
import { AuthProvider } from "@/contexts/AuthContext";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MTG Collection Tracker",
  description: "Track your Magic: The Gathering card collection and prices",
  icons: {
    icon: '/images/logo.svg',
  },
};

export default async function RootLayout({ children }) {
  // const currentUser = await getCurrentUser();
  
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <SymbologyProvider>
            <Header />
            <Toaster richColors position="top-right" />
            {children}
          </SymbologyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
