-- Adiciona o valor 'cabos' ao enum tipo_item para permitir itens de cabos por ambiente.
ALTER TYPE public.tipo_item ADD VALUE IF NOT EXISTS 'cabos';
