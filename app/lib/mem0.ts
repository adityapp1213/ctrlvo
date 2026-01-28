import { MemoryClient } from "mem0ai";

type Mem0Message = {
  role: "user" | "assistant";
  content: string;
};

export type Mem0Operation = "search" | "add" | "update" | "delete";

type Mem0Ids = {
  userId: string;
  sessionId?: string | null;
};

const MEM0_API_KEY = process.env.MEM0_API_KEY;

let mem0Client: MemoryClient | null = null;

function getClient(): MemoryClient | null {
  if (!MEM0_API_KEY) return null;
  if (!mem0Client) {
    mem0Client = new MemoryClient({
      apiKey: MEM0_API_KEY,
    });
  }
  return mem0Client;
}

export async function mem0SearchForContext(
  query: string,
  ids: Mem0Ids,
  options?: { topK?: number }
): Promise<{ lines: string[]; used: boolean }> {
  const client = getClient();
  if (!client) return { lines: [], used: false };
  const trimmed = (query || "").trim();
  if (!trimmed) return { lines: [], used: false };

  const allLines: string[] = [];

  try {
    // 1. Forcefully retrieve ALL memories for this user to ensure complete context
    try {
      const all: any = await (client as any).getAll({ user_id: ids.userId });
      const allResults = Array.isArray(all) ? all : Array.isArray(all?.results) ? all.results : [];
      if (allResults.length > 0) {
        allResults.forEach((m: any) => {
          const text = String(m.memory || "").trim();
          if (text) allLines.push(`Memory: ${text}`);
        });
      }
    } catch (e) {
      console.error("Mem0 getAll failed", e);
    }

    // 2. Also perform a targeted search to ensure the most relevant ones are at the top
    const filters: any = {
      user_id: ids.userId,
      agent_id: "cloudy-web",
    };

    let searchRes: any = await (client as any).search(trimmed, {
      filters,
      user_id: ids.userId,
      top_k: options?.topK ?? 10,
    });

    if (!searchRes?.results?.length) {
      searchRes = await (client as any).search(trimmed, {
        filters: { user_id: ids.userId },
        user_id: ids.userId,
        top_k: options?.topK ?? 10,
      });
    }

    const searchResults = Array.isArray(searchRes?.results) ? searchRes.results : [];
    const searchLines = searchResults
      .map((m: any) => String(m.memory || "").trim())
      .filter(Boolean)
      .map((m: any) => `Memory: ${m}`);

    // Prepend search results (most relevant) and then add the rest, deduplicated
    const finalLines = Array.from(new Set([...searchLines, ...allLines]));

    return { 
      lines: finalLines.slice(0, 50), // Increased limit since user wants "all" context
      used: finalLines.length > 0 
    };
  } catch (err) {
    console.error("Mem0 search context failed", err);
    return { lines: [], used: false };
  }
}

export async function mem0AddTurn(
  messages: Mem0Message[],
  ids: Mem0Ids,
  metadata?: Record<string, any>
): Promise<void> {
  const client = getClient();
  if (!client) return;
  if (!ids.userId) return;
  const cleaned = (messages || []).map((m) => ({
    role: m.role,
    content: (m.content || "").toString(),
  }));
  if (!cleaned.length) return;

  try {
    await (client as any).add(cleaned, {
      user_id: ids.userId,
      run_id: ids.sessionId ?? undefined,
      agent_id: "cloudy-web",
      metadata,
    });
  } catch {
    return;
  }
}

export async function mem0UpdateMemory(
  memoryId: string,
  data: { text?: string; metadata?: Record<string, any> }
): Promise<void> {
  const client = getClient();
  if (!client) return;
  const id = (memoryId || "").trim();
  if (!id) return;
  try {
    await (client as any).update(id, {
      ...(data.text ? { text: data.text } : {}),
      ...(data.metadata ? { metadata: data.metadata } : {}),
    });
  } catch {
    return;
  }
}

export async function mem0DeleteMemory(memoryId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const id = (memoryId || "").trim();
  if (!id) return;
  try {
    await (client as any).delete(id);
  } catch {
    return;
  }
}

export async function mem0DeleteAllForUser(userId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const id = (userId || "").trim();
  if (!id) return;
  try {
    await (client as any).deleteAll({ user_id: id });
  } catch {
    return;
  }
}
