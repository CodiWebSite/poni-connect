
-- Allow same-department users to see basic profile info of colleagues
CREATE POLICY "Same department can view colleague profiles"
ON public.profiles
FOR SELECT
USING (
  user_same_department(user_id)
);

-- Allow same-department users to see basic EPD info of colleagues (for leave calendar)
CREATE POLICY "Same department can view colleague EPD"
ON public.employee_personal_data
FOR SELECT
USING (
  epd_same_department(id)
);
