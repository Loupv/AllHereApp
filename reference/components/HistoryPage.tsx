import { Header } from './Header';
import { BackButton } from './BackButton';
import { Clock, Calendar, Timer, Repeat, Music, Trash2, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';

interface HistoryPageProps {
  onBack: () => void;
}

export interface TrainingSession {
  id: string;
  date: string;
  duration: number; // in minutes
  repetitions: number;
  sound: string;
  soundName: string;
  completedReps?: number;
  qmScore?: number; // QM Score from device, undefined if no device connected
}

const ambientSoundNames: Record<string, string> = {
  forest: 'Forest',
  ocean: 'Ocean Waves',
  rain: 'Rain',
  wind: 'Wind',
  river: 'River Stream',
  birds: 'Bird Songs',
  thunder: 'Thunder Storm',
  silence: 'Silence',
};

// Mock data for demonstration
const mockSessions: TrainingSession[] = [
  {
    id: 'mock-1',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    duration: 10,
    repetitions: 15,
    sound: 'forest',
    soundName: 'Forest',
    completedReps: 15,
    qmScore: 87,
  },
  {
    id: 'mock-2',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    duration: 5,
    repetitions: 10,
    sound: 'ocean',
    soundName: 'Ocean Waves',
    completedReps: 10,
    qmScore: 92,
  },
  {
    id: 'mock-3',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    duration: 15,
    repetitions: 20,
    sound: 'rain',
    soundName: 'Rain',
    completedReps: 18,
    // No qmScore - device not connected
  },
  {
    id: 'mock-4',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    duration: 10,
    repetitions: 12,
    sound: 'silence',
    soundName: 'Silence',
    completedReps: 12,
    qmScore: 78,
  },
];

export function HistoryPage({ onBack }: HistoryPageProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);

  useEffect(() => {
    // Load sessions from localStorage
    const stored = localStorage.getItem('trainingHistory');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // If no real sessions, use mock data for demonstration
        setSessions(parsed.length > 0 ? parsed : mockSessions);
      } catch (error) {
        console.error('Error loading training history:', error);
        setSessions(mockSessions);
      }
    } else {
      // Use mock data if nothing in localStorage
      setSessions(mockSessions);
    }
  }, []);

  const deleteSession = (id: string) => {
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('trainingHistory', JSON.stringify(newSessions));
    toast.success('Session deleted');
  };

  const clearAllSessions = () => {
    setSessions([]);
    localStorage.removeItem('trainingHistory');
    toast.success('All sessions cleared');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      <Header />
      <div className="h-full w-full bg-[#000D22] overflow-y-auto pt-[88px]">
        <div className="w-full max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <div className="mb-8">
            <BackButton onClick={onBack} color="emerald" />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-emerald-300 mb-2 drop-shadow-lg">Training History</h1>
            <p className="text-emerald-200/70 drop-shadow-md">Review your past sessions</p>
          </div>

          {/* Clear All Button */}
          {sessions.length > 0 && (
            <div className="flex justify-end mb-4">
              <Button
                onClick={clearAllSessions}
                variant="outline"
                size="sm"
                className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 hover:border-red-500/60 bg-red-950/20"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Clear All
              </Button>
            </div>
          )}

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-10 w-10 text-emerald-400/50" />
              </div>
              <h3 className="text-emerald-300/70 mb-2">No training sessions yet</h3>
              <p className="text-emerald-400/50 text-sm">Your completed sessions will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {sessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative bg-gradient-to-br from-emerald-950/40 to-teal-950/30 border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-500/40 transition-all duration-300"
                  >
                    {/* Delete Button */}
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Date and Time */}
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-emerald-500/10">
                      <div className="flex items-center gap-2 text-emerald-300/90">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">{formatDate(session.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400/70">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{formatTime(session.date)}</span>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Duration */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Timer className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-400/60">Duration</p>
                          <p className="text-emerald-300">{session.duration} min</p>
                        </div>
                      </div>

                      {/* Repetitions */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                          <Repeat className="h-4 w-4 text-teal-400" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-400/60">Reps</p>
                          <p className="text-emerald-300">
                            {session.completedReps !== undefined 
                              ? `${session.completedReps}/${session.repetitions}`
                              : session.repetitions
                            }
                          </p>
                        </div>
                      </div>

                      {/* Sound */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <Music className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-400/60">Sound</p>
                          <p className="text-emerald-300 text-sm">{session.soundName}</p>
                        </div>
                      </div>

                      {/* QM Score */}
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          session.qmScore !== undefined 
                            ? 'bg-purple-500/10 border border-purple-500/20'
                            : 'bg-gray-500/10 border border-gray-500/20'
                        }`}>
                          <Activity className={`h-4 w-4 ${
                            session.qmScore !== undefined ? 'text-purple-400' : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <p className={`text-xs ${
                            session.qmScore !== undefined ? 'text-emerald-400/60' : 'text-gray-500/60'
                          }`}>QM Score</p>
                          <p className={session.qmScore !== undefined ? 'text-emerald-300' : 'text-gray-500'}>
                            {session.qmScore !== undefined ? session.qmScore : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
