ALTER TYPE public.line_status ADD VALUE IF NOT EXISTS 'preparing' AFTER 'pending';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS started_at timestamptz;