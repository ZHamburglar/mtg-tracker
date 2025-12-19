"use client";
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

import { NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem
} from "@/components/ui/navigation-menu";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Label
} from "@/components/ui/label";
import {
  Input
} from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import buildClient from "../app/api/build-client";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Menu } from 'lucide-react';


const Header = () => {
  const { currentUser, refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(true); // TODO: Fetch from API

  useEffect(() => {
    console.log('Current user in Header:', currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    console.log('Fetching notifications...');
    const client = buildClient();
    try {
      const response = await client.get('/api/notification');
      console.log('Fetched notifications:', response.data);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.message));
      } else {
        toast.error('Failed to fetch notifications');
      }
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    const client = buildClient();
    try {
      await client.post(`/api/notification/${notificationId}/read`);
      // Update local state to mark as read
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(unreadCount - 1);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err.message));
      } else {
        toast.error('Failed to mark notification as read');
      }
    }
  };

  const signIn = () => {
    const client = buildClient();
    client.post('/api/users/signin', { email, password })
      .then(response => {
        console.log('Sign in successful:', response.data);
        setIsSignInOpen(false);
        toast.success('Signed in successfully!');
        refreshAuth();
      })
      .catch(error => {
        console.error('Error signing in:', error);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => toast.error(err.message));
        } else {
          toast.error('Failed to sign in. Please check your credentials.');
        }
      });
  };

  const createAccount = () => {
    const client = buildClient();
    client.post('/api/users/newuser', { email, username, password })
      .then(response => {
        console.log('Account created:', response.data);
        setIsCreateAccountOpen(false);
        toast.success('Account created successfully!');
        // Clear form
        setEmail('');
        setUsername('');
        setPassword('');
        refreshAuth();
      })
      .catch(error => {
        console.error('Error creating account:', error);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => toast.error(err.message));
        } else {
          toast.error('Failed to create account. Please try again.');
        }
      });
  };

  const openCreateAccount = () => {
    setIsSignInOpen(false);
    setIsCreateAccountOpen(true);
  };

  const signOut = () => {
    const client = buildClient();
    client.post('/api/users/signout')
      .then(response => {
        console.log('Sign out successful:', response);
        toast.success('Signed out successfully!');
        refreshAuth();
        // Redirect to home after a brief delay
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      })
      .catch(error => {
        console.error('Error signing out:', error);
        if (error.response?.data?.errors) {
          error.response.data.errors.forEach(err => toast.error(err.message));
        } else {
          toast.error('Failed to sign out. Please try again.');
        }
      });
  };

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>
                  Quick links to navigate the app
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                <Link href="/" className="text-lg hover:text-primary transition-colors">
                  Home
                </Link>
                <Link href="/search" className="text-lg hover:text-primary transition-colors">
                  Search
                </Link>
                <Link href="/collection" className="text-lg hover:text-primary transition-colors">
                  My Collection
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>


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
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="relative cursor-pointer">
                        <Avatar>
                          <AvatarFallback>
                            {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {unreadCount > 0 && (
                          <Badge 
                            variant="notification"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                          >
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                      <DropdownMenuLabel className="text-center">{currentUser.username}</DropdownMenuLabel>
                      <DropdownMenuLabel className="text-center">{currentUser.email}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {notifications.length > 0 && (
                        <>
                          <DropdownMenuLabel className="flex items-center justify-between">
                            <span>Notifications</span>
                            <div className="flex gap-2">
                              {
                                unreadCount > 0 ? (
                                  <Badge variant="notification">{unreadCount}</Badge>
                                ) : null
                              }
                              <Badge variant="secondary">{notifications.length}</Badge>
                            </div>
                           
                          </DropdownMenuLabel>
                          <div className="max-h-64 overflow-y-auto">
                            {notifications.map((notification) => (
                              <DropdownMenuItem 
                                key={notification.id}
                                className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                                onClick={() => markNotificationAsRead(notification.id)}
                              >
                                <div className="flex items-start justify-between w-full gap-2">
                                  <div className="font-medium text-sm">{notification.title}</div>
                                  {!notification.read && (
                                    <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(notification.created_at).toLocaleDateString()}
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      
                      <DropdownMenuItem onClick={() => console.log('Go to settings')}>
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => signOut()}>
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <>
                  <Dialog open={isSignInOpen} onOpenChange={setIsSignInOpen}>
                    <DialogTrigger asChild>
                      <Button>Sign In</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Sign In</DialogTitle>
                        <DialogDescription>
                          Enter your credentials to sign in
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
                      <DialogDescription>
                        Don't have an account?{' '}
                        <span 
                          onClick={openCreateAccount}
                          className="text-primary underline cursor-pointer hover:text-primary/80"
                        >
                          Create one
                        </span>
                      </DialogDescription>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSignInOpen(false)}>Cancel</Button>
                        <Button onClick={() => signIn()}>Sign In</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Account</DialogTitle>
                        <DialogDescription>
                          Fill in your details to create a new account
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center gap-4">
                        <Label htmlFor="new-username" className="min-w-20">Username</Label>
                        <Input type="text" id="new-username" className="flex-1" value={username}
                          onChange={e => setUsername(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-4">
                        <Label htmlFor="new-email" className="min-w-20">Email</Label>
                        <Input type="email" id="new-email" className="flex-1" value={email}
                          onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-4">
                        <Label htmlFor="new-password" className="min-w-20">Password</Label>
                        <Input type="password" id="new-password" className="flex-1" value={password}
                          onChange={e => setPassword(e.target.value)} />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateAccountOpen(false)}>Cancel</Button>
                        <Button onClick={() => createAccount()}>Create Account</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

            </NavigationMenuItem> 
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </nav>
  );
}

export default Header;
