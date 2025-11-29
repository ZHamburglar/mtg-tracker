const Trending = ({ trending }) => {
  return (
    <ul className="text-sm text-muted-foreground mb-2">
      {trending.map((card, index) => (
        <li key={index}>
          {card.card_name} - ${card.current_price} (+{card.percent_change}%)
        </li>
      ))}
    </ul>
  );
};

export default Trending;