-- Add push_notified_at column to orders table for idempotent push notifications
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS push_notified_at timestamptz DEFAULT NULL;
