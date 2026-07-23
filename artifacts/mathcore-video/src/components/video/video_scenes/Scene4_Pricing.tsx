import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene4_Pricing = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-primary flex flex-col items-center justify-center text-center px-12"
      initial={{ clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)' }}
      animate={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
      exit={{ scale: 1.1, opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background Graphic */}
      <motion.div 
        className="absolute inset-0 z-0 opacity-10"
        initial={{ rotate: -10, scale: 1.5 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 10, ease: 'linear' }}
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <motion.p
          className="text-2xl font-bold text-accent uppercase tracking-widest mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Investasi Masa Depan
        </motion.p>
        
        <div className="flex items-start justify-center text-white mb-8">
          <motion.span 
            className="text-4xl font-bold mt-2 mr-2"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring' }}
          >
            Rp
          </motion.span>
          <motion.span 
            className="text-display text-9xl font-extrabold tracking-tighter"
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
          >
            60.000
          </motion.span>
          <motion.span 
            className="text-4xl font-bold mt-auto mb-4 ml-4 text-white/70"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            /bulan
          </motion.span>
        </div>

        <motion.div
          className="flex gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          {['Semua Materi', 'Ujian Interaktif', 'Bebas Akses'].map((feature, i) => (
            <div key={feature} className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium">
              {feature}
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};
