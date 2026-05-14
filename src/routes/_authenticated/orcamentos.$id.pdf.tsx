import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TIPO_ITEM_LABELS } from "@/lib/format";
import { toast } from "sonner";
import logoUrl from "@/assets/foneplan-logo.png";
import logoRoehnUrl from "@/assets/logo-roehn.png";
import logoFocalUrl from "@/assets/logo-focal.png";
import logoSavantUrl from "@/assets/logo-savant.png";
import logoSonanceUrl from "@/assets/logo-sonance.png";

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  component: PdfView,
});

const DIAS = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

function dataExtenso(d: Date) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} DE ${MESES[d.getMonth()]} DE ${d.getFullYear()}`;
}

async function toDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function PdfView() {
  const { id } = Route.useParams();

  // Dados do orçamento
  const [orc, setOrc]       = useState<any>(null);
  const [itens, setItens]   = useState<any[] | null>(null);
  const [vendedor, setVendedor] = useState<any>(null);

  // Estado do PDF
  const [status, setStatus] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [blobHref, setBlobHref]     = useState<string>("");
  const [fileName, setFileName]     = useState<string>("orcamento.pdf");
  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Pré-carregamentos em paralelo
  const logosRef  = useRef<Record<string, string | null>>({});
  const jspdfRef  = useRef<any>(null);
  const autoRef   = useRef<any>(null);

  // ── Carregar dados do orçamento ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: o } = await supabase
        .from("orcamentos")
        .select("*, clientes(*, arquitetos(nome,empresa,telefone,email))")
        .eq("id", id).single();
      setOrc(o);

      if (o?.vendedor_id) {
        const { data: v } = await supabase
          .from("profiles").select("nome,email,telefone")
          .eq("id", o.vendedor_id).single();
        setVendedor(v);
      }

      const { data: its } = await supabase
        .from("orcamento_itens")
        .select("*, segmentos(nome,ordem), ambientes(nome,ordem)")
        .eq("orcamento_id", id)
        .order("ordem_exibicao");
      setItens(its || []);
    })();
  }, [id]);

  // ── Pré-carregar jsPDF e logos assim que os dados chegam ─────────────
  useEffect(() => {
    if (!orc || !itens) return;
    (async () => {
      const [jspdfMod, autoMod, ...imgs] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
        toDataURL(logoUrl),
        toDataURL(logoRoehnUrl),
        toDataURL(logoFocalUrl),
        toDataURL(logoSavantUrl),
        toDataURL(logoSonanceUrl),
      ]);
      jspdfRef.current  = jspdfMod.jsPDF;
      autoRef.current   = autoMod.default || autoMod;
      logosRef.current  = {
        logo:    imgs[0],
        roehn:   imgs[1],
        focal:   imgs[2],
        savant:  imgs[3],
        sonance: imgs[4],
      };
    })();
  }, [orc, itens]);

  // ── Gerar PDF — chamado pelo botão (gesto do usuário) ────────────────
  const gerarPdf = async () => {
    if (!orc || !itens) { toast.error("Aguarde o carregamento."); return; }

    setStatus("building");
    try {
      // Garantir que os módulos estão carregados
      const JsPDF = jspdfRef.current || (await import("jspdf")).jsPDF;
      const autoTable = autoRef.current || (await import("jspdf-autotable").then(m => m.default || m));

      if (!jspdfRef.current) jspdfRef.current = JsPDF;
      if (!autoRef.current)  autoRef.current  = autoTable;

      const logos = logosRef.current;

      const pdf     = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW   = pdf.internal.pageSize.getWidth();
      const margin  = 12;
      const usableW = pageW - margin * 2;

      // ── Cabeçalho (reutilizado em cada página) ──────────────────────
      const addHeader = () => {
        if (logos.logo) pdf.addImage(logos.logo, "PNG", margin, 8, 20, 20);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("FONEPLAN COM E ADMINISTRACAO LTDA", pageW / 2, 13, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text("RUA JOÃO WAGNER WEY, 281 | JARDIM AMERICA | SOROCABA - SP | 18046-695", pageW / 2, 17.5, { align: "center" });
        pdf.text("FONE (15) 3224-2316    comercial@foneplan.com.br", pageW / 2, 21.5, { align: "center" });
        pdf.text("CNPJ 01.136.535/0001-57    INSC.EST. 669.348.154.111", pageW / 2, 25.5, { align: "center" });

        const bW = 32, bH = 18, bX = pageW - margin - bW, bY = 8;
        pdf.setLineWidth(0.4);
        pdf.rect(bX, bY, bW, bH);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text("PEDIDO", bX + bW / 2, bY + 5, { align: "center" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text(String(orc.numero_orcamento ?? ""), bX + bW / 2, bY + 13, { align: "center" });
        pdf.setTextColor(0, 0, 0);
      };

      addHeader();

      // ── Bloco cliente ───────────────────────────────────────────────
      const c = orc.clientes || {};
      const endInst = c.endereco_instalacao
        || [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(" - ");

      const clienteBody: any[] = [
        [{ content: "NOME/RAZÃO SOCIAL:", styles: { fontStyle: "bold" } }, { content: c.nome_razao_social || "", colSpan: 5 }],
        [{ content: "ENDEREÇO:", styles: { fontStyle: "bold" } }, { content: c.endereco || "", colSpan: 5 }],
        [
          { content: "BAIRRO:", styles: { fontStyle: "bold" } }, { content: c.bairro || "" },
          { content: "CEP:", styles: { fontStyle: "bold" } }, { content: c.cep || "-" },
          { content: "CIDADE:", styles: { fontStyle: "bold" } }, { content: `${c.cidade || ""}${c.estado ? ` - ${c.estado}` : ""}` },
        ],
        [
          { content: "TELEFONE:", styles: { fontStyle: "bold" } }, { content: c.telefone || "-" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } }, { content: c.celular || "-" },
          { content: "CPF/CNPJ:", styles: { fontStyle: "bold" } }, { content: c.cpf_cnpj || "-" },
        ],
        [
          { content: "EMAIL:", styles: { fontStyle: "bold" } }, { content: c.email || "-" },
          { content: "RG/INSCRIÇÃO:", styles: { fontStyle: "bold" } }, { content: c.rg_inscricao || "-", colSpan: 3 },
        ],
        [{ content: "ENDEREÇO DE INSTALAÇÃO:", styles: { fontStyle: "bold" } }, { content: endInst || "-", colSpan: 5 }],
        [
          { content: "RESPONSÁVEL PELA OBRA:", styles: { fontStyle: "bold" } }, { content: c.responsavel_obra || "" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } }, { content: c.celular_responsavel_obra || "-" },
          { content: "EMAIL:", styles: { fontStyle: "bold" } }, { content: c.email_responsavel_obra || "-" },
        ],
        [
          { content: "ARQUITETO:", styles: { fontStyle: "bold" } }, { content: c.arquitetos?.nome || "" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } }, { content: c.arquitetos?.telefone || "-" },
          { content: "EMAIL:", styles: { fontStyle: "bold" } }, { content: c.arquitetos?.email || "-" },
        ],
        [{ content: "INFORMAÇÕES ADICIONAIS:", styles: { fontStyle: "bold" } }, { content: c.informacoes_adicionais || "", colSpan: 5 }],
      ];

      autoTable(pdf, {
        startY: 31,
        margin: { left: margin, right: margin },
        body: clienteBody,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.15, textColor: [0,0,0], overflow: "linebreak" },
        columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 18 }, 3: { cellWidth: "auto" }, 4: { cellWidth: 22 }, 5: { cellWidth: "auto" } },
        didDrawPage: () => addHeader(),
      });

      // ── Itens agrupados por Segmento → Ambiente ─────────────────────
      const grouped: Record<string, Record<string, any[]>> = {};
      itens.forEach((it) => {
        const seg = it.segmentos?.nome?.toUpperCase() || "GERAL";
        const amb = it.ambientes?.nome?.toUpperCase() || "GERAL";
        grouped[seg] = grouped[seg] || {};
        grouped[seg][amb] = grouped[seg][amb] || [];
        grouped[seg][amb].push(it);
      });

      const itemBody: any[] = [];
      Object.entries(grouped).forEach(([seg, ambs]) => {
        itemBody.push([{ content: seg, colSpan: 3, styles: { halign: "center", fontStyle: "bold", fillColor: [210,210,210] } }]);
        Object.entries(ambs).forEach(([amb, list]) => {
          itemBody.push([{ content: amb, colSpan: 3, styles: { halign: "center", fontStyle: "bold", fillColor: [238,238,238] } }]);
          list.forEach((it: any) => {
            const qtd = Number(it.quantidade) % 1 === 0 ? `${Math.round(it.quantidade)},00` : String(it.quantidade);
            const tipo = it.tipo_item === "venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item] || "");
            const desc = `${it.produto_sku ? it.produto_sku + " " : ""}${it.produto_titulo}${it.observacao ? " - " + it.observacao : ""}`;
            itemBody.push([
              { content: qtd, styles: { halign: "right" } },
              { content: desc },
              { content: tipo, styles: { halign: "center", fontStyle: "italic", fontSize: 7 } },
            ]);
          });
        });
      });

      autoTable(pdf, {
        startY: (pdf as any).lastAutoTable.finalY + 1,
        margin: { left: margin, right: margin },
        body: itemBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.15, textColor: [0,0,0] },
        columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 30 } },
        didDrawPage: () => addHeader(),
      });

      // ── Prazo, Garantia, Observações ─────────────────────────────────
      let y = (pdf as any).lastAutoTable.finalY + 5;
      const pageH = pdf.internal.pageSize.getHeight();
      const checkBreak = (h: number) => {
        if (y + h > pageH - 40) { pdf.addPage(); addHeader(); y = 33; }
      };

      pdf.setFontSize(8);
      checkBreak(6);
      pdf.setFont("helvetica", "bold");
      pdf.text(`PRAZO PARA ENTREGA: ${orc.prazo || ""}`, margin, y);
      y += 6;

      const garantiaBody = orc.garantia
        || "Toda instalação e serviços terão garantia de 1 ano, materiais e equipamentos a garantia é de responsabilidade do fabricante.";
      const garantiaExtra = " Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão acima da especificada pelo fabricante do equipamento.";
      const garantiaFull = garantiaBody + garantiaExtra;
      const garantiaLines = pdf.splitTextToSize(garantiaFull, usableW - 44);
      checkBreak(garantiaLines.length * 3.8 + 4);
      pdf.setFont("helvetica", "bold");
      pdf.text("TERMO DE GARANTIA:", margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(garantiaLines, margin + 44, y);
      y += Math.max(garantiaLines.length, 1) * 3.8 + 4;

      if (orc.observacoes_cliente) {
        const obsLines = pdf.splitTextToSize(orc.observacoes_cliente, usableW);
        checkBreak(obsLines.length * 3.8 + 8);
        pdf.setFont("helvetica", "bold");
        pdf.text("OBSERVAÇÕES:", margin, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        pdf.text(obsLines, margin, y);
        y += obsLines.length * 3.8 + 4;
      }

      // ── Assinatura ───────────────────────────────────────────────────
      checkBreak(42);
      const nomeVend = (vendedor?.nome || "—").toUpperCase();
      const telVend  = vendedor?.telefone || "";
      const emailVend = vendedor?.email || "";
      const contatoVend = [telVend, emailVend].filter(Boolean).join("  |  ");

      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        body: [[
          { content: dataExtenso(new Date(orc.created_at)), styles: { halign: "center" } },
          { content: `${nomeVend}\n${contatoVend}`, styles: { halign: "center", fontStyle: "bold" } },
        ]],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
        columnStyles: { 0: { cellWidth: usableW / 2 } },
        didDrawPage: () => addHeader(),
      });

      // ── Rodapé parceiros ─────────────────────────────────────────────
      const pY = (pdf as any).lastAutoTable.finalY;

      // Barra "Distribuidor Credenciado"
      pdf.setFillColor(245, 245, 245);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, pY, usableW, 7, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Distribuidor Credenciado", pageW / 2, pY + 4.5, { align: "center" });

      // Logos
      const lY = pY + 7;
      const lH = 16;
      const slotW = usableW / 4;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.15);
      pdf.rect(margin, lY, usableW, lH, "D");

      const drawLogo = (img: string | null, idx: number, darkBg = false) => {
        const sx = margin + idx * slotW;
        if (darkBg) { pdf.setFillColor(25, 25, 25); pdf.rect(sx, lY, slotW, lH, "F"); }
        if (idx > 0) { pdf.setDrawColor(200,200,200); pdf.line(sx, lY, sx, lY + lH); }
        if (img) pdf.addImage(img, "PNG", sx + 4, lY + 2, slotW - 8, lH - 4, undefined, "FAST");
      };

      drawLogo(logos.savant,  0, true);
      drawLogo(logos.roehn,   1);
      drawLogo(logos.focal,   2);
      drawLogo(logos.sonance, 3);

      // ── Criar blob e expor como link direto ──────────────────────────
      const blob = pdf.output("blob");
      const href = URL.createObjectURL(blob);

      const slug = (orc.clientes?.nome_razao_social || "cliente")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-");
      const name = `Foneplan-${orc.numero_orcamento ?? "sem-numero"}-${slug}.pdf`;

      setBlobHref(href);
      setFileName(name);
      setStatus("ready");

    } catch (err: any) {
      console.error("[PDF] erro:", err);
      toast.error("Erro ao gerar PDF: " + (err?.message || String(err)));
      setStatus("error");
    }
  };

  // Clicar automaticamente no link de download quando ficar pronto
  useEffect(() => {
    if (status === "ready" && blobHref && downloadRef.current) {
      downloadRef.current.click();
    }
  }, [status, blobHref]);

  // Limpar blob URL ao desmontar
  useEffect(() => {
    return () => { if (blobHref) URL.revokeObjectURL(blobHref); };
  }, [blobHref]);

  if (!orc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const c = orc.clientes || {};

  return (
    <div className="bg-background min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto flex items-center mb-6">
        <Button asChild variant="ghost">
          <Link to="/orcamentos/$id" params={{ id }}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Link>
        </Button>
      </div>

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-8 text-center shadow-sm space-y-4">

        {/* Ícone de status */}
        <div className="flex justify-center">
          {status === "ready"
            ? <CheckCircle2 className="h-16 w-16 text-green-500" />
            : status === "error"
            ? <AlertCircle className="h-16 w-16 text-destructive" />
            : <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-8 w-8 text-primary" />
              </div>
          }
        </div>

        <div>
          <h1 className="text-2xl font-bold">Orçamento #{orc.numero_orcamento}</h1>
          <p className="text-muted-foreground text-sm mt-1">{c.nome_razao_social || "—"}</p>
          {orc.nome_projeto && <p className="text-muted-foreground text-sm">{orc.nome_projeto}</p>}
          <p className="text-muted-foreground text-sm">
            {itens ? `${itens.length} iten${itens.length !== 1 ? "s" : ""}` : "Carregando itens..."}
          </p>
        </div>

        {/* Link oculto que será clicado automaticamente quando o blob estiver pronto */}
        <a
          ref={downloadRef}
          href={blobHref}
          download={fileName}
          className="hidden"
          aria-hidden
        />

        {status === "idle" && (
          <Button
            size="lg"
            className="w-full sm:w-auto px-10"
            onClick={gerarPdf}
            disabled={!itens}
          >
            <Download className="h-5 w-5 mr-2" />
            Gerar e Baixar PDF
          </Button>
        )}

        {status === "building" && (
          <Button size="lg" className="w-full sm:w-auto px-10" disabled>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Gerando PDF...
          </Button>
        )}

        {status === "ready" && (
          <div className="space-y-3">
            <p className="text-sm text-green-600 font-medium">PDF gerado! Salvando nos downloads…</p>
            {/* Botão visível como fallback se o clique automático não funcionar */}
            <a href={blobHref} download={fileName}>
              <Button size="lg" className="w-full sm:w-auto px-10">
                <Download className="h-5 w-5 mr-2" />
                Clique aqui para baixar
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Se o download não iniciou automaticamente, clique no botão acima.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Ocorreu um erro ao gerar o PDF.</p>
            <Button size="lg" variant="outline" onClick={() => setStatus("idle")}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
