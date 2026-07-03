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
