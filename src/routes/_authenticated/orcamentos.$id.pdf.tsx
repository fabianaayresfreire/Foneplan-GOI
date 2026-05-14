import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import { TIPO_ITEM_LABELS } from "@/lib/format";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl    from "@/assets/foneplan-logo.png";
import logoRoehn  from "@/assets/logo-roehn.png";
import logoFocal  from "@/assets/logo-focal.png";
import logoSavant from "@/assets/logo-savant.png";
import logoSonance from "@/assets/logo-sonance.png";

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  component: PdfView,
});

const DIAS  = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const dataExtenso = (d: Date) =>
  `${DIAS[d.getDay()]}, ${d.getDate()} DE ${MESES[d.getMonth()]} DE ${d.getFullYear()}`;

async function imgToDataURL(src: string): Promise<string | null> {
  try {
    const r = await fetch(src);
    const b = await r.blob();
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload  = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

function PdfView() {
  const { id } = Route.useParams();
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
          .from("profiles").select("nome,email,telefone")
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

  // Limpa a blob URL ao desmontar
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const gerarPdf = async () => {
    setErro("");
    setBusy(true);
    try {
      if (!orc)   throw new Error("Orçamento não carregado ainda.");
      if (!itens) throw new Error("Itens não carregados ainda.");

      // ── Carregar logos em paralelo ──────────────────────────────────
      const [iLogo, iRoehn, iFocal, iSavant, iSonance] = await Promise.all([
        imgToDataURL(logoUrl),
        imgToDataURL(logoRoehn),
        imgToDataURL(logoFocal),
        imgToDataURL(logoSavant),
        imgToDataURL(logoSonance),
      ]);

      const pdf    = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW  = pdf.internal.pageSize.getWidth();
      const margin = 12;
      const usableW = pageW - margin * 2;

      // ── Cabeçalho ───────────────────────────────────────────────────
      const header = () => {
        if (iLogo) pdf.addImage(iLogo, "PNG", margin, 8, 20, 20);
        pdf.setFont("helvetica", "bold");  pdf.setFontSize(10);
        pdf.text("FONEPLAN COM E ADMINISTRACAO LTDA", pageW/2, 13, { align:"center" });
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
        pdf.text("RUA JOÃO WAGNER WEY, 281 | JARDIM AMERICA | SOROCABA - SP | 18046-695", pageW/2, 17.5, {align:"center"});
        pdf.text("FONE (15) 3224-2316    comercial@foneplan.com.br",           pageW/2, 21.5, {align:"center"});
        pdf.text("CNPJ 01.136.535/0001-57    INSC.EST. 669.348.154.111",       pageW/2, 25.5, {align:"center"});
        const bW=32, bH=18, bX=pageW-margin-bW, bY=8;
        pdf.setLineWidth(0.4); pdf.rect(bX, bY, bW, bH);
        pdf.setFontSize(7); pdf.setFont("helvetica","normal");
        pdf.text("PEDIDO", bX+bW/2, bY+5, {align:"center"});
        pdf.setFont("helvetica","bold"); pdf.setFontSize(14);
        pdf.text(String(orc.numero_orcamento??""), bX+bW/2, bY+13, {align:"center"});
        pdf.setTextColor(0,0,0);
      };
      header();

      // ── Bloco cliente ───────────────────────────────────────────────
      const c = orc.clientes ?? {};
      const endInst = c.endereco_instalacao
        || [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(" - ");
      const B = (t: string) => ({ content: t, styles:{ fontStyle:"bold" as const } });
      const clienteBody = [
        [B("NOME/RAZÃO SOCIAL:"), {content: c.nome_razao_social||"", colSpan:5}],
        [B("ENDEREÇO:"),           {content: c.endereco||"",         colSpan:5}],
        [B("BAIRRO:"), {content:c.bairro||""}, B("CEP:"), {content:c.cep||"-"}, B("CIDADE:"), {content:`${c.cidade||""}${c.estado?` - ${c.estado}`:""}`}],
        [B("TELEFONE:"), {content:c.telefone||"-"}, B("CELULAR:"), {content:c.celular||"-"}, B("CPF/CNPJ:"), {content:c.cpf_cnpj||"-"}],
        [B("EMAIL:"), {content:c.email||"-"}, B("RG/INSCRIÇÃO:"), {content:c.rg_inscricao||"-", colSpan:3}],
        [B("ENDEREÇO DE INSTALAÇÃO:"), {content:endInst||"-", colSpan:5}],
        [B("RESPONSÁVEL PELA OBRA:"), {content:c.responsavel_obra||""}, B("CELULAR:"), {content:c.celular_responsavel_obra||"-"}, B("EMAIL:"), {content:c.email_responsavel_obra||"-"}],
        [B("ARQUITETO:"), {content:c.arquitetos?.nome||""}, B("CELULAR:"), {content:c.arquitetos?.telefone||"-"}, B("EMAIL:"), {content:c.arquitetos?.email||"-"}],
        [B("INFORMAÇÕES ADICIONAIS:"), {content:c.informacoes_adicionais||"", colSpan:5}],
      ];
      autoTable(pdf, {
        startY: 31, margin:{left:margin, right:margin}, body: clienteBody, theme:"grid",
        styles:{fontSize:7.5, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
        columnStyles:{0:{cellWidth:42},1:{cellWidth:"auto"},2:{cellWidth:18},3:{cellWidth:"auto"},4:{cellWidth:22},5:{cellWidth:"auto"}},
        didDrawPage: () => header(),
      });

      // ── Itens ────────────────────────────────────────────────────────
      const grouped: Record<string,Record<string,any[]>> = {};
      itens.forEach(it => {
        const seg = (it.segmentos?.nome ?? "GERAL").toUpperCase();
        const amb = (it.ambientes?.nome ?? "GERAL").toUpperCase();
        (grouped[seg] ??= {})[amb] ??= [];
        grouped[seg][amb].push(it);
      });
      const rows: any[] = [];
      for (const [seg, ambs] of Object.entries(grouped)) {
        rows.push([{content:seg, colSpan:3, styles:{halign:"center",fontStyle:"bold",fillColor:[210,210,210]}}]);
        for (const [amb, list] of Object.entries(ambs)) {
          rows.push([{content:amb, colSpan:3, styles:{halign:"center",fontStyle:"bold",fillColor:[238,238,238]}}]);
          for (const it of list) {
            const qtd  = Number(it.quantidade)%1===0 ? `${Math.round(it.quantidade)},00` : String(it.quantidade);
            const tipo = it.tipo_item==="venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item]??"");
            const desc = `${it.produto_sku?it.produto_sku+" ":""}${it.produto_titulo}${it.observacao?" - "+it.observacao:""}`;
            rows.push([
              {content:qtd,  styles:{halign:"right"}},
              {content:desc},
              {content:tipo, styles:{halign:"center",fontStyle:"italic",fontSize:7}},
            ]);
          }
        }
      }
      autoTable(pdf, {
        startY:(pdf as any).lastAutoTable.finalY+1, margin:{left:margin,right:margin},
        body:rows, theme:"grid",
        styles:{fontSize:8, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0]},
        columnStyles:{0:{cellWidth:16},1:{cellWidth:"auto"},2:{cellWidth:30}},
        didDrawPage: () => header(),
      });

      // ── Prazo / Garantia / Observações ───────────────────────────────
      let y = (pdf as any).lastAutoTable.finalY + 5;
      const pH = pdf.internal.pageSize.getHeight();
      const chk = (h:number) => { if(y+h > pH-42){pdf.addPage(); header(); y=33;} };

      pdf.setFontSize(8);
      chk(6); pdf.setFont("helvetica","bold");
      pdf.text(`PRAZO PARA ENTREGA: ${orc.prazo||""}`, margin, y); y+=6;

      const gExtra = " Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão acima da especificada pelo fabricante do equipamento.";
      const gText  = (orc.garantia || "Toda instalação e serviços terão garantia de 1 ano, materiais e equipamentos a garantia é de responsabilidade do fabricante.") + gExtra;
      const gLines = pdf.splitTextToSize(gText, usableW-44);
      chk(gLines.length*3.8+4);
      pdf.setFont("helvetica","bold");  pdf.text("TERMO DE GARANTIA:", margin, y);
      pdf.setFont("helvetica","normal"); pdf.text(gLines, margin+44, y);
      y += gLines.length*3.8+4;

      if (orc.observacoes_cliente) {
        const oLines = pdf.splitTextToSize(orc.observacoes_cliente, usableW);
        chk(oLines.length*3.8+8);
        pdf.setFont("helvetica","bold"); pdf.text("OBSERVAÇÕES:", margin, y); y+=4;
        pdf.setFont("helvetica","normal"); pdf.text(oLines, margin, y); y+=oLines.length*3.8+4;
      }

      // ── Assinatura ───────────────────────────────────────────────────
      chk(42);
      const nV = (vendedor?.nome||"—").toUpperCase();
      const cV = [vendedor?.telefone, vendedor?.email].filter(Boolean).join("  |  ");
      autoTable(pdf, {
        startY:y, margin:{left:margin,right:margin},
        body:[[
          {content:dataExtenso(new Date(orc.created_at)), styles:{halign:"center"}},
          {content:`${nV}\n${cV}`, styles:{halign:"center",fontStyle:"bold"}},
        ]],
        theme:"grid",
        styles:{fontSize:8, cellPadding:3, lineColor:[0,0,0], lineWidth:0.2, textColor:[0,0,0]},
        columnStyles:{0:{cellWidth:usableW/2}},
        didDrawPage: () => header(),
      });

      // ── Rodapé parceiros ─────────────────────────────────────────────
      const pY = (pdf as any).lastAutoTable.finalY;
      pdf.setFillColor(245,245,245); pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.2);
      pdf.rect(margin, pY, usableW, 7, "FD");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(8);
      pdf.text("Distribuidor Credenciado", pageW/2, pY+4.5, {align:"center"});

      const lY=pY+7, lH=16, slotW=usableW/4;
      pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.15);
      pdf.rect(margin, lY, usableW, lH, "D");
      const logo4 = (img:string|null, i:number, dark=false) => {
        const sx=margin+i*slotW;
        if(dark){pdf.setFillColor(25,25,25); pdf.rect(sx,lY,slotW,lH,"F");}
        if(i>0){pdf.setDrawColor(200,200,200); pdf.line(sx,lY,sx,lY+lH);}
        if(img) pdf.addImage(img,"PNG",sx+4,lY+2,slotW-8,lH-4,undefined,"FAST");
      };
      logo4(iSavant,0,true); logo4(iRoehn,1); logo4(iFocal,2); logo4(iSonance,3);

      // ── Entregar o arquivo ───────────────────────────────────────────
      const slug = (c.nome_razao_social||"cliente")
        .normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-");
      const nome = `Foneplan-${orc.numero_orcamento??""}-${slug}.pdf`;
      setPdfName(nome);

      // Criar blob URL e abrir numa nova aba do browser
      // (abre o visualizador de PDF nativo — o usuário salva de lá ou vê o botão de baixar)
      const blob = pdf.output("blob");
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);

      // Tenta abrir em nova aba (mostra o PDF completo no browser)
      const nova = window.open(url, "_blank");
      if (!nova) {
        // Popup bloqueado — fallback: forçar download via link
        const a = document.createElement("a");
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }

    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setErro(msg);
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

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">

        {/* Info do orçamento */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Orçamento #{orc.numero_orcamento}</h1>
            <p className="text-muted-foreground text-sm">{c.nome_razao_social||"—"}</p>
            {orc.nome_projeto && <p className="text-muted-foreground text-sm">{orc.nome_projeto}</p>}
            <p className="text-muted-foreground text-sm">
              {itens===null ? "Carregando itens…" : `${itens.length} ${itens.length===1?"item":"itens"}`}
            </p>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Erro ao gerar PDF:</strong> {erro}
            <br/><span className="text-xs">Abra o console do navegador (F12) para mais detalhes.</span>
          </div>
        )}

        {/* Botão principal */}
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

        {/* Link de fallback se a nova aba foi bloqueada */}
        {pdfUrl && !busy && (
          <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 p-4 text-center space-y-2">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ✅ PDF gerado! Se não abriu automaticamente:
            </p>
            <a href={pdfUrl} download={pdfName} target="_blank" rel="noreferrer">
              <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-100">
                <Download className="h-4 w-4 mr-2"/>Clique aqui para baixar o PDF
              </Button>
            </a>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          O PDF abrirá numa nova aba do navegador. Use Ctrl+S (ou o ícone 💾) para salvar.
        </p>
      </div>
    </div>
  );
}
