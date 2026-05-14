import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { TIPO_ITEM_LABELS, brl } from "@/lib/format";
import { toast } from "sonner";
import logo from "@/assets/foneplan-logo.png";
import logoRoehn from "@/assets/logo-roehn.png";
import logoFocal from "@/assets/logo-focal.png";
import logoSavant from "@/assets/logo-savant.png";
import logoSonance from "@/assets/logo-sonance.png";

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  component: PdfView,
});

const DIAS = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
function dataExtenso(d: Date) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} DE ${MESES[d.getMonth()]} DE ${d.getFullYear()}`;
}

async function loadImageAsDataURL(url: string): Promise<string | null> {
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
  const [orc, setOrc] = useState<any>(null);
  const [itens, setItens] = useState<any[] | null>(null);
  const [vendedor, setVendedor] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase
        .from("orcamentos")
        .select("*, clientes(*, arquitetos(nome,empresa,telefone,email))")
        .eq("id", id).single();
      setOrc(o);
      if (o?.vendedor_id) {
        const { data: v } = await supabase.from("profiles").select("nome,email,telefone").eq("id", o.vendedor_id).single();
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
      toast.error("Aguarde o carregamento.");
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

      // ── Cabeçalho (função reutilizável para múltiplas páginas) ──────────
      const addHeader = (p: typeof pdf) => {
        // Logo Foneplan
        if (logoData) p.addImage(logoData, "PNG", margin, 8, 20, 20);

        // Dados empresa — centro
        p.setFont("helvetica", "bold");
        p.setFontSize(10);
        p.text("FONEPLAN COM E ADMINISTRACAO LTDA", pageW / 2, 13, { align: "center" });
        p.setFont("helvetica", "normal");
        p.setFontSize(8);
        p.text("RUA JOÃO WAGNER WEY, 281 | JARDIM AMERICA | SOROCABA - SP | 18046-695", pageW / 2, 17.5, { align: "center" });
        p.text("FONE (15) 3224-2316    comercial@foneplan.com.br", pageW / 2, 21.5, { align: "center" });
        p.text("CNPJ 01.136.535/0001-57    INSC.EST. 669.348.154.111", pageW / 2, 25.5, { align: "center" });

        // Box PEDIDO — direita
        const boxW = 32, boxH = 18, boxX = pageW - margin - boxW, boxY = 8;
        p.setLineWidth(0.4);
        p.rect(boxX, boxY, boxW, boxH);
        p.setFontSize(7);
        p.setFont("helvetica", "normal");
        p.text("PEDIDO", boxX + boxW / 2, boxY + 5, { align: "center" });
        p.setFont("helvetica", "bold");
        p.setFontSize(14);
        p.text(String(orc.numero_orcamento ?? ""), boxX + boxW / 2, boxY + 13, { align: "center" });
      };

      // Carregar logos
      const [logoData, roehnData, focalData, savantData, sonanceData] = await Promise.all([
        loadImageAsDataURL(logo),
        loadImageAsDataURL(logoRoehn),
        loadImageAsDataURL(logoFocal),
        loadImageAsDataURL(logoSavant),
        loadImageAsDataURL(logoSonance),
      ]);

      addHeader(pdf);

      // ── Bloco cliente ──────────────────────────────────────────────────
      const c = orc.clientes || {};
      const enderecoInst = c.endereco_instalacao
        || [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(" - ");

      const clienteBody: any[] = [
        [
          { content: "NOME/RAZÃO SOCIAL:", styles: { fontStyle: "bold" } },
          { content: c.nome_razao_social || "", colSpan: 5 },
        ],
        [
          { content: "ENDEREÇO:", styles: { fontStyle: "bold" } },
          { content: c.endereco || "", colSpan: 5 },
        ],
        [
          { content: "BAIRRO:", styles: { fontStyle: "bold" } },
          { content: c.bairro || "" },
          { content: "CEP:", styles: { fontStyle: "bold" } },
          { content: c.cep || "-" },
          { content: "CIDADE:", styles: { fontStyle: "bold" } },
          { content: `${c.cidade || ""}${c.estado ? ` - ${c.estado}` : ""}` },
        ],
        [
          { content: "TELEFONE:", styles: { fontStyle: "bold" } },
          { content: c.telefone || "-" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } },
          { content: c.celular || "-" },
          { content: "CPF/CNPJ:", styles: { fontStyle: "bold" } },
          { content: c.cpf_cnpj || "-" },
        ],
        [
          { content: "EMAIL:", styles: { fontStyle: "bold" } },
          { content: c.email || "-" },
          { content: "RG/INSCRIÇÃO:", styles: { fontStyle: "bold" } },
          { content: c.rg_inscricao || "-", colSpan: 3 },
        ],
        [
          { content: "ENDEREÇO DE INSTALAÇÃO:", styles: { fontStyle: "bold" } },
          { content: enderecoInst || "-", colSpan: 5 },
        ],
        [
          { content: "RESPONSÁVEL PELA OBRA:", styles: { fontStyle: "bold" } },
          { content: c.responsavel_obra || "" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } },
          { content: c.celular_responsavel_obra || "-" },
          { content: "EMAIL:", styles: { fontStyle: "bold" } },
          { content: c.email_responsavel_obra || "-" },
        ],
        [
          { content: "ARQUITETO:", styles: { fontStyle: "bold" } },
          { content: c.arquitetos?.nome || "" },
          { content: "CELULAR:", styles: { fontStyle: "bold" } },
          { content: c.arquitetos?.telefone || "-" },
          { content: "EMAIL:", styles: { fontStyle: "bold" } },
          { content: c.arquitetos?.email || "-" },
        ],
        [
          { content: "INFORMAÇÕES ADICIONAIS:", styles: { fontStyle: "bold" } },
          { content: c.informacoes_adicionais || "", colSpan: 5 },
        ],
      ];

      autoTable(pdf, {
        startY: 31,
        margin: { left: margin, right: margin },
        body: clienteBody,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 1.2,
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
          textColor: [0, 0, 0],
          overflow: "linebreak",
        },
        columnStyles: {
          0: { cellWidth: 42, fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 18, fontStyle: "bold" },
          3: { cellWidth: "auto" },
          4: { cellWidth: 22, fontStyle: "bold" },
          5: { cellWidth: "auto" },
        },
        didDrawPage: (_data: any) => {
          addHeader(pdf);
        },
      });

      // ── Itens agrupados por Segmento → Ambiente ────────────────────────
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
        // Cabeçalho Segmento — cinza escuro
        itemBody.push([{
          content: seg,
          colSpan: 3,
          styles: {
            halign: "center",
            fontStyle: "bold",
            fillColor: [210, 210, 210],
            textColor: [0, 0, 0],
          },
        }]);
        Object.entries(ambs).forEach(([amb, list]) => {
          // Cabeçalho Ambiente — cinza claro
          itemBody.push([{
            content: amb,
            colSpan: 3,
            styles: {
              halign: "center",
              fontStyle: "bold",
              fillColor: [238, 238, 238],
              textColor: [0, 0, 0],
            },
          }]);
          list.forEach((it: any) => {
            const qtd = Number(it.quantidade) % 1 === 0
              ? `${Math.round(it.quantidade)},00`
              : String(it.quantidade);
            const tipoLabel = it.tipo_item === "venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item] || "");
            const sku = it.produto_sku ? `${it.produto_sku} ` : "";
            const obs = it.observacao ? ` - ${it.observacao}` : "";
            const desc = `${sku}${it.produto_titulo}${obs}`;
            itemBody.push([
              { content: qtd, styles: { halign: "right" } },
              { content: desc },
              { content: tipoLabel, styles: { halign: "center", fontStyle: "italic", fontSize: 7 } },
            ]);
          });
        });
      });

      autoTable(pdf, {
        startY: (pdf as any).lastAutoTable.finalY + 1,
        margin: { left: margin, right: margin },
        body: itemBody,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 1.2,
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: "auto" },
          2: { cellWidth: 30 },
        },
        didDrawPage: (_data: any) => {
          addHeader(pdf);
        },
      });

      // ── Prazo + Garantia + Observações ─────────────────────────────────
      let y = (pdf as any).lastAutoTable.finalY + 5;
      const usableW = pageW - margin * 2;

      const checkPageBreak = (neededH: number) => {
        if (y + neededH > pdf.internal.pageSize.getHeight() - 20) {
          pdf.addPage();
          addHeader(pdf);
          y = 33;
        }
      };

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      checkPageBreak(6);
      pdf.text(`PRAZO PARA ENTREGA: ${orc.prazo || ""}`, margin, y);
      y += 6;

      const termoGarantia = orc.garantia
        || "Toda instalação e serviços terão garantia de 1 ano, materiais e equipamentos a garantia é de responsabilidade do fabricante.";
      const garantiaTxt = "TERMO DE GARANTIA: " + termoGarantia +
        " Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, " +
        "manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, " +
        "oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão " +
        "acima da especificada pelo fabricante do equipamento.";

      pdf.setFont("helvetica", "normal");
      const garantiaLines = pdf.splitTextToSize(garantiaTxt, usableW);
      // Bold apenas o label
      const garantiaParts = pdf.splitTextToSize("TERMO DE GARANTIA:", usableW);
      checkPageBreak(garantiaLines.length * 3.8 + 4);
      pdf.setFont("helvetica", "bold");
      pdf.text("TERMO DE GARANTIA:", margin, y);
      pdf.setFont("helvetica", "normal");
      const garantiaBody = pdf.splitTextToSize(
        termoGarantia + " Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, " +
        "manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, " +
        "oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão " +
        "acima da especificada pelo fabricante do equipamento.",
        usableW - 42
      );
      pdf.text(garantiaBody, margin + 42, y);
      const garantiaH = Math.max(garantiaBody.length, 1) * 3.8;
      y += garantiaH + 3;

      if (orc.observacoes_cliente) {
        checkPageBreak(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("OBSERVAÇÕES:", margin, y);
        y += 4;
        pdf.setFont("helvetica", "normal");
        const obsLines = pdf.splitTextToSize(orc.observacoes_cliente, usableW);
        checkPageBreak(obsLines.length * 3.8 + 4);
        pdf.text(obsLines, margin, y);
        y += obsLines.length * 3.8 + 4;
      }

      // ── Assinatura ─────────────────────────────────────────────────────
      const sigH = 14;
      checkPageBreak(sigH + 28);

      const nomeVend = (vendedor?.nome || "—").toUpperCase();
      const contatoVend = [
        vendedor?.telefone,
        vendedor?.email,
      ].filter(Boolean).join("  |  ") || vendedor?.email || "";

      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        body: [[
          { content: dataExtenso(new Date(orc.created_at)), styles: { halign: "center" } },
          {
            content: `${nomeVend}\n${contatoVend}`,
            styles: { halign: "center", fontStyle: "bold" },
          },
        ]],
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
        },
        columnStyles: { 0: { cellWidth: (usableW) / 2 } },
        didDrawPage: (_data: any) => {
          addHeader(pdf);
        },
      });

      // ── Rodapé parceiros ───────────────────────────────────────────────
      const partnerY = (pdf as any).lastAutoTable.finalY;

      // Barra "Distribuidor Credenciado"
      pdf.setFillColor(245, 245, 245);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, partnerY, usableW, 7, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Distribuidor Credenciado", pageW / 2, partnerY + 4.5, { align: "center" });

      // Logos dos parceiros
      const logoRowY = partnerY + 7;
      const logoRowH = 16;
      const slotW = usableW / 4;

      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.15);
      pdf.rect(margin, logoRowY, usableW, logoRowH, "D");

      const renderLogoInSlot = (
        imgData: string | null,
        slotIndex: number,
        darkBg = false,
        paddingX = 4,
        paddingY = 2
      ) => {
        const slotX = margin + slotIndex * slotW;
        if (darkBg) {
          pdf.setFillColor(25, 25, 25);
          pdf.rect(slotX, logoRowY, slotW, logoRowH, "F");
        }
        // Separador vertical
        if (slotIndex > 0) {
          pdf.setDrawColor(200, 200, 200);
          pdf.line(slotX, logoRowY, slotX, logoRowY + logoRowH);
        }
        if (imgData) {
          const maxW = slotW - paddingX * 2;
          const maxH = logoRowH - paddingY * 2;
          pdf.addImage(imgData, "PNG", slotX + paddingX, logoRowY + paddingY, maxW, maxH, undefined, "FAST");
        }
      };

      renderLogoInSlot(savantData, 0, true, 6, 3);   // Savant — fundo escuro
      renderLogoInSlot(roehnData, 1, false, 4, 2);    // Roehn
      renderLogoInSlot(focalData, 2, false, 4, 2);    // Focal
      renderLogoInSlot(sonanceData, 3, false, 4, 2);  // Sonance

      // ── Gerar e baixar ─────────────────────────────────────────────────
      const nomeCliente = (orc.clientes?.nome_razao_social || "cliente")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      const fileName = `Foneplan-${orc.numero_orcamento ?? "sem-numero"}-${nomeCliente}.pdf`;

      pdf.save(fileName);
      toast.success("PDF baixado com sucesso!");
    } catch (err: any) {
      console.error("[PDF] Erro:", err);
      toast.error("Erro ao gerar PDF: " + (err?.message || "desconhecido"));
    } finally {
      setDownloading(false);
    }
  };

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
      {/* Barra topo */}
      <div className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <Button asChild variant="ghost">
          <Link to="/orcamentos/$id" params={{ id }}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Link>
        </Button>
      </div>

      {/* Card central */}
      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-8 text-center shadow-sm">
        {/* Ícone */}
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Download className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-2xl font-bold mb-1">
          Orçamento #{orc.numero_orcamento}
        </h1>
        <p className="text-muted-foreground mb-1 text-sm">
          {c.nome_razao_social || "—"}
        </p>
        {orc.nome_projeto && (
          <p className="text-muted-foreground text-sm mb-1">{orc.nome_projeto}</p>
        )}
        <p className="text-muted-foreground text-sm mb-6">
          {itens ? `${itens.length} iten${itens.length !== 1 ? "s" : ""}` : "Carregando..."}
        </p>

        <Button
          size="lg"
          className="w-full sm:w-auto px-10 text-base"
          onClick={baixarPdf}
          disabled={downloading || !itens}
        >
          {downloading
            ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gerando PDF...</>
            : <><Download className="h-5 w-5 mr-2" />Baixar PDF</>
          }
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          O arquivo será salvo na pasta de Downloads do seu navegador.
        </p>
      </div>
    </div>
  );
}
