'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function SearchPageContent() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  useEffect(() => {
    if (query) {
      setSearchQuery(query);
      searchCards(query);
    }
  }, [query]);

  const searchCards = async (q) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`);
      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getCardImage = (card) => {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
    return null;
  };

  const getCardPrice = (card) => {
    if (card.prices?.usd) return `$${parseFloat(card.prices.usd).toFixed(2)}`;
    if (card.prices?.usd_foil) return `$${parseFloat(card.prices.usd_foil).toFixed(2)} (Foil)`;
    return 'Price N/A';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Search for cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Search</Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : cards.length > 0 ? (
          <>
            <h2 className="text-2xl font-bold mb-6">Search Results ({cards.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {cards.map((card) => {
                const image = getCardImage(card);
                return (
                  <Card
                    key={card.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => router.push(`/card/${card.id}`)}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={card.name}
                        className="w-full h-auto object-contain"
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-1 truncate">{card.name}</h3>
                      <p className="text-xs text-muted-foreground">{card.set_name}</p>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex justify-between items-center">
                      <Badge variant="secondary" className="text-xs">
                        {card.rarity}
                      </Badge>
                      <span className="text-sm font-semibold text-green-600">
                        {getCardPrice(card)}
                      </span>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </>
        ) : query ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No results found for "{query}"</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}