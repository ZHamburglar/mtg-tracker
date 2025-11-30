import CardHover from "./cardhover";

const Trending = ({ trending }) => {
  return (
    <ul className="text-sm text-muted-foreground mb-2">
      {trending.map((card, index) => (
        <li key={index}>
          <CardHover card={card} />
        </li>
      ))}
    </ul>
  );
};

export default Trending;