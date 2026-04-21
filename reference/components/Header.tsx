import { Settings, User } from 'lucide-react';
import logo from 'figma:asset/2fc785cd03fb98f8b8508ec23b204a997c2ecb12.png';
import { Button } from './ui/button';

interface HeaderProps {
  onNavigateToPreferences?: () => void;
  onNavigateToAccount?: () => void;
}

export function Header({ onNavigateToPreferences, onNavigateToAccount }: HeaderProps) {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[#0A1128]/98" />
        <div className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
          <div className="w-20">
            {onNavigateToPreferences && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNavigateToPreferences}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>
          
          <img 
            src={logo} 
            alt="All Here" 
            className="h-10 w-auto"
          />
          
          <div className="w-20 flex justify-end">
            {onNavigateToAccount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNavigateToAccount}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              >
                <User className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>
      {/* Extended gradient from header */}
      <div className="fixed top-[88px] left-0 right-0 h-48 pointer-events-none z-40 bg-gradient-to-b from-[#0A1128]/80 via-[#0A1128]/40 to-transparent" />
    </>
  );
}