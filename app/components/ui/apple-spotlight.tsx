'use client';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  Files,
  Folder,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  MessageSquare,
  Music,
  Search,
  Settings,
  StickyNote,
  Terminal,
  Twitter,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/lib/supabase';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from './search-bar';

interface Shortcut {
  label: string;
  icon: React.ReactNode;
  link: string;
}

interface SearchResult {
  icon: React.ReactNode;
  label: string;
  description: string;
  link: string;
}

const SVGFilter = () => {
  return (
    <svg width="0" height="0">
      <filter id="blob">
        <feGaussianBlur stdDeviation="10" in="SourceGraphic" />
        <feColorMatrix
          values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 18 -9
    "
          result="blob"
        />
        <feBlend in="SourceGraphic" in2="blob" />
      </filter>
    </svg>
  );
};

interface ShortcutButtonProps {
  icon: React.ReactNode;
  link: string;
}

const ShortcutButton = ({ icon, link }: ShortcutButtonProps) => {
  return (
    <a href={link} target="_blank">
      <div className="rounded-full cursor-pointer hover:shadow-lg opacity-30 hover:opacity-100 transition-[opacity,shadow] duration-200">
        <div className="size-16 aspect-square flex items-center justify-center">{icon}</div>
      </div>
    </a>
  );
};

interface SpotlightPlaceholderProps {
  text: string;
  className?: string;
}

const SpotlightPlaceholder = ({ text, className }: SpotlightPlaceholderProps) => {
  return (
    <motion.div
      layout
      className={cn('absolute text-gray-500 flex items-center pointer-events-none z-10', className)}
    >
      <AnimatePresence mode="popLayout">
        <motion.p
          layoutId={`placeholder-${text}`}
          key={`placeholder-${text}`}
          initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
};

interface SpotlightInputProps {
  placeholder: string;
  hidePlaceholder: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholderClassName?: string;
  onEnter?: (value: string) => void;
  onSearchClick?: () => void;
}

const SpotlightInput = ({
  placeholder,
  hidePlaceholder,
  value,
  onChange,
  placeholderClassName,
  onEnter,
  onSearchClick,
}: SpotlightInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center w-full justify-start gap-2 px-6 h-16">
      <motion.button
        layoutId="search-icon"
        onClick={onSearchClick}
        className="focus:outline-none hover:opacity-70 transition-opacity"
        aria-label="Search"
      >
        <Search />
      </motion.button>
      <div className="flex-1 relative text-2xl">
        {!hidePlaceholder && (
          <SpotlightPlaceholder text={placeholder} className={placeholderClassName} />
        )}

        <motion.input
          ref={inputRef}
          layout="position"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.currentTarget.value || '').trim();
              if (v) onEnter?.(v);
            }
          }}
          className="w-full bg-transparent outline-none ring-none"
        />
      </div>
    </div>
  );
};

interface SearchResultsContainerProps {
  searchResults: SearchResult[];
  onHover: (index: number | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SearchResultsContainer = (_: SearchResultsContainerProps) => null;

interface AppleSpotlightProps {
  shortcuts?: Shortcut[];
  isOpen?: boolean;
}

const AppleSpotlight = ({
  shortcuts = [
    {
      label: 'Apps',
      icon: <LayoutGrid />,
      link: '/docs/components',
    },
    {
      label: 'Files',
      icon: <Folder />,
      link: '/docs/texts',
    },
    {
      label: 'Actions',
      icon: <Activity />,
      link: '/docs/buttons',
    },
    {
      label: 'Clipboard',
      icon: <Files />,
      link: '/docs/backgrounds',
    },
  ],
  isOpen = true,
}: AppleSpotlightProps) => {
  const [hovered, setHovered] = useState(false);
  const [hoveredSearchResult, setHoveredSearchResult] = useState<number | null>(null);
  const [hoveredShortcut, setHoveredShortcut] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const supabase = useSupabase();
  const { userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.get('q') || searchParams.get('search');
    if (query) {
      setSearchValue(query);
    }
  }, [searchParams]);

  const handleSearchValueChange = (value: string) => {
    setSearchValue(value);
  };

  const handleSubmitSearch = async (value: string) => {
    try {
      if (supabase) {
        await supabase.from('searches').insert({
          query: value,
          user_id: userId ?? null,
        });
      }
    } catch (err) {
      console.error('[search:insert:error]', err);
    } finally {
      router.push(`/home/search?q=${encodeURIComponent(value)}`);
    }
  };

  const searchResults: SearchResult[] = [
    {
      icon: <Twitter />,
      label: 'Twitter',
      description: 'Follow me on Twitter',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Globe />,
      label: 'Safari',
      description: 'Open Safari web browser',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Mail />,
      label: 'Mail',
      description: 'Open Mail application',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Calendar />,
      label: 'Calendar',
      description: 'View your calendar events',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <StickyNote />,
      label: 'Notes',
      description: 'Open Notes application',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <ImageIcon />,
      label: 'Photos',
      description: 'Browse your photo library',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Settings />,
      label: 'System Settings',
      description: 'Open System Preferences',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Terminal />,
      label: 'Terminal',
      description: 'Open Terminal application',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Folder />,
      label: 'Finder',
      description: 'Open Finder file manager',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <MessageSquare />,
      label: 'Messages',
      description: 'Open Messages application',
      link: ' `https://x.com/samitkapoorr` ',
    },
    {
      icon: <Music />,
      label: 'Music',
      description: 'Open Music application',
      link: ' `https://x.com/samitkapoorr` ',
    },
  ];

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{
            opacity: 0,
            scaleX: 1.3,
            scaleY: 1.1,
            y: -10,
          }}
          animate={{
            opacity: 1,
            scaleX: 1,
            scaleY: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scaleX: 1.3,
            scaleY: 1.1,
            y: 10,
          }}
          transition={{
            stiffness: 550,
            damping: 50,
            type: 'spring',
          }}
          className="relative w-full flex flex-col items-center justify-center"
        >
          <SVGFilter />

          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              setHovered(false);
              setHoveredShortcut(null);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ filter: 'url(#blob)' }}
            className={cn(
              'w-full flex items-center justify-center gap-4 z-20 group',
              '[&>div]:bg-neutral-100 [&>div]:text-black [&>div]:rounded-full [&>div]:backdrop-blur-xl',
              '[&_svg]:size-7 [&_svg]:stroke-[1.4]',
              'max-w-3xl'
            )}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layoutId="search-input-container"
                transition={{
                  layout: {
                    duration: 0.5,
                    type: 'spring',
                    bounce: 0.2,
                  },
                }}
                style={{
                  borderRadius: '30px',
                }}
                className="h-full w-full flex flex-col items-center justify-start z-10 relative shadow-lg overflow-hidden border"
              >
                <SearchBar
                  placeholder="Search"
                  value={searchValue}
                  onChange={handleSearchValueChange}
                  onEnter={handleSubmitSearch}
                  onSearchClick={() => handleSubmitSearch(searchValue)}
                />

                {searchValue && (
                  <SearchResultsContainer
                    searchResults={searchResults}
                    onHover={setHoveredSearchResult}
                  />
                )}
              </motion.div>
              {hovered &&
                !searchValue &&
                shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={`shortcut-${index}`}
                    onMouseEnter={() => setHoveredShortcut(index)}
                    layout
                    initial={{ scale: 0.7, x: -1 * (64 * (index + 1)) }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{
                      scale: 0.7,
                      x:
                        1 *
                        (16 * (shortcuts.length - index - 1) +
                          64 * (shortcuts.length - index - 1)),
                    }}
                    transition={{
                      duration: 0.8,
                      type: 'spring',
                      bounce: 0.2,
                      delay: index * 0.05,
                    }}
                    className="rounded-full cursor-pointer"
                  >
                    <ShortcutButton icon={shortcut.icon} link={shortcut.link} />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { AppleSpotlight };
