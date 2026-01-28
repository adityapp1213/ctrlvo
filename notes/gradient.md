import { useEffect, useRef } from 'react';

const GradientRocket = () => {
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dotsRef.current) {
        const dot = document.createElement('div');
        dot.className = 'gradient-dot';
        dot.style.top = `${Math.random() * 60 + 20}%`;
        dot.style.right = `${Math.random() * 15 + 5}%`;
        dot.style.animationDelay = `${Math.random() * 0.5}s`;
        dotsRef.current.appendChild(dot);
        
        setTimeout(() => {
          dot.remove();
        }, 2000);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="gradient-container">
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Main gradient blobs */}
      <div className="gradient-blob gradient-blob-1" />
      <div className="gradient-blob gradient-blob-2" />
      <div className="gradient-blob gradient-blob-3" />
      <div className="gradient-blob gradient-blob-4" />
      
      {/* Animated dots container */}
      <div ref={dotsRef} className="dots-container" />
      
      {/* Rocket SVG */}
      <svg 
        className="rocket-svg"
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Person on rocket */}
        <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Head */}
          <circle cx="120" cy="25" r="8" />
          {/* Arms raised */}
          <path d="M112 33 L100 15" />
          <path d="M128 33 L140 15" />
          {/* Body on rocket */}
          <path d="M120 33 L120 55" />
          {/* Legs */}
          <path d="M120 55 L110 70" />
          <path d="M120 55 L130 70" />
          
          {/* Rocket body */}
          <path d="M80 90 Q60 100 55 130 L55 150 Q80 160 105 150 L105 130 Q100 100 80 90" />
          {/* Rocket nose */}
          <path d="M70 90 Q80 70 90 90" />
          {/* Windows/details */}
          <circle cx="80" cy="115" r="8" />
          <circle cx="70" cy="135" r="4" />
          <circle cx="90" cy="135" r="4" />
          
          {/* Fins */}
          <path d="M55 135 L40 155 L55 150" />
          <path d="M105 135 L120 155 L105 150" />
          <path d="M80 150 L80 170 L70 165" />
          <path d="M80 150 L80 170 L90 165" />
          
          {/* Exhaust flames/speed lines */}
          <path d="M40 160 Q20 165 5 160" strokeWidth="1.5" />
          <path d="M50 170 Q25 175 0 170" strokeWidth="1.5" />
          <path d="M45 180 Q30 185 10 180" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
};

export default GradientRocket;

