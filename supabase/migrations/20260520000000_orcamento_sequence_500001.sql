-- Redefine a sequence de numero_orcamento para iniciar em 500001
-- ou continuar a partir do maior número já existente, o que for maior.
-- setval(seq, X) define o "último valor usado"; o próximo INSERT receberá X+1.
SELECT setval(
  pg_get_serial_sequence('orcamentos', 'numero_orcamento'),
  GREATEST(
    500000,
    COALESCE((SELECT MAX(numero_orcamento) FROM orcamentos), 500000)
  )
);
