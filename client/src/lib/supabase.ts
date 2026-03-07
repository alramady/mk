import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wspwewmnucqihnhcaqxk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHdld21udWNxaWhuaGNhcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1MzEsImV4cCI6MjA4ODQ3MDUzMX0.JYy3sOXfWtcqB8uNz9dAiqHJBXfHblhoQEfVUvoeDL4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
