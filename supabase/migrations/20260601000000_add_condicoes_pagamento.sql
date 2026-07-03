-- Adiciona campo condições de pagamento ao orçamento
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT;
