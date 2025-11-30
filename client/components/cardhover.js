import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

const CardHover = ({ card }) => {
  console.log(card);
  return (
    <HoverCard>
      <HoverCardTrigger>{card.card_name} - ${card.current_price} (+{card.percent_change}%)</HoverCardTrigger>
      <HoverCardContent className="w-80 z-50">
        {card.card_name} is currently priced at ${card.current_price}, which is a {card.percent_change}% change.
      </HoverCardContent>
    </HoverCard>
  );
};

export default CardHover;