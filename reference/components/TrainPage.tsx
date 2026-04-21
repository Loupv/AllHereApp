import { ArrowLeft, Bluetooth, Loader2, Dumbbell, Music, Timer, Repeat, Play, Volume2, Trees, Waves, CloudRain, Wind, Droplets, Bird, CloudLightning, VolumeX, RotateCcw, Volume1, Trophy, History, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { useState, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { motion } from 'motion/react';
import type { TrainingSession } from './HistoryPage';

interface TrainPageProps {
  onBack: () => void;
  onNavigateToLeaderboard?: () => void;
  onNavigateToHistory?: () => void;
}

type TrainMode = 'select' | 'device' | 'program';

const ambientSounds = [
  { id: 'forest', name: 'Forest', Icon: Trees },
  { id: 'ocean', name: 'Ocean Waves', Icon: Waves },
  { id: 'rain', name: 'Rain', Icon: CloudRain },
  { id: 'wind', name: 'Wind', Icon: Wind },
  { id: 'river', name: 'River Stream', Icon: Droplets },
  { id: 'birds', name: 'Bird Songs', Icon: Bird },
  { id: 'thunder', name: 'Thunder Storm', Icon: CloudLightning },
  { id: 'silence', name: 'Silence', Icon: Moon },
];

// Circular Timer Component
function CircularTimer({ timeRemaining, totalTime, hideText = false }: { timeRemaining: number; totalTime: number; hideText?: boolean }) {
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? (timeRemaining / totalTime) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 240 240">
        {/* Background circle */}
        <circle
          cx="120"
          cy="120"
          r={radius}
          stroke="rgba(16, 185, 129, 0.1)"
          strokeWidth="12"
          fill="none"
        />
        {/* Progress circle */}
        <motion.circle
          cx="120"
          cy="120"
          r={radius}
          stroke="url(#gradient)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "linear" }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
      {!hideText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl tracking-wider bg-gradient-to-br from-emerald-200 to-teal-200 bg-clip-text text-transparent">
              {formatTimeDisplay(timeRemaining)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wave Animation Component
function WaveAnimation() {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-emerald-400 rounded-full"
          animate={{
            height: ["8px", "20px", "8px"],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Helper function to format time
function formatTimeDisplay(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TrainPage({ onBack, onNavigateToLeaderboard, onNavigateToHistory }: TrainPageProps) {
  const [mode, setMode] = useState<TrainMode>('select');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);

  // Training program state
  const [duration, setDuration] = useState([5]); // minutes
  const [repetitions, setRepetitions] = useState([10]);
  const [selectedSound, setSelectedSound] = useState('forest');
  const [isProgramReady, setIsProgramReady] = useState(false); // Program configured, ready to play
  const [isProgramRunning, setIsProgramRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [repsRemaining, setRepsRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0); // for circular progress
  const [completedReps, setCompletedReps] = useState(0);

  const connectBluetooth = async () => {
    try {
      setIsScanning(true);
      
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        toast.error('Bluetooth is not supported on this device or browser');
        setIsScanning(false);
        return;
      }

      // Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Mobile QMS' }],
        optionalServices: ['battery_service'] // Add services as needed
      });

      // Connect to the device
      const server = await device.gatt?.connect();
      
      if (server) {
        setDevice(device);
        setIsConnected(true);
        toast.success('Successfully connected to Mobile QMS');
      }
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          toast.error('Mobile QMS device not found. Please make sure it is turned on and in pairing mode.');
        } else if (error.name === 'NotAllowedError') {
          toast.error('Bluetooth access was denied');
        } else {
          toast.error(`Connection failed: ${error.message}`);
        }
      }
    } finally {
      setIsScanning(false);
    }
  };

  const disconnectBluetooth = () => {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
      setDevice(null);
      setIsConnected(false);
      toast.info('Disconnected from Mobile QMS');
    }
  };

  const startProgram = () => {
    const totalSeconds = duration[0] * 60;
    setIsProgramReady(true);
    setTimeRemaining(totalSeconds);
    setTotalTime(totalSeconds);
    setRepsRemaining(repetitions[0]);
    setCompletedReps(0);
    setShowSummary(false);
  };

  const playProgram = () => {
    setIsProgramRunning(true);
    toast.success(`Training session started!`);
  };

  const stopProgram = () => {
    setIsProgramRunning(false);
    setIsProgramReady(false);
    setTimeRemaining(0);
    setRepsRemaining(0);
    setTotalTime(0);
    toast.info('Training program stopped');
  };

  const restartRepetition = () => {
    setTimeRemaining(totalTime);
    toast.info('Repetition restarted');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast.info(isMuted ? 'Sound unmuted' : 'Sound muted');
  };

  const saveSessionToHistory = (completed: number, total: number) => {
    const soundName = ambientSounds.find(s => s.id === selectedSound)?.name || 'Silence';
    const session: TrainingSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      duration: duration[0],
      repetitions: total,
      sound: selectedSound,
      soundName: soundName,
      completedReps: completed,
    };

    // Get existing sessions
    const stored = localStorage.getItem('trainingHistory');
    const existingSessions: TrainingSession[] = stored ? JSON.parse(stored) : [];
    
    // Add new session at the beginning
    const updatedSessions = [session, ...existingSessions];
    
    // Save to localStorage
    localStorage.setItem('trainingHistory', JSON.stringify(updatedSessions));
  };

  // Timer countdown effect
  useEffect(() => {
    if (!isProgramRunning || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsProgramRunning(false);
          const completed = repetitions[0];
          setCompletedReps(completed);
          setShowSummary(true);
          
          // Save session to history
          saveSessionToHistory(completed, repetitions[0]);
          
          toast.success('Training session completed! Great work!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isProgramRunning, timeRemaining, repetitions, duration, selectedSound]);



  // Selection screen
  if (mode === 'select') {
    return (
      <>
        <Header />
        <div className="h-full w-full bg-[#000D22] overflow-y-auto pt-[88px]">
          {/* Hero Image Section */}
          <div className="relative h-72 w-full overflow-hidden">
            <motion.div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url('https://images.unsplash.com/photo-1669291480580-91b09ac96d2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3Jlc3QlMjBtb3VudGFpbiUyMG5hdHVyZXxlbnwxfHx8fDE3NjE4MzM0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080')`
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
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-teal-900/50 to-slate-800/60" />
            {/* Progressive gradient overlay for readability */}
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#000D22] via-[#000D22]/70 via-[#000D22]/40 to-transparent" />
          </div>

          <div className="w-full max-w-4xl mx-auto p-6 -mt-64 relative z-10">
            {/* Top bar with Back button */}
            <div className="mb-8 flex items-start justify-between">
              <BackButton onClick={onBack} color="emerald" />
            </div>

            {/* Centered buttons - Mobile QMS, Leaderboard and History */}
            <div className="flex justify-center items-start gap-8 mb-6">
              {/* Mobile QMS Button with label */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setMode('device')}
                  className="cursor-pointer group"
                >
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cyan-900/40 via-cyan-800/30 to-teal-900/40 border-2 border-cyan-500/30 group-hover:border-cyan-400/50 shadow-lg flex flex-col items-center justify-center transition-all duration-300">
                    <Bluetooth className="h-5 w-5 text-cyan-400" />
                  </div>
                </motion.div>
                <span className="text-xs text-cyan-300/80 text-center">Connect your<br/>Mobile QMS</span>
              </div>

              {/* Leaderboard Button with label */}
              {onNavigateToLeaderboard && (
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    onClick={onNavigateToLeaderboard}
                    className="cursor-pointer group"
                  >
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-900/40 via-emerald-800/30 to-teal-900/40 border-2 border-emerald-500/30 group-hover:border-emerald-400/50 shadow-lg flex flex-col items-center justify-center transition-all duration-300">
                      <Trophy className="h-5 w-5 text-emerald-400" />
                    </div>
                  </motion.div>
                  <span className="text-xs text-emerald-300/80 text-center">View<br/>Leaderboard</span>
                </div>
              )}

              {/* History Button with label */}
              {onNavigateToHistory && (
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    onClick={onNavigateToHistory}
                    className="cursor-pointer group"
                  >
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-teal-900/40 via-emerald-800/30 to-teal-900/40 border-2 border-teal-500/30 group-hover:border-teal-400/50 shadow-lg flex flex-col items-center justify-center transition-all duration-300">
                      <History className="h-5 w-5 text-teal-400" />
                    </div>
                  </motion.div>
                  <span className="text-xs text-teal-300/80 text-center">Training<br/>History</span>
                </div>
              )}
            </div>
            
            <div className="text-center mb-8">
              <h1 className="text-emerald-300 mb-2 drop-shadow-lg">Train</h1>
            </div>

            {/* Training Options */}
            <div className="space-y-8">
              {/* Digital Training */}
              <div>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Quick Start - Minimalist */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    setDuration([3]);
                    setRepetitions([5]);
                    setSelectedSound('silence');
                    setMode('program');
                    // Prepare program with Quick Start parameters
                    const totalSeconds = 3 * 60;
                    setIsProgramReady(true);
                    setTimeRemaining(totalSeconds);
                    setTotalTime(totalSeconds);
                    setRepsRemaining(5);
                    setCompletedReps(0);
                    setShowSummary(false);
                  }}
                  className="cursor-pointer group"
                >
                  <div className="relative overflow-hidden rounded-3xl p-6 h-full bg-[#0A1633] border-2 border-emerald-500/30 shadow-xl group-hover:border-emerald-500/50 transition-all duration-300">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="bg-emerald-900/30 p-4 rounded-2xl border border-emerald-500/30">
                        <Play className="h-8 w-8 text-emerald-400" />
                      </div>
                      
                      <div>
                        <h3 className="text-slate-200 mb-2">Quick Start</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-2">
                          Begin immediately with preset parameters
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/70">
                          <span>3 min</span>
                          <span>·</span>
                          <span>5 rounds</span>
                          <span>·</span>
                          <span>Silence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Custom Program Card */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    setMode('program');
                    startProgram();
                  }}
                  className="cursor-pointer group"
                >
                  <div className="relative overflow-hidden rounded-3xl p-8 h-full bg-[#0A1633] border-2 border-emerald-500/30 shadow-xl group-hover:border-emerald-500/50 transition-all duration-300">
                    
                    <div className="flex flex-col items-center text-center space-y-6">
                      <div className="bg-emerald-900/30 p-6 rounded-2xl border border-emerald-500/30">
                        <Dumbbell className="h-12 w-12 text-emerald-400" />
                      </div>
                      
                      <div>
                        <h3 className="text-slate-200 mb-2">Custom Program</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          Configure your own training session with personalized duration, repetitions, and ambient sounds
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Device connection screen
  if (mode === 'device') {
    return (
      <>
        <Header />
        <div className="h-full w-full bg-[#000D22] p-6 overflow-y-auto pt-24">
          <div className="text-center space-y-8 max-w-md mx-auto">
            <div className="text-left">
              <BackButton onClick={() => setMode('select')} color="emerald" />
            </div>
            
            <div className={`${isConnected ? 'bg-green-950/40 border-green-500/40' : 'bg-emerald-950/40 border-emerald-500/40'} p-8 rounded-full w-32 h-32 flex items-center justify-center mx-auto transition-all border-2`}>
              <Bluetooth className={`h-16 w-16 ${isConnected ? 'text-green-400' : 'text-emerald-400'}`} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-slate-300">Connect Device</h1>
              <p className={`${isConnected ? 'text-green-300' : 'text-slate-400'}`}>
                {isConnected ? 'Device Connected' : 'Connect Your Device'}
              </p>
            </div>
            
            {!isConnected ? (
              <>
                <p className="text-slate-400">
                  Connect your Mobile QMS device to start your training session. Make sure your device is turned on and in pairing mode.
                </p>
                
                <Button
                  onClick={connectBluetooth}
                  disabled={isScanning}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-slate-300 border-2 border-emerald-500/40 hover:border-emerald-500/60 transition-all disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Bluetooth className="mr-2 h-4 w-4" />
                      Connect Mobile QMS
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <p className="text-green-400/70">
                  Your Mobile QMS device is now connected and ready for training.
                </p>
                
                <div className="space-y-3">
                  <Button
                    onClick={disconnectBluetooth}
                    className="bg-red-900/30 hover:bg-red-800/40 text-red-300 border-2 border-red-500/30 hover:border-red-500/50 transition-all w-full"
                  >
                    Disconnect Device
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // Summary screen after completion
  if (showSummary) {
    return (
      <>
        <Header />
        <div className="h-full w-full bg-[#000D22] p-6 overflow-y-auto pt-24">
          <div className="w-full max-w-2xl mx-auto">
            <div className="text-left">
              <BackButton onClick={() => setMode('select')} color="emerald" />
            </div>
            
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <div className="bg-emerald-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-500/40">
                  <Play className="h-12 w-12 text-emerald-300" />
                </div>
              </motion.div>
              <h1 className="text-slate-300 mb-2">Training Complete</h1>
              <p className="text-slate-400">Great work on your session</p>
            </div>

            <div className="bg-[#0A1633] border-2 border-emerald-500/30 rounded-3xl p-8 shadow-xl space-y-6">
              <h2 className="text-slate-300 text-center mb-6">Session Summary</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-emerald-950/40 rounded-2xl p-6 border-2 border-emerald-500/30 text-center">
                  <Timer className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                  <p className="text-3xl text-slate-300 mb-1">{duration[0]}</p>
                  <p className="text-slate-500 text-sm">{duration[0] === 1 ? 'Minute' : 'Minutes'}</p>
                </div>

                <div className="bg-emerald-950/40 rounded-2xl p-6 border-2 border-emerald-500/30 text-center">
                  <Repeat className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                  <p className="text-3xl text-slate-300 mb-1">{completedReps}</p>
                  <p className="text-slate-500 text-sm">{completedReps === 1 ? 'Repetition' : 'Repetitions'}</p>
                </div>
              </div>

              <div className="bg-emerald-950/40 rounded-2xl p-6 border-2 border-emerald-500/30">
                <div className="flex items-center justify-center gap-3 text-slate-300">
                  <Music className="h-5 w-5" />
                  <span className="flex items-center gap-2">
                    {(() => {
                      const sound = ambientSounds.find(s => s.id === selectedSound);
                      return sound ? (
                        <>
                          <sound.Icon className="h-5 w-5" />
                          {sound.name}
                        </>
                      ) : null;
                    })()}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => {
                    setShowSummary(false);
                    setIsProgramRunning(false);
                    setIsProgramReady(false);
                  }}
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-slate-300 border-2 border-emerald-500/40 hover:border-emerald-500/60 transition-all"
                >
                  Start New Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }



  // Training program setup screen
  return (
    <>
      <Header />
      <div className="h-full w-full bg-[#000D22] p-6 overflow-y-auto pt-24">
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-left">
            <BackButton 
              onClick={() => {
                if (isProgramReady) {
                  // Stop program and return to configuration
                  setIsProgramRunning(false);
                  setIsProgramReady(false);
                  setTimeRemaining(0);
                  setRepsRemaining(0);
                  setTotalTime(0);
                } else {
                  setMode('select');
                }
              }} 
              color="emerald" 
            />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-slate-300 mb-2">Training Program</h1>
            <p className="text-slate-400">
              {isProgramReady ? 'Session in Progress' : 'Customize Your Session'}
            </p>
          </div>

          <div className="bg-[#0A1633] border-2 border-emerald-500/30 rounded-3xl p-8 shadow-xl space-y-8">
            
            {!isProgramReady ? (
              <>
                {/* Duration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Timer className="h-5 w-5 text-emerald-400" />
                    <label className="text-slate-300">Duration</label>
                  </div>
                  <div className="space-y-2">
                    <Slider
                      value={duration}
                      onValueChange={setDuration}
                      min={1}
                      max={20}
                      step={1}
                      className="w-full [&_[data-slot=slider-track]]:bg-emerald-900/40 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:bg-emerald-400 [&_[data-slot=slider-thumb]]:border-emerald-300 [&_[data-slot=slider-thumb]]:ring-emerald-500/30"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>1 min</span>
                      <span className="text-slate-300">{duration[0]} {duration[0] === 1 ? 'minute' : 'minutes'}</span>
                      <span>20 min</span>
                    </div>
                  </div>
                </div>

                {/* Repetitions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-5 w-5 text-emerald-400" />
                    <label className="text-slate-300">Repetitions</label>
                  </div>
                  <div className="space-y-2">
                    <Slider
                      value={repetitions}
                      onValueChange={setRepetitions}
                      min={1}
                      max={20}
                      step={1}
                      className="w-full [&_[data-slot=slider-track]]:bg-emerald-900/40 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:bg-emerald-400 [&_[data-slot=slider-thumb]]:border-emerald-300 [&_[data-slot=slider-thumb]]:ring-emerald-500/30"
                    />
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>1 rep</span>
                      <span className="text-slate-300">{repetitions[0]} {repetitions[0] === 1 ? 'repetition' : 'repetitions'}</span>
                      <span>20 reps</span>
                    </div>
                  </div>
                </div>

                {/* Ambient Sound */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-5 w-5 text-emerald-400" />
                    <label className="text-slate-300">Ambient Sound</label>
                  </div>
                  <Select value={selectedSound} onValueChange={setSelectedSound}>
                    <SelectTrigger className="bg-emerald-950/40 border-2 border-emerald-500/30 text-slate-300 hover:border-emerald-500/50 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A1633] border-2 border-emerald-500/30">
                      {ambientSounds.map((sound) => (
                        <SelectItem 
                          key={sound.id} 
                          value={sound.id}
                          className="text-slate-300 focus:bg-emerald-950/60 focus:text-slate-200"
                        >
                          <span className="flex items-center gap-2">
                            <sound.Icon className="h-4 w-4" />
                            <span>{sound.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={startProgram}
                    className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-slate-300 border-2 border-emerald-500/40 hover:border-emerald-500/60 transition-all py-6"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Training Session
                  </Button>
                </motion.div>
              </>
            ) : (
              <>
                {/* Ready / Running program display */}
                <div className="text-center space-y-8">
                  {/* Circular Timer with Play Button overlay when not running */}
                  <div className="space-y-4">
                    <div className="relative w-64 h-64 mx-auto">
                      <CircularTimer timeRemaining={timeRemaining} totalTime={totalTime} hideText={!isProgramRunning} />
                      {/* Play button overlay when not running - just the triangle icon centered */}
                      {!isProgramRunning && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.button
                            onClick={playProgram}
                            className="flex items-center justify-center"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Play className="h-24 w-24 text-emerald-400 drop-shadow-2xl ml-2" fill="currentColor" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-500 text-base">
                      Time Remaining
                    </p>
                  </div>

                  {/* Reps and Duration Display */}
                  <div className="flex items-center justify-center gap-4 text-slate-500">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-5 w-5" />
                      <span>{repsRemaining} {repsRemaining === 1 ? 'rep' : 'reps'}</span>
                    </div>
                    <span className="text-slate-600">·</span>
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5" />
                      <span>{duration[0]} {duration[0] === 1 ? 'min' : 'min'} each</span>
                    </div>
                  </div>

                  {/* Ambient Sound Display with Wave Animation and Mute */}
                  <div className="flex items-center justify-center gap-3 text-slate-300">
                    {isProgramRunning && (
                      <Button
                        onClick={toggleMute}
                        variant="ghost"
                        size="icon"
                        className="hover:bg-emerald-500/10"
                      >
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume1 className="h-5 w-5" />}
                      </Button>
                    )}
                    <span className="text-lg flex items-center gap-2">
                      {(() => {
                        const sound = ambientSounds.find(s => s.id === selectedSound);
                        return sound ? (
                          <>
                            <sound.Icon className="h-5 w-5" />
                            {sound.name}
                          </>
                        ) : null;
                      })()}
                    </span>
                    {selectedSound !== 'silence' && !isMuted && isProgramRunning && <WaveAnimation />}
                  </div>

                  {/* Buttons */}
                  <div className="space-y-3 pt-4">
                    <Button
                      onClick={restartRepetition}
                      disabled={!isProgramRunning}
                      className="bg-emerald-900/30 hover:bg-emerald-800/40 text-slate-300 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all w-full disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restart Repetition
                    </Button>
                    <Button
                      onClick={stopProgram}
                      disabled={!isProgramRunning}
                      className="bg-red-900/30 hover:bg-red-800/40 text-red-300 border-2 border-red-500/30 hover:border-red-500/50 transition-all w-full disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Stop Session
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
