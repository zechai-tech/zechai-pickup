-- Add master_item_id and deleted_at to menu_items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS master_item_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_master_item_id ON public.menu_items(master_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at ON public.menu_items(deleted_at);

-- Add master_combo_id and deleted_at to combos
ALTER TABLE public.combos
  ADD COLUMN IF NOT EXISTS master_combo_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_combos_master_combo_id ON public.combos(master_combo_id);
CREATE INDEX IF NOT EXISTS idx_combos_deleted_at ON public.combos(deleted_at);

-- Initialize master_item_id for existing menu_items
UPDATE public.menu_items
SET master_item_id = id
WHERE master_item_id IS NULL;

-- Initialize master_combo_id for existing combos
UPDATE public.combos
SET master_combo_id = id
WHERE master_combo_id IS NULL;
