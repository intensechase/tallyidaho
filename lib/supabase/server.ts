import { createClient } from '@supabase/supabase-js'

// Singleton — reused across warm serverless invocations within the same process
const _client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Server-side client with service role — for SSR data fetching
// Never expose this to the browser
export function createServerClient() {
  return _client
}
