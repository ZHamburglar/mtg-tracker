'use client';

import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import buildClient from '@/app/api/build-client';

export default function CardFaceToggle({ cardId, cardData }) {
  const [faces, setFaces] = useState([]);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    setCardFaces();
  }, [cardData]);

  const setCardFaces = async () => {
    setLoading(true);
    try {
      if (cardData && cardData.card_faces) {
        console.log('Setting card faces from props:', cardData);
        setFaces(cardData.card_faces);
      }
    } catch (error) {
      console.error('Fetch card faces error:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToNextFace = () => {
    if (faces[0]?.image_uri_png) {
      setIsHighResLoaded(false);
    }
    setCurrentFaceIndex((prev) => (prev + 1) % faces.length);
  };

  const goToPreviousFace = () => {
    if (faces[0]?.image_uri_png) {
      setIsHighResLoaded(false);
    }
    setCurrentFaceIndex((prev) => (prev - 1 + faces.length) % faces.length);
  };

  const getImageUrl = (face) => {
    // For adventure layout, images are at the card level, not in card_faces
    if (cardData.image_uri_png || cardData.image_uri_small) {
      if (cardData.image_uri_png) return cardData.image_uri_png;
      if (cardData.image_uri_large) return cardData.image_uri_large;
      if (cardData.image_uri_normal) return cardData.image_uri_normal;
      if (cardData.image_uri_small) return cardData.image_uri_small;
    }
    // For other layouts, use face-specific images
    if (face.image_uri_png) return face.image_uri_png;
    if (face.image_uri_large) return face.image_uri_large;
    if (face.image_uri_normal) return face.image_uri_normal;
    if (face.image_uri_small) return face.image_uri_small;
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (faces.length === 0) {
    // Fallback to regular card image if no faces found
    const image = cardData.image_uri_png || cardData.image_uri_small;
    return image ? (
      <div className="relative">
        <img
          src={image}
          alt={cardData.name}
          className="w-full h-auto rounded-lg shadow-lg"
        />
      </div>
    ) : (
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">No Image Available</span>
      </div>
    );
  }

  const currentFace = faces[currentFaceIndex];
  const imageUrl = getImageUrl(currentFace);

  return (
    <div className="space-y-4">
      {/* Face Image */}
      <div className="relative">
        {imageUrl ? (
          <>
            {/* Show low-res placeholder while high-res loads */}
            {!isHighResLoaded && (cardData.layout === 'adventure' ? cardData.image_uri_small : currentFace.image_uri_small) && (
              <img
                src={cardData.layout === 'adventure' ? cardData.image_uri_small : currentFace.image_uri_small}
                alt={currentFace.name || cardData.name}
                className="w-full h-auto rounded-lg shadow-lg blur-sm"
              />
            )}
            <img
              src={imageUrl}
              alt={currentFace.name || cardData.name}
              className={`w-full h-auto rounded-lg shadow-lg transition-opacity duration-300 ${
                isHighResLoaded ? 'opacity-100' : 'opacity-0 absolute top-0 left-0'
              }`}
              onLoad={() => setIsHighResLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">No Image Available</span>
          </div>
        )}

        {/* Face Navigation Buttons */}
        {faces && faces.length > 1 && faces[0].image_uri_png && (
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-2">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg bg-background/90 hover:bg-background"
              onClick={goToPreviousFace}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg bg-background/90 hover:bg-background"
              onClick={goToNextFace}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Face Indicator */}
        {faces.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Badge className="bg-background/90 text-foreground shadow-lg">
              Face {currentFaceIndex + 1} of {faces.length}
            </Badge>
          </div>
        )}
      </div>

      {/* Face Selector Buttons */}
      {faces.length > 1 && (
        <div className="flex gap-2 justify-center flex-wrap">
          {faces.map((face, index) => (
            <Button
              key={face.id || index}
              variant={currentFaceIndex === index ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (faces[0]?.image_uri_png) {
                  setIsHighResLoaded(false);
                }
                setCurrentFaceIndex(index);
              }}
            >
              {face.name || `Face ${index + 1}`}
            </Button>
          ))}
        </div>
      )}

      {/* Current Face Details */}
      {currentFace && (currentFace.mana_cost || currentFace.type_line || currentFace.oracle_text) && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {currentFace.name && faces.length > 1 && (
              <h3 className="text-xl font-bold">{currentFace.name}</h3>
            )}
            {currentFace.mana_cost && (
              <p><strong>Mana Cost:</strong> {currentFace.mana_cost}</p>
            )}
            {currentFace.type_line && (
              <p><strong>Type:</strong> {currentFace.type_line}</p>
            )}
            {currentFace.oracle_text && (
              <div>
                <strong>Text:</strong>
                <p className="whitespace-pre-line mt-1">{currentFace.oracle_text}</p>
              </div>
            )}
            {currentFace.power && currentFace.toughness && (
              <p><strong>P/T:</strong> {currentFace.power}/{currentFace.toughness}</p>
            )}
            {currentFace.flavor_text && (
              <p className="text-sm italic text-muted-foreground mt-2">{currentFace.flavor_text}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
