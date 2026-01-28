import { motion } from 'framer-motion';

export const Rocket = ({ className }: { className?: string }) => {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className={className}
      initial={{ y: 0 }}
      animate={{ y: [-10, 10, -10] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Rocket Body */}
      <path
        d="M100 20 L140 140 H60 L100 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-foreground"
      />
      {/* Fins */}
      <path
        d="M60 140 L40 170 H70 L60 140"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-foreground"
      />
      <path
        d="M140 140 L160 170 H130 L140 140"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-foreground"
      />
      {/* Window */}
      <circle
        cx="100"
        cy="80"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-foreground"
      />
      {/* Circuit lines (simple) */}
      <path
        d="M100 95 V120 M100 120 L80 130 M100 120 L120 130"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        className="text-muted-foreground"
      />
      <circle cx="80" cy="130" r="2" fill="currentColor" className="text-muted-foreground" />
      <circle cx="120" cy="130" r="2" fill="currentColor" className="text-muted-foreground" />
      
      {/* Stick Figure */}
      <path
        d="M100 60 L110 50 M100 60 L90 50 M100 60 V75 M100 75 L110 85 M100 75 L90 85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        className="text-foreground"
      />
      <circle cx="100" cy="45" r="5" stroke="currentColor" strokeWidth="2" fill="none" className="text-foreground" />
      
      {/* Exhaust/Thrust Lines */}
      <motion.path
        d="M70 140 L60 180 M100 140 L100 190 M130 140 L140 180"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ opacity: [0.5, 1, 0.5], pathLength: [0.8, 1, 0.8] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="text-orange-500"
      />
    </motion.svg>
  );
};
