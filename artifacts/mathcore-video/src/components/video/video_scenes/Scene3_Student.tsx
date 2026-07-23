import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Scene3_Student = () => {
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
      className="absolute inset-0 bg-bg-light flex items-center justify-between px-[10vw]"
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="relative z-10 w-[45vw] h-[60vh] flex items-center justify-center">
        {/* Mockup Mobile App/Student View */}
        <motion.div
          className="relative w-[300px] h-[600px] bg-white rounded-[40px] shadow-2xl border-[8px] border-slate-200 overflow-hidden flex flex-col"
          initial={{ y: 50, rotateZ: -10, opacity: 0 }}
          animate={{ y: 0, rotateZ: 5, opacity: 1 }}
          transition={{ duration: 1, delay: 0.4, type: 'spring' }}
        >
          {/* Header */}
          <div className="h-20 bg-primary flex items-end px-6 pb-4">
            <div className="w-1/2 h-6 bg-white/30 rounded-md" />
          </div>
          
          <div className="flex-1 p-6 flex flex-col gap-6 bg-slate-50">
            {/* Progress Card */}
            <motion.div 
              className="w-full h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-between"
              initial={{ x: -30, opacity: 0 }}
              animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: -30, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.4 }}
            >
              <div className="w-2/3 h-4 bg-slate-200 rounded-full" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-accent border-r-transparent rotate-45" />
                <div className="flex-1 space-y-2">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-accent rounded-full" />
                  </div>
                  <div className="w-1/2 h-3 bg-slate-200 rounded-full" />
                </div>
              </div>
            </motion.div>
            
            {/* Learning Modules */}
            <div className="space-y-4">
              {[1, 2, 3].map((item, i) => (
                <motion.div 
                  key={item}
                  className="w-full h-16 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center px-4 gap-4"
                  initial={{ y: 20, opacity: 0 }}
                  animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-sm bg-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="w-3/4 h-3 bg-slate-200 rounded-full" />
                    <div className="w-1/2 h-3 bg-slate-100 rounded-full" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Floating element for student scene */}
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/Logo_MathCourse_1777550046532.png`}
          className="absolute -right-10 -bottom-10 w-48 h-48 object-contain drop-shadow-2xl z-20"
          initial={{ scale: 0, rotate: 45 }}
          animate={phase >= 3 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: 45 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        />
      </div>

      <div className="relative z-10 max-w-[40vw] text-right">
        <motion.div
          className="inline-block px-4 py-1 bg-accent/20 text-accent-dark font-bold rounded-full mb-6 border border-accent/50 text-xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Student Dashboard
        </motion.div>
        
        <motion.h2
          className="text-display text-5xl font-bold text-text-primary mb-6 leading-tight"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Belajar lebih interaktif, pantau progres kapan saja.
        </motion.h2>

        <ul className="space-y-4 flex flex-col items-end">
          {['Akses Materi 24/7', 'Latihan Soal Interaktif', 'Progress Tracker'].map((item, i) => (
            <motion.li
              key={item}
              className="flex items-center justify-end text-2xl text-text-secondary"
              initial={{ x: 20, opacity: 0 }}
              animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 20, opacity: 0 }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
            >
              {item}
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center ml-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};
