-- Migration: Global app settings table and toggles for combos and packaging fee
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert the two toggle rows
INSERT INTO public.app_settings (key, value) VALUES
  ('combos_enabled', '{"enabled": true}'::jsonb),
  ('packaging_fee_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Anyone can read app_settings'
  ) THEN
    CREATE POLICY "Anyone can read app_settings"
      ON public.app_settings FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;
