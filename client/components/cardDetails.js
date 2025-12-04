import { Card, CardContent } from '@/components/ui/card';

export default function CardDetails({ card }) {
  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-2">
        {card.name && (
          <h3 className="text-xl font-bold">{card.name}</h3>
        )}
        {card.mana_cost && (
          <p><strong>Mana Cost:</strong> {card.mana_cost}</p>
        )}
        {card.type_line && (
          <p><strong>Type:</strong> {card.type_line}</p>
        )}
        {card.oracle_text && (
          <div>
            <strong>Text:</strong>
            <p className="whitespace-pre-line mt-1">{card.oracle_text}</p>
          </div>
        )}
        {card.power && card.toughness && (
          <p><strong>P/T:</strong> {card.power}/{card.toughness}</p>
        )}
        {card.flavor_text && (
          <p className="text-sm italic text-muted-foreground mt-2">{card.flavor_text}</p>
        )}
      </CardContent>
    </Card>
  )
}