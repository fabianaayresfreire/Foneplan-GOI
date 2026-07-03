-- Adiciona campo "Nome Fantasia" ao catálogo de produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;

-- Replica o campo no item do orçamento (armazenado no momento da seleção,
-- assim o PDF funciona sem precisar de JOIN com a tabela de produtos)
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
