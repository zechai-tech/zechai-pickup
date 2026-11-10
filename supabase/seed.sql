-- ============================================================================
-- Zécha! Seed Data
-- ============================================================================

DO $$
DECLARE
  v_outlet_id uuid;
  v_admin_auth_id uuid := '11218399-c4f2-4018-bb3e-3d964dace318';
BEGIN
  -- 1. Insert default outlet if not exists
  SELECT id INTO v_outlet_id FROM public.outlets WHERE name = 'Zécha! Thamarassery' LIMIT 1;
  IF v_outlet_id IS NULL THEN
    INSERT INTO public.outlets (name, address, opening_time, closing_time, is_active)
    VALUES ('Zécha! Thamarassery', 'Thamarassery, Kozhikode', '15:00', '00:00', true)
    RETURNING id INTO v_outlet_id;
  END IF;

  -- 2. Insert admin user into public.users
  INSERT INTO public.users (id, name, email, password_hash, role, outlet_id, is_active)
  VALUES (
    v_admin_auth_id,
    'Admin',
    'adminzechai@gmail.com',
    '$2a$10$eO1d4B5cK7vW0H2x6qM4J.wKzF6R.k6q9r4.g9zX4X1M6N7L2vP.', -- admin@zechai hash
    'admin',
    NULL,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = 'admin',
    is_active = true;

  -- 3. Insert Menu Items for Zécha! Thamarassery
  DELETE FROM public.menu_items WHERE outlet_id = v_outlet_id;

  INSERT INTO public.menu_items (outlet_id, name, description, price, category, image_url, is_available, is_bestseller, is_veg, sort_order)
  VALUES
    (v_outlet_id, 'Masala Chai', 'Slow-brewed with cardamom, clove and fresh ginger. The cup we are known for.', 49, 'Chai & Coffee', '/assets/chai.jpg', true, true, true, 1),
    (v_outlet_id, 'Cappuccino', 'Double shot, silky foam with roasted Kerala estate Arabica beans.', 89, 'Chai & Coffee', '/assets/latte.jpg', true, false, true, 2),
    (v_outlet_id, 'Iced Tea', 'Refreshing brewed black tea infused with lemon zest and fresh mint leaves.', 79, 'Coolers', '/assets/iced.png', true, true, true, 3),
    (v_outlet_id, 'Crispy Chicken', 'Golden crunchy marinated chicken drumsticks with spiced dip.', 149, 'Chicken', '/assets/chicken-dip.jpg', true, true, false, 4),
    (v_outlet_id, 'Classic Fries', 'Crispy skin-on potato fries sprinkled with Himalayan sea salt.', 99, 'Fries', '/assets/fries-pack.png', true, false, true, 5),
    (v_outlet_id, 'Loaded Fries', 'Cheese sauce, chicken bits, peri spice and spring onions on hot fries.', 129, 'Fries', '/assets/loaded-fries.jpg', true, true, false, 6),
    (v_outlet_id, 'Chicken Sub', 'Herb baguette with grilled pulled chicken and chipotle dressing.', 169, 'Snacks', '/assets/sub.jpg', true, false, false, 7);

END $$;
