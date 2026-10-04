ALTER TABLE public.bar_settings
  ADD COLUMN IF NOT EXISTS tapa_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS tapa_rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tapa_rounds_after text NOT NULL DEFAULT 'cycle',
  ADD COLUMN IF NOT EXISTS tapa_extra_price numeric NOT NULL DEFAULT 1.5;
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS includes_tapa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tapa_supplement numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tapa_kind text,
  ADD COLUMN IF NOT EXISTS tapa_round integer;
UPDATE public.bar_settings SET tapa_mode = 'house' WHERE free_tapa_with_drink = true;
UPDATE public.items SET includes_tapa = false
  WHERE is_drink AND (name ~* '(agua|caf[eé]|cortado|infusi|zumo|chupito|t[eé] )');
COMMENT ON COLUMN public.bar_settings.free_tapa_with_drink IS 'DEPRECATED: replaced by tapa_mode';