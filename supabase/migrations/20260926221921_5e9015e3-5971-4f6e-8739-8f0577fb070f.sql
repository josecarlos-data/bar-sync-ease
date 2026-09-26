ALTER TABLE public.bar_settings
  ADD COLUMN IF NOT EXISTS kitchen_voice text NOT NULL DEFAULT 'device'
    CHECK (kitchen_voice IN ('device','ai')),
  ADD COLUMN IF NOT EXISTS kitchen_voice_auto boolean NOT NULL DEFAULT true;