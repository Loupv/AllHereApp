import { Shield } from 'lucide-react';
import { Header } from './Header';
import { BackButton } from './BackButton';

interface AccessPageProps {
  onBack: () => void;
}

export function AccessPage({ onBack }: AccessPageProps) {
  return (
    <>
      <Header />
      <div className="h-full w-full bg-[#000D22] p-6 overflow-y-auto pt-24">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="text-left">
            <BackButton onClick={onBack} color="amber" />
          </div>
          
          <div className="bg-amber-950/40 border-2 border-amber-500/40 p-8 rounded-full w-32 h-32 flex items-center justify-center mx-auto">
            <Shield className="h-16 w-16 text-amber-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-amber-200">Access</h1>
            <p className="text-amber-300">Coming Soon</p>
          </div>
          
          <p className="text-amber-300/80 leading-relaxed">
            This section will be available soon. It will help you manage your access and personalize your experience with All Here.
          </p>
        </div>
      </div>
    </>
  );
}