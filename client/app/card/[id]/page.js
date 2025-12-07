'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Check, Minus, Car } from 'lucide-react';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/components/ui/select';
import PriceChart from '@/components/PriceChart';
import CardFaceToggle from '@/components/CardFaceToggle';
import CardDetails from '@/components/cardDetails';
import { CardSearch } from '@/components/CardSearch';
import buildClient from '../../api/build-client';

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
        className={`w-full h-auto object-contain transition-opacity duration-300 ${isHighResLoaded ? 'opacity-0 absolute' : 'opacity-100'
          }`}
      />
      {isVisible && (
        <img
          src={card.image_uri_png}
          alt={card.name}
          className={`w-full h-auto object-contain transition-opacity duration-300 ${isHighResLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          onLoad={onHighResLoad}
        />
      )}
    </div>
  );
}


export default function CardDetailPage() {
  const [card, setCard] = useState(null);
  const [allPrints, setAllPrints] = useState([]);
  const [open, setOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [currentPrice, setCurrentPrice] = useState({});
  const [loading, setLoading] = useState(true);
  const [inCollection, setInCollection] = useState(false);
  const [collectionData, setCollectionData] = useState(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(false);

  const router = useRouter();
  const params = useParams();
  const cardId = params.id;

  useEffect(() => {
    if (cardId) {
      loadCard();
      fetchCardPrices();
      fetchPriceHistory();
      checkCollection();
      fetchAllPrints();
    }
  }, [cardId]);

  const loadCard = async () => {
    setLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/search/${cardId}`);
      console.log('Card detail response:', data);
      if (data) {
        setCard(data.card);
      }
    } catch (error) {
      console.error('Load card error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPrints = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/search/${cardId}/prints`);
      console.log('dAll prints response:', data);
      if (data && data.cards) {
        setAllPrints(data.cards);
      }
    } catch (error) {
      console.error('Fetch all prints error:', error);
    }
  };

  const fetchCardPrices = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/search/${cardId}/prices/latest`);
      if (data && data.price) {
        setCurrentPrice(data.price);
      }
    } catch (error) {
      console.error('Fetch card prices error:', error);
    }
  };

  const fetchPriceHistory = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/search/${cardId}/prices`);
      if (data && data.priceHistory) {
        setPriceHistory(data.priceHistory);
      }
    } catch (error) {
      console.error('Fetch card prices error:', error);
    }
  };

  const checkCollection = async () => {
    try {
      const client = buildClient();
      const { data } = await client.get(`/api/collection/check/${cardId}`);
      setInCollection(data.inCollection);
      setCollectionData(data);
    } catch (error) {
      console.error('Check collection error:', error);
    }
  };

  const incrementCard = async (finishType) => {
    setAddingToCollection(true);
    try {
      const client = buildClient();
      await client.post(`/api/collection/${cardId}/increment`, {
        finish_type: finishType
      });
      toast.success('Card added to collection.');
      await checkCollection();
    } catch (error) {
      toast.error('Failed to add card to collection. Please try again.');
      console.error('Increment card error:', error);
    } finally {
      setAddingToCollection(false);
    }
  };

  const decrementCard = async (finishType) => {
    setAddingToCollection(true);
    try {
      const client = buildClient();
      await client.post(`/api/collection/${cardId}/decrement`, {
        finish_type: finishType
      });
      toast.success('Card removed from collection.');
      await checkCollection();
    } catch (error) {
      toast.error('Failed to remove card from collection. Please try again.');
      console.error('Decrement card error:', error);
    } finally {
      setAddingToCollection(false);
    }
  };

  const toggleCollection = async () => {
    setAddingToCollection(true);
    try {
      if (inCollection) {
        await fetch(`/api/collection/${cardId}`, { method: 'DELETE' });
        setInCollection(false);
      } else {
        await fetch('/api/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, cardData: card })
        });
        setInCollection(true);
      }
    } catch (error) {
      console.error('Toggle collection error:', error);
    } finally {
      setAddingToCollection(false);
    }
  };

  const formatStatus = (status) => {
    switch (status) {
      case 'legal':
        return 'Legal';
      case 'not_legal':
        return 'Not Legal';
      case 'banned':
        return 'Banned';
      case 'restricted':
        return 'Restricted';
      default:
        return status;
    }
  }

  const getCardImage = (card) => {
    // For multi-faced cards with layout 'adventure', images are at card level
    if (card.has_multiple_faces) {
      if (card.image_uri_png) return card.image_uri_png;
      if (card.image_uri_small) return card.image_uri_small;
    }
    // For single-faced cards or non-adventure multi-faced cards without card-level images
    if (card.image_uri_png) {return card.image_uri_png;}
    if (card.image_uri_small) {return card.image_uri_small;}
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Card not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <CardSearch />
        {/* <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div> */}
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Card Image */}
          <div>
            {card.has_multiple_faces && card.card_faces && card.card_faces.length > 0 ? (
              <CardFaceToggle cardId={cardId} cardData={card} />
            ) : getCardImage(card) ? (
              <>
                <CardImage
                  card={card}
                  isHighResLoaded={isHighResLoaded}
                  onHighResLoad={() => setIsHighResLoaded(true)}
                />
                <CardDetails card={card} />
              </>
            ) : (
              <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">No Image Available</span>
              </div>
            )}

            {/* All Prints Section */}
            {allPrints.length > 1 && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">
                  All Printings ({allPrints.length})
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {allPrints.map((print) => {
                    const price = print.prices?.usd || print.prices?.usd_foil;
                    return (
                      <Card
                        key={print.id}
                        className={`cursor-pointer hover:shadow-lg transition-shadow ${
                          print.id === cardId ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => router.push(`/card/${print.id}`)}
                      >
                        <div className="relative">
                          {print.image_uri_small ? (
                            <img
                              src={print.image_uri_small}
                              alt={`${print.name} - ${print.set_name}`}
                              className="w-full h-auto object-contain"
                            />
                          ) : (
                            <div className="w-full h-48 bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground text-xs">No Image</span>
                            </div>
                          )}
                          {print.id === cardId && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Current
                            </div>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="text-xs font-semibold truncate">{print.set_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {print.set_code?.toUpperCase()} #{print.collector_number}
                          </p>
                          {print.released_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(print.released_at).getFullYear()}
                            </p>
                          )}
                          {(print.prices?.usd || print.prices?.usd_foil) && (
                            <div className="flex items-center justify-between mt-1">
                              {print.prices?.usd && (
                                <p className="text-xs font-semibold text-green-600">
                                  ${parseFloat(print.prices.usd).toFixed(2)}
                                </p>
                              )}
                              {print.prices?.usd_foil && (
                                <p className="text-xs font-semibold text-blue-600">
                                  ${parseFloat(print.prices.usd_foil).toFixed(2)} ✨
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div>
            <div className="mb-4">
              <h1 className="text-4xl font-bold mb-2">{card.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Set:</span>
                {allPrints.length > 1 ? (
                  <Select value={cardId} onValueChange={(value) => router.push(`/card/${value}`)}>
                    <SelectTrigger className="w-auto">
                      <SelectValue>
                        {card.set_name} ({card.set_code?.toUpperCase()}) #{card.collector_number}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectScrollUpButton />
                      <SelectGroup>
                        <SelectLabel>All Prints</SelectLabel>
                        <SelectSeparator />
                        {allPrints.map((print) => (
                          <SelectItem
                            key={print.id}
                            value={print.id}
                          >
                            {print.set_name} ({print.set_code?.toUpperCase()}) #{print.collector_number}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectScrollDownButton />
                    </SelectContent>
                  </Select>
                ) : (
                  <span>{card.set_name} ({card.set_code?.toUpperCase()}) #{card.collector_number}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <Badge>{card.rarity}</Badge>
              {card.type_line && <Badge variant="outline">{card.type_line}</Badge>}
            </div>

            {/* Collection Status */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Add to Collection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Non-Foil */}
                  {card && card.finishes.length > 0 && card.finishes.includes('nonfoil') && (
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-semibold">Non-Foil</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {collectionData?.summary?.normalQuantity || 0}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => decrementCard('normal')}
                          disabled={addingToCollection || (collectionData?.summary?.normalQuantity || 0) === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => incrementCard('normal')}
                          disabled={addingToCollection}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Foil */}
                  {card && card.finishes.length > 0 && card.finishes.includes('foil') && (
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-semibold">Foil</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {collectionData?.summary?.foilQuantity || 0}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => decrementCard('foil')}
                          disabled={addingToCollection || (collectionData?.summary?.foilQuantity || 0) === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => incrementCard('foil')}
                          disabled={addingToCollection}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                  }
                  {/* Other Prints in Collection */}
                  {collectionData?.otherPrints && collectionData.otherPrints.length > 0 && (
                    <div className="p-4 bg-muted rounded-lg mb-4">
                      <p className="font-semibold mb-2">Other Printings in Collection:</p>
                      <div className="space-y-2">
                        {collectionData.otherPrints.map((print) => (
                          <div
                            key={`${print.card_id}-${print.finish_type}`}
                            className="flex items-center justify-between text-sm cursor-pointer hover:bg-background p-2 rounded"
                            onClick={() => router.push(`/card/${print.card_id}`)}
                          >
                            <div>
                              <p className="font-medium">
                                {print.cardData.set_name} ({print.cardData.set_code?.toUpperCase()})
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {print.finish_type.charAt(0).toUpperCase() + print.finish_type.slice(1)} × {print.quantity}
                              </p>
                            </div>
                            <Badge variant="outline" className="ml-2">
                              {print.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>

            {/* Current Prices */}
            {
              currentPrice && Object.keys(currentPrice).length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Current Prices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {currentPrice?.price_usd && (
                        <div>
                          <p className="text-sm text-muted-foreground">Regular</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${parseFloat(currentPrice.price_usd).toFixed(2)}
                          </p>
                        </div>
                      )}
                      {currentPrice?.price_usd_foil && (
                        <div>
                          <p className="text-sm text-muted-foreground">Foil</p>
                          <p className="text-2xl font-bold text-blue-600">
                            ${parseFloat(currentPrice.price_usd_foil).toFixed(2)}
                          </p>
                        </div>
                      )}
                      {currentPrice?.price_eur && (
                        <div>
                          <p className="text-sm text-muted-foreground">EUR</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            €{parseFloat(currentPrice.price_eur).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            }


            {/* Price History Chart */}
            {
              priceHistory && priceHistory.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Price History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PriceChart priceHistory={priceHistory} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Price History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center py-8 text-muted-foreground">
                      No price history available
                    </p>
                  </CardContent>
                </Card>
              )
            }

            {/* Legalities */}
            {card && card.legalities && Object.keys(card.legalities).length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Legalities</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(card.legalities).map(([format, status]) => (
                    <div key={format} className="flex flex-col">
                      <span className="font-semibold capitalize">{format.replace('_', ' ')}</span>
                      <span className={status === 'legal' ? 'text-green-600' : 'text-red-600'}>
                        {formatStatus(status)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}


            {/* Card Text */}
            {card.oracle_text && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Card Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{card.oracle_text}</p>
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {card.mana_cost && <p><strong>Mana Cost:</strong> {card.mana_cost}</p>}
                {card.cmc && <p><strong>CMC:</strong> {card.cmc}</p>}
                {card.power && card.toughness && (
                  <p><strong>P/T:</strong> {card.power}/{card.toughness}</p>
                )}
                {card.artist && (
                  <p>
                    <strong>Artist:</strong>{' '}
                    <Link 
                      href={`/search?artist=${encodeURIComponent(card.artist)}`}
                      className="text-primary hover:underline"
                    >
                      {card.artist}
                    </Link>
                  </p>
                )}
                `<a
                  href={card.scryfall_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-block mt-2"
                >
                  View on Scryfall →
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}