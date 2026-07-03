-- Migra dados existentes para os 4 novos status
UPDATE public.orcamentos SET status = 'em_elaboracao'   WHERE status IN ('rascunho', 'em_revisao', 'proxima_fase');
UPDATE public.orcamentos SET status = 'enviado_cliente' WHERE status = 'em_negociacao';
UPDATE public.orcamentos SET status = 'cancelado'       WHERE status = 'reprovado';
UPDATE public.orcamentos SET status = 'aprovado'        WHERE status = 'finalizado';

-- Cria novo enum com apenas os 4 status
CREATE TYPE public.orcamento_status_new AS ENUM (
  'em_elaboracao',
  'enviado_cliente',
  'aprovado',
  'cancelado'
);

-- Troca o tipo da coluna
ALTER TABLE public.orcamentos
  ALTER COLUMN status TYPE public.orcamento_status_new
  USING status::text::public.orcamento_status_new;

-- Substitui o enum antigo
DROP TYPE public.orcamento_status;
ALTER TYPE public.orcamento_status_new RENAME TO orcamento_status;
