/*
# Fix handle_new_user trigger function

## Problem
The `handle_new_user()` trigger function is SECURITY DEFINER but has no explicit `search_path`.
When Supabase Auth creates a new user, this trigger fires and tries to INSERT into `profiles`,
but without a set `search_path`, the table reference may not resolve correctly, causing
"Database error saving new user" during registration.

## Fix
- Recreate the function with `SET search_path = public` to ensure the `profiles` table resolves.
- Drop and re-create the trigger to attach the fixed function.
- Also ensure the function owner has proper grants.
*/

-- Recreate the function with explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'teacher'
  );
  RETURN NEW;
END;
$$;

-- Grant execute to the auth-related roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated, supabase_admin;

-- Drop and re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();