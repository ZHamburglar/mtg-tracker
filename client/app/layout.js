import { Inter } from "next/font/google";
import Header from "@/components/header";
import buildClient from './api/build-client';
import { Toaster } from "@/components/ui/sonner";
import { SymbologyProvider } from "@/contexts/SymbologyContext";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MTG Collection Tracker",
  description: "Track your Magic: The Gathering card collection and prices",
  icons: {
    icon: '/images/logo.svg',
  },
};

async function getCurrentUser() {
  try {
    const client = buildClient();
    console.log('Fetching current user from server-side...');
    const { data } = await client.get('/api/users/currentuser');
    console.log('Current user data:', data);
    return data.currentUser;
  } catch (error) {
    console.error('Error fetching current user:', error.message);
    return null;
  }
}

export default async function RootLayout({ children }) {
  // const currentUser = await getCurrentUser();
  
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <SymbologyProvider>
          <Header />
          <Toaster richColors position="top-right" />
          {children}
        </SymbologyProvider>
      </body>
    </html>
  );
}
