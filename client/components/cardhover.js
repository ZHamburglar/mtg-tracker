import { useState } from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow } from '@/components/ui/hover-card';
import buildClient from '@/app/api/build-client';

const CardHover = ({ card }) => {
  const [cardDetails, setCardDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (open) => {
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

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger>{card.card_name} - ${card.current_price} (+{card.percent_change}%)</HoverCardTrigger>
      <HoverCardContent className="w-120 z-50">
        {loading ? (
          <p>Loading card details...</p>
        ) : cardDetails ? (
          <div>
            <p>{card.card_name} is currently priced at ${card.current_price}, which is a {card.percent_change}% change.</p>
            <pre className="mt-2 text-xs">{cardDetails.id}</pre>
            <img src={cardDetails.image_uri_small} alt={card.card_name} />
          </div>
        ) : (
          <p>{card.card_name} is currently priced at ${card.current_price}, which is a {card.percent_change}% change.</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default CardHover;