import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface BackButtonProps {
  onClick: () => void;
  color?: 'violet' | 'blue' | 'emerald' | 'amber' | 'cyan' | 'pink';
}

const colorClasses = {
  violet: 'text-purple-300 hover:bg-purple-900/20',
  blue: 'text-blue-300 hover:bg-blue-900/20',
  emerald: 'text-emerald-300 hover:bg-emerald-900/20',
  amber: 'text-amber-300 hover:bg-amber-900/20',
  cyan: 'text-cyan-300 hover:bg-cyan-900/20',
  pink: 'text-pink-300 hover:bg-pink-900/20',
};

export function BackButton({ onClick, color = 'emerald' }: BackButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={`${colorClasses[color]}`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      BACK
    </Button>
  );
}
