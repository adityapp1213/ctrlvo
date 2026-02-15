Shopping Integration Plan – Google Shopping Light via SerpAPI

## 1. Goals and Scope

- When I speak a product query (via mic / Cloudy) or hit the Shopping app button in the home input, the system should:
  - Interpret the query as a **product search**.
  - Call **Google Shopping Light API** via **SerpAPI** using the existing `SERPAPI_API_KEY` env var.
  - Fetch the **top 4 products** for the query.
  - Display for each product:
    - Thumbnail
    - Title
    - Price (current, and optionally old price if available)
    - Rating and review count (if present)
    - Source (store name)
  - Present results inline with the existing search / chat UX.
- This document only defines a **detailed plan** (no implementation code).

## 2. Current Codebase – Relevant Pieces

### 2.1 Home search input and Apps selector

- File: `app/(protected)/home/home-search-input.tsx`
- Key features:
  - Has an **Apps selector** in the home hero input: YouTube, Maps, Shopping, Apps (none).
  - State: `selectedApp: "apps" | "youtube" | "maps" | "shopping"`.
  - The Apps dropdown uses:
    - `getAppIcon()` and `getAppLabel()` to render icons and labels.
    - `DropdownMenuItem` to set `selectedApp`.
  - When submitting text (`submitText`):
    - If `selectedApp === "youtube"` → prefix query with `YouTube ` and navigate to `/home/search?q=YouTube ...`.
    - If `selectedApp === "maps"` → prefix query with `Map of ` and navigate with `tab=map`.
    - If `selectedApp === "shopping"`:
      - `text = "Shopping " + text`
      - Navigates to `/home/search?q=${encodeURIComponent(text)}&chatId=...` with optional `&voice=1` (for voice).
  - Mic button:
    - Uses `MediaRecorder` to capture audio.
    - Sends audio as `FormData` to `/api/deepgram/stt` to get transcript.
    - Sets `isVoiceInputRef.current = true` and calls `submitText(transcript, "voice")`.
    - Thus a **voice Shopping query** becomes `"Shopping <spoken product>"` with `source: "voice"` and `&voice=1`.

### 2.2 Search / chat shell and AI input footer

- File: `app/(protected)/home/search/ai-input-footer.tsx`
- Responsibilities:
  - Renders the chat conversation UI for `/home/search` (chat tab).
  - Accepts props: `tab`, `searchQuery`, `overallSummaryLines`, `webItems`, `youtubeItems`, `mapLocation`, etc.
  - Maintains `contentState` with fields including `shoppingItems` (already part of the state structure).
  - Contains `SearchResultsBlock` rendering different result kinds (web, media, videos, maps, etc.).
  - Handles new messages via `handleChatSubmit(value, meta)`:
    - Collects context (recent messages, pinned items, etc.).
    - Calls `performDynamicSearch` (server action) to let the LLM decide what tools to call (web search, YouTube, maps, etc.).
    - Writes prompt/response to Convex (`writePrompt`, `writeResponse`). Includes `is_SST` based on source `"voice"`.
    - Maintains streaming state for assistant replies and coordinates TTS via Deepgram.

### 2.3 Server actions for search / tools

- File: `app/actions/search.ts`
- Responsibilities (high-level):
  - `performDynamicSearch` orchestrates different tools based on LLM intent:
    - Uses `detectIntent` to classify the query.
    - Can call `webSearch`, `youtubeSearch`, `fetchWeatherForCity`, and `imageSearch` as needed.
    - Aggregates results into a `DynamicSearchResult` object:
      - Contains `webItems`, `youtubeItems`, `mapLocation`, `mediaItems`, etc.
      - These feed into the `SearchResultsBlock` UI.

- This is the **natural place** to integrate Google Shopping as another tool:
  - Add a shopping tool function (e.g. `shoppingSearch`).
  - Add `shoppingItems` to `DynamicSearchResult.data` and to the shape persisted in Convex responses.

### 2.4 Search results rendering

- File: `components/search-results-block.tsx`
- Responsibilities:
  - Renders AI-assisted search results with tabs for:
    - General results
    - Media / images
    - Videos
    - Weather
  - Already has patterns for rendering cards with:
    - Thumbnails (via `next/image`)
    - Titles
    - Summaries
    - External links
- This component is ideal to **add a Shopping section** that displays product cards.

### 2.5 Environment and secrets

- File: `.env.local`
  - Contains `SERPAPI_API_KEY` (already configured).
- This key should be read **only on the server** (Next.js App Router server actions and API routes).

## 3. External APIs – Google Shopping via SerpAPI

### 3.1 Google Shopping Light API

- Engine: `google_shopping_light`
- Example request pattern:
  - Parameters:
    - `engine=google_shopping_light`
    - `q=<product query>` (e.g., `"macbook"`)
    - `hl=en`, `gl=us`, `device=desktop` (or as appropriate).
    - `api_key=<SERPAPI_API_KEY>`.
- Main response structure (simplified):
  - `shopping_results`: array of product objects, each with:
    - `title`
    - `product_link`
    - `product_id`
    - `source` (store)
    - `source_icon` (favicon URL)
    - `price` (string) and `extracted_price` (number)
    - `rating` (float) and `reviews` (integer)
    - `thumbnail` (image URL)

### 3.2 Categorized Shopping Results

- Engine: `google_shopping_light` with categorized endpoint / mode.
- Response adds:
  - `categorized_shopping_results`: array of category blocks, each with:
    - `title` (category name, e.g., `"MacBook Air M3"`)
    - `shopping_results`: array of product entries with same fields as above.
- How to use:
  - For a shopping query, we can:
    - Either use the plain `shopping_results` (uncategorized).
    - Or use categories to group results, but likely not needed for initial version.

### 3.3 Filters API

- Engine: `google_shopping_filters`
- Returns:
  - `filters`: options like `Nearby`, `Get it today`, `On sale`, `Small business`.
  - Each option has a `shoprs` token that can be passed back to `google_shopping` or `google_shopping_light` to refine sorting / filtering.
- Sorting examples:
  - “Price: low to high”, “Price: high to low”, “Rating: high to low” – each with its own `shoprs` value.
- Planned usage:
  - Initial version may **not** expose filters to the user (to stay fast and simple).
  - Later, we can:
    - Pre‑select a sorting filter (e.g., price low→high) for some flows.
    - Or add a UI toggle for “Sort by price” / “Sort by rating” that controls the `shoprs` value.

### 3.4 Inline Results API

- Google Shopping Light Inline Results is for inline shopping content in other surfaces.
- Potential use:
  - Reuse the same SerpAPI client pattern but a different endpoint if we ever want inline results in AI overview / snippet cards.
  - For this project, a **single unified Shopping API function** using `google_shopping_light` is sufficient.

## 4. Data Model and Types (Conceptual)

> Note: This section is conceptual; actual types/interfaces are not written as code here.

### 4.1 Internal product shape

Define an internal “ShoppingProduct” shape with fields:

- `id` – derived from SerpAPI’s `product_id` or a stable hash.
- `title` – from `title`.
- `link` – from `product_link`.
- `thumbnailUrl` – from `thumbnail`.
- `priceText` – from `price` (string) to preserve currency symbols and locale.
- `price` – from `extracted_price` (numeric) for calculations / sorting.
- `oldPriceText` and `oldPrice` – if `old_price` / `extracted_old_price` exist (from categorized results).
- `rating` – from `rating` (0–5).
- `reviewCount` – from `reviews`.
- `source` – store name (from `source`).
- `sourceIconUrl` – small icon (from `source_icon`).

### 4.2 DynamicSearchResult extension

Extend the existing `DynamicSearchResult.data` conceptually to include:

- `shoppingItems` – array of `ShoppingProduct` (top 4).
- Optional:
  - `shoppingQuery` – normalized product query text.
  - `shoppingFilters` – information about applied filters or sort (e.g. “Price: low to high”).

### 4.3 Persisted response schema

Convex `writeResponse` currently persists result data for “search” responses. Conceptually:

- Add `shoppingItems` to response payload for “search” when shopping is used.
- Ensure the persisted shape matches what `SearchConversationShell` expects to restore sessions from local storage via `getChatSession` / `saveChatSession`.

## 5. High-Level Flow Design

### 5.1 Trigger sources

There are two main triggers for Shopping:

1. **Shopping app from home input**:
   - User selects Shopping in the Apps selector.
   - Types a product (e.g., “macbook air m3”) or speaks it.
   - Query becomes `Shopping macbook air m3` when navigating to `/home/search`.

2. **Spoken product query in chat context**:
   - Inside the chat (AIInputFooter), the user can use voice input (mic / Cloudy).
   - We can define a **shopping mode** within chat where:
     - Either the user toggles a “Shopping” mode in the apps selector (if present there).
     - Or the LLM detects product intent and decides to invoke the shopping tool.

### 5.2 Server-side decision logic

At a high level, the decision to call Google Shopping should be based on:

- **Explicit mode**:
  - If the query starts with a well-known Shopping prefix (`"Shopping "` from home input).
  - Or if a UI flag for “shopping” mode is set in the request metadata.

- **Intent detection**:
  - For non‑prefixed queries, use the LLM’s `detectIntent` to classify if this is a product search.

Once we know it’s a Shopping query, we:

- Extract the **product query text** (strip prefixes like “Shopping” and extraneous words).
- Call the Shopping tool to fetch products from SerpAPI.

### 5.3 End‑to‑end sequence (voice Shopping from home)

1. User selects “Shopping” in home Apps selector.
2. User taps mic (or double‑taps Cloudy) and speaks a product name.
3. STT pipeline captures audio, sends to Deepgram, transcribes to text (`"macbook air m3"`).
4. `submitText` is called with transcript and `source="voice"` → marks `is_SST` true.
5. Because `selectedApp === "shopping"`, the actual query used on `/home/search` is `"Shopping macbook air m3"`.
6. `/home/search` page loads, passes `searchQuery` and `tab` into `AIInputFooter`.
7. `handleChatSubmit` is invoked for the initial question / search:
   - Attaches context, writes prompt to Convex with `is_SST=true`.
   - Calls `performDynamicSearch` with the combined query and metadata (including a shopping hint).
8. `performDynamicSearch`:
   - Recognizes the shopping intent (via prefix or LLM intent).
   - Calls the `shoppingSearch` tool, which hits SerpAPI’s `google_shopping_light` endpoint.
   - Receives results, normalizes into `shoppingItems` (top 4 products) and attaches to `DynamicSearchResult.data`.
9. `AIInputFooter` receives `result`:
   - For type `"search"`, inserts assistant message that includes `shoppingItems` in `data`.
   - Saves response via `writeResponse` with `shoppingItems`.
   - Updates `contentState.shoppingItems` and passes to `SearchResultsBlock` for rendering.
10. `SearchResultsBlock` renders a Shopping section/cards.
11. If the query came from voice (`is_SST` true), the assistant reply is spoken via Deepgram TTS (e.g., summarizing top products). Visual cards still show the details.

## 6. Detailed Server-Side Plan

### 6.1 SerpAPI client wrapper

Create a lightweight internal client for SerpAPI Shopping:

- Responsibilities:
  - Read `SERPAPI_API_KEY` from the environment.
  - Build query parameters for `google_shopping_light`.
  - Optionally accept `shoprs` for filters (price sorting, etc.).
  - Handle HTTP requests (using existing fetch utilities or node fetch).
  - Normalize error cases into a consistent error type.

- Design decisions:
  - Implement as a **server-only utility** under `app/lib/serpapi/shopping` or a similar path.
  - Provide a single main entry point (e.g., `shoppingSearch(query, options)`).

### 6.2 Shopping search function (conceptual)

The internal Shopping function should:

- Accept:
  - `query`: string (product keywords), already trimmed and normalized.
  - Optional `options`:
    - `maxResults` (default 4).
    - `sort` (e.g., `"price_low_to_high"`, `"rating_high_to_low"`).
    - `locale` (`hl`, `gl`).
    - `shoprs` override if we want to pass it directly.

- Steps:
  1. Decide which endpoint variant to use:
     - Basic `google_shopping_light` (uncategorized) for v1.
     - Optionally, fetch categorized results if we want richer grouping later.
  2. Call SerpAPI with:
     - `engine="google_shopping_light"`.
     - `q=productQuery`.
     - `hl`/`gl`/`device` as defaults from config.
     - `api_key` from environment.
     - Add `shoprs` if provided (for sorting or filters).
  3. Parse `shopping_results` (or the first category’s `shopping_results` for categorized).
  4. For each product, fill the internal `ShoppingProduct` structure, handling missing fields gracefully.
  5. Return an array of products (top `maxResults`).

### 6.3 Integration with performDynamicSearch

To extend `performDynamicSearch`:

- Intent handling:
  - Add a possible intent type `shopping` (if not already present).
  - Map explicit prefixes (e.g., queries starting with “Shopping ”) to the `shopping` intent.
  - For generic queries, rely on the LLM’s `detectIntent` to choose shopping when appropriate.

- When intent is `shopping`:
  1. Derive a normalized product query:
     - Strip “Shopping ” prefix.
     - Remove trailing question marks or filler text if needed.
  2. Call the Shopping tool:
     - `shoppingItems = shoppingSearch(productQuery)`.
  3. Build `DynamicSearchResult`:
     - `type: "search"`.
     - `data.shoppingItems = shoppingItems`.
     - Optionally leave `webItems` empty or include web search as a fallback.
  4. Build a natural language summary (via the LLM) that references the top products:
     - Example: “Here are the top products I found for {productQuery}…”.
     - Keep this summary relatively short so TTS remains fast.

- Non-shopping intents:
  - Continue to behave exactly as before (web, YouTube, maps, etc.).

### 6.4 Error handling and edge cases

- If SerpAPI returns an error or empty `shopping_results`:
  - Do not break the entire search; instead:
    - Present a friendly assistant message: e.g., “I couldn’t find shopping results for this.”
    - Allow the LLM to fall back to web search or other tools.
  - Log enough detail server-side for debugging (without leaking user queries or keys).

- Timeouts and latency:
  - Respect reasonable timeout values for SerpAPI requests.
  - Ensure timeouts don’t block the rest of the dynamic search logic.

## 7. Detailed Frontend Plan

### 7.1 HomeSearchInput behavior for Shopping

- Confirm the existing patterns:
  - When `selectedApp === "shopping"`, prefix query with “Shopping ”.
  - For voice, `voice=1` is still added to the URL to trigger TTS paths (via `is_SST` and Deepgram).

- Adjustments:
  - Ensure that when coming from Shopping voice queries:
    - The query is clearly marked as shopping (prefix + potential tab or query param).
    - The search tab defaults to the chat view where `AIInputFooter` runs the dynamic search logic.

### 7.2 Displaying Shopping products in SearchResultsBlock

- Add a Shopping section/card layout:
  - As a new block in `SearchResultsBlock` that renders if `shoppingItems` is present and non‑empty.
  - Layout:
    - 2×2 grid or single row with horizontally scrollable cards (depending on existing design constraints).
    - Each card displays:
      - Product thumbnail (small but clear) using `next/image`.
      - Product title (one or two lines, truncating with ellipsis).
      - Price (bold, with currency symbol from `priceText`).
      - Rating and review count (e.g., “4.8 (5600 reviews)”).
      - Source name, optionally accompanied by the source icon.
    - Clicking a card opens `product_link` in a new tab with `rel="noopener noreferrer"`.

- Integration pattern:
  - Follow existing UI code style for other result types (web, videos).
  - Reuse existing card components if possible (e.g., `SearchResultItem`) or create a Shopping‑specific subcomponent.

### 7.3 Assistant messaging for Shopping

- The assistant summary should:
  - Introduce the Shopping results succinctly.
  - Avoid reading out full product titles and details in TTS to keep audio short and useful.
  - Example behavior:
    - Assistant message: “I found a few top options for ‘macbook air m3’. The best‑rated is from Store X around $1100. Here are the details.”
    - Visual cards show the full comparison.

### 7.4 Handling voice Shopping queries end‑to‑end

- For voice queries that go through Shopping:
  - `is_SST` is already written into Convex via `writePrompt` based on `source: "voice"`.
  - TTS is already triggered for responses when `is_SST` is true.
  - Ensure that Shopping responses integrate seamlessly:
    - The assistant summary (text) becomes the TTS content, not the raw product table.
    - Cards are shown visually for detailed inspection.

### 7.5 UX considerations

- Indicators:
  - When shopping results are being fetched, show a lightweight loading indicator near the Shopping section or the assistant message.

- Fallbacks:
  - If no products are found, clearly indicate this and suggest the user adjust the product name or refine filters later.

## 8. Filters and Sorting (Future Enhancements)

Although the initial version can ignore filters, plan ahead to integrate `google_shopping_filters`:

- On initial Shopping query:
  - Optionally call the Filters API to retrieve available sort options.
  - Pre‑select a default sort (e.g., “Relevance” or “Price: low to high”). Use the corresponding `shoprs` in the Shopping request.

- In UI:
  - Add a small “Sort by” dropdown above the Shopping grid.
  - Options might include:
    - Relevance (default)
    - Price: low to high
    - Price: high to low
    - Rating: high to low
  - When user chooses a sort option:
    - Trigger a new Shopping call with the chosen `shoprs` value.

- Keep performance in mind:
  - Debounce repeated changes to sort options.
  - Avoid rerunning the entire LLM pipeline when only the sort order changes; just refetch Shopping results.

## 9. Testing Strategy

### 9.1 Unit-level testing (conceptual)

- SerpAPI client:
  - Test query parameter generation (engine, q, hl, gl, device, api_key).
  - Test mapping from SerpAPI response to `ShoppingProduct` shape, including edge cases:
    - Missing rating, reviews, or price.
    - Products without thumbnails or source icons.

- Shopping integration in `performDynamicSearch`:
  - Test that queries starting with “Shopping ” select the Shopping tool.
  - Test that non‑Shopping intents never call SerpAPI.
  - Test that the returned `DynamicSearchResult` contains `shoppingItems` with correct size and ordering.

### 9.2 Integration testing

- End‑to‑end query:
  - From `/home`, set selector to Shopping, type “macbook air m3” and submit.
  - Verify that:
    - The `/home/search` page calls the Shopping tool.
    - The assistant summarizes products.
    - The Shopping grid displays top 4 products with correct fields.

- Voice Shopping:
  - Use mic or Cloudy with “macbook air m3”.
  - Confirm that:
    - STT successfully transcribes and passes through with `source: "voice"`.
    - `is_SST` is true in Convex for that prompt.
    - Shopping results appear visually.
    - Deepgram TTS speaks the assistant summary.

### 9.3 Error and fallback scenarios

- Simulate SerpAPI failure or empty `shopping_results`:
  - Ensure assistant explains the situation and optionally falls back to web search.

- Ensure no leakage of `SERPAPI_API_KEY` on the client:
  - Confirm env variable is only accessed server‑side.

## 10. Performance and Observability

- Performance:
  - Minimize the number of calls to SerpAPI per query (ideally one Shopping call).
  - Keep `maxResults` small (4) by design.
  - Consider caching recent Shopping results for identical queries within a short window to avoid redundant calls.

- Observability:
  - Log Shopping usage and errors server‑side:
    - Product queries (normalized).
    - Response sizes and timing (without sensitive data).
  - Monitor error rate and latency for SerpAPI requests.

## 11. Security and Privacy

- Keep `SERPAPI_API_KEY` strictly on the server; never expose it to client bundles or logs.
- Sanitize user product queries before sending to SerpAPI where necessary.
- Avoid logging full user queries at a level that could leak sensitive shopping intent; use either redaction or sampling if logging is needed.

---

This plan is intended to be exhaustive enough that the next implementation step is straightforward: introduce a SerpAPI shopping client, extend `performDynamicSearch` with a shopping tool, wire `shoppingItems` through the existing search result pipeline, and ensure seamless integration with both typed and voice‑driven shopping queries.
