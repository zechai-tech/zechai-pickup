-- ============================================================================
-- Combos & Combo Items Migration
-- ============================================================================

-- 1. Create Combos Table
CREATE TABLE IF NOT EXISTS public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL CHECK (price >= 0),
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by outlet
CREATE INDEX IF NOT EXISTS idx_combos_outlet_id ON public.combos(outlet_id);

-- 2. Create Combo Items Table
CREATE TABLE IF NOT EXISTS public.combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_combo_menu_item UNIQUE (combo_id, menu_item_id)
);

-- Indexes for fast joins
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON public.combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_menu_item_id ON public.combo_items(menu_item_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Combos
DROP POLICY IF EXISTS "Public read combos" ON public.combos;
CREATE POLICY "Public read combos" ON public.combos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin manage combos" ON public.combos;
CREATE POLICY "Admin manage combos" ON public.combos
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.current_user_role() IN ('admin', 'super_admin'));

-- 5. RLS Policies for Combo Items
DROP POLICY IF EXISTS "Public read combo_items" ON public.combo_items;
CREATE POLICY "Public read combo_items" ON public.combo_items
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin manage combo_items" ON public.combo_items;
CREATE POLICY "Admin manage combo_items" ON public.combo_items
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.current_user_role() IN ('admin', 'super_admin'));
