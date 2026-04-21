import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

interface TutorialStep {
  title: string;
  description: string;
  target: string; // CSS selector or identifier
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialOverlayProps {
  onComplete: () => void;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Welcome to All Here',
    description: 'This is your home screen. Let us guide you through each section to help you start your journey to mental wellness and a silent mind.',
    target: 'center',
    position: 'center',
  },
  {
    title: 'Begin',
    description: 'Start here to understand what you can find on this app. Learn about the mission, philosophy, and how to dive into the practice.',
    target: 'begin',
    position: 'bottom',
  },
  {
    title: 'Learn',
    description: 'Access structured learning content with videos and guided audio practices. Progress through the three parts of our Silent Mind programme.',
    target: 'learn',
    position: 'bottom',
  },
  {
    title: 'Train',
    description: 'Put your learning into practice. Connect your QMS device or configure a custom training program with personalized duration and ambient sounds.',
    target: 'train',
    position: 'bottom',
  },
  {
    title: 'Access',
    description: 'This section will provide additional resources and tools to support your journey. Coming soon.',
    target: 'access',
    position: 'bottom',
  },
  {
    title: 'Connect',
    description: 'Join our community and track your progress alongside others on the same journey. Coming soon.',
    target: 'connect',
    position: 'bottom',
  },
  {
    title: 'About All Here',
    description: 'Learn more about our mission, read the latest news, and discover how All Here contributes to promote meditation around the world.',
    target: 'contact',
    position: 'bottom',
  },
];

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<DOMRect | null>(null);



  useEffect(() => {
    const step = tutorialSteps[currentStep];
    if (step.target !== 'center') {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const element = document.querySelector(`[data-tutorial-id="${step.target}"]`);
        if (element) {
          // Scroll element into view if not fully visible
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
          });
          
          // Wait for scroll to complete before getting position
          setTimeout(() => {
            const rect = element.getBoundingClientRect();
            setHighlightedElement(rect);
          }, 300);
        } else {
          console.warn(`Tutorial: Element not found for target "${step.target}"`);
          setHighlightedElement(null);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    } else {
      setHighlightedElement(null);
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Scroll to top before completing
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onComplete();
    }
  };

  const handleSkip = () => {
    // Scroll to top before completing
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete();
  };

  const step = tutorialSteps[currentStep];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200]">
        {/* Dark overlay using 4 divs to create a cutout */}
        {highlightedElement ? (
          <>
            {/* Top overlay */}
            <div 
              onClick={handleSkip}
              className="absolute left-0 right-0 top-0 bg-black/50 cursor-pointer"
              style={{ height: highlightedElement.y - 8 }}
            />
            {/* Right overlay */}
            <div 
              onClick={handleSkip}
              className="absolute top-0 bottom-0 bg-black/50 cursor-pointer"
              style={{ 
                left: highlightedElement.x + highlightedElement.width + 8,
                right: 0 
              }}
            />
            {/* Bottom overlay */}
            <div 
              onClick={handleSkip}
              className="absolute left-0 right-0 bottom-0 bg-black/50 cursor-pointer"
              style={{ top: highlightedElement.y + highlightedElement.height + 8 }}
            />
            {/* Left overlay */}
            <div 
              onClick={handleSkip}
              className="absolute top-0 bottom-0 left-0 bg-black/50 cursor-pointer"
              style={{ width: highlightedElement.x - 8 }}
            />
          </>
        ) : (
          <div onClick={handleSkip} className="absolute inset-0 bg-black/50 cursor-pointer" />
        )}

        {/* Highlighted border around element */}
        {highlightedElement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute pointer-events-none border-4 border-blue-400 rounded-3xl shadow-lg shadow-blue-400/50 z-[202]"
            style={{
              left: highlightedElement.x - 8,
              top: highlightedElement.y - 8,
              width: highlightedElement.width + 16,
              height: highlightedElement.height + 16,
            }}
          />
        )}

        {/* Skip button */}
        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="absolute top-6 right-6 text-slate-300 hover:text-white hover:bg-white/10 z-[203]"
        >
          <X className="h-4 w-4 mr-2" />
          Skip Tutorial
        </Button>

        {/* Tutorial content */}
        <div 
          className={`absolute left-0 right-0 flex justify-center p-6 pointer-events-none z-[203] ${
            highlightedElement && typeof window !== 'undefined' && highlightedElement.y > window.innerHeight / 2
              ? 'top-24'
              : 'bottom-24'
          }`}
        >
          <motion.div
            key={currentStep}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-lg w-full bg-[#0A1633] border-2 border-blue-500/50 rounded-2xl p-8 shadow-2xl relative pointer-events-auto"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-blue-300">{step.title}</h2>
                  <span className="text-sm text-blue-400/60">
                    {currentStep + 1} / {tutorialSteps.length}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{step.description}</p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-1">
                  {tutorialSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        index === currentStep
                          ? 'w-8 bg-blue-400'
                          : index < currentStep
                          ? 'w-1.5 bg-blue-600'
                          : 'w-1.5 bg-blue-900/40'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNext}
                  className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border-2 border-blue-500/50 hover:border-blue-400 transition-all"
                >
                  {currentStep < tutorialSteps.length - 1 ? (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
