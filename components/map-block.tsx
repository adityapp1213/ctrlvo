// Small card that shows a map location with an “Open map” button
"use client";

import { Map as MapIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type MapBlockProps = {
  location: string;
  onOpenSideMap: () => void;
};

export function MapBlock({ location, onOpenSideMap }: MapBlockProps) {
  return (
    <div className="w-full bg-card rounded-lg border p-4 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <MapIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-sm">Map Location</h3>
          <p className="text-sm text-muted-foreground">{location}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onOpenSideMap} className="gap-2">
        <ExternalLink className="w-4 h-4" />
        Open Map
      </Button>
    </div>
  );
}
