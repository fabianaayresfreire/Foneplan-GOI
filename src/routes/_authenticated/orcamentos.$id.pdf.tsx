import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { TIPO_ITEM_LABELS, brl } from "@/lib/format";
import { toast } from "sonner";
import logo from "@/assets/foneplan-logo.png";

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  validateSearch: (s: Record<string, unknown>) =>
    ({ download: s.download === "1" || s.download === 1 ? "1" : undefined }) as { download?: "1" },
  component: PdfView,
});

const DIAS = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
function dataExtenso(d: Date) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} DE ${MESES[d.getMonth()]} DE ${d.getFullYear()}`;
}

async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function PdfView() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const [orc, setOrc] = useState<any>(null);
  const [itens, setItens] = useState<any[] | null>(null);
  const [vendedor, setVendedor] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const autoTriggered = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase
        .from("orcamentos")
        .select("*, clientes(*, arquitetos(nome,empresa,telefone,email))")
        .eq("id", id).single();
      setOrc(o);
      if (o?.vendedor_id) {
        const { data: v } = await supabase.from("profiles").select("nome,email").eq("id", o.vendedor_id).single();
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

  const baixarPdf = async () => {
    if (!orc || !itens) {
      toast.error("Aguarde o carregamento do orçamento.");
      return;
    }
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableMod: any = await import("jspdf-autotable");
      const autoTable = autoTableMod.default || autoTableMod;

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 12;

      // Logo
      try {
        const logoData = await loadImageAsDataURL(logo);
        pdf.addImage(logoData, "PNG", margin, 10, 18, 18);
      } catch {}

      // Header center text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("FONEPLAN COM E ADMINISTRACAO LTDA", pageW / 2, 13, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("RUA JOÃO WAGNER WEY, 281 | JARDIM AMERICA | SOROCABA - SP | 18046-695", pageW / 2, 17, { align: "center" });
      pdf.text("FONE (15) 3224-2316    comercial@foneplan.com.br", pageW / 2, 21, { align: "center" });
      pdf.text("CNPJ 01.136.535/0001-57    INSC.EST. 669.348.154.111", pageW / 2, 25, { align: "center" });

      // Pedido box (right)
      const boxW = 32, boxH = 16, boxX = pageW - margin - boxW, boxY = 10;
      pdf.setLineWidth(0.3);
      pdf.rect(boxX, boxY, boxW, boxH);
      pdf.setFontSize(7);
      pdf.text("PEDIDO", boxX + boxW / 2, boxY + 4, { align: "center" });
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(String(orc.numero_orcamento ?? ""), boxX + boxW / 2, boxY + 12, { align: "center" });

      // Cliente block
      const c = orc.clientes || {};
      const enderecoInst = c.endereco_instalacao
        || [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(" - ");

      const clienteRows: [string, string, string?, string?, string?, string?][] = [
        ["NOME/RAZÃO SOCIAL:", c.nome_razao_social || ""],
        ["ENDEREÇO:", c.endereco || ""],
        ["BAIRRO:", c.bairro || "", "CEP:", c.cep || "-", "CIDADE:", `${c.cidade || ""}${c.estado ? ` - ${c.estado}` : ""}`],
        ["TELEFONE:", c.telefone || "-", "CELULAR:", c.celular || "-", "CPF/CNPJ:", c.cpf_cnpj || "-"],
        ["EMAIL:", c.email || "-", "RG/INSCRIÇÃO:", c.rg_inscricao || "-"],
        ["ENDEREÇO DE INSTALAÇÃO:", enderecoInst],
        ["RESPONSÁVEL PELA OBRA:", c.responsavel_obra || "", "CELULAR:", c.celular_responsavel_obra || "-", "EMAIL:", c.email_responsavel_obra || ""],
        ["ARQUITETO:", c.arquitetos?.nome || "", "CELULAR:", c.arquitetos?.telefone || "-", "EMAIL:", c.arquitetos?.email || ""],
        ["INFORMAÇÕES ADICIONAIS:", c.informacoes_adicionais || ""],
      ];

      const clienteBody = clienteRows.map((r) => {
        if (r.length === 2) {
          return [
            { content: r[0], styles: { fontStyle: "bold" as const } },
            { content: r[1] || "", colSpan: 5 },
          ];
        }
        return [
          { content: r[0], styles: { fontStyle: "bold" as const } },
          { content: r[1] || "" },
          { content: r[2] || "", styles: { fontStyle: "bold" as const } },
          { content: r[3] || "" },
          { content: r[4] || "", styles: { fontStyle: "bold" as const } },
          { content: r[5] || "" },
        ];
      });

      autoTable(pdf, {
        startY: 30,
        margin: { left: margin, right: margin },
        body: clienteBody as any,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 18 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 22 },
          5: { cellWidth: "auto" },
        },
      });

      // Itens agrupados
      const grouped: Record<string, Record<string, any[]>> = {};
      itens.forEach((it) => {
        const seg = it.segmentos?.nome || "GERAL";
        const amb = it.ambientes?.nome || "GERAL";
        grouped[seg] = grouped[seg] || {};
        grouped[seg][amb] = grouped[seg][amb] || [];
        grouped[seg][amb].push(it);
      });

      const itemBody: any[] = [];
      Object.entries(grouped).forEach(([seg, ambs]) => {
        itemBody.push([{
          content: seg.toUpperCase(),
          colSpan: 3,
          styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [220, 220, 220] },
        }]);
        Object.entries(ambs).forEach(([amb, list]) => {
          itemBody.push([{
            content: amb.toUpperCase(),
            colSpan: 3,
            styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [240, 240, 240] },
          }]);
          list.forEach((it: any) => {
            const qtd = String(Math.round(Number(it.quantidade)));
            const tipoLabel = it.tipo_item === "venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item] || "");
            const desc = `${it.produto_sku ? it.produto_sku + " " : ""}${it.produto_titulo}${it.observacao ? " - " + it.observacao : ""}`;
            itemBody.push([
              { content: qtd, styles: { halign: "right" as const } },
              { content: desc },
              { content: tipoLabel, styles: { halign: "right" as const } },
            ]);
          });
        });
      });

      autoTable(pdf, {
        startY: (pdf as any).lastAutoTable.finalY + 1,
        margin: { left: margin, right: margin },
        body: itemBody,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 28 },
        },
      });

      // Totais
      const valorBruto = itens
        .filter((i) => ["venda_normal", "cliente"].includes(i.tipo_item))
        .reduce((s, i) => s + Number(i.valor_total || 0), 0);
      const desconto = Number(orc.desconto || 0);
      const valorFinal = Math.max(0, valorBruto - desconto);

      let y = (pdf as any).lastAutoTable.finalY + 4;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Valor bruto: ${brl(valorBruto)}`, pageW - margin, y, { align: "right" });
      y += 4;
      pdf.text(`Desconto: ${brl(desconto)}`, pageW - margin, y, { align: "right" });
      y += 4;
      pdf.setFont("helvetica", "bold");
      pdf.text(`Valor final: ${brl(valorFinal)}`, pageW - margin, y, { align: "right" });
      y += 6;

      // Termos
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(`PRAZO PARA ENTREGA: ${orc.prazo || ""}`, margin, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      const termoGarantia = orc.garantia
        || "Toda instalação e serviços terão garantia de 1 ano, materiais e equipamentos a garantia é de responsabilidade do fabricante.";
      const garantiaTxt = `TERMO DE GARANTIA: ${termoGarantia} Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão acima da especificada pelo fabricante do equipamento.`;
      const garantiaLines = pdf.splitTextToSize(garantiaTxt, pageW - margin * 2);
      pdf.text(garantiaLines, margin, y);
      y += garantiaLines.length * 3.5 + 2;

      if (orc.observacoes_cliente) {
        pdf.setFont("helvetica", "bold");
        pdf.text("OBSERVAÇÕES:", margin, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        const obsLines = pdf.splitTextToSize(orc.observacoes_cliente, pageW - margin * 2);
        pdf.text(obsLines, margin, y);
        y += obsLines.length * 3.5 + 2;
      }

      // Assinatura
      autoTable(pdf, {
        startY: y + 2,
        margin: { left: margin, right: margin },
        body: [[
          { content: dataExtenso(new Date(orc.created_at)), styles: { halign: "center" as const } },
          {
            content: `${(vendedor?.nome || "—").toUpperCase()}\n${vendedor?.email || ""}`,
            styles: { halign: "center" as const, fontStyle: "bold" as const },
          },
        ]],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: (pageW - margin * 2) / 2 } },
      });

      const finalY = (pdf as any).lastAutoTable.finalY;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.rect(margin, finalY, pageW - margin * 2, 6);
      pdf.text("Distribuidor Credenciado", pageW / 2, finalY + 4, { align: "center" });

      const nomeCliente = (orc.clientes?.nome_razao_social || "cliente")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      const fileName = `Foneplan-GOI-${orc.numero_orcamento ?? "sem-numero"}-${nomeCliente}.pdf`;

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success("PDF gerado.");
    } catch (err: any) {
      console.error("[PDF] Falha:", err);
      toast.error("Erro ao gerar PDF: " + (err?.message || "desconhecido"));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (orc && itens && search.download === "1" && !autoTriggered.current) {
      autoTriggered.current = true;
      const t = setTimeout(() => baixarPdf(), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orc, itens, search.download]);

  if (!orc) return <div className="p-8">Carregando...</div>;

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="max-w-3xl mx-auto flex justify-between items-center mb-6">
        <Button asChild variant="ghost">
          <Link to="/orcamentos/$id" params={{ id }}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
        </Button>
        <Button onClick={baixarPdf} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Baixar PDF
        </Button>
      </div>
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-lg p-8">
        <h1 className="text-xl font-bold mb-2">Orçamento #{orc.numero_orcamento}</h1>
        <p className="text-muted-foreground">Cliente: {orc.clientes?.nome_razao_social || "—"}</p>
        <p className="text-muted-foreground">Itens: {itens?.length ?? 0}</p>
        <p className="text-sm mt-4">Clique em "Baixar PDF" para gerar o arquivo.</p>
      </div>
    </div>
  );
}
