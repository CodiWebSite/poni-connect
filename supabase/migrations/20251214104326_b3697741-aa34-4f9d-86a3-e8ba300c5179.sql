-- Fix PUBLIC_DATA_EXPOSURE: Restrict phone number access to own profile + HR
-- Keep other profile data (including birth_date) visible for employee directory and birthday widget

-- First, drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new policy that allows viewing non-sensitive fields (via RLS expression)
-- Since RLS can't limit columns, we use a security definer function approach

-- Create a function to check if user can view sensitive profile data
CREATE OR REPLACE FUNCTION public.can_view_sensitive_profile_data(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _viewer_id = _profile_user_id OR  -- User can see their own data
    can_manage_hr(_viewer_id)          -- HR can see all data
$$;

-- Create a view for the employee directory with non-sensitive fields only
CREATE OR REPLACE VIEW public.employee_directory AS
SELECT 
  id,
  user_id,
  full_name,
  department,
  position,
  avatar_url,
  birth_date,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.employee_directory TO authenticated;

-- Now create restrictive RLS policies for the profiles table

-- Users can view their own full profile (including phone)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- HR can view all profiles (including phone)
CREATE POLICY "HR can view all profiles"
ON public.profiles FOR SELECT
USING (can_manage_hr(auth.uid()));