import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://muofnutncqgaxflbzoyd.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11b2ZudXRuY3FnYXhmbGJ6b3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEyMDQsImV4cCI6MjA4MjA4NzIwNH0.ZHx1gOjjVNA5fUrzfG-N0JT7SwU7sSV4xuGc5TgOS3Y";

export const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
