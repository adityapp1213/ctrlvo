"use client";

import { Orb } from "@/components/chat/orb";

export function OrbPanel() {
  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="grid grid-cols-3 border border-neutral-200 rounded-lg overflow-hidden">
        <div className="h-56 bg-white" />
        <div className="h-56 bg-white flex items-center justify-center">
          <Orb className="h-44 w-full" />
        </div>
        <div className="h-56 bg-white" />
      </div>
    </div>
  );
}

