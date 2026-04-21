import { Users } from 'lucide-react';
import { Header } from './Header';
import { BackButton } from './BackButton';

interface ConnectPageProps {
  onBack: () => void;
}

export function ConnectPage({ onBack }: ConnectPageProps) {
  return (
    <>
      <Header />
      <div className="h-full w-full bg-[#000D22] p-6 overflow-y-auto pt-24">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="text-left">
            <BackButton onClick={onBack} color="cyan" />
          </div>
          
          <div className="bg-cyan-950/40 border-2 border-cyan-500/40 p-8 rounded-full w-32 h-32 flex items-center justify-center mx-auto">
            <Users className="h-16 w-16 text-cyan-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-cyan-200">Connect</h1>
            <p className="text-cyan-300">Coming Soon</p>
          </div>
          
          <p className="text-cyan-300/80 leading-relaxed">
            This section will be available soon. It will allow you to connect with others, share your journey, and find support in our community.
          </p>
        </div>
      </div>
    </>
  );
}