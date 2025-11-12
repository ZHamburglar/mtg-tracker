import { Inter } from "next/font/google";
import Header from "@/components/header";
import buildClient from './api/build-client';

import "./globals.css";
import { Root } from "react-day-picker";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MTG Collection Tracker",
  description: "Track your Magic: The Gathering card collection and prices",
};

async function getCurrentUser() {
  try {
    const client = buildClient();
    const { data } = await client.get('/api/users/currentuser');
    console.log('data in layout:', data);
    return data.currentUser;
  } catch (error) {
    // During build time or if service is unavailable, return null
    console.error('Error fetching current user:', error.message);
    return null;
  }
}

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser();
  
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Header currentUser={currentUser}/>
        
        {children}
      </body>
    </html>
  );
}
