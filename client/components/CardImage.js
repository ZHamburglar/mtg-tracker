import { useEffect, useRef, useState } from 'react';

export default function CardImage({ card, isHighResLoaded, onHighResLoad }) {
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

  // Use first face image if card has multiple faces
  const smallImage = card.image_uri_small || (card.has_multiple_faces && card.card_faces?.[0]?.image_uri_small) || null;
  
  const largeImage = card.image_uri_png || (card.has_multiple_faces && card.card_faces?.[0]?.image_uri_png) || null;

  return (
    <div ref={imgRef} className="relative w-full">
      {smallImage && (
        <img
          src={smallImage}
          alt={card.name}
          loading="lazy"
          className={`w-full h-auto object-contain transition-opacity duration-300 ${
            isHighResLoaded ? 'opacity-0 absolute' : 'opacity-100'
          }`}
        />
      )}
      {isVisible && largeImage && (
        <img
          src={largeImage}
          alt={card.name}
          className={`w-full h-auto object-contain transition-opacity duration-300 ${
            isHighResLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={onHighResLoad}
        />
      )}
    </div>
  );
}