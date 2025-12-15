'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Settings, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CardImage from '@/components/CardImage';
import buildClient from '../../api/build-client';
import { toast } from 'sonner';

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id;

  const [deck, setDeck] = useState(null);
  const [deckCards, setDeckCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('mainboard');
  const [showStats, setShowStats] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({
    creatures: true,
    planeswalkers: true,
    instants: true,
    sorceries: true,
    enchantments: true,
    artifacts: true,
    lands: true
  });

  useEffect(() => {
    if (deckId) {
      loadDeck();
      loadDeckCards();
    }
  }, [deckId]);

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const delayDebounceFn = setTimeout(() => {
        searchCards();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadDeck = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/deck/${deckId}`);
      setDeck(data.deck);
    } catch (error) {
      console.error('Error loading deck:', error);
      toast.error('Failed to load deck');
    }
  };

  const loadDeckCards = async () => {
    setLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/deck/${deckId}/cards`);
      setDeckCards(data.cards || []);
    } catch (error) {
      console.error('Error loading deck cards:', error);
      toast.error('Failed to load deck cards');
    } finally {
      setLoading(false);
    }
  };

  const searchCards = async () => {
    setSearching(true);
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/search/cards?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.cards || []);
    } catch (error) {
      console.error('Error searching cards:', error);
    } finally {
      setSearching(false);
    }
  };

  const addCardToDeck = async (cardId, category = 'mainboard') => {
    try {
      const client = buildClient();
      await client.post(`/api/deck/${deckId}/cards`, {
        card_id: cardId,
        category,
        quantity: 1
      });
      toast.success('Card added to deck');
      loadDeckCards();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding card:', error);
      toast.error('Failed to add card');
    }
  };

  const removeCardFromDeck = async (cardId, category) => {
    try {
      const client = buildClient();
      await client.delete(`/api/deck/${deckId}/cards/${cardId}?category=${category}`);
      toast.success('Card removed from deck');
      loadDeckCards();
    } catch (error) {
      console.error('Error removing card:', error);
      toast.error('Failed to remove card');
    }
  };

  const updateCardQuantity = async (cardId, category, quantity) => {
    if (quantity < 1) {
      removeCardFromDeck(cardId, category);
      return;
    }

    try {
      const client = buildClient();
      await client.patch(`/api/deck/${deckId}/cards/${cardId}`, {
        category,
        quantity
      });
      loadDeckCards();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const categorizeCards = (cards, category = 'mainboard') => {
    const filtered = cards.filter(c => c.category === category);
    
    return {
      creatures: filtered.filter(c => c.card.type_line?.toLowerCase().includes('creature')),
      planeswalkers: filtered.filter(c => c.card.type_line?.toLowerCase().includes('planeswalker')),
      instants: filtered.filter(c => c.card.type_line?.toLowerCase().includes('instant')),
      sorceries: filtered.filter(c => c.card.type_line?.toLowerCase().includes('sorcery')),
      enchantments: filtered.filter(c => c.card.type_line?.toLowerCase().includes('enchantment') && !c.card.type_line?.toLowerCase().includes('creature')),
      artifacts: filtered.filter(c => c.card.type_line?.toLowerCase().includes('artifact') && !c.card.type_line?.toLowerCase().includes('creature')),
      lands: filtered.filter(c => c.card.type_line?.toLowerCase().includes('land'))
    };
  };

  const calculateStats = () => {
    const mainboard = deckCards.filter(c => c.category === 'mainboard');
    const totalCards = mainboard.reduce((sum, c) => sum + c.quantity, 0);
    
    const avgCMC = mainboard.length > 0
      ? mainboard.reduce((sum, c) => sum + (c.card.cmc || 0) * c.quantity, 0) / totalCards
      : 0;

    return {
      totalCards,
      avgCMC: avgCMC.toFixed(2),
      commanders: deckCards.filter(c => c.category === 'commander').length,
      sideboard: deckCards.filter(c => c.category === 'sideboard').reduce((sum, c) => sum + c.quantity, 0)
    };
  };

  const renderCardList = (cards, category) => {
    if (cards.length === 0) return null;

    return Object.entries(cards).map(([type, typeCards]) => {
      if (typeCards.length === 0) return null;

      return (
        <div key={type} className="mb-4">
          <button
            className="flex items-center gap-2 text-sm font-semibold mb-2 hover:text-primary transition-colors w-full"
            onClick={() => toggleCategory(type)}
          >
            {expandedCategories[type] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {type.charAt(0).toUpperCase() + type.slice(1)} ({typeCards.length})
          </button>
          {expandedCategories[type] && (
            <div className="space-y-1 pl-6">
              {typeCards.map((item) => (
                <div
                  key={`${item.card.id}-${item.category}`}
                  className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent group"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateCardQuantity(item.card.id, item.category, parseInt(e.target.value))}
                      className="w-12 h-8 text-center"
                    />
                    <span className="text-sm">{item.card.name}</span>
                    {item.card.mana_cost && (
                      <span className="text-xs text-muted-foreground">{item.card.mana_cost}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeCardFromDeck(item.card.id, item.category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  if (!deck) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = calculateStats();
  const categorizedMainboard = categorizeCards(deckCards, 'mainboard');
  const categorizedSideboard = categorizeCards(deckCards, 'sideboard');
  const commanders = deckCards.filter(c => c.category === 'commander');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.push('/deck')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Decks
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold">{deck.name}</h1>
              {deck.description && (
                <p className="text-muted-foreground mt-1">{deck.description}</p>
              )}
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">{deck.format}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Deck List */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Deck Stats</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowStats(!showStats)}
                  >
                    {showStats ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {showStats && (
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cards:</span>
                    <span className="font-medium">{stats.totalCards}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg CMC:</span>
                    <span className="font-medium">{stats.avgCMC}</span>
                  </div>
                  {stats.commanders > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commanders:</span>
                      <span className="font-medium">{stats.commanders}</span>
                    </div>
                  )}
                  {stats.sideboard > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sideboard:</span>
                      <span className="font-medium">{stats.sideboard}</span>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Decklist</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="mainboard" className="flex-1">Main</TabsTrigger>
                    <TabsTrigger value="sideboard" className="flex-1">Side</TabsTrigger>
                    {commanders.length > 0 && (
                      <TabsTrigger value="commander" className="flex-1">Cmdr</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="mainboard" className="mt-4">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      renderCardList(categorizedMainboard, 'mainboard')
                    )}
                  </TabsContent>
                  
                  <TabsContent value="sideboard" className="mt-4">
                    {renderCardList(categorizedSideboard, 'sideboard')}
                  </TabsContent>
                  
                  {commanders.length > 0 && (
                    <TabsContent value="commander" className="mt-4">
                      {commanders.map((item) => (
                        <div key={item.card.id} className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium">{item.card.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeCardFromDeck(item.card.id, 'commander')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Card Search */}
          <div className="lg:col-span-9">
            <Card>
              <CardHeader>
                <CardTitle>Add Cards</CardTitle>
                <Input
                  placeholder="Search for cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-2"
                />
              </CardHeader>
              <CardContent>
                {searching ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {searchResults.map((card) => (
                      <div key={card.id} className="group relative">
                        <CardImage
                          src={card.image_uris?.normal || card.image_uris?.small}
                          alt={card.name}
                          className="rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => addCardToDeck(card.id, 'mainboard')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Main
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => addCardToDeck(card.id, 'sideboard')}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Side
                          </Button>
                        </div>
                        <p className="text-xs text-center mt-1 truncate">{card.name}</p>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length >= 3 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No cards found
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Search for cards to add to your deck
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
