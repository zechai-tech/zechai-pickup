-- ============================================================================
-- Zécha! Database Schema & RLS Policies
-- ============================================================================

-- 1. Create Outlets Table
CREATE TABLE IF NOT EXISTS public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  opening_time time NOT NULL DEFAULT '15:00',
  closing_time time NOT NULL DEFAULT '00:00',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'ordering_staff')),
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Create Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  category text NOT NULL,
  image_url text,
  is_available boolean DEFAULT true,
  is_bestseller boolean DEFAULT false,
  is_veg boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  items jsonb NOT NULL,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled')),
  pickup_code text NOT NULL,
  payment_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Realtime publication for orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 5. Helper Functions for RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users 
  WHERE email = auth.jwt() ->> 'email' AND is_active = true 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_outlet_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT outlet_id FROM public.users 
  WHERE email = auth.jwt() ->> 'email' AND is_active = true 
  LIMIT 1;
$$;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Outlets Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon read active outlets" ON public.outlets;
CREATE POLICY "Anon read active outlets" ON public.outlets
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin manage outlets" ON public.outlets;
CREATE POLICY "Admin manage outlets" ON public.outlets
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Users Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read themselves or admin/manager" ON public.users;
CREATE POLICY "Users read themselves or admin/manager" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id())
    OR email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "Admin manage all users" ON public.users;
CREATE POLICY "Admin manage all users" ON public.users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Manager manage outlet users" ON public.users;
CREATE POLICY "Manager manage outlet users" ON public.users
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'manager' 
    AND outlet_id = public.current_user_outlet_id()
    AND role IN ('staff', 'ordering_staff')
  )
  WITH CHECK (
    public.current_user_role() = 'manager' 
    AND outlet_id = public.current_user_outlet_id()
    AND role IN ('staff', 'ordering_staff')
  );

-- ----------------------------------------------------------------------------
-- Menu Items Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon read available menu items" ON public.menu_items;
CREATE POLICY "Anon read available menu items" ON public.menu_items
  FOR SELECT TO anon, authenticated
  USING (
    is_available = true 
    OR public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id())
    OR (public.current_user_role() IN ('staff', 'ordering_staff') AND outlet_id = public.current_user_outlet_id())
  );

DROP POLICY IF EXISTS "Admin manage menu items" ON public.menu_items;
CREATE POLICY "Admin manage menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Manager manage outlet menu items" ON public.menu_items;
CREATE POLICY "Manager manage outlet menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id())
  WITH CHECK (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id());

-- ----------------------------------------------------------------------------
-- Orders Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon create orders" ON public.orders;
CREATE POLICY "Anon create orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon read orders" ON public.orders;
CREATE POLICY "Anon read orders" ON public.orders
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Admin manage all orders" ON public.orders;
CREATE POLICY "Admin manage all orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Manager manage outlet orders" ON public.orders;
CREATE POLICY "Manager manage outlet orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id())
  WITH CHECK (public.current_user_role() = 'manager' AND outlet_id = public.current_user_outlet_id());

DROP POLICY IF EXISTS "Staff read outlet orders" ON public.orders;
CREATE POLICY "Staff read outlet orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('staff', 'ordering_staff') 
    AND outlet_id = public.current_user_outlet_id()
  );

DROP POLICY IF EXISTS "Staff update outlet order status" ON public.orders;
CREATE POLICY "Staff update outlet order status" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('staff', 'ordering_staff') 
    AND outlet_id = public.current_user_outlet_id()
  )
  WITH CHECK (
    public.current_user_role() IN ('staff', 'ordering_staff') 
    AND outlet_id = public.current_user_outlet_id()
  );
