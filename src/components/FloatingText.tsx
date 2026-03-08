import { useEffect, useState } from 'react';

interface FloatingTextProps {
  text: string;
  x: number; // percentage from left
  y: number; // percentage from top
}

export default function FloatingText({ text, x, y }: FloatingTextProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute pointer-events-none z-30 font-display font-bold text-sm text-primary-foreground drop-shadow-lg"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        animation: 'floatUp 1.8s ease-out forwards',
      }}
    >
      <span className="bg-foreground/60 backdrop-blur-sm px-3 py-1 rounded-full whitespace-nowrap">
        {text}
      </span>
    </div>
  );
}
