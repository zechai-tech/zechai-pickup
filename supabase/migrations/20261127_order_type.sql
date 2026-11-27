-- Add order_type column to orders table
ALTER TABLE orders
ADD COLUMN order_type text NOT NULL DEFAULT 'pickup'
CHECK (order_type IN ('pickup', 'dine_in'));

-- Update existing orders (all are pickup)
-- No action needed — DEFAULT handles it
