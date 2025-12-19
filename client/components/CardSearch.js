'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion';
import { DropdownMultiselect } from '@/components/ui/dropdown-multiselect';
import buildClient from '../app/api/build-client';
import { toast } from 'sonner';

export function CardSearch({ initialQuery = '', initialFilters = {} }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [accordionValue, setAccordionValue] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState(() => ({
    artist: [],
    set_name: [],
    type_line: [],
    rarity: [],
    cmc: '',
    color_identity: [],
    keywords: [],
    legality_format: [],
    ...initialFilters,
  }));
  const [sets, setSets] = useState([]);
  const [groupedSets, setGroupedSets] = useState({});
  const [artists, setArtists] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [types, setTypes] = useState({});
  const router = useRouter();

  useEffect(() => {
    // Fetch available sets, artists, keywords, and types
    fetchSets();
    fetchArtists();
    fetchKeywords();
    fetchTypes();
  }, []);

  // Update search query when initialQuery changes
  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Update advanced filters when initialFilters changes
  useEffect(() => {
    const filtersString = JSON.stringify(initialFilters);
    setAdvancedFilters({
      artist: [],
      set_name: [],
      type_line: [],
      rarity: [],
      cmc: '',
      color_identity: [],
      keywords: [],
      legality_format: [],
      ...initialFilters,
    });
  }, [JSON.stringify(initialFilters)]);

  const fetchArtists = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/search/artists');
      if (data && data.artists) {
        setArtists(data.artists);
      }
    } catch (error) {
      console.error('Error fetching artists:', error);
      toast.error('Failed to load artists');
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
      toast.error('Failed to load keywords');
    }
  };

  const fetchTypes = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get('/api/search/types');
      if (data && data.types) {
        setTypes(data.types);
      }
    } catch (error) {
      console.error('Error fetching types:', error);
      toast.error('Failed to load types');
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
        
        // Group sets by set_type
        const grouped = sortedSets.reduce((acc, set) => {
          const setType = set.set_type || 'other';
          const formattedType = setType.charAt(0).toUpperCase() + setType.slice(1);
          if (!acc[formattedType]) {
            acc[formattedType] = [];
          }
          acc[formattedType].push(set);
          return acc;
        }, {});
        setGroupedSets(grouped);
      }
    } catch (error) {
      console.error('Error fetching sets:', error);
      toast.error('Failed to load sets');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?name=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleClear = () => {
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
  };

  const handleApplyFilters = () => {
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
  };

  return (
    <div className="container mx-auto px-4 py-4">
      <form onSubmit={handleSearch} className={`flex gap-2 ${accordionValue === 'advanced' ? '' : 'mb-4'}`}>
        <Button type="button" variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
        <Input
          type="text"
          placeholder="Search for cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        {accordionValue === '' ? <Button type="submit">Search</Button> : null}
        
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
                options={groupedSets}
                value={advancedFilters.set_name}
                onChange={(value) => setAdvancedFilters({...advancedFilters, set_name: value})}
                getOptionValue={(set) => set.name}
                getOptionLabel={(set) => set.name}
                renderOption={(set) => (
                  <div className="flex items-center gap-2">
                    {set.icon_svg_uri && (
                      <img 
                        src={set.icon_svg_uri} 
                        alt={set.code}
                        className="w-4 h-4 flex-shrink-0 brightness-0 invert"
                      />
                    )}
                    <span>{set.name} ({set.code})</span>
                  </div>
                )}
                grouped={true}
                collapsible={true}
                groupOrder={['Expansion', 'Core', 'Masters', 'Commander', 'Draft_innovation', 'Funny', 'Starter', 'Duel_deck', 'Premium_deck', 'From_the_vault', 'Spellbook', 'Archenemy', 'Planechase', 'Box', 'Promo', 'Alchemy', 'Masterpiece', 'Arsenal', 'Vanguard', 'Minigame', 'Token', 'Memorabilia', 'Other']}
              />
              {/* Type Filter */}
              <DropdownMultiselect
                label="Type"
                placeholder="Select types..."
                searchPlaceholder="Search types..."
                emptyMessage="No type found."
                options={types}
                value={advancedFilters.type_line}
                onChange={(value) => setAdvancedFilters({...advancedFilters, type_line: value})}
                grouped={true}
                collapsible={true}
                groupOrder={['Supertypes', 'Card Types', 'Artifact Types', 'Battle Types', 'Creature Types', 'Enchantment Types', 'Land Types', 'Planeswalker Types', 'Spell Types']}
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
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button 
                type="button"
                onClick={handleApplyFilters}
              >
                Apply Filters
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
