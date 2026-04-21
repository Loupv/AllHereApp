import { BookOpen, Target, Key, Handshake, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { motion } from 'motion/react';

interface BeginPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

export function BeginPage({ onBack, onNavigate }: BeginPageProps) {
  const sections = [
    {
      icon: BookOpen,
      title: 'Learn',
      description: 'Access a comprehensive journey through guided meditation practices. Progress your way toward a silent mind, through our structured step-by-step audio and video program.',
      color: 'blue',
      page: 'learn',
    },
    {
      icon: Target,
      title: 'Train',
      description: 'Connect your Mobile QMS device, or create personalized practice programs to train within the QM format. Choose your repetitions, and audio background.',
      color: 'emerald',
      page: 'train',
    },
    {
      icon: Key,
      title: 'Access',
      description: 'Find an All Here Lounge next to you, and access aditionnal knowledge, guidance and content.',
      color: 'amber',
      comingSoon: true,
      page: 'access',
    },
    {
      icon: Handshake,
      title: 'Connect',
      description: 'Join a community of practitioners, share experiences, organise your own gatherings, and find support from others walking the same path toward inner peace.',
      color: 'cyan',
      comingSoon: true,
      page: 'connect',
    },
    {
      icon: Info,
      title: 'About All Here',
      description: 'Discover the science and philosophy behind our approach. Stay updated with the latest research, news, and insights on meditation and mental health.',
      color: 'pink',
      page: 'contact',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: {
        bg: 'bg-blue-500/20',
        text: 'text-blue-300',
        border: 'border-blue-500/20',
      },
      emerald: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-300',
        border: 'border-emerald-500/20',
      },
      amber: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-300',
        border: 'border-amber-500/20',
      },
      cyan: {
        bg: 'bg-cyan-500/20',
        text: 'text-cyan-300',
        border: 'border-cyan-500/20',
      },
      pink: {
        bg: 'bg-pink-500/20',
        text: 'text-pink-300',
        border: 'border-pink-500/20',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <>
      <Header />
      <div className="h-full w-full bg-[#000D22] overflow-y-auto pt-[88px]">
        {/* Hero Image Section */}
        <div className="relative h-72 w-full overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url('https://images.unsplash.com/photo-1648726442906-b0b33ad693d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWxtJTIwb2NlYW4lMjB3YXRlcnxlbnwxfHx8fDE3NjE3NDk2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080')`
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
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/70 via-purple-800/60 to-indigo-900/70" />
          {/* Progressive gradient overlay for readability */}
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#000D22] via-[#000D22]/70 via-[#000D22]/40 to-transparent" />
        </div>

        <div className="max-w-3xl mx-auto p-6 -mt-64 relative z-10">
          <div className="mb-4">
            <BackButton onClick={onBack} color="violet" />
          </div>
          
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-purple-200 drop-shadow-lg">Welcome to All Here</h1>
            <p className="text-purple-300 max-w-2xl mx-auto drop-shadow-md">
              Discover how each section of our app supports your journey toward mental clarity, inner peace, and personal transformation.
            </p>
          </div>
          
          <div className="space-y-8">
            
            <div className="space-y-6">
              {sections.map((section, index) => {
                const Icon = section.icon;
                const colorClasses = getColorClasses(section.color);
                const canNavigate = !section.comingSoon && onNavigate;
                
                return (
                  <motion.div
                    key={index}
                    whileHover={canNavigate ? { scale: 1.02, y: -4 } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      onClick={() => canNavigate && onNavigate(section.page)}
                      className={`bg-[#0A1633] ${colorClasses.border} border-2 p-6 hover:border-opacity-60 transition-all duration-300 shadow-lg ${section.comingSoon ? 'opacity-60' : canNavigate ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`${colorClasses.bg} p-3 rounded-xl flex-shrink-0`}>
                          <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className={colorClasses.text}>{section.title}</h3>
                            {section.comingSoon && (
                              <span className="text-xs uppercase tracking-wider text-white/50 bg-[#0D1A3D] px-3 py-1 rounded-full border border-white/10">
                                Coming Soon
                              </span>
                            )}
                          </div>
                          <p className="text-white/70 leading-relaxed">{section.description}</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
