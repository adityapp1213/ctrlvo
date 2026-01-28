import { MapWidget } from "@/components/ui/map-widget";

type Props = {
  searchParams: Promise<{ location?: string }>;
};

export default async function MapViewPage({ searchParams }: Props) {
  const { location } = await searchParams;

  if (!location) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        No location specified.
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background">
      <MapWidget 
        location={location} 
        apiKey={process.env.GOOGLE_MAP_API_KEY}
        interactive
        variant="full"
        className="h-full w-full rounded-none border-none" 
      />
    </div>
  );
}
