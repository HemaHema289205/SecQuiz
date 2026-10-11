/*
# Fix security advisor warnings

## Changes
1. Revoke EXECUTE on handle_new_user from anon and authenticated - only the trigger should call it
2. Fix update_updated_at function to have explicit search_path
*/

-- Revoke direct execute on handle_new_user from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
-- Only supabase_admin (which runs triggers) needs execute
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_admin;

-- Fix update_updated_at search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;