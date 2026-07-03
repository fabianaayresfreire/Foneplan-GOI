-- Adiciona 'mao_de_obra' ao enum tipo_item
-- Necessário para salvar itens de mão de obra nos orçamentos
ALTER TYPE public.tipo_item ADD VALUE IF NOT EXISTS 'mao_de_obra';
