import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene1_Problem = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 2000), // Show "Tidak lagi."
      setTimeout(() => setPhase(2), 5000), // Exit phase
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-secondary overflow-hidden"
      initial={{ x: '100%' }}
      animate={{ x: '0%' }}
      exit={{ scale: 1.2, opacity: 0 }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background Image with Parallax and Blur */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'linear' }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/math-abstract.jpg`}
          alt="Abstract Math"
          className="w-full h-full object-cover opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/80 to-transparent" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <div className="overflow-hidden mb-6">
          <motion.h2
            className="text-display text-7xl font-bold text-white tracking-tight"
            initial={{ y: '100%', rotate: 2 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.33, 1, 0.68, 1] }}
          >
            Matematika Susah?
          </motion.h2>
        </div>

        <motion.div
          className="bg-accent text-white px-8 py-3 rounded-full shadow-xl"
          initial={{ scale: 0, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <p className="text-3xl font-bold uppercase tracking-widest text-display">
            Tidak Lagi.
          </p>
        </motion.div>
      </div>
      
      {/* Dynamic graphic accents */}
      <motion.div 
        className="absolute top-1/4 left-1/4 w-12 h-12 border-4 border-accent rounded-sm"
        initial={{ rotate: -45, scale: 0, opacity: 0 }}
        animate={{ rotate: 135, scale: 1, opacity: 0.8 }}
        transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
      />
      <motion.div 
        className="absolute bottom-1/4 right-1/4 w-16 h-16 rounded-full bg-primary-light"
        initial={{ y: 100, scale: 0, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.5, delay: 1.2, type: 'spring' }}
      />
    </motion.div>
  );
};
