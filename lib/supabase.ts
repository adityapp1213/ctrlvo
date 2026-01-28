"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function useSupabase(): SupabaseClient | null {
  const { getToken, isSignedIn } = useAuth();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const tokenRef = useRef<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const token =
          (await getToken({ template: "supabase" })) || (await getToken());
        if (tokenRef.current === token && clientRef.current) {
          if (mounted) setClient(clientRef.current);
          return;
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
          auth: {
            persistSession: false,
            detectSessionInUrl: false,
            autoRefreshToken: false,
          },
        });

        tokenRef.current = token;
        clientRef.current = supabase;
        if (mounted) {
          setClient(supabase);
        }
      } catch (err) {
        console.error("[supabase:init:error]", err);
        if (mounted) setClient(null);
      }
    }

    if (isSignedIn) {
      init();
    } else {
      setClient(null);
      tokenRef.current = null;
      clientRef.current = null;
    }

    return () => {
      mounted = false;
    };
  }, [getToken, isSignedIn]);

  return client;
}
