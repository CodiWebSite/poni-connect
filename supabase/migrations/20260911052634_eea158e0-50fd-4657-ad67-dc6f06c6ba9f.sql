CREATE OR REPLACE FUNCTION public.can_view_institute_leave(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('secretar_stiintific','director_institut','director_adjunct','super_admin')
  )
$$;

CREATE POLICY "Institute leadership can view all leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (public.can_view_institute_leave(auth.uid()));

CREATE POLICY "Institute leadership can view EPD"
ON public.employee_personal_data FOR SELECT TO authenticated
USING (public.can_view_institute_leave(auth.uid()));

CREATE POLICY "Institute leadership can view leave hr_requests"
ON public.hr_requests FOR SELECT TO authenticated
USING (public.can_view_institute_leave(auth.uid()));

CREATE POLICY "Institute leadership can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.can_view_institute_leave(auth.uid()));