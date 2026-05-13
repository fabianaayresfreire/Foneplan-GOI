## Correções no fluxo de orçamento

**1. Busca de produtos (1.084 itens não cabem no limite padrão de 1.000)**
- Reescrever `ProdutoCombobox` para buscar no banco com debounce (300ms): `.from("produtos").select("id,titulo,sku,marca,modelo,unidade,msrp").or("titulo.ilike.%q%,sku.ilike.%q%,marca.ilike.%q%,modelo.ilike.%q%").eq("status",true).limit(50)`.
- Carga inicial: 50 produtos por título.
- Remover o pré-carregamento de todos os produtos no `OrcamentoEditor`.

**2. Cadastro inline de Segmento e Ambiente — só admin**
- No `OrcamentoEditor`, ler `isAdmin` do `useAuth`.
- O item "+ Novo segmento" e "+ Novo ambiente" só aparece para admin.
- Para vendedor: item desabilitado com texto cinza "Apenas administradores podem cadastrar — peça ao admin".
- Sem mudança de RLS, mantém regra atual do banco.

**3. Diálogo de novo cliente — feedback de erro**
- Garantir `toast.error(error.message)` visível em qualquer falha (já existe; revisar).
- Após salvar, selecionar automaticamente no `Select` (já implementado; validar no preview).

**4. Validação visual + spinner + toast com número**
- Já implementados. Apenas testar no preview que aparecem corretamente.

**5. Roteamento — confirmar funcionamento**
- A estrutura atual (`orcamentos.index.tsx`, `orcamentos.novo.tsx`, `orcamentos.$id.tsx`, `orcamentos.$id.pdf.tsx`) está correta.
- Testar abrir cada uma no preview após as mudanças e confirmar que "Novo orçamento", "Editar" e "PDF" funcionam.

## Arquivos
- `src/components/ProdutoCombobox.tsx` — busca server-side com debounce.
- `src/components/OrcamentoEditor.tsx` — remover preload de produtos; gating admin no "+ Novo seg/amb"; passar `query` ao combobox.

## Sem mudanças
- Banco de dados (RLS atual mantida).
- Demais rotas e telas.