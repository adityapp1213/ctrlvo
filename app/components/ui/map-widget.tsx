"use client";

import React, { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";

type MapWidgetProps = {
  location: string;
  apiKey?: string;
  className?: string;
  interactive?: boolean;
  variant?: "inline" | "full";
};

export function MapWidget({
  location,
  apiKey,
  className,
  interactive = false,
  variant = "inline",
}: MapWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const sizeClass = variant === "full" ? "h-full" : "h-[300px] sm:h-[400px]";

  useEffect(() => {
    if (!location) return;
    setReady(false);
  }, [location, interactive]);

  // Initialize Map
  useEffect(() => {
    if (!interactive) return;
    if (!mapRef.current || !apiKey) return;

    const initMap = async () => {
      try {
        setOptions({
          key: apiKey,
          v: "weekly",
        });

        const { Map } = (await importLibrary("maps")) as google.maps.MapsLibrary;
        // Preload other libraries we need
        await importLibrary("places");
        await importLibrary("marker");
        await importLibrary("geocoding");

        if (mapRef.current) {
          const m = new Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
            mapId: "DEMO_MAP_ID",
          });
          setMap(m);
          infoWindowRef.current = new google.maps.InfoWindow();
        }
      } catch (e) {
        console.error("Error loading Google Maps", e);
        // Fallback to Embed API immediately if JS API fails to load
        setUseEmbedFallback(true);
      }
    };

    if (!map && !useEmbedFallback) {
      initMap();
    }
  }, [apiKey, interactive, map, useEmbedFallback]);

  // Handle Search
  useEffect(() => {
    if (!interactive) return;
    if (useEmbedFallback) return;
    if (!map || !location) return;

    setReady(false);

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    setError(null);

    const performSearch = async () => {
        let hasGeocoded = false;
        
        try {
            // Step 1: Try Geocoding first
            const { Geocoder } = (await importLibrary("geocoding")) as google.maps.GeocodingLibrary;
            const { Marker, Animation } = (await importLibrary("marker")) as google.maps.MarkerLibrary;
            const { LatLngBounds } = (await importLibrary("core")) as google.maps.CoreLibrary;
            
            const geocoder = new Geocoder();
            const response = await geocoder.geocode({ address: location });
            const { results } = response;

            if (results && results.length > 0) {
                hasGeocoded = true;
                const bounds = new LatLngBounds();
                const newMarkers: google.maps.Marker[] = [];

                results.forEach((result) => {
                    const marker = new Marker({
                        map,
                        position: result.geometry.location,
                        title: result.formatted_address,
                        animation: Animation.DROP,
                    });

                    const contentString = `
                        <div style="padding: 8px; max-width: 200px; color: #333;">
                            <h3 style="margin: 0 0 5px; font-weight: bold; font-size: 14px;">Location</h3>
                            <p style="margin: 0 0 5px; font-size: 12px;">${result.formatted_address}</p>
                        </div>
                    `;

                    marker.addListener("click", () => {
                        const iw = infoWindowRef.current;
                        if (iw) {
                            iw.setContent(contentString);
                            iw.open(map, marker);
                        }
                    });

                    newMarkers.push(marker);
                    if (result.geometry.viewport) {
                        bounds.union(result.geometry.viewport);
                    } else {
                        bounds.extend(result.geometry.location);
                    }
                });

                markersRef.current = newMarkers;
                map.fitBounds(bounds);
                google.maps.event.addListenerOnce(map, "idle", () => {
                  setReady(true);
                });
            }
        } catch (geoError) {
            console.warn("Geocoding failed, trying Places API...", geoError);
        }

        // Step 2: Try Places API
        try {
            const { Place } = (await importLibrary("places")) as google.maps.PlacesLibrary;
            const { Marker, Animation } = (await importLibrary("marker")) as google.maps.MarkerLibrary;
            const { LatLngBounds } = (await importLibrary("core")) as google.maps.CoreLibrary;

            // Text Search (New)
            const { places } = await Place.searchByText({
                textQuery: location,
                fields: ["displayName", "location", "formattedAddress", "rating", "userRatingCount", "viewport"],
                isOpenNow: false,
            });

            if (places && places.length > 0) {
                const bounds = new LatLngBounds();
                const newMarkers: google.maps.Marker[] = [];

                places.forEach((place) => {
                    if (!place.location) return;

                    const marker = new Marker({
                        map,
                        position: place.location,
                        title: place.displayName,
                        animation: Animation.DROP,
                    });

                    // Info Window Content
                    const contentString = `
                        <div style="padding: 8px; max-width: 200px; color: #333;">
                        <h3 style="margin: 0 0 5px; font-weight: bold; font-size: 14px;">${place.displayName}</h3>
                        <p style="margin: 0 0 5px; font-size: 12px;">${place.formattedAddress || ""}</p>
                        ${
                            place.rating
                            ? `<div style="display: flex; align-items: center; font-size: 12px;">
                                <span style="color: #fbbc04; margin-right: 4px;">★</span>
                                <span>${place.rating}</span>
                                <span style="color: #666; margin-left: 4px;">(${place.userRatingCount || 0})</span>
                                </div>`
                            : ""
                        }
                        </div>
                    `;

                    marker.addListener("click", () => {
                        const iw = infoWindowRef.current;
                        if (iw) {
                            iw.setContent(contentString);
                            iw.open(map, marker);
                        }
                    });

                    newMarkers.push(marker);
                    bounds.extend(place.location);
                });

                // If we got results from Places, replace Geocoding results
                markersRef.current.forEach((m) => m.setMap(null));
                markersRef.current = newMarkers;
                map.fitBounds(bounds);

                if (places.length === 1 && places[0].viewport) {
                    map.fitBounds(places[0].viewport);
                } else if (places.length === 1) {
                    map.setZoom(15);
                }
                google.maps.event.addListenerOnce(map, "idle", () => {
                  setReady(true);
                });
            } else {
                 if (!hasGeocoded) {
                     console.log("No results found for", location);
                     // If both failed to find results (but APIs worked), maybe fallback to embed?
                     // setUseEmbedFallback(true); 
                     google.maps.event.addListenerOnce(map, "idle", () => {
                       setReady(true);
                     });
                 }
            }
        } catch (error) {
            if (!hasGeocoded) {
                console.error("Error performing text search:", error);
                // If both APIs failed (likely permission/billing), fallback to Embed API
                setUseEmbedFallback(true);
            }
        }
    }
    
    performSearch();

  }, [interactive, location, map, useEmbedFallback]);

  if (!location) return null;

  if (!interactive) {
    return (
      <div className={cn("w-full rounded-lg overflow-hidden border bg-muted relative", sizeClass, className)}>
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading map…</span>
            </div>
          </div>
        )}
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
          onLoad={() => setReady(true)}
        />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className={cn(
          "w-full rounded-lg overflow-hidden border bg-muted relative flex items-center justify-center p-6 text-center",
          sizeClass,
          className
        )}
      >
        <div className="max-w-md space-y-4">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-medium text-lg">Missing Google Maps API Key</h3>
          <p className="text-sm text-muted-foreground">
            Set <strong>GOOGLE_MAP_API_KEY</strong> in your environment to enable the interactive map.
          </p>
        </div>
      </div>
    );
  }

  if (useEmbedFallback) {
      return (
        <div className={cn("w-full rounded-lg overflow-hidden border bg-muted relative", sizeClass, className)}>
            {!ready && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading map…</span>
                </div>
              </div>
            )}
            <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
                onLoad={() => setReady(true)}
            />
        </div>
      );
  }

  if (error) {
    // This should rarely be reached now, as we fallback to Embed
    return (
        <div className={cn("w-full rounded-lg overflow-hidden border bg-muted relative flex items-center justify-center p-6 text-center", sizeClass, className)}>
             <div className="max-w-md space-y-4">
                <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="font-medium text-lg">Map Configuration Error</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
             </div>
        </div>
    );
  }

  return (
    <div 
        className={cn("w-full rounded-lg overflow-hidden border bg-muted relative", sizeClass, className)}
    >
      <div ref={mapRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading map…</span>
          </div>
        </div>
      )}
    </div>
  );
}
