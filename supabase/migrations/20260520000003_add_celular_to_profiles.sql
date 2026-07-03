-- Adiciona campo celular ao cadastro de perfis (vendedores)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS celular TEXT;
