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
  const client = buildClient();
  const { data } = await client.get('/api/users/currentuser');
  console.log('data in layout:', data);
  // try {
  //   // Server-side fetch - runs on the server during rendering
  //   const response = await fetch('http://auth-srv:3000/api/users/currentuser', {
  //     cache: 'no-store', // Don't cache, always get fresh data
  //     headers: {
  //       // Forward cookies from the request if needed
  //       // Cookie: cookies().toString()
  //     }
  //   });
    
  //   if (response.ok) {
  //     const data = await response.json();
  //     return data.currentUser;
  //   }
  // } catch (error) {
  //   console.error('Error fetching current user:', error);
  // }
  
  // return null;
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
