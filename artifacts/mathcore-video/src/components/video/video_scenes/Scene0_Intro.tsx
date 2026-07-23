import { motion } from 'framer-motion';

export const Scene0_Intro = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-light"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
          className="relative"
        >
          {/* Logo backdrop glow */}
          <motion.div 
            className="absolute inset-0 rounded-full bg-primary opacity-20 blur-2xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <img 
            src={`${import.meta.env.BASE_URL}images/ChatGPT_Image_Jul_18,_2026,_06_36_36_AM_1784331431257.png`} 
            alt="Math Core Logo" 
            className="w-48 h-48 object-contain relative z-10 rounded-3xl shadow-2xl shadow-primary/20"
          />
        </motion.div>

        <motion.div className="mt-8 text-center overflow-hidden">
          <motion.h1
            className="text-display text-6xl font-bold text-text-primary tracking-tight"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.33, 1, 0.68, 1] }}
          >
            Math Core
          </motion.h1>
        </motion.div>

        <motion.div className="mt-4 overflow-hidden">
          <motion.p
            className="text-2xl text-primary font-medium tracking-wide uppercase"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0, ease: 'easeOut' }}
          >
            Bimbel Online Modern
          </motion.p>
        </motion.div>
      </div>

      {/* Decorative floating elements */}
      <motion.div
        className="absolute w-[30vw] h-[30vw] border-[1px] border-primary/10 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute w-[50vw] h-[50vw] border-[1px] border-accent/10 rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.7, ease: 'easeOut' }}
      />
    </motion.div>
  );
};
