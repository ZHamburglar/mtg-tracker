'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import buildClient from '../api/build-client';
import { CardSearch } from '@/components/CardSearch';
import { toast } from 'sonner';

function CardImage({ card, isHighResLoaded, onHighResLoad }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Use first face image if card has multiple faces
  const smallImage = card.image_uri_small || (card.has_multiple_faces && card.card_faces?.[0]?.image_uri_small) || null;
  
  const largeImage = card.image_uri_png || (card.has_multiple_faces && card.card_faces?.[0]?.image_uri_png) || null;

  return (
    <div ref={imgRef} className="relative w-full">
      {smallImage && (
        <img
          src={smallImage}
          alt={card.name}
          loading="lazy"
          className={`w-full h-auto object-contain transition-opacity duration-300 ${
            isHighResLoaded ? 'opacity-0 absolute' : 'opacity-100'
          }`}
        />
      )}
      {isVisible && largeImage && (
        <img
          src={largeImage}
          alt={card.name}
          className={`w-full h-auto object-contain transition-opacity duration-300 ${
            isHighResLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={onHighResLoad}
        />
      )}
    </div>
  );
}

function SearchPageContent() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loadedImages, setLoadedImages] = useState({});
  const [advancedFilters, setAdvancedFilters] = useState({
    artist: [],
    set_name: [],
    type_line: [],
    rarity: [],
    cmc: '',
    color_identity: [],
    keywords: [],
    legality_format: [],
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = {};
    
    // Get all query parameters
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Update search query if 'name' exists
    if (params.name) {
      setSearchQuery(params.name);
    }

    // Update advanced filters from URL
    setAdvancedFilters({
      artist: params.artist ? params.artist.split(',') : [],
      set_name: params.set_name ? params.set_name.split(',') : [],
      type_line: params.type_line ? params.type_line.split(',') : [],
      rarity: params.rarity ? params.rarity.split(',') : [],
      cmc: params.cmc || '',
      color_identity: params.color_identity ? params.color_identity.split(',') : [],
      keywords: params.keywords ? params.keywords.split(',') : [],
      legality_format: params.legality_format ? params.legality_format.split(',') : [],
    });

    // Perform search if any params exist
    if (Object.keys(params).length > 0) {
      searchCards(params);
    }
  }, [searchParams]);

  const searchCards = async (params) => {
    setLoading(true);
    try {
      const client = buildClient();
      // Build query string from params object
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      const { data } = await client.get(`/api/search?${queryString}`);
      console.log('search params:', params);
      console.log('Search response:', data);
      if (data) {
        setCards(data.cards || []);
        setPagination({
          page: data.pagination?.currentPage || 1,
          totalPages: data.pagination?.totalPages || 1,
          totalRecords: data.pagination?.totalRecords || 0,
          pageSize: data.pagination?.pageSize || 100,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search cards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCardImage = (card) => {
    // For multi-faced cards, use the first face image
    if (card.image_uri_png) {return card.image_uri_png;}
    if (card.image_uri_small) {return card.image_uri_small;}
    if (card.has_multiple_faces && card.card_faces?.[0]) {
      return card.card_faces[0].image_uri_png || card.card_faces[0].image_uri_small;
    }
    return null;
  };

  const getCardPrice = (card) => {
    if (card.prices?.usd) {return `$${parseFloat(card.prices.usd).toFixed(2)}`;}
    if (card.prices?.usd_foil) {return `$${parseFloat(card.prices.usd_foil).toFixed(2)} (Foil)`;}
    return 'Price N/A';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-border">
        <CardSearch initialQuery={searchQuery} initialFilters={advancedFilters} />
      </header>      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : cards.length > 0 ? (
          <>
            <h2 className="text-2xl font-bold mb-6">Search Results ({pagination.totalRecords})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {cards.map((card) => {
                const image = getCardImage(card);
                const isHighResLoaded = loadedImages[card.id];
                return (
                  <Card
                    key={card.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => router.push(`/card/${card.id}`)}
                  >
                    <div className="relative">
                      {image ? (
                        <CardImage
                          card={card}
                          isHighResLoaded={loadedImages[card.id]}
                          onHighResLoad={() => setLoadedImages(prev => ({ ...prev, [card.id]: true }))}
                        />
                      ) : (
                        <div className="w-full h-64 bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground">No Image</span>
                        </div>
                      )}
                      {card.has_multiple_faces ? (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-primary/90 text-primary-foreground shadow-lg text-xs">
                            Multi-Face
                          </Badge>
                        </div>
                      ) : null}
                    </div>
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
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', '1');
                    router.push(`/search?${params.toString()}`);
                  }}
                  disabled={pagination.page === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(pagination.page - 1));
                    router.push(`/search?${params.toString()}`);
                  }}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(pagination.page + 1));
                    router.push(`/search?${params.toString()}`);
                  }}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(pagination.totalPages));
                    router.push(`/search?${params.toString()}`);
                  }}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Last
                </Button>
              </div>
            )}
          </>
        ) : searchQuery ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
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