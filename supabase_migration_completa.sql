-- ============================================================
-- Migration: 20260511183323_b989afa3-fa75-4d26-8801-358a184f211a.sql
-- ============================================================
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');
CREATE TYPE public.orcamento_status AS ENUM (
  'rascunho','em_elaboracao','em_revisao','enviado_cliente',
  'em_negociacao','aprovado','reprovado','cancelado','proxima_fase','finalizado'
);
CREATE TYPE public.tipo_projeto AS ENUM ('residencial','corporativo');
CREATE TYPE public.tipo_item AS ENUM (
  'venda_normal','cliente','cortesia','fase_anterior','proxima_fase','opcional','nao_incluso'
);

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========== USER ROLES ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- =========== TRIGGER: novo usuário => profile + role vendedor ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== updated_at trigger ===========
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========== ARQUITETOS ===========
CREATE TABLE public.arquitetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  celular TEXT,
  email TEXT,
  empresa TEXT,
  observacoes TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.arquitetos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_arquitetos_updated BEFORE UPDATE ON public.arquitetos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== CLIENTES ===========
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cliente SERIAL UNIQUE,
  nome_razao_social TEXT NOT NULL,
  cpf_cnpj TEXT,
  rg_inscricao TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  endereco_instalacao TEXT,
  responsavel_obra TEXT,
  celular_responsavel_obra TEXT,
  email_responsavel_obra TEXT,
  arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL,
  informacoes_adicionais TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== PRODUTOS ===========
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  titulo TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  categoria TEXT,
  msrp NUMERIC(14,2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'un',
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== SEGMENTOS ===========
CREATE TABLE public.segmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.segmentos ENABLE ROW LEVEL SECURITY;

-- =========== AMBIENTES ===========
CREATE TABLE public.ambientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ambientes ENABLE ROW LEVEL SECURITY;

-- =========== ORCAMENTOS ===========
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_orcamento SERIAL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vendedor_id UUID NOT NULL REFERENCES auth.users(id),
  nome_projeto TEXT NOT NULL,
  tipo_projeto tipo_projeto NOT NULL DEFAULT 'residencial',
  status orcamento_status NOT NULL DEFAULT 'rascunho',
  observacoes_internas TEXT,
  observacoes_cliente TEXT,
  prazo TEXT,
  garantia TEXT,
  valor_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_final NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_orcamentos_vendedor ON public.orcamentos(vendedor_id);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);

-- =========== ITENS DO ORÇAMENTO ===========
CREATE TABLE public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  segmento_id UUID REFERENCES public.segmentos(id),
  ambiente_id UUID REFERENCES public.ambientes(id),
  produto_id UUID REFERENCES public.produtos(id),
  -- snapshot do produto p/ orçamentos antigos
  produto_titulo TEXT NOT NULL,
  produto_sku TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'un',
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto_item NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tipo_item tipo_item NOT NULL DEFAULT 'venda_normal',
  observacao TEXT,
  ordem_exibicao INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_itens_orc ON public.orcamento_itens(orcamento_id);

-- =========== RLS POLICIES ===========

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- arquitetos: todos autenticados leem; vendedor cria/edita; admin tudo
CREATE POLICY "arq_select_all" ON public.arquitetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "arq_insert_auth" ON public.arquitetos FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "arq_update_auth" ON public.arquitetos FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "arq_delete_admin" ON public.arquitetos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- clientes: igual arquitetos (reaproveitamento entre vendedores é permitido)
CREATE POLICY "cli_select_all" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cli_insert_auth" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cli_update_auth" ON public.clientes FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cli_delete_admin" ON public.clientes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- produtos: leitura para todos autenticados; só admin escreve
CREATE POLICY "prod_select_all" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_admin_write" ON public.produtos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- segmentos
CREATE POLICY "seg_select_all" ON public.segmentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "seg_admin_write" ON public.segmentos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ambientes
CREATE POLICY "amb_select_all" ON public.ambientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "amb_admin_write" ON public.ambientes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- orcamentos: vendedor vê só os seus; admin vê tudo
CREATE POLICY "orc_select_own_or_admin" ON public.orcamentos FOR SELECT TO authenticated
USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orc_insert_own" ON public.orcamentos FOR INSERT TO authenticated
WITH CHECK (vendedor_id = auth.uid());
CREATE POLICY "orc_update_own_or_admin" ON public.orcamentos FOR UPDATE TO authenticated
USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orc_delete_own_or_admin" ON public.orcamentos FOR DELETE TO authenticated
USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- itens: seguem o orçamento pai
CREATE POLICY "itens_select" ON public.orcamento_itens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id
  AND (o.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "itens_write" ON public.orcamento_itens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id
  AND (o.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id
  AND (o.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========== SEEDS ===========
INSERT INTO public.segmentos (nome, ordem) VALUES
  ('Áudio e Vídeo',1),('Automação',2),('Rede Wi-Fi',3),('Aspiração Central',4),
  ('Câmeras',5),('Piso Aquecido',6),('Laundry Jet',7);

INSERT INTO public.ambientes (nome, ordem) VALUES
  ('Gourmet',1),('Hall de entrada',2),('Sala de Estar',3),('Sala de Jantar',4),
  ('Home Theater',5),('Piscina',6),('Área Externa',7),('Cozinha',8),
  ('Suíte Master',9),('Banho Master',10),('Spa',11),('Academia',12),
  ('Garagem',13),('Central de Equipamentos',14),('Quadro de Automação',15),
  ('Distribuição de Rede',16),('Distribuição de Câmeras',17),
  ('Jardim / Paisagismo',18),('Varanda Gourmet',19);

-- ============================================================
-- Migration: 20260511183346_30d71022-3a62-4844-89d4-8b051fec90fb.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Migration: 20260511191726_3e606f51-d3ae-4225-ac7f-c494b4a1df4c.sql
-- ============================================================
ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS orcamentos_vendedor_id_fkey;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_arquiteto_id_fkey;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_arquiteto_id_fkey FOREIGN KEY (arquiteto_id) REFERENCES public.arquitetos(id) ON DELETE SET NULL;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- ============================================================
-- Migration: 20260520000000_orcamento_sequence_500001.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260520000001_add_nome_fantasia.sql
-- ============================================================
-- Adiciona campo "Nome Fantasia" ao catálogo de produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;

-- Replica o campo no item do orçamento (armazenado no momento da seleção,
-- assim o PDF funciona sem precisar de JOIN com a tabela de produtos)
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;

-- ============================================================
-- Migration: 20260520000002_create_kits.sql
-- ============================================================
-- Tabela de kits
CREATE TABLE IF NOT EXISTS kits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  categoria   TEXT,
  status      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID        REFERENCES auth.users(id)
);

-- Itens que compõem cada kit
CREATE TABLE IF NOT EXISTS kit_itens (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id          UUID    NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  descricao       TEXT    NOT NULL,
  produto_codigo  TEXT,
  quantidade      INTEGER NOT NULL DEFAULT 1,
  ordem           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE kits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kits_all"      ON kits      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kit_itens_all" ON kit_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Migration: 20260520000003_add_celular_to_profiles.sql
-- ============================================================
-- Adiciona campo celular ao cadastro de perfis (vendedores)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS celular TEXT;

-- ============================================================
-- Migration: 20260520000004_add_mao_de_obra_to_tipo_item.sql
-- ============================================================
-- Adiciona 'mao_de_obra' ao enum tipo_item
-- Necessário para salvar itens de mão de obra nos orçamentos
ALTER TYPE public.tipo_item ADD VALUE IF NOT EXISTS 'mao_de_obra';

