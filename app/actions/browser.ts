"use server";

export async function checkEmbeddability(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const xFrameOptions = response.headers.get("x-frame-options")?.toLowerCase();
    const csp = response.headers.get("content-security-policy")?.toLowerCase();

    // Check X-Frame-Options
    if (xFrameOptions === "deny" || xFrameOptions === "sameorigin") {
      return false;
    }

    // Check CSP frame-ancestors
    if (csp && csp.includes("frame-ancestors")) {
      // This is a simplified check. A robust parser is complex, but if frame-ancestors exists,
      // it's likely restricting embedding unless it explicitly allows * or the specific origin.
      // Most sites that set this intend to block embedding.
      // If it contains 'none' or 'self', it's definitely blocked.
      if (csp.includes("'none'") || csp.includes("'self'")) {
        return false;
      }
      // If it doesn't explicitly include https: or *, treat as suspicious/blocked for safety?
      // Actually, let's just catch the obvious blocks.
    }

    return true;
  } catch (error) {
    // If we can't even reach the site (e.g. CORS error if we were client side, but server side it might be network)
    // Actually, fetch on server side shouldn't have CORS issues.
    // But if it fails (e.g. 404 or connection refused), we might as well say it's not embeddable or let the iframe try.
    // If the server can't reach it, the client likely can't either (or it's a local network thing).
    // Let's return true and let the client-side timeout handle connection errors, 
    // UNLESS it's a specific error.
    console.error("Error checking embeddability:", error);
    return true; // Give it the benefit of the doubt if check fails
  }
}
