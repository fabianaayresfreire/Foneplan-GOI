-- Adiciona coluna de versão (sufixo A, B, C…) para suporte a versionamento de orçamentos.
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS versao TEXT;

-- Remove constraint UNIQUE de numero_orcamento, se existir,
-- para permitir que múltiplas versões compartilhem o mesmo número base.
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_numero_orcamento_key;
