export type ShoppingProduct = {
  id: string;
  title: string;
  link: string;
  thumbnailUrl?: string;
  priceText?: string;
  price?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  source?: string;
  sourceIconUrl?: string;
  descriptionSnippet?: string;
  additionalImageUrls?: string[];
};

export type ShoppingSearchOptions = {
  maxResults?: number;
  hl?: string;
  gl?: string;
  device?: string;
  location?: string;
};

type SerpShoppingItem = {
  product_id?: string;
  product_link?: string;
  link?: string;
  title?: string;
  thumbnail?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  source?: string;
  source_icon?: string;
  snippet?: string;
  extensions?: string[];
  images_results?: { thumbnail?: string }[];
};

type SerpShoppingResponse = {
  shopping_results?: SerpShoppingItem[];
  inline_shopping_results?: SerpShoppingItem[];
};

export async function shoppingSearch(
  query: string,
  options?: ShoppingSearchOptions
): Promise<ShoppingProduct[]> {
  const q = (query || "").trim();
  if (!q) return [];

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn("[shoppingSearch] Missing SERPAPI_API_KEY");
    return [];
  }

  const params = new URLSearchParams();
  params.set("engine", "google_shopping_light");
  params.set("q", q);
  params.set("api_key", apiKey);
  const defaultHl = process.env.SHOPPING_DEFAULT_HL || "en";
  const defaultGl = process.env.SHOPPING_DEFAULT_GL || "us";
  const defaultLocation = process.env.SHOPPING_DEFAULT_LOCATION;
  params.set("hl", options?.hl || defaultHl);
  params.set("gl", options?.gl || defaultGl);
  params.set("device", options?.device || "desktop");
  if (options?.location || defaultLocation) {
    params.set("location", options?.location || defaultLocation!);
  }

  const url = `https://serpapi.com/search.json?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.warn("[shoppingSearch] SerpAPI error", res.status, res.statusText);
      return [];
    }
    const json = (await res.json()) as SerpShoppingResponse;
    const itemsSource =
      (Array.isArray(json.shopping_results) && json.shopping_results.length
        ? json.shopping_results
        : Array.isArray(json.inline_shopping_results) && json.inline_shopping_results.length
        ? json.inline_shopping_results
        : []) ?? [];
    const items = itemsSource;
    const max = options?.maxResults ?? 4;

    return items
      .slice(0, max)
      .map((item, index) => {
        const title = String(item.title ?? "").trim();
        const link = String(item.link ?? item.product_link ?? "").trim();
        if (!title || !link) {
          return null;
        }
        const id =
          String(item.product_id ?? "").trim() ||
          `${title.slice(0, 80)}:${link.slice(0, 80)}` ||
          `item-${index}`;

        const price =
          typeof item.extracted_price === "number" && !Number.isNaN(item.extracted_price)
            ? item.extracted_price
            : null;
        const rating =
          typeof item.rating === "number" && !Number.isNaN(item.rating) ? item.rating : null;
        const reviewCount =
          typeof item.reviews === "number" && !Number.isNaN(item.reviews) ? item.reviews : null;

        const descriptionSnippet =
          typeof item.snippet === "string" && item.snippet.trim().length
            ? item.snippet.trim()
            : undefined;

        const additionalImageUrls =
          Array.isArray(item.images_results) && item.images_results.length
            ? item.images_results
                .map((img) => String(img.thumbnail || "").trim())
                .filter((url) => Boolean(url))
            : undefined;

        return {
          id,
          title,
          link,
          thumbnailUrl: item.thumbnail || undefined,
          priceText: item.price || undefined,
          price,
          rating,
          reviewCount,
          source: item.source || undefined,
          sourceIconUrl: item.source_icon || undefined,
          descriptionSnippet,
          additionalImageUrls,
        } satisfies ShoppingProduct | null;
      })
      .filter(Boolean) as ShoppingProduct[];
  } catch (err) {
    console.warn("[shoppingSearch] Request failed", err);
    return [];
  }
}
