"use client";
import { useState, useEffect, use } from 'react';

import { NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport } from "@/components/ui/navigation-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Label
} from "@/components/ui/label";
import {
  Input
} from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import buildClient from "../app/api/build-client";
import Image from "next/image";
import Link from "next/link";


const Header = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  useEffect(() => {
    console.log('Current user in Header:', currentUser);
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    console.log('Fetching current user...');
    const client = buildClient();
    try {
      const response = await client.get('/api/users/currentuser');
      console.log('Fetched current user:', response.data.currentUser);
      setCurrentUser(response.data.currentUser);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };



  const signIn = () => {
    console.log('Signing in with', email, password);
    const client = buildClient();
    client.post('/api/users/signin', { email, password })
      .then(response => {
        console.log('Sign in successful:', response.data);
        setCurrentUser(response.data);
        setIsSignInOpen(false);
        // Cookie is automatically set by the browser from Set-Cookie header
        // Reload the page to update the currentUser state
        // window.location.href = '/';
      })
      .catch(error => {
        console.error('Error signing in:', error);
        // TODO: Show error message to user
      });
  };

  const signOut = () => {
    const client = buildClient();
    client.post('/api/users/signout')
      .then(response => {
        console.log('Sign out successful:', response);
        // Reload the page to clear the currentUser state
        window.location.href = '/';
      })
      .catch(error => {
        console.error('Error signing out:', error);
      });
  };

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <NavigationMenuLink href="/search">Search</NavigationMenuLink>
              </NavigationMenuTrigger>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>


        <Link href="/">
          <Image 
            src="/images/logo.svg" 
            alt="Logo" 
            width={50} 
            height={50}
            className="cursor-pointer"
          />
        </Link>

        
        {/* Right side of header */}
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>

              {currentUser ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Sign Out</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Sign Out</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to sign out?
                      </DialogDescription>
                    </DialogHeader>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => console.log('Cancel sign out')}>Cancel</Button>
                      <Button onClick={() => signOut()}>Sign Out</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
                  <DialogTrigger asChild>
                    <Button>Sign In</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Sign In</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to sign in?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-4">
                      <Label htmlFor="email" className="min-w-20">Email</Label>
                      <Input type="email" id="email" className="flex-1" value={email}
                        onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-4">
                      <Label htmlFor="password" className="min-w-20">Password</Label>
                      <Input type="password" id="password" className="flex-1" value={password}
                        onChange={e => setPassword(e.target.value)} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => console.log('Cancel sign out')}>Cancel</Button>
                      <Button onClick={() => signIn()}>Sign In</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

            </NavigationMenuItem> 
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </nav>
  );
}

export default Header;
