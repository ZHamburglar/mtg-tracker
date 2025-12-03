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
import { DropdownMultiselect } from '@/components/ui/dropdown-multiselect';

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
    artist: [],
    set_name: [],
    type_line: [],
    rarity: [],
    cmc: '',
    color_identity: [],
    keywords: [],
    legality_format: [],
  });
  const [sets, setSets] = useState([]);
  const [artists, setArtists] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Fetch available sets, artists, and keywords
    fetchSets();
    fetchArtists();
    fetchKeywords();
  }, []);

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

  const fetchArtists = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/search/artists');
      if (data && data.artists) {
        setArtists(data.artists);
      }
    } catch (error) {
      console.error('Error fetching artists:', error);
    }
  };

  const fetchKeywords = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/search/keywords');
      if (data && data.keywords) {
        setKeywords(data.keywords);
      }
    } catch (error) {
      console.error('Error fetching keywords:', error);
    }
  };

  const fetchSets = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/search/sets');
      if (data && data.sets) {
        // Sort sets by release date descending
        const sortedSets = data.sets.sort((a, b) => {
          if (!a.released_at) return 1;
          if (!b.released_at) return -1;
          return new Date(b.released_at) - new Date(a.released_at);
        });
        setSets(sortedSets);
      }
    } catch (error) {
      console.error('Error fetching sets:', error);
    }
  };

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
      router.push(`/search?name=${encodeURIComponent(searchQuery.trim())}`);
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
      <header className="border-border">
        <div className="container mx-auto px-4 py-4">
          
          <form onSubmit={handleSearch} className={`flex gap-2 ${accordionValue === 'advanced' ? '' : 'mb-4'}`}>
            <Input
              type="text"
              placeholder="Search for cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            {
              accordionValue === '' ? <Button type="submit">Search</Button> : null
            }
            
            
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
                  {/* Artists Filter */}
                  <DropdownMultiselect
                    label="Artist"
                    placeholder="Select artists..."
                    searchPlaceholder="Search artists..."
                    emptyMessage="No artist found."
                    options={artists}
                    value={advancedFilters.artist}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, artist: value})}
                  />
                  {/* Sets Filter */}
                  <DropdownMultiselect
                    label="Set"
                    placeholder="Select sets..."
                    searchPlaceholder="Search sets..."
                    emptyMessage="No set found."
                    options={sets}
                    value={advancedFilters.set_name}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, set_name: value})}
                    getOptionValue={(set) => set.name}
                    getOptionLabel={(set) => set.name}
                    renderOption={(set) => <span>{set.name} ({set.code})</span>}
                  />
                  {/* Type Filter */}
                  <DropdownMultiselect
                    label="Type"
                    placeholder="Select types..."
                    searchPlaceholder="Search types..."
                    emptyMessage="No type found."
                    options={['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Battle']}
                    value={advancedFilters.type_line}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, type_line: value})}
                  />
                  {/* Rarity */}
                  <DropdownMultiselect
                    label="Rarity"
                    placeholder="Select rarity..."
                    searchPlaceholder="Search rarity..."
                    emptyMessage="No rarity found."
                    options={['common', 'uncommon', 'rare', 'mythic']}
                    value={advancedFilters.rarity}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, rarity: value})}
                    renderBadge={(r) => <span className="capitalize">{r}</span>}
                  />
                  {/* CMC */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">CMC</label>
                    <Input 
                      placeholder="Mana value" 
                      type="number" 
                      value={advancedFilters.cmc}
                      onChange={(e) => setAdvancedFilters({...advancedFilters, cmc: e.target.value})}
                    />
                  </div>
                  {/* Colors */}
                  <DropdownMultiselect
                    label="Color Identity"
                    placeholder="Select color identities..."
                    searchPlaceholder="Search color identities..."
                    emptyMessage="No color identity found."
                    options={['W', 'U', 'B', 'R', 'G']}
                    value={advancedFilters.color_identity}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, color_identity: value})}
                    renderBadge={(r) => <span className="capitalize">{r}</span>}
                  />
                  {/* Keywords */}
                  <DropdownMultiselect
                    label="Keywords"
                    placeholder="Select keywords..."
                    searchPlaceholder="Search keywords..."
                    emptyMessage="No keyword found."
                    options={keywords}
                    value={advancedFilters.keywords}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, keywords: value})}
                  />
                  {/* Legality Format */}
                  <DropdownMultiselect
                    label="Legal In Format"
                    placeholder="Select formats..."
                    searchPlaceholder="Search formats..."
                    emptyMessage="No format found."
                    options={[
                      { value: 'alchemy', label: 'Alchemy' },
                      { value: 'brawl', label: 'Brawl' },
                      { value: 'commander', label: 'Commander' },
                      { value: 'duel', label: 'Duel' },
                      { value: 'future', label: 'Future' },
                      { value: 'gladiator', label: 'Gladiator' },
                      { value: 'historic', label: 'Historic' },
                      { value: 'legacy', label: 'Legacy' },
                      { value: 'modern', label: 'Modern' },
                      { value: 'oathbreaker', label: 'Oathbreaker' },
                      { value: 'oldschool', label: 'Old School' },
                      { value: 'pauper', label: 'Pauper' },
                      { value: 'paupercommander', label: 'Pauper Commander' },
                      { value: 'penny', label: 'Penny' },
                      { value: 'pioneer', label: 'Pioneer' },
                      { value: 'predh', label: 'PreDH' },
                      { value: 'premodern', label: 'Premodern' },
                      { value: 'standard', label: 'Standard' },
                      { value: 'standardbrawl', label: 'Standard Brawl' },
                      { value: 'timeless', label: 'Timeless' },
                      { value: 'vintage', label: 'Vintage' }
                    ]}
                    value={advancedFilters.legality_format}
                    onChange={(value) => setAdvancedFilters({...advancedFilters, legality_format: value})}
                    getOptionValue={(opt) => opt.value}
                    getOptionLabel={(opt) => opt.label}
                    renderOption={(opt) => <span>{opt.label}</span>}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setAdvancedFilters({
                        artist: [],
                        set_name: [],
                        type_line: [],
                        rarity: [],
                        cmc: '',
                        color_identity: [],
                        keywords: [],
                        legality_format: [],
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
                      
                      // Include search query if it exists
                      if (searchQuery.trim()) {
                        filters.name = searchQuery.trim();
                      }
                      
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