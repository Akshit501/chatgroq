import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jstakckauamwmjyybmgg.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6qR1PuWobSeHY2p5MLqxtQ_Ze5pWYlW";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

