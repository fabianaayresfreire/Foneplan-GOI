ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'aberto'
  CHECK (tipo IN ('fechado', 'aberto'));
