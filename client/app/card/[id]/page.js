'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PriceChart from '@/components/PriceChart';

export default function CardDetailPage() {
  const [card, setCard] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inCollection, setInCollection] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const router = useRouter();
  const params = useParams();
  const cardId = params.id;

  useEffect(() => {
    if (cardId) {
      loadCard();
      checkCollection();
    }
  }, [cardId]);

  const loadCard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cards/${cardId}`);
      if (response.ok) {
        const data = await response.json();
        setCard(data.card);
        setPriceHistory(data.priceHistory || []);
      }
    } catch (error) {
      console.error('Load card error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCollection = async () => {
    try {
      const response = await fetch(`/api/collection/check/${cardId}`);
      if (response.ok) {
        const data = await response.json();
        setInCollection(data.inCollection);
      }
    } catch (error) {
      console.error('Check collection error:', error);
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

  const getCardImage = (card) => {
    if (card.image_uris?.large) return card.image_uris.large;
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large;
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
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Card Image */}
          <div>
            {getCardImage(card) ? (
              <img
                src={getCardImage(card)}
                alt={card.name}
                className="rounded-lg shadow-2xl w-full max-w-md mx-auto"
              />
            ) : (
              <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">No Image Available</span>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div>
            <div className="mb-4">
              <h1 className="text-4xl font-bold mb-2">{card.name}</h1>
              <p className="text-muted-foreground">
                {card.set_name} ({card.set.toUpperCase()}) #{card.collector_number}
              </p>
            </div>

            <div className="flex gap-2 mb-6">
              <Badge>{card.rarity}</Badge>
              {card.type_line && <Badge variant="outline">{card.type_line}</Badge>}
            </div>

            <Button
              onClick={toggleCollection}
              disabled={addingToCollection}
              size="lg"
              className="mb-6"
            >
              {inCollection ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  In Collection
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Collection
                </>
              )}
            </Button>

            {/* Current Prices */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Current Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {card.prices?.usd && (
                    <div>
                      <p className="text-sm text-muted-foreground">Regular</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${parseFloat(card.prices.usd).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {card.prices?.usd_foil && (
                    <div>
                      <p className="text-sm text-muted-foreground">Foil</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ${parseFloat(card.prices.usd_foil).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {card.prices?.eur && (
                    <div>
                      <p className="text-sm text-muted-foreground">EUR</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        €{parseFloat(card.prices.eur).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Price History Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceChart priceHistory={priceHistory} />
              </CardContent>
            </Card>

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
                {card.artist && <p><strong>Artist:</strong> {card.artist}</p>}
                <a
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