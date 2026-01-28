"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function HomeCloud({ className, rangeX = 20, rangeY = 10 }: { className?: string; rangeX?: number; rangeY?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    const h = typeof window !== "undefined" ? window.innerHeight : 0;
    return { x: w / 2, y: h / 2 };
  });
  const [blink, setBlink] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  useEffect(() => {
    const handleListeningState = (e: any) => {
      setIsListening(e.detail);
    };
    window.addEventListener("atom-ctrl-listening-state", handleListeningState);
    return () => window.removeEventListener("atom-ctrl-listening-state", handleListeningState);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const eyePos = useMemo(() => {
    if (isListening) return { x: 0, y: 0 };
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const offsetX = (cursor.x / w - 0.5) * rangeX;
    const offsetY = (cursor.y / h - 0.5) * rangeY;
    return { x: offsetX, y: offsetY };
  }, [cursor, rangeX, rangeY, isListening]);

  useEffect(() => {
    if (isListening) return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 3000);
    return () => clearInterval(interval);
  }, [isListening]);

  // Handle click outside to stop listening
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isListening && ref.current && !ref.current.contains(event.target as Node)) {
        window.dispatchEvent(new CustomEvent("atom-ctrl-toggle-listening"));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isListening]);

  const handleMouseDown = () => {
    setIsLongPressing(true);
  };

  const handleMouseUp = () => {
    setIsLongPressing(false);
  };

  return (
    <motion.div 
      ref={ref}
      className={cn("relative w-full max-w-xl cursor-pointer", className)}
      animate={isListening ? {
        y: [0, -15, 0],
        scale: 1.05,
        transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
      } : {
        y: [0, -10, 0],
        scale: 1,
        transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
      }}
      onDoubleClick={() => window.dispatchEvent(new CustomEvent("atom-ctrl-toggle-listening"))}
      onClick={(e) => {
        // Only trigger on double tap as per user request
        e.stopPropagation();
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <Image
        src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/cloud.jpg"
        alt="Cloud"
        width={800}
        height={400}
        className="h-auto w-full"
        priority
      />
      {["left", "right"].map((side, idx) => (
        <div
          key={side}
          className="absolute flex items-end justify-center overflow-hidden"
          style={{
            top: "40%",
            left: idx === 0 ? "38%" : "58%",
            width: "6%",
            height: blink ? "6%" : (isListening ? "18%" : "16%"),
            borderRadius: blink ? "2px" : "50% / 60%",
            backgroundColor: "white",
            transition: "all 0.15s ease",
          }}
        >
          {!blink && (
            <div
              className="bg-black"
              style={{
                width: isListening ? "65%" : "60%",
                height: isListening ? "65%" : "60%",
                borderRadius: "50%",
                marginBottom: "8%",
                transform: `translate(${eyePos.x}px, ${eyePos.y * 0.2}px)`,
                transition: "all 0.1s ease",
              }}
            />
          )}
        </div>
      ))}
    </motion.div>
  );
}
