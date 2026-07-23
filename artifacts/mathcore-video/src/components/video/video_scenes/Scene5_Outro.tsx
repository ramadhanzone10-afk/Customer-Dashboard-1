import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene5_Outro = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-light flex flex-col items-center justify-center text-center px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          className="mb-8"
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/ChatGPT_Image_Jul_18,_2026,_06_36_36_AM_1784331431257.png`}
            alt="Math Core Logo"
            className="w-32 h-32 object-contain rounded-2xl shadow-xl shadow-primary/20"
          />
        </motion.div>

        <div className="overflow-hidden mb-8">
          <motion.h2
            className="text-display text-6xl font-bold text-text-primary leading-tight max-w-[80vw]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.33, 1, 0.68, 1] }}
          >
            Belajar matematika jadi<br/>lebih menyenangkan.
          </motion.h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mt-4"
        >
          <div className="px-10 py-4 bg-primary text-white rounded-full text-2xl font-bold shadow-2xl shadow-primary/30 transform hover:scale-105 transition-transform">
            Daftar Sekarang
          </div>
          <p className="mt-4 text-text-secondary font-medium text-lg">
            mathcore.id
          </p>
        </motion.div>
      </div>

      {/* Decorative bursts */}
      {phase >= 1 && (
        <>
          <motion.div
            className="absolute top-[20%] left-[20%] w-4 h-4 rounded-full bg-accent"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [0, 2, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 1 }}
          />
          <motion.div
            className="absolute top-[30%] right-[25%] w-6 h-6 rounded-full bg-success"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [0, 1.5, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 1, delay: 0.2 }}
          />
          <motion.div
            className="absolute bottom-[25%] left-[30%] w-5 h-5 rounded-full bg-primary"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [0, 2, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 1, delay: 0.4 }}
          />
        </>
      )}
    </motion.div>
  );
};
