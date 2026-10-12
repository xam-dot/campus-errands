
const SUPABASE_URL = "https://eaqpmhxnltxzsdwwivrp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_q89hecRafrn_zIJLrEyoHA_93VitUxX";

window.ceSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("Campus Errands: Supabase client initialized.");
