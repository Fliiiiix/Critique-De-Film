// Configuration Supabase.
// Remplace les deux valeurs ci-dessous par celles de ton projet :
// Supabase → Project Settings → API → Project URL / anon public key.
//
// La clé "anon" est faite pour être exposée côté client (elle est visible
// dans le code source de n'importe quel site utilisant Supabase) — la
// sécurité vient des règles RLS définies dans supabase/schema.sql, pas du
// secret de cette clé. Ne jamais mettre ici la "service_role key" en revanche,
// celle-là est un vrai secret.
// Valeurs placeholder volontairement "valides" (l'app s'affiche normalement,
// seuls les appels réseau échoueront) — évite une page blanche si on oublie
// de les remplacer avant de déployer.
const SUPABASE_URL = 'https://ethhacnngepckeakhsch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGhhY25uZ2VwY2tlYWtoc2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNjQwODQsImV4cCI6MjEwMjg0MDA4NH0.PhrFiRZ8TSRJoIBsk4iKw7E5Ra227ptijBpBTBxkPMU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
