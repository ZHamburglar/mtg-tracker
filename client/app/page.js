'use client';

import { useRouter } from 'next/navigation';
import { Search, Library, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Trending from '@/components/trending';
import DeckIcon from '@/components/DeckIcon';
import buildClient from "./api/build-client";
import Image from 'next/image';
import Link from "next/link";
import { useQuery } from '@tanstack/react-query';

// Fetch function for trending prices
async function fetchTrendingPrices(timeframe, direction = 'increase') {
  const client = buildClient();
  const response = await client.get(`/api/search/trending?timeframe=${timeframe}&direction=${direction}`);
  return response.data.cards;
}

export default function Home() {
  const router = useRouter();

  // Query hooks for all trending data
  const { data: trending24h = [], isLoading: loading24h } = useQuery({
    queryKey: ['trending', '24h', 'increase'],
    queryFn: () => fetchTrendingPrices('24h', 'increase'),
  });

  const { data: trending7d = [], isLoading: loading7d } = useQuery({
    queryKey: ['trending', '7d', 'increase'],
    queryFn: () => fetchTrendingPrices('7d', 'increase'),
  });

  const { data: trendingMonthly = [], isLoading: loadingMonthly } = useQuery({
    queryKey: ['trending', '30d', 'increase'],
    queryFn: () => fetchTrendingPrices('30d', 'increase'),
  });

  const { data: trending24hDown = [], isLoading: loading24hDown } = useQuery({
    queryKey: ['trending', '24h', 'decrease'],
    queryFn: () => fetchTrendingPrices('24h', 'decrease'),
  });

  const { data: trending7dDown = [], isLoading: loading7dDown } = useQuery({
    queryKey: ['trending', '7d', 'decrease'],
    queryFn: () => fetchTrendingPrices('7d', 'decrease'),
  });

  const { data: trendingMonthlyDown = [], isLoading: loadingMonthlyDown } = useQuery({
    queryKey: ['trending', '30d', 'decrease'],
    queryFn: () => fetchTrendingPrices('30d', 'decrease'),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto text-center">
          <Image src="/images/logo-animated.svg" alt="MTG Collection Tracker" width={128} height={128} className="mx-auto mb-6" />
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            MTG Collection Tracker
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Track your Magic: The Gathering card collection, build decks, and manage your valuable cards.
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
                <Link href="/decks">
                  <DeckIcon className="h-12 w-12 mb-4 text-primary mx-auto" />
                  <CardTitle>Build a Deck</CardTitle>
                </Link>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Build a deck or search for deck ideas from other users
                </CardDescription>
              </CardContent>
            </Card>
            {/* Trending Up Cards */}
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
            {/* Trending Down Cards */}
            <Card className="border-border/50">
              <CardHeader>
                <TrendingUp className="h-12 w-12 mb-4 text-primary mx-auto" />
                <CardTitle>Daily Declining Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {
                    trending24hDown.length > 0 ? (
                      <Trending trending={trending24hDown} />
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
                <CardTitle>Weekly Declining Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {
                    trending7dDown.length > 0 ? (
                      <Trending trending={trending7dDown} />
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
                <CardTitle>Monthly Declining Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {
                    trendingMonthlyDown.length > 0 ? (
                      <Trending trending={trendingMonthlyDown} />
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">No trending data available.</p>
                    )
                  }
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
