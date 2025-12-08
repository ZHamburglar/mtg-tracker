import { useState } from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import buildClient from '@/app/api/build-client';
import { ManaSymbols, TextWithSymbols } from '@/components/ManaSymbols';
import { get } from 'react-hook-form';

const CardHover = ({ card }) => {
  const [cardDetails, setCardDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (open) => {
    console.log('hoveropen:', cardDetails);
    if (open && !cardDetails) {
      setLoading(true);
      try {
        const client = buildClient();
        const response = await client.get(`/api/search/${card.card_id}`);
        console.log('Card details fetched:', response.data);
        setCardDetails(response.data.card);
      } catch (error) {
        console.error('Error fetching card details:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const getCardImage = (card) => {
    // For multi-faced cards, use the first face image
    if (card.image_uri_png) {return card.image_uri_png;}
    if (card.image_uri_small) {return card.image_uri_small;}
    if (card.has_multiple_faces && card.card_faces?.[0]) {
      return card.card_faces[0].image_uri_png || card.card_faces[0].image_uri_small;
    }
    return null;
  };

  const changeSign = card.percent_change >= 0 ? '+' : '';
  const isPositiveChange = card.percent_change >= 0;

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger className="cursor-pointer hover:underline">
        {card.card_name} - ${card.current_price} ({changeSign}{card.percent_change}%)
      </HoverCardTrigger>
      <HoverCardContent className="w-[500px] p-0 z-50" align="start">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : cardDetails ? (
          <div className="flex gap-4 p-3">
            {/* Card Image - Left Column */}
            <Link 
              href={`/card/${card.card_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group overflow-hidden flex-shrink-0 w-44"
            >
              <img 
                src={getCardImage(cardDetails)} 
                alt={card.card_name}
                className="w-full h-full object-cover rounded transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 rounded">
                <span className="text-white text-xs font-semibold bg-black/70 px-2 py-1 rounded">
                  View →
                </span>
              </div>
            </Link>

            {/* Card Info - Right Column */}
            <div className="flex-1 space-y-2 min-w-0 pr-1">
              {/* Card Name and Set */}
              <div>
                <h3 className="font-bold text-base truncate">{cardDetails.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {cardDetails.set_name} ({cardDetails.set_code?.toUpperCase()})
                </p>
              </div>

              {/* Type and Rarity */}
              <div className="flex items-center gap-1 flex-wrap">
                {cardDetails.rarity && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {cardDetails.rarity}
                  </Badge>
                )}
                {cardDetails.type_line && (
                  <Badge variant="outline" className="text-xs truncate">
                    {cardDetails.type_line}
                  </Badge>
                )}
              </div>

              {/* Price Information */}
              <div className="border-t pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Current:</span>
                  <span className="text-base font-bold text-green-600">
                    ${parseFloat(card.current_price).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Change:</span>
                  <div className={`flex items-center gap-1 ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositiveChange ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="text-sm font-semibold">
                      {changeSign}{card.percent_change}%
                    </span>
                  </div>
                </div>

                {card.old_price && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Previous:</span>
                    <span className="text-muted-foreground">
                      ${parseFloat(card.old_price).toFixed(2)}
                    </span>
                  </div>
                )}

                {card.price_change && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className={isPositiveChange ? 'text-green-600' : 'text-red-600'}>
                      {changeSign}${Math.abs(parseFloat(card.price_change)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Additional Card Info */}
              {(cardDetails.mana_cost || cardDetails.cmc || (cardDetails.power && cardDetails.toughness)) && (
                <div className="border-t pt-2 space-y-1">
                  {cardDetails.mana_cost && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Mana:</span>
                      <span className="font-mono text-xs"><ManaSymbols manaString={cardDetails.mana_cost} size = 'w-4 h-4' /></span>
                    </div>
                  )}
                  {cardDetails.cmc !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">CMC:</span>
                      <span>{cardDetails.cmc}</span>
                    </div>
                  )}
                  {cardDetails.power && cardDetails.toughness && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">P/T:</span>
                      <span className="font-semibold">{cardDetails.power}/{cardDetails.toughness}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Artist */}
              {cardDetails.artist && (
                <div className="text-xs text-muted-foreground border-t pt-1.5">
                  <span className="italic truncate block">Art by {cardDetails.artist}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm">{card.card_name} is currently priced at ${card.current_price}, which is a {changeSign}{card.percent_change}% change.</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default CardHover;