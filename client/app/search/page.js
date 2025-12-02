'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import buildClient from '../api/build-client';

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

  return (
    <div ref={imgRef} className="relative w-full">
      <img
        src={card.image_uri_small}
        alt={card.name}
        loading="lazy"
        className={`w-full h-auto object-contain transition-opacity duration-300 ${
          isHighResLoaded ? 'opacity-0 absolute' : 'opacity-100'
        }`}
      />
      {isVisible && (
        <img
          src={card.image_uri_png}
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
  const [accordionValue, setAccordionValue] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    artist: '',
    set_name: '',
    type_line: '',
    rarity: [],
    cmc: '',
    colors: '',
  });
  const [rarityOpen, setRarityOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = {};
    
    // Get all query parameters
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Update search query if 'q' or 'name' exists
    if (params.q || params.name) {
      setSearchQuery(params.q || params.name);
    }

    // Update advanced filters from URL
    setAdvancedFilters({
      artist: params.artist || '',
      set_name: params.set_name || '',
      type_line: params.type_line || '',
      rarity: params.rarity ? params.rarity.split(',') : [],
      cmc: params.cmc || '',
      colors: params.colors || '',
    });

    // Perform search if any params exist
    if (Object.keys(params).length > 0) {
      searchCards(params);
    }
  }, [searchParams]);

  const searchCards = async (params) => {
    console.log('accordion value:', accordionValue);
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
        });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    console.log('Handling search for query:', searchQuery);
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getCardImage = (card) => {
    if (card.image_uri_png) {return card.image_uri_png;}
    if (card.image_uri_small) {return card.image_uri_small;}
    return null;
  };

  const getCardPrice = (card) => {
    if (card.prices?.usd) {return `$${parseFloat(card.prices.usd).toFixed(2)}`;}
    if (card.prices?.usd_foil) {return `$${parseFloat(card.prices.usd_foil).toFixed(2)} (Foil)`;}
    return 'Price N/A';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <Input
              type="text"
              placeholder="Search for cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Search</Button>
            
            <Button 
              type="button"
              variant="outline"
              onClick={() => setAccordionValue(accordionValue === 'advanced' ? '' : 'advanced')}
            >
              Advanced Search
            </Button>
          </form>

          <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
            <AccordionItem value="advanced">
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Artist</label>
                    <Input 
                      placeholder="Artist name" 
                      value={advancedFilters.artist}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, artist: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Set</label>
                    <Input 
                      placeholder="Set name or code" 
                      value={advancedFilters.set_name}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, set_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type</label>
                    <Input 
                      placeholder="Card type" 
                      value={advancedFilters.type_line}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, type_line: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Rarity</label>
                    <Popover open={rarityOpen} onOpenChange={setRarityOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={rarityOpen}
                          className="w-full justify-between"
                        >
                          {advancedFilters.rarity.length > 0
                            ? `${advancedFilters.rarity.length} selected`
                            : "Select rarity..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search rarity..." />
                          <CommandList>
                            <CommandEmpty>No rarity found.</CommandEmpty>
                            <CommandGroup>
                              {['common', 'uncommon', 'rare', 'mythic'].map((rarityOption) => (
                                <CommandItem
                                  key={rarityOption}
                                  value={rarityOption}
                                  onSelect={() => {
                                    if (advancedFilters.rarity.includes(rarityOption)) {
                                      setAdvancedFilters({
                                        ...advancedFilters,
                                        rarity: advancedFilters.rarity.filter(r => r !== rarityOption)
                                      });
                                    } else {
                                      setAdvancedFilters({
                                        ...advancedFilters,
                                        rarity: [...advancedFilters.rarity, rarityOption]
                                      });
                                    }
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      advancedFilters.rarity.includes(rarityOption)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  <span className="capitalize">{rarityOption}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {advancedFilters.rarity.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {advancedFilters.rarity.map((r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className="capitalize cursor-pointer"
                            onClick={() => {
                              setAdvancedFilters({
                                ...advancedFilters,
                                rarity: advancedFilters.rarity.filter(rarity => rarity !== r)
                              });
                            }}
                          >
                            {r}
                            <X className="ml-1 h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">CMC</label>
                    <Input 
                      placeholder="Mana value" 
                      type="number" 
                      value={advancedFilters.cmc}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, cmc: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Colors</label>
                    <Input 
                      placeholder="W, U, B, R, G" 
                      value={advancedFilters.colors}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, colors: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setAdvancedFilters({
                        artist: '',
                        set_name: '',
                        type_line: '',
                        rarity: [],
                        cmc: '',
                        colors: '',
                      });
                      router.push('/search');
                    }}
                  >
                    Clear
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => {
                      const filters = Object.entries(advancedFilters)
                        .filter(([_, value]) => {
                          if (Array.isArray(value)) return value.length > 0;
                          return value;
                        })
                        .reduce((acc, [key, value]) => {
                          // Join array values with comma for URL
                          if (Array.isArray(value)) {
                            return { ...acc, [key]: value.join(',') };
                          }
                          return { ...acc, [key]: value };
                        }, {});
                      
                      const queryString = Object.entries(filters)
                        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                        .join('&');
                      
                      router.push(`/search?${queryString}`);
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
                const isHighResLoaded = loadedImages[card.id];
                return (
                  <Card
                    key={card.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => router.push(`/card/${card.id}`)}
                  >
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