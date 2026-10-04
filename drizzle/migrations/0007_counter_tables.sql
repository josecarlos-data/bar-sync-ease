ALTER TABLE public.tables ADD COLUMN kind text NOT NULL DEFAULT 'table';
ALTER TABLE public.tables ADD CONSTRAINT tables_kind_check CHECK (kind IN ('table','counter'));