-- 1. Helper function to get current user's school_id (runs with SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT school_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- 2. Helper function to get current user's role (runs with SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- 3. Rewrite profiles RLS policies using the helper functions
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR 
  get_current_user_role() = 'super_admin' OR 
  (school_id IS NOT NULL AND school_id = get_current_user_school_id())
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR 
  get_current_user_role() = 'super_admin' OR 
  (get_current_user_role() = 'admin_cfa' AND school_id = get_current_user_school_id())
);

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE USING (
  get_current_user_role() = 'super_admin' OR 
  (get_current_user_role() = 'admin_cfa' AND school_id = get_current_user_school_id())
);

-- 4. Rewrite details RLS policies to use helper functions for speed and consistency
DROP POLICY IF EXISTS "Public apprentis are viewable by everyone" ON public.apprentis_details;
CREATE POLICY "Public apprentis are viewable by everyone" ON public.apprentis_details FOR SELECT USING (
  get_current_user_role() = 'super_admin' OR
  EXISTS (
    SELECT 1 FROM public.profiles AS target
    WHERE target.id = apprentis_details.profile_id 
      AND target.school_id = get_current_user_school_id()
  )
);

DROP POLICY IF EXISTS "Public patrons are viewable by everyone" ON public.patrons_details;
CREATE POLICY "Public patrons are viewable by everyone" ON public.patrons_details FOR SELECT USING (
  get_current_user_role() = 'super_admin' OR
  EXISTS (
    SELECT 1 FROM public.profiles AS target
    WHERE target.id = patrons_details.profile_id 
      AND target.school_id = get_current_user_school_id()
  )
);

-- 5. Rewrite swipes RLS policies
DROP POLICY IF EXISTS "Approved users can insert own swipes" ON public.swipes;
CREATE POLICY "Approved users can insert own swipes" ON public.swipes FOR INSERT WITH CHECK (
  auth.uid() = de_profile_id
  AND (
    get_current_user_role() = 'super_admin' OR 
    (
      EXISTS (
        SELECT 1 FROM public.profiles AS self
        WHERE self.id = auth.uid() AND self.is_approved = true
      ) AND EXISTS (
        SELECT 1 FROM public.profiles AS target
        WHERE target.id = vers_profile_id AND (target.school_id = get_current_user_school_id() OR target.school_id IS NULL)
      )
    )
  )
);

DROP POLICY IF EXISTS "Users and admin can view swipes" ON public.swipes;
CREATE POLICY "Users and admin can view swipes" ON public.swipes FOR SELECT USING (
  auth.uid() = de_profile_id OR 
  auth.uid() = vers_profile_id OR 
  get_current_user_role() = 'super_admin' OR
  (
    get_current_user_role() = 'admin_cfa' AND 
    EXISTS (
      SELECT 1 FROM public.profiles AS de
      WHERE de.id = de_profile_id AND de.school_id = get_current_user_school_id()
    )
  )
);

-- 6. Rewrite matches RLS policies
DROP POLICY IF EXISTS "Participants can view their matches" ON public.matches;
CREATE POLICY "Participants can view their matches" ON public.matches FOR SELECT USING (
  auth.uid() = apprenti_id OR 
  auth.uid() = patron_id OR
  get_current_user_role() = 'super_admin' OR
  (
    get_current_user_role() = 'admin_cfa' AND 
    EXISTS (
      SELECT 1 FROM public.profiles AS app
      WHERE app.id = apprenti_id AND app.school_id = get_current_user_school_id()
    )
  )
);

-- 7. Rewrite messages RLS policies
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.apprenti_id = auth.uid() OR matches.patron_id = auth.uid())
  ) OR 
  get_current_user_role() = 'super_admin' OR
  (
    get_current_user_role() = 'admin_cfa' AND 
    EXISTS (
      SELECT 1 FROM matches AS m
      JOIN public.profiles AS app ON app.id = m.apprenti_id
      WHERE m.id = messages.match_id AND app.school_id = get_current_user_school_id()
    )
  )
);

-- 8. Rewrite storage RLS policies for delete
DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
CREATE POLICY "photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR get_current_user_role() = 'super_admin'
    OR (
      get_current_user_role() = 'admin_cfa' AND EXISTS (
        SELECT 1 FROM public.profiles AS target
        WHERE target.id::text = (storage.foldername(name))[1] AND target.school_id = get_current_user_school_id()
      )
    )
  )
);
