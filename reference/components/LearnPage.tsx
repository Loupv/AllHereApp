import { useState } from 'react';
import { Video, Headphones, CheckCircle2, Lock } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { MediaPlayerPage } from './MediaPlayerPage';
import { motion } from 'motion/react';

interface LearnPageProps {
  onBack: () => void;
}

interface JourneyNode {
  id: string;
  title: string;
  type: 'video' | 'audio';
  duration: string;
  completed: boolean;
  locked: boolean;
  level: number;
}

export function LearnPage({ onBack }: LearnPageProps) {
  const [selectedContent, setSelectedContent] = useState<{
    item: JourneyNode;
    sectionName: string;
  } | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const learningPaths = [
    {
      name: 'Preamble',
      items: [
        {
          id: 'pre-1',
          title: 'Introduction to The Silent Mind',
          type: 'video' as const,
          duration: '8 min',
          completed: false,
          locked: false,
          level: 0,
        },
        {
          id: 'pre-2',
          title: 'Noisy, Focal, Stable, Silent',
          type: 'audio' as const,
          duration: '4 min',
          completed: false,
          locked: false,
          level: 0,
        },
        {
          id: 'pre-3',
          title: 'The Earth, Sky and Space Ascent',
          type: 'video' as const,
          duration: '4 min',
          completed: false,
          locked: false,
          level: 0,
        },
        {
          id: 'pre-4',
          title: 'Prepare for the meditation',
          type: 'audio' as const,
          duration: '8 min',
          completed: false,
          locked: false,
          level: 0,
        },
      ],
    },
    {
      name: 'Part1 - From Noise to Focal Mind',
      items: [
        {
          id: '1-1',
          title: 'Part1 - Introduction',
          type: 'video' as const,
          duration: '8 min',
          completed: false,
          locked: false,
          level: 0,
        },
        {
          id: '1-2',
          title: 'Prepare for the practice',
          type: 'audio' as const,
          duration: '3 min',
          completed: false,
          locked: false,
          level: 0,
        },
        {
          id: '1-3',
          title: 'Guided Practice: Relax and Observe',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: false,
          level: 1,
        },
        {
          id: '1-4',
          title: 'Guided Practice: Breath and Self-Observation',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '1-5',
          title: 'Guided Practice: Center of Gravity',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '1-6',
          title: 'Wrap-up of Part1',
          type: 'video' as const,
          duration: '4 min',
          completed: false,
          locked: true,
          level: 2,
        },
      ],
    },
    {
      name: 'Part2 - From Focal to Stable Mind',
      items: [
        {
          id: '2-1',
          title: 'Part2 - Introduction',
          type: 'video' as const,
          duration: '8 min',
          completed: false,
          locked: true,
          level: 0,
        },
        {
          id: '2-2',
          title: 'Guided Practice 1: Follow the Air',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 1,
        },
        {
          id: '2-3',
          title: 'Guided Practice 2: Follow and Witness',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 1,
        },
        {
          id: '2-4',
          title: 'Guided Practice 3: Unfollow the Air',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '2-5',
          title: 'Guided Practice 4: Emptiness',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '2-6',
          title: 'Wrap-up of Part2',
          type: 'video' as const,
          duration: '4 min',
          completed: false,
          locked: true,
          level: 2,
        },
      ],
    },
    {
      name: 'Part3 - From Stable to Silent Mind',
      items: [
        {
          id: '3-1',
          title: 'Part3 - Introduction',
          type: 'video' as const,
          duration: '8 min',
          completed: false,
          locked: true,
          level: 0,
        },
        {
          id: '3-2',
          title: 'Guided Practice 1: The Dark Practice',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 1,
        },
        {
          id: '3-3',
          title: 'Guided Practice 2: The Vertical Axis',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 1,
        },
        {
          id: '3-4',
          title: 'Guided Practice 3: The Light Practice',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '3-5',
          title: 'Guided Practice 4: In the Black Hall',
          type: 'audio' as const,
          duration: '20 min',
          completed: false,
          locked: true,
          level: 2,
        },
        {
          id: '3-6',
          title: 'Wrap-up of Part3',
          type: 'video' as const,
          duration: '4 min',
          completed: false,
          locked: true,
          level: 2,
        },
      ],
    },
  ];

  const handleContentClick = (item: JourneyNode, sectionName: string) => {
    if (!item.locked) {
      setSelectedContent({ item, sectionName });
    }
  };

  const handleComplete = () => {
    if (selectedContent) {
      setCompletedItems(prev => new Set(prev).add(selectedContent.item.id));
    }
  };

  const handleBackFromPlayer = () => {
    setSelectedContent(null);
  };

  if (selectedContent) {
    return (
      <MediaPlayerPage
        content={{
          id: selectedContent.item.id,
          title: selectedContent.item.title,
          type: selectedContent.item.type,
          duration: selectedContent.item.duration,
          sectionName: selectedContent.sectionName,
        }}
        onBack={handleBackFromPlayer}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          {/* Hero Image Section */}
          <div className="relative h-72 w-full overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url('https://images.unsplash.com/photo-1682335688718-cd3c073bd18b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2Z0JTIwY2xvdWRzJTIwc2t5fGVufDF8fHx8MTc2MTgyMTU4Nnww&ixlib=rb-4.1.0&q=80&w=1080')`
              }}
              animate={{
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-blue-900/50 to-slate-900/60" />
            {/* Progressive gradient overlay for readability */}
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#000D22] via-[#000D22]/70 via-[#000D22]/40 to-transparent" />
          </div>

          <div className="max-w-2xl mx-auto w-full p-6 -mt-64 relative z-10">
            <div className="mb-4">
              <BackButton onClick={onBack} color="blue" />
            </div>
            
            <div className="text-center space-y-2 mb-6">
              <h1 className="text-blue-300 uppercase tracking-wider drop-shadow-lg">Learn</h1>
              <p className="text-blue-200/70 tracking-wider drop-shadow-md">
                Your Journey to a Silent Mind
              </p>
            </div>
            
            <div className="space-y-8 pb-6">
              {learningPaths.map((path, pathIndex) => (
                <div key={pathIndex} className="space-y-4">
                  <h2 className="text-blue-300 text-xl">{path.name}</h2>
                  
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600"></div>
                    
                    <div className="space-y-4">
                      {path.items.map((item, itemIndex) => {
                        const Icon = item.type === 'video' ? Video : Headphones;
                        const isCompleted = completedItems.has(item.id);
                        const isLocked = item.locked;
                        
                        return (
                          <div key={itemIndex} className="relative">
                            <div className="absolute -left-8 top-4 w-6 h-6 rounded-full bg-[#000D22] border-2 border-blue-500 flex items-center justify-center z-10">
                              {isCompleted ? (
                                <CheckCircle2 className="h-3 w-3 text-blue-400" />
                              ) : isLocked ? (
                                <Lock className="h-3 w-3 text-blue-600" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              )}
                            </div>
                            
                            <Card 
                              onClick={() => handleContentClick(item, path.name)}
                              className={`bg-[#0A1633] border-2 border-blue-500/30 p-4 shadow-lg ${
                              isLocked ? 'opacity-50' : 'hover:border-blue-500/50 cursor-pointer'
                            } transition-all duration-300`}>
                              <div className="flex items-start gap-3">
                                <Icon className={`h-5 w-5 mt-1 flex-shrink-0 ${
                                  isLocked ? 'text-blue-600' : 'text-blue-400'
                                }`} />
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h3 className="text-slate-300">{item.title}</h3>
                                      <p className="text-slate-500 text-sm mt-1">{item.duration}</p>
                                    </div>
                                    <Badge 
                                      variant={isCompleted ? 'default' : isLocked ? 'outline' : 'secondary'}
                                      className={
                                        isCompleted 
                                          ? 'bg-blue-600 text-white border-0' 
                                          : isLocked 
                                          ? 'border-2 border-blue-600/50 text-blue-400 bg-transparent' 
                                          : 'bg-blue-900/40 text-blue-300 border border-blue-500/30'
                                      }
                                    >
                                      {isCompleted ? 'Completed' : isLocked ? 'Locked' : 'Available'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
