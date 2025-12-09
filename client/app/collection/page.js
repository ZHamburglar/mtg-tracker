'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Star, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CardImage from '@/components/CardImage';
import { getCardImage } from '@/hooks/get-card-image';
import { useLoading } from '@/hooks/use-loading';
import buildClient from './../api/build-client';
import { format, set } from 'date-fns';

function CollectionPageContent() {
  const { loading, startLoading, stopLoading } = useLoading();
  const [collection, setCollection] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 100 });
  const [collectionValue, setCollectionValue] = useState(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadCollection();
    loadAnalytics();
  }, []);

  const formatPrice = useMemo(() => {
    return (item) => {
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
  }, []);

  const loadCollection = async () => {
    startLoading();
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
      stopLoading();
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get('/api/collection/analytics');
      console.log('Analytics data fetched:', data);
      setAnalytics(data.analytics || null);
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setAnalyticsLoading(false);
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
          <div className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </Button>
          </div>
        </div>

        {/* Analytics Section */}
        {showAnalytics && (
          <div className="mb-8 space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : analytics ? (
              <>
                {/* Most Valuable Cards */}
                {analytics.mostValuableCards?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Star className="h-5 w-5" />
                        Most Valuable Cards
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-4">
                        {analytics.mostValuableCards.slice(0, 10).map((card) => (
                          <div 
                            key={`${card.card_id}-${card.finish_type}`}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => router.push(`/card/${card.card_id}`)}
                          >
                            <div className="relative">
                              <img 
                                src={card.image_uri} 
                                alt={card.name}
                                className="rounded-lg w-full"
                              />
                              <Badge className="absolute bottom-2 left-2 bg-green-600">
                                ${card.current_price.toFixed(2)}
                              </Badge>
                            </div>
                            <p className="text-xs mt-1 truncate font-medium">{card.name}</p>
                            <p className="text-xs text-muted-foreground">x{card.quantity}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Price Trends */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Biggest Gainers */}
                  {analytics.priceGainers?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-600">
                          <TrendingUp className="h-5 w-5" />
                          Biggest Gainers (30 days)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.priceGainers.slice(0, 5).map((card) => (
                            <div 
                              key={`${card.card_id}-${card.finish_type}`}
                              className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                              onClick={() => router.push(`/card/${card.card_id}`)}
                            >
                              <img 
                                src={card.image_uri} 
                                alt={card.name}
                                className="w-12 h-16 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{card.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${card.old_price.toFixed(2)} → ${card.new_price.toFixed(2)}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                +{card.percent_change.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Biggest Losers */}
                  {analytics.priceLosers?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                          <TrendingDown className="h-5 w-5" />
                          Biggest Losers (30 days)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.priceLosers.slice(0, 5).map((card) => (
                            <div 
                              key={`${card.card_id}-${card.finish_type}`}
                              className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                              onClick={() => router.push(`/card/${card.card_id}`)}
                            >
                              <img 
                                src={card.image_uri} 
                                alt={card.name}
                                className="w-12 h-16 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{card.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${card.old_price.toFixed(2)} → ${card.new_price.toFixed(2)}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                {card.percent_change.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Cards by Rarity */}
                  {analytics.cardsByRarity?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cards by Rarity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.cardsByRarity
                            .sort((a, b) => b.total_value - a.total_value)
                            .map((item) => (
                              <div key={item.rarity} className="flex justify-between items-center">
                                <span className="text-sm capitalize">{item.rarity}</span>
                                <div className="text-right">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.count} cards
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    ${item.total_value.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Cards by Type */}
                  {analytics.cardsByType?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cards by Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analytics.cardsByType
                            .sort((a, b) => b.quantity - a.quantity)
                            .map((item) => (
                              <div key={item.type} className="flex justify-between items-center">
                                <span className="text-sm">{item.type}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {item.quantity} cards
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reserved List & Staples */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Special Cards</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analytics.reservedListCards?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium">Reserved List</span>
                          </div>
                          <p className="text-2xl font-bold text-yellow-600">
                            {analytics.reservedListCards.length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${analytics.reservedListCards.reduce((sum, c) => sum + c.total_value, 0).toFixed(2)} total
                          </p>
                        </div>
                      )}
                      {analytics.staples?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">EDH Staples</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-600">
                            {analytics.staples.length}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rank &lt; 1000
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recently Added */}
                {analytics.recentlyAdded?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recently Added</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                        {analytics.recentlyAdded.slice(0, 10).map((card) => (
                          <div 
                            key={`${card.card_id}-${card.finish_type}`}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => router.push(`/card/${card.card_id}`)}
                          >
                            <img 
                              src={card.image_uri} 
                              alt={card.name}
                              className="rounded-lg w-full"
                            />
                            <p className="text-xs mt-1 truncate">{card.name}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">No analytics available</p>
            )}
          </div>
        )}

        {/* Collection Grid */}
        {useMemo(() => {
          if (loading) {
            return (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            );
          }
          
          if (collection.length > 0) {
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {collection.map((item) => {
                  const card = item.cardData;
                  const image = getCardImage(card);
                  console.log('Rendering collection card:', card);
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
            );
          }
          
          return (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">Your collection is empty</p>
              <Button onClick={() => router.push('/search')}>Start Adding Cards</Button>
            </div>
          );
        }, [loading, collection, isHighResLoaded, router, formatPrice])}
      </main>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CollectionPageContent />
    </Suspense>
  );
}