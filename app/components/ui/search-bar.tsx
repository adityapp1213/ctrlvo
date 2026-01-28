"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: (value: string) => void;
  onSearchClick?: () => void;
  className?: string;
}

export function SearchBar({
  placeholder = "Search",
  value,
  onChange,
  onEnter,
  onSearchClick,
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={`flex items-center w-full justify-start gap-2 px-6 h-16 ${className}`}>
      <motion.button
        layoutId="search-icon"
        onClick={onSearchClick}
        className="focus:outline-none hover:opacity-70 transition-opacity"
        aria-label="Search"
      >
        <Search />
      </motion.button>
      <div className="flex-1 relative text-2xl">
        {!value && (
          <div className="absolute text-gray-500 flex items-center pointer-events-none z-10">
             {placeholder}
          </div>
        )}

        <motion.input
          ref={inputRef}
          layout="position"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Stop propagation to prevent global listeners (like HomeCloud) from catching these events
            e.stopPropagation();
            
            if (e.key === 'Enter') {
              const v = (e.currentTarget.value || '').trim();
              if (v) onEnter?.(v);
            }
          }}
          onKeyUp={(e) => {
             e.stopPropagation();
          }}
          className="w-full bg-transparent outline-none ring-none"
        />
      </div>
    </div>
  );
}
