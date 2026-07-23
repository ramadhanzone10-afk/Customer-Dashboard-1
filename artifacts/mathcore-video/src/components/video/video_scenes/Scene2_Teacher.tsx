import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene2_Teacher = () => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 2400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-dark flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-100%' }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ scale: 1.1, x: 50 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ duration: 7, ease: 'easeOut' }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/dashboard-glow.jpg`}
          alt="Dashboard Glow"
          className="w-full h-full object-cover opacity-30 mix-blend-lighten"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-dark via-bg-dark/90 to-transparent" />
      </motion.div>

      <div className="relative z-10 max-w-[40vw]">
        <motion.div
          className="inline-block px-4 py-1 bg-primary/20 text-primary-light font-bold rounded-full mb-6 border border-primary/50 text-xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Teacher Dashboard
        </motion.div>
        
        <motion.h2
          className="text-display text-5xl font-bold text-white mb-6 leading-tight"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Kelola kelas, materi, dan ujian dengan mudah.
        </motion.h2>

        <ul className="space-y-4">
          {['Manajemen Siswa', 'Upload Materi', 'Buat Ujian & Nilai'].map((item, i) => (
            <motion.li
              key={item}
              className="flex items-center text-2xl text-text-muted"
              initial={{ x: -20, opacity: 0 }}
              animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center mr-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              </div>
              {item}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 w-[45vw] h-[60vh]">
        {/* Mockup UI Window */}
        <motion.div
          className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          initial={{ y: 100, rotateY: -15, opacity: 0, perspective: 1000 }}
          animate={{ y: 0, rotateY: -5, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.6, type: 'spring' }}
        >
          {/* Header */}
          <div className="h-12 border-b border-white/10 flex items-center px-6 gap-3">
            <div className="w-3 h-3 rounded-full bg-error/80" />
            <div className="w-3 h-3 rounded-full bg-warning/80" />
            <div className="w-3 h-3 rounded-full bg-success/80" />
          </div>
          
          <div className="flex-1 p-8 flex flex-col gap-6">
            <div className="flex gap-4">
              <motion.div 
                className="w-1/3 h-24 bg-primary/20 rounded-xl border border-primary/30"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', delay: 0 }}
              />
              <motion.div 
                className="w-1/3 h-24 bg-accent/20 rounded-xl border border-accent/30"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', delay: 0.1 }}
              />
              <motion.div 
                className="w-1/3 h-24 bg-success/20 rounded-xl border border-success/30"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
              />
            </div>
            
            <motion.div 
              className="flex-1 bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-4"
              initial={{ y: 20, opacity: 0 }}
              animate={phase >= 3 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-3/4 h-6 bg-white/20 rounded-md" />
              <div className="w-full h-4 bg-white/10 rounded-md" />
              <div className="w-5/6 h-4 bg-white/10 rounded-md" />
              <div className="w-full h-4 bg-white/10 rounded-md" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
