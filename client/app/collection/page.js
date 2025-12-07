'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CardImage from '@/components/CardImage';
import { getCardImage } from '@/hooks/get-card-image';
import buildClient from './../api/build-client';
import { format, set } from 'date-fns';

export default function CollectionPage() {
  const [collection, setCollection] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 100 });
  const [collectionValue, setCollectionValue] = useState(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCollection();
  }, []);

  const formatPrice = (item) => {
    console.log('Formatting price:', item);
    
    // Map finish_type to price field
    let priceField;
    if (item.finish_type === 'foil') {
      priceField = 'usd_foil';
    } else if (item.finish_type === 'etched') {
      priceField = 'usd_etched';
    } else {
      priceField = 'usd';
    }
    
    const price = item.cardData.prices?.[priceField];
    
    if (!price) {
      return 'N/A';
    }
    
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const loadCollection = async () => {
    setLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get('/api/collection');
      console.log('Collection data fetched:', data);
      setCollection(data.cards || []);
      setPagination({
        page: data.pagination.currentPage || 1,
        pageSize: data.pagination.pageSize || 100,
      });
      setCollectionValue(data.collectionValue || null);
    } catch (error) {
      console.error('Load collection error:', error);
    } finally {
      setLoading(false);
    }
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
            {collectionValue ? (
              <>
                {collectionValue.totalCards} unique cards · {collectionValue.totalQuantity} total cards · Total Value: ${collectionValue.totalValueUsd.toFixed(2)}
              </>
            ) : (
              'Loading collection value...'
            )}
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
              console.log('Rendering card in collection:', card, item);
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                  onClick={() => router.push(`/card/${item.card_id}`)}
                >
                  <div className="relative">
                    {image ? (
                      <CardImage
                        card={card}
                        isHighResLoaded={isHighResLoaded}
                        onHighResLoad={() => setIsHighResLoaded(true)}
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    {card.has_multiple_faces && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-primary/90 text-primary-foreground shadow-lg text-xs">
                          Multi-Face
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm mb-1 truncate">{card.name}</h3>
                    <p className="text-xs text-muted-foreground">{card.set_name}</p>
                  </CardContent>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm mb-1 truncate">{item.finish_type}</h3>
                    <p className="text-xs text-muted-foreground">Total: {item.quantity}</p>
                    <p className="text-xs text-muted-foreground">Available: {item.available}</p>
                  </CardContent>
                  <CardFooter className="p-3 pt-0 flex justify-between items-center">
                    <Badge variant="secondary" className="text-xs">
                      {card.rarity}
                    </Badge>
                    {card.prices?.usd && (
                      <span className="text-sm font-semibold text-green-600">
                        {formatPrice(item)}
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