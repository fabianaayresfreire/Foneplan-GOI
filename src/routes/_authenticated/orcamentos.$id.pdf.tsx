import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
import { TIPO_ITEM_LABELS, fmtOrcNumV, brl } from "@/lib/format";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl    from "@/assets/foneplan-logo.png";         // Foneplan (cabeçalho)
import logoSavant  from "@/assets/logo-savant-white.png";   // branco  → fundo escuro
import logoRoehn   from "@/assets/logo-roehn-black.png";    // preto   → fundo branco
import logoFocal   from "@/assets/logo-focal-black.png";    // preto   → fundo branco
import logoSonance from "@/assets/logo-sonance-white.png";  // branco  → fundo escuro

export const Route = createFileRoute("/_authenticated/orcamentos/$id/pdf")({
  component: PdfView,
  validateSearch: (s: Record<string, string>) => ({
    groupOrder: s.groupOrder ?? "",
  }),
});

const DIAS  = ["DOMINGO","SEGUNDA-FEIRA","TERÇA-FEIRA","QUARTA-FEIRA","QUINTA-FEIRA","SEXTA-FEIRA","SÁBADO"];
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const dataExtenso = (d: Date) =>
  `${DIAS[d.getDay()]}, ${d.getDate()} DE ${MESES[d.getMonth()]} DE ${d.getFullYear()}`;

type ImgData = { url: string; w: number; h: number };

async function loadImg(src: string): Promise<ImgData | null> {
  try {
    const r = await fetch(src);
    const b = await r.blob();

    const [url, dims] = await Promise.all([
      // data URL para jsPDF
      new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload  = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      }),
      // dimensões lidas direto do cabeçalho PNG (IHDR: bytes 16-19 = width, 20-23 = height)
      new Promise<{ w: number; h: number }>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => {
          try {
            const view = new DataView(fr.result as ArrayBuffer);
            res({ w: view.getUint32(16), h: view.getUint32(20) });
          } catch (e) { rej(e); }
        };
        fr.onerror = rej;
        fr.readAsArrayBuffer(b.slice(0, 24));
      }),
    ]);

    return { url, ...dims };
  } catch { return null; }
}

/** Renderiza uma imagem mantendo proporção (contain) centrada dentro de uma caixa. */
function addImgContain(
  pdf: jsPDF,
  img: ImgData | null,
  boxX: number, boxY: number, boxW: number, boxH: number,
  compression: "NONE" | "FAST" | "MEDIUM" | "SLOW" = "FAST",
) {
  if (!img) return;
  const ar = img.w / img.h;
  let dw: number, dh: number;
  if (boxW / boxH > ar) { dw = boxH * ar; dh = boxH; }
  else                  { dw = boxW;      dh = boxW / ar; }
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;
  pdf.addImage(img.url, "PNG", dx, dy, dw, dh, undefined, compression);
}

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

  // Limpa a blob URL ao desmontar
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const gerarPdf = async () => {
    setErro("");
    setBusy(true);
    try {
      if (!orc)   throw new Error("Orçamento não carregado ainda.");
      if (!itens) throw new Error("Itens não carregados ainda.");

      // ── Carregar logos em paralelo ──────────────────────────────────
      const [iLogo, iSavant, iRoehn, iFocal, iSonance] = await Promise.all([
        loadImg(logoUrl),
        loadImg(logoSavant),
        loadImg(logoRoehn),
        loadImg(logoFocal),
        loadImg(logoSonance),
      ]);

      const pdf    = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW  = pdf.internal.pageSize.getWidth();
      const margin = 12;
      const usableW = pageW - margin * 2;

      // ── Cabeçalho ───────────────────────────────────────────────────
      const header = () => {
        addImgContain(pdf, iLogo, margin, 8, 20, 20);
        pdf.setFont("helvetica", "bold");  pdf.setFontSize(10);
        pdf.text("FONEPLAN COM E ADMINISTRACAO LTDA", pageW/2, 13, { align:"center" });
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
        pdf.text("RUA JOÃO WAGNER WEY, 281 | JARDIM AMERICA | SOROCABA - SP | 18046-695", pageW/2, 17.5, {align:"center"});
        pdf.text("FONE (15) 3224-2316    comercial@foneplan.com.br",           pageW/2, 21.5, {align:"center"});
        pdf.text("CNPJ 01.136.535/0001-57    INSC.EST. 669.348.154.111",       pageW/2, 25.5, {align:"center"});
        const bW=32, bH=18, bX=pageW-margin-bW, bY=8;
        pdf.setLineWidth(0.4); pdf.rect(bX, bY, bW, bH);
        pdf.setFontSize(7); pdf.setFont("helvetica","normal");
        pdf.text(orc.status === "aprovado" ? "PEDIDO" : "ORÇAMENTO", bX+bW/2, bY+5, {align:"center"});
        pdf.setFont("helvetica","bold"); pdf.setFontSize(11);
        pdf.text(fmtOrcNumV(orc.numero_orcamento, orc.versao), bX+bW/2, bY+13, {align:"center"});
        pdf.setTextColor(0,0,0);
      };
      header();

      // ── Bloco cliente ───────────────────────────────────────────────
      const c = orc.clientes ?? {};
      const endInst = c.endereco_instalacao
        || [c.endereco, c.bairro, c.cidade, c.estado].filter(Boolean).join(" - ");
      const B = (t: string) => ({ content: t, styles:{ fontStyle:"bold" as const } });
      const clienteBody: any[] = [
        [B("NOME/RAZÃO SOCIAL:"), {content: c.nome_razao_social||"", colSpan:5}],
        ...(c.nome_fantasia ? [[B("NOME FANTASIA:"), {content: c.nome_fantasia, colSpan:5}]] : []),
        [B("ENDEREÇO:"),           {content: c.endereco||"",         colSpan:5}],
        [B("BAIRRO:"), {content:c.bairro||""}, B("CEP:"), {content:c.cep||"-"}, B("CIDADE:"), {content:`${c.cidade||""}${c.estado?` - ${c.estado}`:""}`}],
        [B("TELEFONE:"), {content:c.telefone||"-"}, B("CELULAR:"), {content:c.celular||"-"}, B("CPF/CNPJ:"), {content:c.cpf_cnpj||"-"}],
        [B("EMAIL:"), {content:c.email||"-", colSpan:2}, B("RG / INSCRIÇÃO:"), {content:c.rg_inscricao||"-", colSpan:2}],
        [B("ENDEREÇO DE INSTALAÇÃO:"), {content:endInst||"-", colSpan:5}],
        [B("RESPONSÁVEL PELA OBRA:"), {content:c.responsavel_obra||""}, B("CELULAR:"), {content:c.celular_responsavel_obra||"-"}, B("EMAIL:"), {content:c.email_responsavel_obra||"-"}],
        [B("ARQUITETO:"), {content:c.arquitetos?.nome||""}, B("CELULAR:"), {content:c.arquitetos?.telefone||"-"}, B("EMAIL:"), {content:c.arquitetos?.email||"-"}],
        [B("OBSERVAÇÕES DE PROJETO:"), {content:orc.observacoes_cliente||"", colSpan:5}],
      ];
      autoTable(pdf, {
        startY: 31, margin:{left:margin, right:margin, top:33}, body: clienteBody, theme:"grid",
        styles:{fontSize:7.5, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
        columnStyles:{0:{cellWidth:42},1:{cellWidth:"auto"},2:{cellWidth:18},3:{cellWidth:"auto"},4:{cellWidth:22},5:{cellWidth:"auto"}},
        didDrawPage: () => header(),
      });

      // ── Todos os itens agrupados por segmento > ambiente ──────────────
      // Mão de obra e Cabos aparecem inline dentro do ambiente correspondente
      const grouped: Record<string,Record<string,any[]>> = {};
      itens.forEach(it => {
        const seg = (it.segmentos?.nome ?? "GERAL").toUpperCase();
        const amb = (it.ambiente_nome ?? it.ambientes?.nome ?? "GERAL").toUpperCase();
        (grouped[seg] ??= {})[amb] ??= [];
        grouped[seg][amb].push(it);
      });

      // Cabeçalho fixo da tabela de itens
      const itemHead = [[
        {content:"QTD",      styles:{halign:"center" as const, fontStyle:"bold" as const}},
        {content:"DESCRIÇÃO",styles:{fontStyle:"bold" as const}},
        {content:"TIPO",     styles:{halign:"center" as const, fontStyle:"bold" as const}},
        {content:"PREÇO UN.",styles:{halign:"right"  as const, fontStyle:"bold" as const}},
        {content:"TOTAL",    styles:{halign:"right"  as const, fontStyle:"bold" as const}},
      ]];

      // ── Ordem dos pares seg|amb (padrão ou customizada) ─────────────
      let orderedPairs: [string, string][];
      if (groupOrder) {
        try {
          const custom: string[] = JSON.parse(groupOrder);
          orderedPairs = custom.map(k => {
            const idx = k.indexOf("|||");
            return [k.slice(0, idx), k.slice(idx + 3)] as [string, string];
          });
          // Adiciona pares ausentes na ordem customizada (segurança)
          for (const [seg, ambs] of Object.entries(grouped)) {
            for (const amb of Object.keys(ambs)) {
              if (!custom.includes(`${seg}|||${amb}`)) orderedPairs.push([seg, amb]);
            }
          }
        } catch {
          orderedPairs = Object.entries(grouped).flatMap(([seg, ambs]) =>
            Object.keys(ambs).map(amb => [seg, amb] as [string, string])
          );
        }
      } else {
        orderedPairs = Object.entries(grouped).flatMap(([seg, ambs]) =>
          Object.keys(ambs).map(amb => [seg, amb] as [string, string])
        );
      }

      const rows: any[] = [];
      let lastSeg = "";
      let segTotal = 0;
      let segDesconto = 0;

      const emitSegSubtotal = () => {
        if (segDesconto > 0) {
          rows.push([
            {content:"", colSpan:3, styles:{lineColor:[220,220,220] as any}},
            {content:"DESCONTO:", styles:{halign:"right" as const, fontStyle:"bold" as const, fontSize:7.5}},
            {content:brl(segDesconto), styles:{halign:"right" as const, fontSize:7.5}},
          ]);
        }
        rows.push([
          {content:"", colSpan:3, styles:{lineColor:[220,220,220] as any}},
          {content:"TOTAL:", styles:{halign:"right" as const, fontStyle:"bold" as const, fillColor:[235,235,235], fontSize:7.5}},
          {content:brl(segTotal), styles:{halign:"right" as const, fontStyle:"bold" as const, fillColor:[235,235,235], fontSize:7.5}},
        ]);
      };

      for (const [seg, amb] of orderedPairs) {
        const list = grouped[seg]?.[amb];
        if (!list) continue;
        if (seg !== lastSeg) {
          if (lastSeg !== "") emitSegSubtotal();
          rows.push([{content:seg, colSpan:5, styles:{halign:"center" as const,fontStyle:"bold" as const,fillColor:[210,210,210]}}]);
          lastSeg = seg; segTotal = 0; segDesconto = 0;
        }
        rows.push([{content:amb, colSpan:5, styles:{halign:"center" as const,fontStyle:"bold" as const,fillColor:[238,238,238]}}]);
        for (const it of list) {
          const qtd  = Number(it.quantidade)%1===0 ? `${Math.round(it.quantidade)},00` : String(it.quantidade);
          const isPaying = it.tipo_item === "venda_normal" || it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos";
          const showPrecoUn = it.tipo_item === "venda_normal";
          const tipo = it.tipo_item === "venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item]??"");
          const descProduto = it.nome_fantasia ? it.nome_fantasia : it.produto_titulo;
          const desc = `${descProduto}${it.observacao ? " - " + it.observacao : ""}`;
          rows.push([
            {content:qtd,                                        styles:{halign:"right" as const}},
            {content:desc},
            {content:tipo,                                       styles:{halign:"center" as const,fontStyle:"italic" as const,fontSize:7}},
            {content:showPrecoUn ? brl(it.preco_unitario) : "",  styles:{halign:"right" as const,fontSize:7.5}},
            {content:isPaying    ? brl(it.valor_total)    : "",  styles:{halign:"right" as const,fontSize:7.5}},
          ]);
          if (isPaying) {
            segTotal    += Number(it.valor_total)    || 0;
            segDesconto += Number(it.desconto_item)  || 0;
          }
        }
      }
      if (lastSeg !== "") emitSegSubtotal();

      // ── Totais gerais (após todos os segmentos) ──────────────────────
      const descontoGeral = Number(orc.desconto)     || 0;
      const valorFinalOrc = Number(orc.valor_final)  || 0;

      if (descontoGeral > 0) {
        rows.push([
          {content:"", colSpan:3},
          {content:"DESCONTO GERAL:", styles:{halign:"right" as const, fontStyle:"bold" as const, fontSize:8}},
          {content:brl(descontoGeral), styles:{halign:"right" as const, fontStyle:"bold" as const, fontSize:8}},
        ]);
      }
      rows.push([
        {content:"", colSpan:3},
        {content:"TOTAL GERAL:", styles:{halign:"right" as const, fontStyle:"bold" as const, fillColor:[210,210,210], fontSize:8}},
        {content:brl(valorFinalOrc), styles:{halign:"right" as const, fontStyle:"bold" as const, fillColor:[210,210,210], fontSize:8}},
      ]);

      autoTable(pdf, {
        startY:(pdf as any).lastAutoTable.finalY+1, margin:{left:margin,right:margin,top:33},
        head:itemHead, body:rows, theme:"grid",
        styles:{fontSize:8, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0]},
        headStyles:{fillColor:[230,230,230], textColor:[0,0,0], fontSize:7.5},
        columnStyles:{0:{cellWidth:12},1:{cellWidth:"auto"},2:{cellWidth:26},3:{cellWidth:25},4:{cellWidth:25}},
        didDrawPage: () => header(),
      });

      // ── helper: Y depois do último autoTable ─────────────────────────
      const autoY = () => (pdf as any).lastAutoTable.finalY;

      // ── 1. CONDIÇÕES DE PAGAMENTO (box com borda) ─────────────────────
      if (orc.condicoes_pagamento) {
        autoTable(pdf, {
          startY: autoY()+1, margin:{left:margin,right:margin,top:33},
          body:[
            [{content:"CONDIÇÕES DE PAGAMENTO", styles:{fontStyle:"bold" as const, fontSize:8, cellPadding:{top:1.5,left:1.5,bottom:0.5,right:1.5}}}],
            [{content:orc.condicoes_pagamento,  styles:{fontStyle:"normal" as const, fontSize:8, cellPadding:{top:0.5,left:1.5,bottom:1.5,right:1.5}}}],
          ],
          theme:"grid",
          styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
          didDrawPage:()=>header(),
        });
      }

      // ── 2. DADOS PARA DEPÓSITO (box com borda) ────────────────────────
      const depositoContent = [
        "Banco do Brasil",
        "AG. 0191-0 (para TED ou DOC utilizar 0191 sem o dígito)",
        "CC. 105284-5",
        "***********************************",
        "Banco Itaú",
        "AG. 4877",
        "CC. 59000-2",
        "***********************************",
        "Chave PIX",
        "CNPJ. 01.136.535/0001-57",
        "Foneplan Comércio e Administração Ltda",
      ].join("\n");
      autoTable(pdf, {
        startY: autoY()+1, margin:{left:margin,right:margin,top:33},
        body:[
          [{content:"DADOS PARA DEPÓSITO:", styles:{fontStyle:"bold" as const, fontSize:8, cellPadding:{top:1.5,left:1.5,bottom:0.5,right:1.5}}}],
          [{content:depositoContent,           styles:{fontStyle:"normal" as const, fontSize:7.5, cellPadding:{top:0.5,left:1.5,bottom:1.5,right:1.5}}}],
        ],
        theme:"grid",
        styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
        didDrawPage:()=>header(),
      });

      // ── 3. PRAZO + GARANTIA + OBS CLIENTE (texto inline) ─────────────
      let y = autoY()+4;
      const pH = pdf.internal.pageSize.getHeight();
      const chk = (h:number) => { if(y+h > pH-42){pdf.addPage(); header(); y=35;} };
      pdf.setFontSize(8);

      if (orc.prazo) {
        chk(5);
        pdf.setFont("helvetica","bold"); pdf.text("PRAZO PARA ENTREGA:", margin, y);
        pdf.setFont("helvetica","normal"); pdf.text(orc.prazo, margin+50, y);
        y += 5;
      }

      const gExtra = " Não será concedida garantia nos seguintes casos: desregulagens ou quebras ocasionadas por mau uso, manutenções, modificações ou adaptações realizadas por pessoal não credenciado pela Foneplan, oscilações anormais de energia elétrica, descargas atmosféricas, assim como ligação em tensão acima da especificada pelo fabricante do equipamento.";
      const gText  = (orc.garantia || "Toda instalação e serviços terão garantia de 1 ano, materiais e equipamentos a garantia é de responsabilidade do fabricante.") + gExtra;
      const gLines = pdf.splitTextToSize(gText, usableW-44);
      chk(gLines.length*3.2+1);
      pdf.setFont("helvetica","bold"); pdf.text("TERMO DE GARANTIA:", margin, y);
      pdf.setFont("helvetica","normal");
      pdf.text(gText, margin+44, y, {align:"justify", maxWidth:usableW-44});
      y += gLines.length*3.2+1;

      // ── 4. OBSERVAÇÕES FIXAS (autoTable — borda contínua entre páginas) ──
      // Cada parágrafo é uma linha; strings vazias separam blocos (viram \n extra)
      const obsParas = [
        "O móvel que irá acondicionar os equipamentos deverá:\n- Ter um fundo falso de 70mm de espessura.\n- Ter um furo de 2\" atrás de cada equipamento.\n- Ter folga de 50mm na largura, altura e profundidade dos equipamentos para ventilação.\n- Para receivers adotar a profundidade do equipamento de 500mm",
        "CASO A REDE WIFI NÃO TENHA SIDO ADQUIRIDA COM A FONEPLAN, O RESPONSÁVEL TÉCNICO PELA REDE DEVERÁ ESTAR PRESENTE NA DATA DA INSTALAÇÃO DO SOFTWARE PARA AUTOMAÇÃO.",
        "A MARCA E MODELO DAS PERSIANAS E DOS EQUIPAMENTOS DE AR CONDICIONADO QUE SERÃO AUTOMATIZADOS DEVERÃO SER INFORMADAS PELO CLIENTE, PARA VERIFICARMOS A COMPATIBILIDADE DOS EQUIPAMENTOS. CASO ISSO NÃO OCORRA, A FONEPLAN NÃO SE RESPONSALIZA PELA INTEGRAÇÃO DESSES EQUIPAMENTOS À AUTOMAÇÃO.",
        "É DE RESPONSABILIDADE DO CLIENTE TODOS OS SERVIÇOS DE OBRAS CIVIS, COMO TUBULAÇÕES, INFRA ESTRUTURA, CORTES EM ALVENARIAS (QUANDO NECESSÁRIOS), TAMBÉM O FORNECIMENTO DE MATERIAIS ELÉTRICOS COMO, PULSADORES E INTERRUPTORES, ESPELHOS PARA PULSADORES E INTERRUPTORES, TOMADAS, CAIXAS DE PASSAGEM, CONDUITES, DISJUNTORES, DPS, ATERRAMENTO, PROTEÇÕES ELÉTRICAS E CABOS ELÉTRICOS (COM A DEVIDA IDENTIFICAÇÃO NO QUADRO DE AUTOMAÇÃO COM O NÚMERO DO RETORNO DE ILUMINAÇÃO CORRESPONDENTE). EXCETO KEYPADS ADQUIRIDOS COM A FONEPLAN.",
        "NO CASO DA AQUISIÇÃO DE PISO TÉRMICO, OS SERVIÇOS DE REBAIXO DE PISO PARA EMENDA, COLAGEM DE EMENDA COM COMPOUND É DE RESPONSABILIDADE DO CLIENTE, A FONEPLAN SOMENTE FORNECE E FIXA OS CABOS PARA PISO TÉRMICO.",
        "A IMPERMEABILIZAÇÃO DEVERÁ SER EXECUTADA PELO CLIENTE SOMENTE APÓS A FIXAÇÃO DOS CABOS CALEFATORES, EFETUADA PELA FONEPLAN, POIS É NECESSÁRIO FIXAR OS SUPORTES E DEMAIS ACESSÓRIOS.",
      ];
      autoTable(pdf, {
        startY: y+2, margin:{left:margin,right:margin,top:33},
        body:[
          [{content:"OBSERVAÇÕES", styles:{fontStyle:"bold" as const, fontSize:8,   cellPadding:{top:1.5,left:1.5,bottom:1,right:1.5}}}],
          ...obsParas.map(p => ([{content:p, styles:{fontStyle:"normal" as const, fontSize:7.5, cellPadding:{top:1,left:1.5,bottom:1,right:1.5}}}])),
        ],
        theme:"grid",
        styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
        didDrawPage:()=>header(),
      });

      // ── 5. Assinatura (com dados do vendedor) ─────────────────────────
      const nV = (vendedor?.nome||"—").toUpperCase();
      const cV = [vendedor?.celular, vendedor?.email].filter(Boolean).join("  |  ");
      autoTable(pdf, {
        startY:autoY()+1, margin:{left:margin,right:margin,top:33},
        body:[[
          {content:dataExtenso(new Date(orc.created_at)), styles:{halign:"center" as const}},
          {content:cV ? `${nV}\n${cV}` : nV, styles:{halign:"center" as const, fontStyle:"bold" as const}},
        ]],
        theme:"grid",
        styles:{fontSize:8, cellPadding:3, lineColor:[0,0,0], lineWidth:0.2, textColor:[0,0,0]},
        columnStyles:{0:{cellWidth:usableW/2}},
        didDrawPage:()=>header(),
      });

      // ── 6. Rodapé: "Distribuidor Credenciado" + logos ─────────────────
      const pY = autoY();
      pdf.setFillColor(245,245,245); pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.2);
      pdf.rect(margin, pY, usableW, 7, "FD");
      pdf.setFont("helvetica","bold"); pdf.setFontSize(8);
      pdf.text("Distribuidor Credenciado", pageW/2, pY+4.5, {align:"center"});

      const lY=pY+7, lH=16, slotW=usableW/4;
      pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.15);
      pdf.rect(margin, lY, usableW, lH, "D");
      const logo4 = (img: ImgData | null, i: number, dark = false) => {
        const sx = margin + i * slotW;
        if (dark) { pdf.setFillColor(25, 25, 25); pdf.rect(sx, lY, slotW, lH, "F"); }
        if (i > 0) { pdf.setDrawColor(200, 200, 200); pdf.line(sx, lY, sx, lY + lH); }
        addImgContain(pdf, img, sx + 4, lY + 2, slotW - 8, lH - 4);
      };
      // Slot 0 Savant (fundo escuro) | Slot 1 Roehn (fundo branco) | Slot 2 Focal (fundo branco) | Slot 3 Sonance (fundo escuro)
      logo4(iSavant,0,true); logo4(iRoehn,1,false); logo4(iFocal,2,false); logo4(iSonance,3,true);

      // ── Entregar o arquivo ───────────────────────────────────────────
      const slug = (c.nome_razao_social||"cliente")
        .normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-");
      const nome = `Foneplan-${fmtOrcNumV(orc.numero_orcamento, orc.versao)}-${slug}.pdf`;
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

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-4 md:p-8 shadow-sm space-y-6">

        {/* Info do orçamento */}
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
