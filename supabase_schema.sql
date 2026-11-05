-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR MATKLAR (RECIPE & MEAL PLANNER)
-- Klistra in hela detta skript i Supabase SQL Editor och klicka på "Run".
-- ==============================================================================

-- 1. Skapa tabell för Hushåll
CREATE TABLE IF NOT EXISTS public.households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  creator_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Säkerställ att creator_id finns även om tabellen redan skapats
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS creator_id TEXT;

-- 2. Skapa tabell för Profiler / Medlemmar
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧑‍🍳',
  role_title TEXT DEFAULT 'Medlem',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Säkerställ att role_title finns även om tabellen redan skapats
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title TEXT DEFAULT 'Medlem';

-- 3. Skapa tabell för Recept
CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_image_url TEXT,
  recipe_document_url TEXT,
  source_url TEXT,
  source_type TEXT DEFAULT 'manual',
  servings INTEGER DEFAULT 4,
  category TEXT DEFAULT 'Middag',
  subcategory TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  is_favorite BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  ingredients JSONB DEFAULT '[]'::jsonb,
  instructions JSONB DEFAULT '[]'::jsonb,
  prep_time_minutes INTEGER DEFAULT 15,
  cook_time_minutes INTEGER DEFAULT 20,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Skapa tabell för Veckoplan
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  day_name TEXT NOT NULL,
  lunch_recipe_id TEXT,
  dinner_recipe_id TEXT,
  custom_lunch TEXT DEFAULT '',
  custom_dinner TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Skapa tabell för Inköpslista
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC,
  unit TEXT DEFAULT '',
  aisle TEXT DEFAULT 'Övrigt',
  is_pantry_staple BOOLEAN DEFAULT false,
  checked BOOLEAN DEFAULT false,
  recipe_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Skapa tabell för Alltid ha hemma (Pantry Items)
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC,
  unit TEXT DEFAULT '',
  aisle TEXT DEFAULT 'Skafferi',
  is_out_of_stock BOOLEAN DEFAULT false,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6b. Skapa tabell för valda kategorier på varor i inköpslistan
CREATE TABLE IF NOT EXISTS public.aisle_overrides (
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  ingredient_key TEXT NOT NULL,
  aisle TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, ingredient_key)
);

-- 7. Skapa tabell för Anslutningsförfrågningar (Join Requests)
CREATE TABLE IF NOT EXISTS public.household_join_requests (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES public.households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Aktivera säkerhet (Row Level Security - RLS)
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aisle_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_join_requests ENABLE ROW LEVEL SECURITY;

-- Tillåt läsning och skrivning för hushållsmedlemmar
CREATE POLICY "Allow access to household data" ON public.households FOR ALL USING (true);
CREATE POLICY "Allow access to profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow access to recipes" ON public.recipes FOR ALL USING (true);
CREATE POLICY "Allow access to meal plans" ON public.meal_plans FOR ALL USING (true);
CREATE POLICY "Allow access to shopping items" ON public.shopping_items FOR ALL USING (true);
CREATE POLICY "Allow access to pantry items" ON public.pantry_items FOR ALL USING (true);
CREATE POLICY "Allow access to aisle overrides" ON public.aisle_overrides FOR ALL USING (true);
CREATE POLICY "Allow access to join requests" ON public.household_join_requests FOR ALL USING (true);

-- Aktivera Realtid (Supabase Realtime) för direkt synk över WebSockets
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aisle_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_join_requests;

-- Skapa lagringsbucket för receptfoton och dokument
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recipe-media', 'recipe-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for Recipe Media" ON storage.objects
  FOR ALL USING (bucket_id = 'recipe-media');
