import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function getServerSupabase(): Promise<SupabaseClient> {
  const { getToken } = await auth();
  const token =
    (await getToken({ template: "supabase" })) || (await getToken());

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

type LogUserRequestArgs = {
  requestType: string;
  parameters?: unknown;
  responseStatus?: number;
  responseData?: unknown;
  startedAt?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  additionalContext?: unknown;
};

export async function logUserRequest(args: LogUserRequestArgs): Promise<void> {
  const supabase = await getServerSupabase();
  const processingMs =
    typeof args.startedAt === "number" ? Math.max(Date.now() - args.startedAt, 0) : null;
  const processingInterval =
    processingMs !== null ? `${processingMs} milliseconds` : null;

  try {
    await supabase.rpc("log_user_request", {
      p_request_type: args.requestType,
      p_parameters: args.parameters ?? null,
      p_response_status: args.responseStatus ?? null,
      p_response_data: args.responseData ?? null,
      p_processing_time: processingInterval,
      p_ip_address: args.ipAddress ?? null,
      p_user_agent: args.userAgent ?? null,
      p_additional_context: args.additionalContext ?? null,
    });
  } catch (err) {
    console.error("[supabase:logUserRequest:error]", err);
  }
}
