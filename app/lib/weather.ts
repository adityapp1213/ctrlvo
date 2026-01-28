
export type WeatherType = "clear" | "clouds" | "rain" | "snow" | "thunderstorm" | "mist" | "unknown";

export type WeatherData = {
  city: string;
  temperature: number;
  weatherType: WeatherType;
  dateTime: string;
  isDay: boolean;
};

export type WeatherItem = {
  city: string;
  latitude?: number;
  longitude?: number;
  data?: WeatherData | null;
  error?: string | null;
};

export function mapWeatherType(condition: string): WeatherType {
  const main = (condition || "").toLowerCase();
  if (main.includes("clear")) return "clear";
  if (main.includes("cloud")) return "clouds";
  if (main.includes("rain") || main.includes("drizzle")) return "rain";
  if (main.includes("snow")) return "snow";
  if (main.includes("thunder")) return "thunderstorm";
  if (main.includes("mist") || main.includes("fog") || main.includes("haze")) return "mist";
  return "unknown";
}

export async function fetchWeatherForCity(city: string): Promise<WeatherItem> {
  const apiKey = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "";
  if (!apiKey) {
    return { city, data: null, error: "Missing OPENWEATHER_API_KEY" };
  }
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    if (!geoRes.ok) {
      return { city, data: null, error: `Geocode error ${geoRes.status}` };
    }
    const geoJson: Array<{ name: string; lat: number; lon: number }> = await geoRes.json();
    const first = geoJson[0];
    if (!first) {
      return { city, data: null, error: "Location not found" };
    }
    const { lat, lon } = first;
    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
      { next: { revalidate: 300 } }
    );
    if (!wRes.ok) {
      const msg = wRes.status === 401 ? "Invalid API key" : `Weather API error ${wRes.status}`;
      return { city, latitude: lat, longitude: lon, data: null, error: msg };
    }
    const wJson: {
      name: string;
      main: { temp: number };
      weather: Array<{ main: string; icon: string }>;
    } = await wRes.json();
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      
    }).format(now);
    const icon = wJson.weather?.[0]?.icon || "01d";
    const isDay = icon.includes("d");
    const weatherData: WeatherData = {
      city: wJson.name || city,
      temperature: Math.round(wJson.main?.temp ?? 0),
      weatherType: mapWeatherType(wJson.weather?.[0]?.main || ""),
      dateTime: formatted,
      isDay,
    };
    return { city, latitude: lat, longitude: lon, data: weatherData, error: null };
  } catch (err) {
    return { city, data: null, error: "Network error" };
  }
}
