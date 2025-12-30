'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Settings, Share2, Clipboard, BookCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CardImage from '@/components/CardImage';
import { getCardImage } from '@/hooks/get-card-image';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import buildClient from '../../api/build-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ManaSymbols, TextWithSymbols } from '@/components/ManaSymbols';

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id;
  const { currentUser } = useAuth();

  const [deck, setDeck] = useState(null);
  const [deckCards, setDeckCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('mainboard');
  const [showStats, setShowStats] = useState(true);
  const [showCollection, setShowCollection] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFormat, setEditFormat] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [savingDeck, setSavingDeck] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    creatures: true,
    planeswalkers: true,
    instants: true,
    sorceries: true,
    enchantments: true,
    artifacts: true,
    lands: true
  });
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importParseErrors, setImportParseErrors] = useState([]);
  const [importParsedCount, setImportParsedCount] = useState(0);

  // Combos data and UI state
  const [combosData, setCombosData] = useState(null);
  const [combosLoading, setCombosLoading] = useState(false);
  const [expandedCombos, setExpandedCombos] = useState({});
  const [expandedAlmostIncluded, setExpandedAlmostIncluded] = useState({});

  // Preview is shown only after an import attempt finds errors
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const errorLines = useMemo(() => {
    const linesSet = new Set();
    (importParseErrors || []).forEach(e => linesSet.add(e.line));
    if (importResult && importResult.notFound) importResult.notFound.forEach(l => linesSet.add(l));
    if (importResult && importResult.errors) importResult.errors.forEach(e => linesSet.add(e.line));
    return Array.from(linesSet);
  }, [importParseErrors, importResult]);

  useEffect(() => {
    if (deckId) {
      loadDeck();
      loadDeckCards();
    }
  }, [deckId]);

  useEffect(() => {
    if (deck) {
      setEditName(deck.name || '');
      setEditDescription(deck.description || '');
      setEditFormat(deck.format || '');
      setEditVisibility(deck.visibility || 'public');
    }
  }, [deck]);

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

  useEffect(() => {
    // Reload collection status when user logs in/out or deck cards change
    if (currentUser && deckCards.length > 0) {
      loadCollectionStatus(deckCards);
    } else if (!currentUser) {
      setCollectionStatus({});
    }
  }, [currentUser, deckCards.length]);

  const loadCombos = async () => {
    if (!deckId) return;
    setCombosLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/deck/${deckId}/combos`);
      setCombosData(data || null);
    } catch (error) {
      console.error('Error loading combos:', error);
      setCombosData(null);
    } finally {
      setCombosLoading(false);
    }
  };

  useEffect(() => {
    if (deckId) {
      loadCombos();
    }
  }, [deckId]);

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

  const parseImportText = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const errors = [];
    for (const [i, line] of lines.entries()) {
      const m = line.match(/^(\d+)\s+(.+)$/);
      if (!m) {
        errors.push({ line, index: i + 1, reason: 'Invalid format, expected: <quantity> <card name>' });
      }
    }
    setImportParsedCount(lines.length);
    setImportParseErrors(errors);
    return { lines, errors };
  };

  const importDecklist = async () => {
    if (!importText || importText.trim() === '') {
      toast.error('Nothing to import');
      return;
    }

    // run basic parsing and surface errors only after user clicks Import
    const { errors, lines } = parseImportText(importText);
    if (errors.length > 0) {
      setImportResult({ parseErrors: errors, notFound: [], errors: [] });
      setShowImportPreview(true);
      toast.error(`${errors.length} malformed line(s) found — fix them or correct and try again`);
      return;
    }

    setIsImporting(true);
    try {
      const client = buildClient();
      const { data } = await client.post(`/api/deck/${deckId}/import`, { text: importText });

      // Backend returns a report with imported/notFound/errors
      if (data && data.report) {
        const report = data.report;
        if ((report.notFound && report.notFound.length > 0) || (report.errors && report.errors.length > 0)) {
          console.warn('Import report issues:', report);
          // Show preview with backend-not-found / errors inline
          setImportResult(report);
          setShowImportPreview(true);
          toast.error(`Imported with some issues: ${report.notFound?.length || 0} not found, ${report.errors?.length || 0} errors`);
          // Keep dialog open so user can review/adjust
        } else {
          toast.success('Imported decklist');
          await loadDeckCards();
          setImportText('');
          setImportOpen(false);
        }
      } else {
        toast.success('Imported decklist');
        await loadDeckCards();
        setImportText('');
        setImportOpen(false);
      }
    } catch (err) {
      console.error('Import failed', err);
      toast.error('Import failed — see console for details');
    } finally {
      setIsImporting(false);
    }
  };

  const loadCollectionStatus = async (cards) => {
    if (!currentUser || cards.length === 0) return;
    console.log('cards: ', cards)
    try {
      const client = buildClient();
      const statusMap = {};
      
      // Group cards by oracle_id to check for any printing in collection
      const oracleIdToCardIds = {};
      cards.forEach(c => {
        const oracleId = c.card.oracle_id;
        if (oracleId) {
          if (!oracleIdToCardIds[oracleId]) {
            oracleIdToCardIds[oracleId] = [];
          }
          oracleIdToCardIds[oracleId].push(c.card.id);
        }
      });
            
      // Check collection status for each oracle_id (checks all printings)
      await Promise.all(
        Object.entries(oracleIdToCardIds).map(async ([oracleId, cardIds]) => {
          try {
            // Use the new oracle_id endpoint
            const { data } = await client.get(`/api/collection/check-oracle/${oracleId}`);
            
            // Mark all cards with this oracle_id based on collection status
            cardIds.forEach(cardId => {
              statusMap[cardId] = data.inCollection;
            });
          } catch (error) {
            // If error (likely not authenticated), default to false
            console.error('Error checking collection for oracle_id', oracleId, error);
            cardIds.forEach(cardId => {
              statusMap[cardId] = false;
            });
          }
        })
      );
      
      setCollectionStatus(statusMap);
    } catch (error) {
      console.error('Error loading collection status:', error);
    }
  };

  const searchCards = async () => {
    setSearching(true);
    try {
      const client = buildClient();
      const { data } = await client.get(`api/search/lowest-price?name=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.cards || []);
    } catch (error) {
      console.error('Error searching cards:', error);
    } finally {
      setSearching(false);
    }
  };

  const addCardToDeck = async (cardId, category = 'mainboard', oracleId = null) => {
    try {
      const client = buildClient();
      await client.post(`/api/deck/${deckId}/cards`, {
        card_id: cardId,
        category,
        quantity: 1
        ,
        oracle_id: oracleId ?? null
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

  // Handler to set a creature as commander
  const setAsCommander = async (cardId) => {
    try {
      const client = buildClient();
      // Remove from mainboard, add to commander
      await client.patch(`/api/deck/${deckId}/cards/${cardId}`, {
        category: 'commander',
        quantity: 1
      });
      toast.success('Set as Commander');
      loadDeckCards();
    } catch (error) {
      console.error('Error setting as commander:', error);
      toast.error('Failed to set as commander');
    }
  };

  const saveDeck = async () => {
    if (!editName || editName.trim() === '') {
      toast.error('Deck name is required');
      return;
    }

    try {
      setSavingDeck(true);
      const client = buildClient();
      const { data } = await client.put(`/api/deck/${deckId}`, {
        name: editName,
        description: editDescription,
        format: editFormat,
        visibility: editVisibility
      });
      setDeck(data.deck);
      toast.success('Deck updated');
      setEditOpen(false);
    } catch (error) {
      console.error('Error saving deck:', error);
      toast.error('Failed to save deck');
    } finally {
      setSavingDeck(false);
    }
  };

  const deleteDeck = async () => {
    try {
      setDeletingDeck(true);
      const client = buildClient();
      await client.delete(`/api/deck/${deckId}`);
      toast.success('Deck deleted');
      // Navigate back to decks list
      router.push('/decks');
    } catch (error) {
      console.error('Error deleting deck:', error);
      toast.error('Failed to delete deck');
    } finally {
      setDeletingDeck(false);
      setDeleteOpen(false);
      setEditOpen(false);
    }
  };

  const copyDeckToClipboard = async () => {
    try {
      if (!deckCards || deckCards.length === 0) {
        toast.error('No cards to copy');
        return;
      }

      // Order by category: mainboard, commander, sideboard, then by name
      const order = { mainboard: 1, commander: 2, sideboard: 3 };
      const sorted = [...deckCards].sort((a, b) => {
        const ca = order[a.category] || 99;
        const cb = order[b.category] || 99;
        if (ca !== cb) return ca - cb;
        const an = a.card?.name?.toLowerCase() || '';
        const bn = b.card?.name?.toLowerCase() || '';
        return an.localeCompare(bn);
      });

      const lines = sorted.map(c => `${c.quantity} ${c.card?.name || c.card_id}`);
      const text = lines.join('\n');

      await navigator.clipboard.writeText(text);
      toast.success('Deck copied to clipboard');
    } catch (error) {
      console.error('Error copying deck to clipboard:', error);
      toast.error('Failed to copy deck');
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
    // Always show Commander type for mainboard if format is commander
    let entries = Object.entries(cards);
    if (deck && deck.format === 'commander' && category === 'mainboard' && !entries.some(([type]) => type === 'commander')) {
      entries = [['commander', commanders], ...entries];
    }

    if (entries.length === 0) return null;

    return entries.map(([type, typeCards]) => {
      // For commander type, always show even if empty (for mainboard in commander format)
      if (typeCards.length === 0 && !(deck && deck.format === 'commander' && category === 'mainboard' && type === 'commander')) return null;

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
              {typeCards.map((item) => {
                return (
                  <Popover key={`${item.card.id}-${item.category}`}>
                    <PopoverTrigger asChild>
                      <div
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {isOwner ? (
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateCardQuantity(item.card.id, item.category, parseInt(e.target.value))}
                              className="w-12 h-8 text-center"
                            />
                          ) : (
                            <span className="w-12 h-8 flex items-center justify-center text-sm font-medium">{item.quantity}</span>
                          )}
                          {showCollection && currentUser && (
                            <div 
                              className={`w-2 h-2 rounded-full ${collectionStatus[item.card.id] ? 'bg-green-500' : 'bg-red-500'}`}
                              title={collectionStatus[item.card.id] ? 'In your collection' : 'Not in your collection'}
                            />
                          )}
                          <span className="text-sm font-medium hover:underline">{item.card.name}</span>
                          {item.card.mana_cost && (
                            <ManaSymbols manaString={item.card.mana_cost} size="w-4 h-4" />
                          )}
                        </div>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeCardFromDeck(item.card.id, item.category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-72 p-2">
                      <div className="flex flex-col items-center">
                        <CardImage card={item.card} className="rounded-lg mb-2" />
                        <div className="text-center">
                          <div className="font-semibold text-base">{item.card.name}</div>
                          <div className="text-xs text-muted-foreground mb-1">{item.card.set_name} ({item.card.set_code?.toUpperCase()})</div>
                          {item.card.type_line && <div className="text-xs mb-1">{item.card.type_line}</div>}
                          {item.card.oracle_text && (
                            <div className="text-xs italic mb-1">
                              <TextWithSymbols text={item.card.oracle_text} size="w-4 h-4" />
                            </div>
                          )}
                          {item.card.rarity && <div className="text-xs capitalize">Rarity: {item.card.rarity}</div>}
                        </div>
                        {/* Commander button for creatures in commander format */}
                          {deck && deck.format === 'commander' && type === 'creatures' && isOwner && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="ml-2"
                              onClick={() => setAsCommander(item.card.id)}
                            >
                              Set as Commander
                            </Button>
                          )}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
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
  const isOwner = currentUser && deck && currentUser.id === deck.user_id;

  // Only show commander tab/cards if deck format is 'commander'
  const showCommanderTab = deck && deck.format === 'commander';

  // Derived combo lists (support multiple possible shapes from API)
  const combosList = combosData?.combos || combosData?.included || [];
  const almostList = combosData?.almostIncluded || combosData?.almost_included || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.push('/decks')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Decks
            </Button>
            <div className="flex items-center gap-2">

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Link copied to clipboard!');
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Share Deck Link
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={copyDeckToClipboard}
                    >
                      <Clipboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Copy Decklist to Clipboard
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Deck</DialogTitle>
                    <DialogDescription>Update the deck name, description, and format.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <Label htmlFor="deck-name">Name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="deck-description">Description</Label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full mt-1 p-2 border rounded border-border text-sm"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deck-format">Format</Label>
                      <select
                        id="deck-format"
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        value={editFormat}
                        onChange={(e) => setEditFormat(e.target.value)}
                      >
                        <option value="standard">Standard</option>
                        <option value="modern">Modern</option>
                        <option value="commander">Commander</option>
                        <option value="legacy">Legacy</option>
                        <option value="vintage">Vintage</option>
                        <option value="pauper">Pauper</option>
                        <option value="pioneer">Pioneer</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="deck-visibility">Visibility</Label>
                      <select
                        id="deck-visibility"
                        className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        value={editVisibility}
                        onChange={(e) => setEditVisibility(e.target.value)}
                      >
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    
                  </div>
                  <DialogFooter>
                    <div className='flex justify-between w-full'>
                      <div>
                        {isOwner && (
                          <Button
                            variant="destructive"
                            onClick={() => setDeleteOpen(true)}
                          >
                            Delete Deck
                          </Button>
                        )}
                      </div>
                      <div className="sm:space-x-2">
                        <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={saveDeck} disabled={savingDeck}>{savingDeck ? 'Saving...' : 'Save'}</Button>
                      </div>
                      
                    </div>
                    

                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Deck</DialogTitle>
                    <DialogDescription>This action is permanent and cannot be undone. Are you sure you want to delete this deck?</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">This will permanently delete the deck and all its cards. This action cannot be undone.</p>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={deleteDeck} disabled={deletingDeck}>{deletingDeck ? 'Deleting...' : 'Delete Deck'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Cards</DialogTitle>
                    <DialogDescription>Paste your decklist below. One card per line in the format: <strong>quantity card name</strong>.</DialogDescription>
                    <div>
                      <Label>Example paste</Label>
                      <pre className="text-sm bg-muted p-2 rounded mt-1">{`4 Lightning Bolt
1 Black Lotus
2 Counterspell`}</pre>
                    </div>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      
                      <Label htmlFor="import-list">Paste decklist</Label>
                      <Textarea
                        id="import-list"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={`e.g.\n4 Lightning Bolt\n1 Black Lotus\n2 Counterspell`}
                        className="mt-1 w-full h-40"
                      />
                    </div>
                    {/* Preview parsed lines and show inline errors */}
                    {showImportPreview ? (
                      <div>
                        <Label>Errors</Label>
                      <div className="mt-1 p-2 bg-muted rounded text-sm">
                          {errorLines.length === 0 ? (
                            <div className="text-muted-foreground">No error lines to preview</div>
                          ) : (
                            errorLines.map((line, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="break-words">{line} <span className="text-red-500 ml-2">&lt;&lt;Card Import Error&gt;&gt;</span></div>
                              </div>
                            ))
                          )}
                      </div>
                      </div>
                    ) : null}
                    </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
                    <Button onClick={importDecklist} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isOwner && currentUser && (
          <div className="mb-4 p-3 bg-muted/50 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Viewing deck in read-only mode
            </p>
          </div>
        )}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold">{deck.name}</h1>
              {deck.description && (
                <p className="text-muted-foreground mt-1">{deck.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Updated {new Date(deck.updated_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">{deck.format.charAt(0).toUpperCase() + deck.format.slice(1)}</Badge>
          </div>
        </div>

        <div className="space-y-6">
          {/* Deck Stats */}
          {/* Decklist */}
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
                {currentUser && (
                  <>
                    <div className="border-t pt-2 mt-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Check my Collection:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setShowCollection(!showCollection)}
                      >
                        {showCollection ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>

          {/* Combos (two-column: each takes half width on md+) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Combos Found: {combosList.length}</CardTitle>
              </CardHeader>
              <CardContent>
                {combosLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : combosList.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No combos found</div>
                ) : (
                  <div className="space-y-3">
                    {combosList.map((combo, idx) => (
                      <div key={`combo-${idx}`} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">{combo.title || combo.name || ((combo.included || combo.uses || []).map(inc => inc.card?.name || inc.name || inc).filter(Boolean).join(' + ') || `Combo ${idx + 1}`)}</div>
                          <Button variant="ghost" size="icon" onClick={() => setExpandedCombos(prev => ({ ...prev, [idx]: !prev[idx] }))}>
                            {expandedCombos[idx] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                        {expandedCombos[idx] && (
                          <div className="mt-2 text-sm space-y-2">

                            {combo.notablePrerequisites && combo.notablePrerequisites.length > 0 && (
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className="font-semibold">Prerequisites:</span>
                                <TextWithSymbols text={Array.isArray(combo.notablePrerequisites) ? combo.notablePrerequisites.join(', ') : combo.notablePrerequisites} className="text-sm text-muted-foreground" size="w-4 h-4" />
                              </div>
                            )}
                          
                            {combo.description && (
                              <div className="text-sm">
                                <span className="font-semibold">Steps:</span>{' '}
                                <TextWithSymbols text={combo.description} className="inline text-sm text-muted-foreground" size="w-4 h-4" />
                              </div>
                            )}

                             {combo.produces && combo.produces.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {combo.produces.map((p, pi) => (
                                  <span key={pi} className="text-xs bg-muted px-2 py-1 rounded">{p.feature?.name}</span>
                                ))}
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Almost Included Combos</CardTitle>
              </CardHeader>
              <CardContent>
                {combosLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : almostList.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No near-miss combos</div>
                ) : (
                  <div className="space-y-3">
                    {almostList.map((a, ai) => (
                      <div key={`almost-${ai}`} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">{a.title || a.name || `Candidate ${ai + 1}`}</div>
                          <Button variant="ghost" size="icon" onClick={() => setExpandedAlmostIncluded(prev => ({ ...prev, [ai]: !prev[ai] }))}>
                            {expandedAlmostIncluded[ai] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                        {expandedAlmostIncluded[ai] && (
                          <div className="mt-2 text-sm">
                            {(a.uses || a.items || []).map((u, ui) => (
                              <div key={ui} className="flex items-center gap-2">
                                <div className="font-medium">{u.card?.name || u.name || u}</div>
                                {u.card?.set_name && <div className="text-muted-foreground text-xs"> — {u.card.set_name}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Decklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Decklist</CardTitle>
            </CardHeader>
            <CardContent>
              {(!deckCards || deckCards.length === 0) ? (
                <div className="flex items-center justify-center py-12">
                  <Button onClick={() => setImportOpen(true)}>
                    <BookCopy className="h-4 w-4 mr-2" />
                    Import Cards
                  </Button>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="mainboard" className="flex-1">Main</TabsTrigger>
                    <TabsTrigger value="sideboard" className="flex-1">Side</TabsTrigger>
                  </TabsList>

                  <TabsContent value="mainboard" className="mt-4">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderCardList(categorizedMainboard, 'mainboard')}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="sideboard" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {renderCardList(categorizedSideboard, 'sideboard')}
                    </div>
                  </TabsContent>

                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        

        {/* Card Search Section (only for owners) */}
        {isOwner && (
          <div className="mt-6">
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
                    {searchResults.map((card) => {
                      const image = getCardImage(card);
                      const isHighResLoaded = loadedImages[card.id];
                      return (
                      <div key={card.id} className="group relative">
                        <CardImage
                          card={card}
                          isHighResLoaded={loadedImages[card.id]}
                          onHighResLoad={() => setLoadedImages(prev => ({ ...prev, [card.id]: true }))}
                          alt={card.name}
                          className="rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => addCardToDeck(card.id, 'mainboard', card.oracle_id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Main
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => addCardToDeck(card.id, 'sideboard', card.oracle_id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Side
                          </Button>
                        </div>
                        <p className="text-xs text-center mt-1 truncate">{card.name}</p>
                      </div>
                    )
                    }         
                    )}
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
        )}
      </main>
    </div>
  );
}
