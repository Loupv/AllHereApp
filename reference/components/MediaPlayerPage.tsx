import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Video, Headphones } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Header } from './Header';
import { BackButton } from './BackButton';

interface MediaPlayerPageProps {
  content: {
    id: string;
    title: string;
    type: 'video' | 'audio';
    duration: string;
    sectionName: string;
  };
  onBack: () => void;
  onComplete?: () => void;
}

export function MediaPlayerPage({ content, onBack, onComplete }: MediaPlayerPageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<'nature' | 'silence' | null>(null);
  
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const progressInterval = useRef<number | null>(null);

  // Check if this content has multiple versions
  const hasVersions = content.id === '1-3';

  // Parse duration string to seconds
  const parseDuration = (durationStr: string): number => {
    const match = durationStr.match(/(\d+)\s*min/);
    if (match) {
      return parseInt(match[1]) * 60;
    }
    return 0;
  };

  useEffect(() => {
    // Set initial duration from content
    const estimatedDuration = parseDuration(content.duration);
    setDuration(estimatedDuration);
  }, [content.duration]);

  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = window.setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= duration) {
            setIsPlaying(false);
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
            }
            // Mark as complete when finished
            if (onComplete) {
              onComplete();
            }
            return duration;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, duration, onComplete]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleProgressChange = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const Icon = content.type === 'video' ? Video : Headphones;

  // Version selection screen for content with multiple versions
  if (hasVersions && selectedVersion === null) {
    return (
      <>
        <Header />
        <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
          <div className="h-full w-full overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full p-6">
              <BackButton onClick={onBack} color="blue" />
              
              <div className="space-y-8">
                {/* Header Info */}
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-blue-400/70">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm uppercase tracking-wider">{content.sectionName}</span>
                  </div>
                  <h1 className="text-blue-200">{content.title}</h1>
                  <p className="text-blue-400">{content.duration}</p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-center text-blue-300">Choose Your Version</h2>
                  
                  <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 max-w-2xl mx-auto">
                    <p className="text-blue-300/80 text-sm leading-relaxed text-center">
                      For this stage, we encourage you to practice without ambient sounds in a place where you can listen to both natural sounds and the guidance. However, if such a location is not available to you, the version with nature sounds is perfectly suited for your practice.
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Nature Sounds Version */}
                    <button
                      onClick={() => setSelectedVersion('nature')}
                      className="group relative overflow-hidden rounded-2xl p-6 bg-[#0A1633] border-2 border-blue-500/30 hover:border-blue-500/50 transition-all duration-300"
                    >
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/30">
                          <Volume2 className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-slate-200 mb-2">With Nature Sounds</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Guided practice with ambient natural sounds
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Silence Version */}
                    <button
                      onClick={() => setSelectedVersion('silence')}
                      className="group relative overflow-hidden rounded-2xl p-6 bg-[#0A1633] border-2 border-blue-500/30 hover:border-blue-500/50 transition-all duration-300"
                    >
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/30">
                          <VolumeX className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-slate-200 mb-2">Silence</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            Guided practice without background sounds
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full p-6">
            <BackButton onClick={onBack} color="blue" />
            
            <div className="space-y-6">
              {/* Header Info */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-blue-400/70">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm uppercase tracking-wider">{content.sectionName}</span>
                </div>
                <h1 className="text-blue-200">{content.title}</h1>
                <p className="text-blue-400">{content.duration}</p>
                {hasVersions && selectedVersion && (
                  <p className="text-blue-400/70 text-sm">
                    {selectedVersion === 'nature' ? 'With Nature Sounds' : 'Silence Version'}
                  </p>
                )}
              </div>

              {/* Media Display Area */}
              <div className="relative bg-gradient-to-br from-blue-950/50 to-blue-900/30 rounded-lg border-2 border-blue-500/30 overflow-hidden">
                {content.type === 'video' ? (
                  <div className="aspect-video bg-black/50 flex items-center justify-center">
                    {/* Video placeholder - in real app, this would be a video element */}
                    <div className="text-center space-y-4">
                      <Video className="h-24 w-24 text-blue-400/30 mx-auto" />
                      <p className="text-blue-400/50 text-sm">Video content would play here</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-blue-950/70 to-blue-900/50 flex items-center justify-center">
                    {/* Audio visualization placeholder */}
                    <div className="text-center space-y-4 p-6">
                      <Headphones className="h-20 w-20 text-blue-400/40 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-blue-300 text-sm">Audio Meditation</p>
                        <p className="text-blue-400/70 text-xs">Close your eyes and listen</p>
                      </div>
                      {/* Fixed height container for waveform */}
                      <div className="h-12 flex items-center justify-center">
                        {isPlaying && (
                          <div className="flex items-end justify-center gap-2 h-full">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-blue-400 rounded-full animate-pulse"
                                style={{
                                  height: ['40%', '70%', '50%', '80%', '60%'][i],
                                  animationDelay: `${i * 0.1}s`,
                                  animationDuration: '0.8s'
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={1}
                  onValueChange={handleProgressChange}
                  className="w-full [&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-400 [&_[data-slot=slider-thumb]]:border-blue-300 [&_[data-slot=slider-thumb]]:ring-blue-500/30"
                />
                <div className="flex items-center justify-between text-sm text-blue-400/70">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                {/* Main Play/Pause Button */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={handleRestart}
                    className="bg-blue-900/30 hover:bg-blue-800/40 text-blue-300 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all h-12 w-12 p-0 rounded-full"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  
                  <Button
                    onClick={togglePlay}
                    className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border-2 border-blue-500/50 hover:border-blue-400 transition-all h-16 w-16 p-0 rounded-full"
                  >
                    {isPlaying ? (
                      <Pause className="h-8 w-8" />
                    ) : (
                      <Play className="h-8 w-8 ml-1" />
                    )}
                  </Button>
                  
                  <div className="w-12" /> {/* Spacer for symmetry */}
                </div>

                {/* Volume Control */}
                <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
                  <Button
                    onClick={toggleMute}
                    variant="ghost"
                    size="icon"
                    className="text-blue-400 hover:bg-blue-500/10"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="flex-1 [&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-400 [&_[data-slot=slider-thumb]]:border-blue-300 [&_[data-slot=slider-thumb]]:ring-blue-500/30"
                  />
                </div>
              </div>

              {/* Additional Info */}
              <div className="text-center pt-4">
                <p className="text-blue-400/60 text-sm">
                  {isPlaying 
                    ? 'Now playing...' 
                    : currentTime > 0 
                    ? 'Paused' 
                    : 'Press play to begin'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
