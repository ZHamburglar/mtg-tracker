import { useSymbology } from '@/hooks/use-symbology';

/**
 * Component to parse and render text with mana symbols as SVG icons
 * Replaces {X}, {U}, etc. in text strings with actual symbol images
 * @param {string} text - The text string containing {symbol} placeholders
 * @param {string} size - Tailwind size class for symbols (default: w-4 h-4)
 * @param {string} className - Additional CSS classes for the container
 */
export const TextWithSymbols = ({ text, size = 'w-4 h-4', className = '' }) => {
  const { symbols, loading } = useSymbology();

  if (!text) return null;

  // If still loading, show text as-is
  if (loading) {
    return <span className={className}>{text}</span>;
  }

  // Split text by {symbols} while keeping the symbols
  // Regex matches {anything} and captures both the symbol and surrounding text
  const parts = text.split(/(\{[^}]+\})/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        // Check if this part is a symbol
        const symbolMatch = part.match(/^\{[^}]+\}$/);
        
        if (symbolMatch) {
          const svgUri = symbols[part];
          
          if (svgUri) {
            return (
              <img
                key={`symbol-${idx}`}
                src={svgUri}
                alt={part}
                title={part}
                className={`inline-block align-text-bottom ${size}`}
                loading="lazy"
              />
            );
          }
          // Fallback for unknown symbols
          return <span key={`symbol-${idx}`} className="font-mono text-xs">{part}</span>;
        }
        
        // Regular text
        return <span key={`text-${idx}`}>{part}</span>;
      })}
    </span>
  );
};

/**
 * Component to render mana cost symbols as SVG icons
 * Parses strings like "{X}{U}{U}" and displays them as icons
 * @param {string} manaString - The mana cost string with symbols in {brackets}
 * @param {string} size - Tailwind size class (default: w-5 h-5)
 */
export const ManaSymbols = ({ manaString, size = 'w-5 h-5' }) => {
  const { symbols, loading } = useSymbology();

  if (!manaString) return null;
  
  // Parse "{X}{U}{U}" into ['{X}', '{U}', '{U}']
  const symbolMatches = manaString.match(/\{[^}]+\}/g);
  
  if (!symbolMatches || symbolMatches.length === 0) {
    return <span className="font-mono text-sm">{manaString}</span>;
  }

  // If still loading, show text fallback
  if (loading) {
    return <span className="font-mono text-sm">{manaString}</span>;
  }

  return (
    <span className="inline-flex gap-0.5 items-center">
      {symbolMatches.map((symbol, idx) => {
        const svgUri = symbols[symbol];
        
        if (!svgUri) {
          // Fallback for unknown symbols
          return (
            <span key={`${symbol}-${idx}`} className="font-mono text-xs px-1">
              {symbol}
            </span>
          );
        }

        return (
          <img
            key={`${symbol}-${idx}`}
            src={svgUri}
            alt={symbol}
            title={symbol}
            className={`inline-block ${size}`}
            loading="lazy"
          />
        );
      })}
    </span>
  );
};
