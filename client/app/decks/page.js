'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import buildClient from '../api/build-client';
import { toast } from 'sonner';

export default function DecksPage() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState('commander');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    setLoading(true);
    try {
      const client = buildClient();
      const { data } = await client.get('/api/deck');
      setDecks(data.decks || []);
    } catch (error) {
      console.error('Error loading decks:', error);
      toast.error('Failed to load decks');
    } finally {
      setLoading(false);
    }
  };

  const createDeck = async () => {
    if (!newDeckName.trim()) {
      toast.error('Please enter a deck name');
      return;
    }

    try {
      const client = buildClient();
      const { data } = await client.post('/api/deck', {
        name: newDeckName,
        description: newDeckDescription,
        format: newDeckFormat
      });
      
      toast.success('Deck created successfully!');
      setIsCreateDialogOpen(false);
      setNewDeckName('');
      setNewDeckDescription('');
      setNewDeckFormat('commander');
      
      // Navigate to the new deck
      router.push(`/deck/${data.deck.id}`);
    } catch (error) {
      console.error('Error creating deck:', error);
      toast.error('Failed to create deck');
    }
  };

  const filteredDecks = decks.filter(deck =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deck.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Decks</h1>
            <p className="text-muted-foreground">
              Build and manage your Magic: The Gathering decks
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Deck
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Deck</DialogTitle>
                <DialogDescription>
                  Start building your new deck
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deck-name">Deck Name *</Label>
                  <Input
                    id="deck-name"
                    placeholder="Enter deck name..."
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="deck-description">Description</Label>
                  <Input
                    id="deck-description"
                    placeholder="Enter deck description..."
                    value={newDeckDescription}
                    onChange={(e) => setNewDeckDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="deck-format">Format</Label>
                  <select
                    id="deck-format"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={newDeckFormat}
                    onChange={(e) => setNewDeckFormat(e.target.value)}
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createDeck}>Create Deck</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search decks..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No decks found matching your search' : 'No decks yet'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Deck
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDecks.map((deck) => (
              <Card
                key={deck.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/deck/${deck.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{deck.name}</CardTitle>
                      {deck.description && (
                        <CardDescription className="mt-1">{deck.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant="outline">{deck.format}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">{deck.total_cards || 0}</span> cards
                    </div>
                    {deck.commander_name && (
                      <div className="flex-1 truncate">
                        Commander: <span className="font-medium">{deck.commander_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  Updated {new Date(deck.updated_at).toLocaleDateString()}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
