-- Permite que qualquer usuário autenticado crie novos ambientes durante o orçamento.
-- UPDATE e DELETE continuam restritos a admins via amb_admin_write.
CREATE POLICY "amb_vendor_insert"
  ON public.ambientes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
