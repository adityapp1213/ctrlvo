// Single web search result card with favicon, title, and description
import Image from "next/image";

function normalizeExternalUrl(value: string | undefined) {
  const raw = (value ?? "").trim().replace(/^['"`]+|['"`]+$/g, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function formatDisplayUrl(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./i, "");
    return `www.${host}`;
  } catch {
    return value;
  }
}

type SearchResultItemProps = {
  link: string;
  title: string;
  description: string;
  imageUrl?: string; // Optional for now
  onClick?: () => void;
};

export function SearchResultItem({
  link,
  title,
  description,
  imageUrl,
  onClick,
}: SearchResultItemProps) {
  const normalizedImageUrl = normalizeExternalUrl(imageUrl);

  let domain = "";
  try {
    domain = new URL(link).hostname;
  } catch {
    domain = link;
  }
  const displayUrl = formatDisplayUrl(link);

  // Google Favicon service
  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

  return (
    <div
      className="group flex flex-row gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
      data-cloudy-kind="web"
      data-cloudy-link={link}
      data-cloudy-title={title}
      data-cloudy-summary={description}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative w-4 h-4 rounded-full overflow-hidden bg-muted shrink-0">
            {/* Use a simple img tag for favicons to avoid Next.js Image config issues for external domains if not configured */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={faviconUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onClick) {
                e.preventDefault();
                onClick();
              }
            }}
            className="text-xs font-medium text-blue-600 underline underline-offset-2 truncate max-w-[200px]"
          >
            {displayUrl}
          </a>
        </div>
        
        <a 
          href={link} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => {
            if (onClick) {
              e.preventDefault();
              onClick();
            }
          }}
          className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
        >
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1.5 line-clamp-1 leading-tight">
            {title}
          </h3>
        </a>
        
        <p className="text-sm text-muted-foreground/90 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>

      {normalizedImageUrl && (
        <div className="hidden sm:block w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-muted border relative">
          <Image
            src={normalizedImageUrl}
            alt=""
            fill
            className="object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
