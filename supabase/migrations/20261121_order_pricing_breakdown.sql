-- ============================================================================
-- Order Pricing Breakdown Migration (Subtotal, Combo Savings, Packaging Fee)
-- ============================================================================

-- Add nullable columns with safe defaults to public.orders table so old orders keep working
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS combo_savings numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_fee numeric DEFAULT 0;

-- Optional index for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_packaging_fee ON public.orders(packaging_fee);
