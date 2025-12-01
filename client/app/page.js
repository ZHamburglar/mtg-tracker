'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Library, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Trending from '@/components/trending';
import buildClient from "./api/build-client";
import Image from 'next/image';
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [trending24h, setTrending24h] = useState([]);
  const [trending7d, setTrending7d] = useState([]);
  const [trendingMonthly, setTrendingMonthly] = useState([]);
  const router = useRouter();

  useEffect(() => {
    // checkAuth();
    // handleAuthRedirect();
    getTrendingPrices('24h');
    getTrendingPrices('7d');
    getTrendingPrices('30d');
  }, []);

  const getTrendingPrices = async (timeframe) => {
    const client = buildClient();
    
    setLoading(true);
    try {
      const response = await client.get(`/api/search/trending?timeframe=${timeframe}`);
      console.log(`${timeframe} trending prices:`, response.data);
      
      if (timeframe === '24h') {
        setTrending24h(response.data.cards);
      } else if (timeframe === '7d') {
        setTrending7d(response.data.cards);
      } else if (timeframe === 'monthly') {
        setTrendingMonthly(response.data.cards);
      }
    } catch (error) {
      console.error('Error fetching trending prices:', error);
    } finally {
      setLoading(false);
    }
  };

  // const handleAuthRedirect = async () => {
  //   const hash = window.location.hash;
  //   if (hash && hash.includes('session_id=')) {
  //     const sessionId = hash.split('session_id=')[1].split('&')[0];
  //     setLoading(true);
      
  //     try {
  //         headers: {
  //           'X-Session-ID': sessionId
  //         }
  //       });
        
  //       if (response.ok) {
  //         const userData = await response.json();
          
  //         // Store session in backend
  //         await fetch('/api/auth/session', {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify(userData)
  //         });
          
  //         // Clear hash from URL
  //         window.history.replaceState(null, '', window.location.pathname);
          
  //         await checkAuth();
  //       }
  //     } catch (error) {
  //       console.error('Auth error:', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  // };

  // const checkAuth = async () => {
  //   try {
  //     const response = await fetch('/api/auth/me');
  //     if (response.ok) {
  //       const data = await response.json();
  //       setUser(data.user);
  //     }
  //   } catch (error) {
  //     console.error('Check auth error:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleLogin = () => {
  //   const redirectUrl = `${window.location.origin}`;
  //   window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  // };

  // const handleLogout = async () => {
  //   await fetch('/api/auth/logout', { method: 'POST' });
  //   setUser(null);
  //   router.push('/');
  // };

  // const handleSearch = (e) => {
  //   e.preventDefault();
  //   if (searchQuery.trim()) {
  //     router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  //   }
  // };

  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center">
  //       <Loader2 className="h-8 w-8 animate-spin text-primary" />
  //     </div>
  //   );
  // }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto text-center">
            <Image src="/images/logo-animated.svg" alt="MTG Collection Tracker" width={128} height={128} className="mx-auto mb-6" />
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              MTG Collection Tracker
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Track your Magic: The Gathering card collection, view price histories, and manage your valuable cards.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="border-border/50">
                <CardHeader>
                  <Link href="/search">
                    <Search className="h-12 w-12 mb-4 text-primary mx-auto" />
                    <CardTitle>Search Cards</CardTitle>
                  </Link>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Search through thousands of Magic cards with advanced filters
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card className="border-border/50">
                <CardHeader>
                  <Link href="/collection">
                    <Library className="h-12 w-12 mb-4 text-primary mx-auto" />
                    <CardTitle>Build Collection</CardTitle>
                  </Link>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Add cards to your personal collection and track what you own
                  </CardDescription>
                </CardContent>
              </Card>
              
              
              <Card className="border-border/50">
                <CardHeader>
                  <TrendingUp className="h-12 w-12 mb-4 text-primary mx-auto" />
                  <CardTitle>Daily Trending Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    View historical price data and trends for your cards
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <TrendingUp className="h-12 w-12 mb-4 text-primary mx-auto" />
                  <CardTitle>Daily Trending Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {
                      trending24h.length > 0 ? (
                        <Trending trending={trending24h} />
                      ) : (
                        <p className="text-sm text-muted-foreground mb-2">No trending data available.</p>
                      )
                    }
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <TrendingUp className="h-12 w-12 mb-4 text-primary mx-auto" />
                  <CardTitle>Weekly Trending Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {
                      trending7d.length > 0 ? (
                        <Trending trending={trending7d} />
                      ) : (
                        <p className="text-sm text-muted-foreground mb-2">No trending data available.</p>
                      )
                    }
                  </CardDescription>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader>
                  <TrendingUp className="h-12 w-12 mb-4 text-primary mx-auto" />
                  <CardTitle>Monthly Trending Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    {
                      trendingMonthly.length > 0 ? (
                        <Trending trending={trendingMonthly} />
                      ) : (
                        <p className="text-sm text-muted-foreground mb-2">No trending data available.</p>
                      )
                    }
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
            
            <Button size="lg" onClick={() => console.log('boom', trending24h)} className="text-lg px-8 py-6">
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {/* <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">MTG Tracker</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/collection')}>
              <Library className="h-4 w-4 mr-2" />
              My Collection
            </Button>
            <div className="flex items-center gap-2">
              {user.picture && (
                <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" />
              )}
              <span className="text-sm">{user.name}</span>
            </div>
            <Button variant="outline" onClick={handleLogout} size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header> */}

      {/* Main Content */}
      {/* <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Search Magic Cards</h2>
          <p className="text-muted-foreground mb-6">Find cards by name, set, color, type, or rarity</p>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Search for cards... (e.g., Lightning Bolt)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="lg">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </div>

        {/* Quick Links */}
        {/* <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex-col"
            onClick={() => router.push('/search?q=color:red')}
          >
            <div className="h-12 w-12 rounded-full bg-red-500 mb-2" />
            <span>Red Cards</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex-col"
            onClick={() => router.push('/search?q=color:blue')}
          >
            <div className="h-12 w-12 rounded-full bg-blue-500 mb-2" />
            <span>Blue Cards</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex-col"
            onClick={() => router.push('/search?q=color:green')}
          >
            <div className="h-12 w-12 rounded-full bg-green-500 mb-2" />
            <span>Green Cards</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto py-6 flex-col"
            onClick={() => router.push('/search?q=type:legendary')}
          >
            <TrendingUp className="h-12 w-12 mb-2 text-yellow-500" />
            <span>Legendary</span>
          </Button>
        </div>
      </main> */}
    </div>
  );
}
