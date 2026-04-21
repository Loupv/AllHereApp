import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import logo from 'figma:asset/2fc785cd03fb98f8b8508ec23b204a997c2ecb12.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Wait for animation to complete before hiding splash screen
    const timer = setTimeout(() => {
      setShow(false);
    }, 2500); // Total duration: 2.5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#0A1633] via-[#0A1128] to-[#060B1F]"
        >
          {/* Animated background circles */}
          <motion.div
            initial={{ scale: 0, opacity: 0.3 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute w-96 h-96 rounded-full bg-blue-500/20 blur-3xl z-10"
          />
          <motion.div
            initial={{ scale: 0, opacity: 0.2 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 2, delay: 0.2, ease: 'easeOut' }}
            className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl z-10"
          />

          {/* Logo container */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1], // Custom easing for smooth spring effect
            }}
            className="relative z-20"
          >
            {/* Glow effect behind logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0.4] }}
              transition={{
                duration: 2,
                times: [0, 0.5, 1],
                ease: 'easeInOut',
              }}
              className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-blue-400/30 via-cyan-400/20 to-transparent blur-2xl"
            />

            {/* Logo */}
            <motion.img
              src={logo}
              alt="All Here"
              className="h-16 w-auto relative z-10"
              initial={{ filter: 'brightness(0.8)' }}
              animate={{ filter: 'brightness(1)' }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </motion.div>

          {/* Subtitle fade in and out */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10] }}
            transition={{
              duration: 2.5,
              times: [0, 0.3, 0.7, 1],
              ease: 'easeInOut',
            }}
            className="absolute bottom-1/3 text-center z-20 px-6"
          >
            <p className="text-slate-400 tracking-widest text-sm uppercase">
              Where meditation meets<br />science and technology
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
