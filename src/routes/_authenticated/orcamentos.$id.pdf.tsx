import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import { fmtOrcNumV } from "@/lib/format";
import { gerarPdfBlob, pdfFileName, abrirBlobPdf, type PdfItem } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  component: PdfView,
  validateSearch: (s: Record<string, string>) => ({
    groupOrder: s.groupOrder ?? "",
  }),
});

function PdfView() {
  const { id } = Route.useParams();
  const { groupOrder } = Route.useSearch();
  const [orc,      setOrc]      = useState<any>(null);
  const [itens,    setItens]    = useState<any[] | null>(null);
  const [vendedor, setVendedor] = useState<any>(null);
  const [busy,     setBusy]     = useState(false);
  const [erro,     setErro]     = useState<string>("");
  const [pdfUrl,   setPdfUrl]   = useState<string>("");
  const [pdfName,  setPdfName]  = useState<string>("orcamento.pdf");

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase
        .from("orcamentos")
        .select("*, clientes(*, arquitetos(nome,empresa,telefone,email))")
        .eq("id", id).single();
      setOrc(o);
      if (o?.vendedor_id) {
        const { data: v } = await supabase
          .from("profiles").select("nome,email,celular")
          .eq("id", o.vendedor_id).single();
        setVendedor(v);
      }
      const { data: its } = await supabase
        .from("orcamento_itens")
        .select("*, segmentos(nome,ordem), ambientes(nome,ordem)")
        .eq("orcamento_id", id).order("ordem_exibicao");
      setItens(its ?? []);
    })();
  }, [id]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const gerarPdf = async () => {
    setErro("");
    setBusy(true);
    try {
      if (!orc)   throw new Error("Orçamento não carregado ainda.");
      if (!itens) throw new Error("Itens não carregados ainda.");

      const pdfItens: PdfItem[] = itens.map((it: any) => ({
        segmento_nome: it.segmentos?.nome ?? "GERAL",
        ambiente_nome: it.ambiente_nome ?? it.ambientes?.nome ?? "GERAL",
        nome_fantasia: it.nome_fantasia ?? null,
        produto_titulo: it.produto_titulo,
        observacao: it.observacao ?? null,
        quantidade: it.quantidade,
        tipo_item: it.tipo_item,
        preco_unitario: it.preco_unitario,
        valor_total: it.valor_total,
        desconto_item: it.desconto_item,
      }));

      const blob = await gerarPdfBlob(orc, pdfItens, vendedor, groupOrder || undefined);

      const c    = orc.clientes ?? {};
      const nome = pdfFileName(c.nome_razao_social, orc.numero_orcamento, orc.versao);
      setPdfName(nome);

      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e: any) {
      setErro(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!orc) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const c = orc.clientes ?? {};

  return (
    <div className="bg-background min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto flex items-center mb-6">
        <Button asChild variant="ghost">
          <Link to="/orcamentos/$id" params={{ id }}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Link>
        </Button>
      </div>

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-4 md:p-8 shadow-sm space-y-6">

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Orçamento {fmtOrcNumV(orc.numero_orcamento, orc.versao)}</h1>
            <p className="text-muted-foreground text-sm">{c.nome_razao_social||"—"}</p>
            {orc.nome_projeto && <p className="text-muted-foreground text-sm">{orc.nome_projeto}</p>}
            <p className="text-muted-foreground text-sm">
              {itens===null ? "Carregando itens…" : `${itens.length} ${itens.length===1?"item":"itens"}`}
            </p>
          </div>
        </div>

        {erro && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Erro ao gerar PDF:</strong> {erro}
            <br/><span className="text-xs">Abra o console do navegador (F12) para mais detalhes.</span>
          </div>
        )}

        <Button
          size="lg"
          className="w-full text-base h-12"
          onClick={gerarPdf}
          disabled={busy}
        >
          {busy
            ? <><Loader2 className="h-5 w-5 mr-2 animate-spin"/>Gerando PDF, aguarde…</>
            : <><Download className="h-5 w-5 mr-2"/>Gerar e Baixar PDF</>
          }
        </Button>

        {pdfUrl && !busy && (
          <div className="w-full rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ✅ PDF gerado! Se não abriu automaticamente:
            </p>
            <a href={pdfUrl} download={pdfName} target="_blank" rel="noreferrer" className="block w-full">
              <Button variant="outline" className="w-full border-green-500 text-green-700 hover:bg-green-100">
                <Download className="h-4 w-4 mr-2"/>Clique aqui para baixar o PDF
              </Button>
            </a>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          <span className="hidden sm:inline">O PDF abrirá numa nova aba. Use Ctrl+S (ou o ícone 💾) para salvar.</span>
          <span className="sm:hidden">O PDF abrirá numa nova aba. Toque no ícone de compartilhar para salvar.</span>
        </p>
      </div>
    </div>
  );
}
