"use client";

import { useRef } from "react";
import { ScrollProgress } from "@/components/ui/scroll-progress";

const dummyContent = Array.from({ length: 10 }, (_, i) => (
  <p key={i} className="pb-4 font-mono text-sm text-zinc-500">
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam
    lectus. Sed sit amet ipsum mauris. Maecenas congue ligula ac quam viverra
    nec consectetur ante hendrerit. Donec et mollis dolor. Praesent et diam eget
    libero egestas mattis sit amet vitae augue. Nam tincidunt congue enim, ut
    porta lorem lacinia consectetur. Donec ut libero sed arcu vehicula ultricies
    a non tortor. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
  </p>
));

function ScrollProgressBasic1() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-[350px] overflow-auto px-8 pb-16 pt-16" ref={containerRef}>
      <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-full bg-white to-transparent backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_top,white,transparent)] dark:bg-neutral-900" />
      <div className="pointer-events-none absolute left-0 top-0 w-full">
        <div className="absolute left-0 top-0 h-1 w-full bg-[#E6F4FE] dark:bg-[#111927]" />
        <ScrollProgress
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          className="absolute top-0 bg-[#0090FF]"
        />
      </div>
      {dummyContent}
    </div>
  );
}

function ScrollProgressBasic2() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-[350px] overflow-auto px-8 pb-4 pt-16" ref={containerRef}>
      <div className="absolute left-0 top-0 z-10 h-10 w-full bg-white dark:bg-zinc-950">
        <ScrollProgress
          className="absolute top-0 h-10 bg-zinc-200 dark:bg-zinc-800"
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
        />
        <div className="absolute left-0 top-0 flex h-10 items-center space-x-6 px-8 font-[450]">
          <a
            href="#"
            className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
          >
            Magazine
          </a>
          <a
            href="#"
            className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
          >
            Blog
          </a>
          <a
            href="#"
            className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
          >
            About
          </a>
        </div>
      </div>
      {dummyContent}
    </div>
  );
}

function ScrollProgressBasic3() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-[350px] overflow-auto px-8 pb-16 pt-16" ref={containerRef}>
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-full bg-white to-transparent backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] dark:bg-neutral-950" />
      <div className="pointer-events-none absolute left-0 top-0 w-full">
        <div className="absolute left-0 top-0 h-0.5 w-full dark:bg-[#111111]" />
        <ScrollProgress
          className="absolute top-0 h-0.5 bg-[linear-gradient(to_right,rgba(0,0,0,0),#111111_75%,#111111_100%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0),#ffffff_75%,#ffffff_100%)]"
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          springOptions={{ stiffness: 280, damping: 18, mass: 0.3 }}
        />
      </div>
      {dummyContent}
    </div>
  );
}

export { ScrollProgressBasic1, ScrollProgressBasic2, ScrollProgressBasic3 };

