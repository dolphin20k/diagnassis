import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client: BYPASSES RLS. Server-only. Use exclusively for:
 *  - writing AI-generated question banks / custom-role estimates (students may not write them),
 *  - the market-research pipeline,
 *  - R2 report metadata and AI request logging.
 * Never pass user-controlled identifiers into it without first authorizing the user.
 */
export function createAdminClient() {
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
