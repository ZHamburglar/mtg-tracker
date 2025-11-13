"use client";
import { useState, useEffect } from 'react';

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


const Header = ({ currentUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');


  const signIn = () => {
    console.log('Signing in with', email, password);
    // Implement sign-in logic here, e.g., call an API endpoint
    const client = buildClient();
    client.post('/api/users/signin', { email, password })
      .then(response => {
        console.log('Sign in successful:', response);
        // Cookie is automatically set by the browser from Set-Cookie header
        // Reload the page to update the currentUser state
        // window.location.href = '/';
      })
      .catch(error => {
        console.error('Error signing in:', error);
        // TODO: Show error message to user
      });
  };

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <NavigationMenuLink href="/">Home</NavigationMenuLink>
              </NavigationMenuTrigger>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <NavigationMenuLink href="/search">Search</NavigationMenuLink>
              </NavigationMenuTrigger>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <NavigationMenuLink href="/">Home</NavigationMenuLink>
              </NavigationMenuTrigger>
            </NavigationMenuItem>
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
                      <Button onClick={() => console.log('Sign out confirmed!')}>Sign Out</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog>
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
