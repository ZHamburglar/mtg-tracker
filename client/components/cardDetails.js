import { Card, CardContent } from '@/components/ui/card';
import { ManaSymbols, TextWithSymbols } from '@/components/ManaSymbols';
import Link from "next/link";

export default function CardDetails({ card }) {
  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-2">
        {card.name && (
          <h3 className="text-xl font-bold">{card.name}</h3>
        )}
        {card.mana_cost && (
          <p className="flex items-center gap-2"><strong>Mana Cost:</strong><ManaSymbols manaString={card.mana_cost} /></p>
        )}
        {card.type_line && (
          <p><strong>Type:</strong> {card.type_line}</p>
        )}
        {card.oracle_text && (
          <div>
            <strong>Text:</strong>
            <p className="whitespace-pre-line mt-1">
              <TextWithSymbols text={card.oracle_text} />
            </p>
          </div>
        )}
        {card.power && card.toughness && (
          <p><strong>P/T:</strong> {card.power}/{card.toughness}</p>
        )}
        {card.flavor_text && (
          <p className="text-sm italic text-muted-foreground mt-2">{card.flavor_text}</p>
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
        {card.edhrec_rank && card.edhrec_uri && (
          <p>
            <strong>EDHREC Rank: {' '}</strong>
            <Link 
              href={card.edhrec_uri} 
              className="text-primary hover:underline inline-block mt-2" 
              target="_blank"
              rel="noopener noreferrer" 
            >
              {'#'}{card.edhrec_rank.toLocaleString()}
            </Link>
          </p>
        )}
        {card.scryfall_uri && (
          <p>
            <Link 
              href={card.scryfall_uri}
              className="text-primary hover:underline inline-block mt-2"
            >
              View on Scryfall →
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}