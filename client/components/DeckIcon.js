export default function DeckIcon({ className = "h-12 w-12" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 40"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="8" width="24" height="32" rx="3" transform="rotate(-15 6 8)" />
        <rect x="20" y="4" width="24" height="32" rx="3" />
        <rect x="34" y="8" width="24" height="32" rx="3" transform="rotate(15 34 8)" />
      </g>
    </svg>
  );
}
