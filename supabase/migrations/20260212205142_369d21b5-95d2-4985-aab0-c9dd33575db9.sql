
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

-- 2. Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. User roles table (separate from profiles per security rules)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operator',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Screens table
CREATE TABLE public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  resolution TEXT DEFAULT '1920x1080',
  activation_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_ping_at TIMESTAMPTZ,
  playlist_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;

-- 6. Media table
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- 7. Content items table
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'text', 'html')),
  media_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
  text_content JSONB DEFAULT '{}',
  html_content TEXT,
  duration INTEGER NOT NULL DEFAULT 10,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

-- 8. Playlists table
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_loop BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Add FK from screens to playlists now
ALTER TABLE public.screens ADD CONSTRAINT screens_playlist_fk FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE SET NULL;

-- 9. Playlist items table
CREATE TABLE public.playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  duration_override INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- 10. Schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  screen_id UUID REFERENCES public.screens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time TIME NOT NULL DEFAULT '00:00',
  end_time TIME NOT NULL DEFAULT '23:59',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- 11. Security definer helper functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND organization_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- 12. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org_id UUID;
BEGIN
  -- Create organization for new user
  INSERT INTO public.organizations (name) VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Organização'))
  RETURNING id INTO _org_id;

  -- Create profile
  INSERT INTO public.profiles (id, organization_id, full_name, email)
  VALUES (NEW.id, _org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 14. RLS Policies

-- Organizations: members can view their own org
CREATE POLICY "Members can view own org" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

-- Profiles: members can view profiles in their org, users can update own
CREATE POLICY "View org profiles" ON public.profiles FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- User roles: viewable by org members
CREATE POLICY "View org user roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_org_member(user_id, public.get_user_org_id(auth.uid())));
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid()) AND public.is_org_member(user_id, public.get_user_org_id(auth.uid())));

-- Screens: org members can view, admins can manage
CREATE POLICY "View org screens" ON public.screens FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admin manage screens" ON public.screens FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid()));
CREATE POLICY "Admin update screens" ON public.screens FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid()));
CREATE POLICY "Admin delete screens" ON public.screens FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid()));

-- Media: org members can CRUD
CREATE POLICY "View org media" ON public.media FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Insert org media" ON public.media FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Update org media" ON public.media FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Delete org media" ON public.media FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Content items: org members can CRUD
CREATE POLICY "View org content" ON public.content_items FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Insert org content" ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Update org content" ON public.content_items FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Delete org content" ON public.content_items FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Playlists: org members can CRUD
CREATE POLICY "View org playlists" ON public.playlists FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Insert org playlists" ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Update org playlists" ON public.playlists FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Delete org playlists" ON public.playlists FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- Playlist items: through playlist ownership
CREATE POLICY "View playlist items" ON public.playlist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.organization_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Insert playlist items" ON public.playlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.organization_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Update playlist items" ON public.playlist_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.organization_id = public.get_user_org_id(auth.uid())));
CREATE POLICY "Delete playlist items" ON public.playlist_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.organization_id = public.get_user_org_id(auth.uid())));

-- Schedules: org members can CRUD
CREATE POLICY "View org schedules" ON public.schedules FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Insert org schedules" ON public.schedules FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Update org schedules" ON public.schedules FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Delete org schedules" ON public.schedules FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- 15. Storage bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');
CREATE POLICY "Anyone can view media" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
CREATE POLICY "Authenticated users can delete media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- Player access: screens need to read playlists/content without auth
-- Add anon policies for player route
CREATE POLICY "Anon view screens by code" ON public.screens FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Anon view playlists" ON public.playlists FOR SELECT TO anon
  USING (true);
CREATE POLICY "Anon view playlist items" ON public.playlist_items FOR SELECT TO anon
  USING (true);
CREATE POLICY "Anon view content items" ON public.content_items FOR SELECT TO anon
  USING (true);
CREATE POLICY "Anon view media" ON public.media FOR SELECT TO anon
  USING (true);
