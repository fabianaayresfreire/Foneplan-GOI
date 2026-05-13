ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_vendedor_id_fkey;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_arquiteto_id_fkey;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_arquiteto_id_fkey FOREIGN KEY (arquiteto_id) REFERENCES public.arquitetos(id) ON DELETE SET NULL;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;