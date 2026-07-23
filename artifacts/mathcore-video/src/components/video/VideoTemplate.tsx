import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0_Intro } from './video_scenes/Scene0_Intro';
import { Scene1_Problem } from './video_scenes/Scene1_Problem';
import { Scene2_Teacher } from './video_scenes/Scene2_Teacher';
import { Scene3_Student } from './video_scenes/Scene3_Student';
import { Scene4_Pricing } from './video_scenes/Scene4_Pricing';
import { Scene5_Outro } from './video_scenes/Scene5_Outro';

const SCENE_DURATIONS = {
  0: 5000, // Intro
  1: 6000, // Problem
  2: 7000, // Teacher
  3: 7000, // Student
  4: 5000, // Pricing
  5: 6000, // Outro
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      {/* Persistent Background Layer */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-20"
        animate={{
          background: currentScene % 2 === 0 
            ? 'radial-gradient(circle at 0% 0%, var(--color-primary-light) 0%, transparent 50%), radial-gradient(circle at 100% 100%, var(--color-accent) 0%, transparent 50%)'
            : 'radial-gradient(circle at 100% 0%, var(--color-primary-light) 0%, transparent 50%), radial-gradient(circle at 0% 100%, var(--color-accent) 0%, transparent 50%)'
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
      />
      
      {/* Noise overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      />

      {/* Floating abstract elements (persists across scenes) */}
      <motion.div
        className="absolute rounded-full pointer-events-none blur-3xl opacity-30 mix-blend-multiply"
        animate={{
          width: currentScene === 0 ? '40vw' : currentScene === 5 ? '50vw' : '20vw',
          height: currentScene === 0 ? '40vw' : currentScene === 5 ? '50vw' : '20vw',
          x: currentScene === 1 ? '-20vw' : currentScene === 3 ? '20vw' : '0vw',
          y: currentScene === 2 ? '20vh' : currentScene === 4 ? '-20vh' : '0vh',
          backgroundColor: currentScene === 3 ? 'var(--color-success)' : 'var(--color-primary)'
        }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene0_Intro key="scene0" />}
        {currentScene === 1 && <Scene1_Problem key="scene1" />}
        {currentScene === 2 && <Scene2_Teacher key="scene2" />}
        {currentScene === 3 && <Scene3_Student key="scene3" />}
        {currentScene === 4 && <Scene4_Pricing key="scene4" />}
        {currentScene === 5 && <Scene5_Outro key="scene5" />}
      </AnimatePresence>
    </div>
  );
}
