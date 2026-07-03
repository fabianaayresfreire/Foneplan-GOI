-- Redefine a sequência de numero_orcamento para o próximo INSERT receber 50000.
-- Orçamentos já existentes (>= 500001) não são afetados.
SELECT setval(
  pg_get_serial_sequence('orcamentos', 'numero_orcamento'),
  49999
);
