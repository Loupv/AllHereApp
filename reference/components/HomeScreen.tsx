import { Page } from '../App';
import { Header } from './Header';
import { motion } from 'motion/react';
import { Sunrise, BookOpen, Target, Key, Handshake, Sparkles, Info, Calendar } from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (page: Page) => void;
}

interface NavItem {
  id: Page;
  label: string;
  gradient: string;
  glowColor: string;
  Icon: React.ElementType;
  disabled?: boolean;
  imageUrl: string;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const navItems: NavItem[] = [
    {
      id: 'begin',
      label: 'Begin',
      gradient: 'from-indigo-900/70 via-violet-800/60 to-blue-900/70',
      glowColor: 'rgba(139, 92, 246, 0.3)',
      Icon: Sunrise,
      imageUrl: 'https://images.unsplash.com/photo-1648726442906-b0b33ad693d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWxtJTIwb2NlYW4lMjB3YXRlcnxlbnwxfHx8fDE3NjE3NDk2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'learn',
      label: 'Learn',
      gradient: 'from-slate-800/60 via-blue-900/50 to-slate-900/60',
      glowColor: 'rgba(59, 130, 246, 0.3)',
      Icon: BookOpen,
      imageUrl: 'https://images.unsplash.com/photo-1682335688718-cd3c073bd18b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2Z0JTIwY2xvdWRzJTIwc2t5fGVufDF8fHx8MTc2MTgyMTU4Nnww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'train',
      label: 'Train',
      gradient: 'from-slate-900/60 via-teal-900/50 to-slate-800/60',
      glowColor: 'rgba(20, 184, 166, 0.3)',
      Icon: Target,
      imageUrl: 'https://images.unsplash.com/photo-1669291480580-91b09ac96d2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3Jlc3QlMjBtb3VudGFpbiUyMG5hdHVyZXxlbnwxfHx8fDE3NjE4MzM0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'six-weeks',
      label: '6-Weeks',
      gradient: 'from-orange-900/70 via-amber-800/60 to-rose-900/70',
      glowColor: 'rgba(251, 146, 60, 0.3)',
      Icon: Calendar,
      imageUrl: 'https://images.unsplash.com/photo-1761634731476-abb2df18357d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW5yaXNlJTIwd2VsbG5lc3MlMjBqb3VybmV5fGVufDF8fHx8MTc2ODMyMDIzNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    {
      id: 'access',
      label: 'Access',
      gradient: 'from-slate-800/60 via-gray-800/50 to-slate-900/60',
      glowColor: 'rgba(156, 163, 175, 0.3)',
      Icon: Key,
      disabled: true,
      imageUrl: 'https://images.unsplash.com/photo-1693325012025-44a677c80258?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaXN0eSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NjE4MzM0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'connect',
      label: 'Connect',
      gradient: 'from-blue-950/60 via-indigo-950/50 to-slate-900/60',
      glowColor: 'rgba(79, 70, 229, 0.3)',
      Icon: Handshake,
      disabled: true,
      imageUrl: 'https://images.unsplash.com/photo-1665581593785-6cf9e3eb2492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVuaW5nJTIwc2t5JTIwY2xvdWRzfGVufDF8fHx8MTc2MTgzMzQ4NXww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      id: 'contact',
      label: 'About All Here',
      gradient: 'from-indigo-950/40 via-pink-950/25 to-purple-950/40',
      glowColor: 'rgba(236, 72, 153, 0.3)',
      Icon: Info,
      imageUrl: 'https://images.unsplash.com/photo-1480815403196-35682b6f6a76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWVwJTIwbmlnaHQlMjBzdGFycyUyMG1pbGt5JTIwd2F5fGVufDF8fHx8MTc2MTgzNDQwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ];

  return (
    <>
      {/* Animated background with multiple gradients */}
      <motion.div
        className="fixed inset-0 z-0"
        animate={{
          background: [
            'radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.12) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 60%), #0A1128',
            'radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.15) 0%, transparent 40%), radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 60%), #0A1128',
            'radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 40%), radial-gradient(circle at 40% 20%, rgba(245, 158, 11, 0.12) 0%, transparent 40%), radial-gradient(circle at 60% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%), #0A1128',
          ],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      
      <Header 
        onNavigateToPreferences={() => onNavigate('preferences')}
        onNavigateToAccount={() => onNavigate('account')}
      />
      
      <div className="min-h-screen w-full pt-32 pb-32 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {navItems.map((item, index) => (
            <motion.button
              key={item.id}
              data-tutorial-id={item.id}
              onClick={() => !item.disabled && onNavigate(item.id)}
              disabled={item.disabled}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                delay: index * 0.12,
                type: "spring",
                stiffness: 100,
                damping: 15,
              }}
              whileHover={!item.disabled ? { 
                scale: 1.02, 
                y: -4,
                transition: { duration: 0.3 }
              } : {}}
              whileTap={!item.disabled ? { scale: 0.98 } : {}}
              className={`relative group h-48 rounded-2xl overflow-hidden ${ 
                item.disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
              }`}
            >
              {/* Background image with low opacity */}
              <motion.div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ 
                  backgroundImage: `url('${item.imageUrl}')`,
                }}
                animate={{
                  opacity: item.id === 'learn' 
                    ? [0.5, 0.35, 0.5]
                    : [0.20, 0.12, 0.20],
                }}
                transition={{
                  duration: 4 + (index % 3) * 1,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: index * 0.5,
                }}
              />
              
              {/* Gradient overlay for color theming */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />
              
              {/* Vignette effect */}
              <div 
                className="absolute inset-0"
                style={{ 
                  background: 'radial-gradient(circle at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.6) 100%)' 
                }}
              />
              
              {/* Border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-white/20 group-hover:border-white/30 transition-all duration-300" />
              
              {/* Content */}
              <div className="relative h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                {/* Icon */}
                <item.Icon className="h-12 w-12 text-white/90 flex-shrink-0" strokeWidth={1.5} />
                
                <h2 className="text-white text-4xl tracking-wider uppercase">
                  {item.label}
                </h2>
                
                {/* Espace réservé pour garder l'alignement constant */}
                <div className="h-7 flex items-center justify-center">
                  {item.disabled && (
                    <span className="text-white/60 text-xl tracking-wider uppercase flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Soon
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
      
      {/* Enhanced footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 text-center backdrop-blur-md z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1128] via-[#0A1128]/95 to-transparent" />
        <div className="relative z-10">
          <p className="text-white/80 tracking-widest text-sm">
            WHERE MEDITATION MEETS<br />SCIENCE AND TECHNOLOGY.
          </p>
        </div>
      </footer>
    </>
  );
}