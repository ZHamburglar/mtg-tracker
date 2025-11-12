'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CollectionPage() {
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/collection');
      if (response.ok) {
        const data = await response.json();
        setCollection(data.collection || []);
      }
    } catch (error) {
      console.error('Load collection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCardImage = (cardData) => {
    if (cardData.image_uris?.normal) return cardData.image_uris.normal;
    if (cardData.card_faces?.[0]?.image_uris?.normal) return cardData.card_faces[0].image_uris.normal;
    return null;
  };

  const getTotalValue = () => {
    return collection.reduce((total, item) => {
      const price = parseFloat(item.cardData?.prices?.usd || 0);
      return total + price;
    }, 0).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">My Collection</h1>
          <p className="text-muted-foreground">
            {collection.length} cards · Total Value: ${getTotalValue()}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : collection.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {collection.map((item) => {
              const card = item.cardData;
              const image = getCardImage(card);
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                  onClick={() => router.push(`/card/${item.cardId}`)}
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
                    {card.prices?.usd && (
                      <span className="text-sm font-semibold text-green-600">
                        ${parseFloat(card.prices.usd).toFixed(2)}
                      </span>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Your collection is empty</p>
            <Button onClick={() => router.push('/')}>Start Adding Cards</Button>
          </div>
        )}
      </main>
    </div>
  );
}