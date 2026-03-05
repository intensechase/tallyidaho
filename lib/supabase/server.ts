import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton — reused across warm serverless invocations within the same process
// Lazy-initialized to avoid module-level errors during build when env vars are absent
let _client: SupabaseClient | null = null

// Server-side client with service role — for SSR data fetching
// Never expose this to the browser
export function createServerClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _client
}
