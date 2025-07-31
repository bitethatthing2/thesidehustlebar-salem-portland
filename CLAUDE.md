# CRITICAL RULES - DO NOT BREAK

## NEVER TOUCH THE BACKEND
- **DO NOT create migration files**
- **DO NOT modify any .sql files**
- **DO NOT run supabase db push**
- **DO NOT modify database schema**
- **DO NOT create RPC functions**
- **DO NOT touch anything in /supabase/migrations/**
- **DO NOT modify supabase/config.toml**

## FRONTEND ONLY
- Only work on frontend code
- Only modify React/Next.js components
- Only fix frontend API calls
- If backend functions are missing, document it but DO NOT create them

## REMEMBER
The user has explicitly forbidden any backend modifications. Breaking this rule causes serious problems and wastes their time. FRONTEND ONLY.