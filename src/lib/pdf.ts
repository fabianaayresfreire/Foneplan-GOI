import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TIPO_ITEM_LABELS, fmtOrcNumV, brl } from "@/lib/format";
import logoUrl     from "@/assets/foneplan-logo.png";
import logoSavant  from "@/assets/logo-savant-branco.png";
import logoRoehn   from "@/assets/logo-roehn-black.png";
import logoFocal   from "@/assets/logo-focal-black.png";
import logoSonance from "@/assets/logo-sonance-white.png";

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
      new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload  = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      }),
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

export type PdfItem = {
  /** Nome do segmento já resolvido (não precisa de join). */
  segmento_nome: string;
  /** Nome do ambiente já resolvido (custom ou do banco). */
  ambiente_nome: string;
  nome_fantasia?: string | null;
  produto_titulo: string;
  observacao?: string | null;
  quantidade: number;
  tipo_item: string;
  preco_unitario: number;
  valor_total: number;
  desconto_item: number;
};

export type PdfOrcamento = {
  numero_orcamento: number | null;
  versao: string | null;
  status: string;
  desconto: number;
  valor_final: number;
  condicoes_pagamento?: string | null;
  prazo?: string | null;
  garantia?: string | null;
  observacoes_cliente?: string | null;
  created_at: string;
  /** Objeto cliente com arquitetos nested (campos opcionais). */
  clientes?: any;
};

export type PdfVendedor = {
  nome?: string | null;
  celular?: string | null;
  email?: string | null;
} | null | undefined;

/**
 * Gera o PDF do orçamento e retorna um Blob.
 * Não faz nenhuma chamada ao banco — o caller é responsável por fornecer os dados.
 *
 * @param groupOrder JSON.stringify de array de strings "SEG|||AMB" para ordem customizada;
 *                   undefined ou "" usa ordem padrão.
 */
export async function gerarPdfBlob(
  orc: PdfOrcamento,
  itens: PdfItem[],
  vendedor: PdfVendedor,
  groupOrder?: string,
): Promise<Blob> {
  const [iLogo, iSavant, iRoehn, iFocal, iSonance] = await Promise.all([
    loadImg(logoUrl),
    loadImg(logoSavant),
    loadImg(logoRoehn),
    loadImg(logoFocal),
    loadImg(logoSonance),
  ]);

  const pdf     = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW   = pdf.internal.pageSize.getWidth();
  const margin  = 12;
  const usableW = pageW - margin * 2;

  // ── Cabeçalho (repetido em cada página) ──────────────────────────────────────
  const header = () => {
    addImgContain(pdf, iLogo, margin, 8, 28, 28);
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

  // ── Bloco cliente ─────────────────────────────────────────────────────────────
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
    startY: 38, margin:{left:margin, right:margin, top:40}, body: clienteBody, theme:"grid",
    styles:{fontSize:7.5, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
    columnStyles:{0:{cellWidth:42},1:{cellWidth:"auto"},2:{cellWidth:18},3:{cellWidth:"auto"},4:{cellWidth:22},5:{cellWidth:"auto"}},
    didDrawPage: () => header(),
  });

  // ── Agrupa itens por segmento > ambiente ──────────────────────────────────────
  const grouped: Record<string, Record<string, PdfItem[]>> = {};
  itens.forEach(it => {
    const seg = (it.segmento_nome || "GERAL").toUpperCase();
    const amb = (it.ambiente_nome || "GERAL").toUpperCase();
    (grouped[seg] ??= {})[amb] ??= [];
    grouped[seg][amb].push(it);
  });

  const itemHead = [[
    {content:"QTD",      styles:{halign:"center" as const, fontStyle:"bold" as const}},
    {content:"DESCRIÇÃO",styles:{fontStyle:"bold" as const}},
    {content:"TIPO",     styles:{halign:"center" as const, fontStyle:"bold" as const}},
    {content:"PREÇO UN.",styles:{halign:"right"  as const, fontStyle:"bold" as const}},
    {content:"TOTAL",    styles:{halign:"right"  as const, fontStyle:"bold" as const}},
  ]];

  // ── Ordem dos blocos (customizada ou padrão) ──────────────────────────────────
  let orderedPairs: [string, string][];
  if (groupOrder) {
    try {
      const custom: string[] = JSON.parse(groupOrder);
      const raw: [string, string][] = custom.map(k => {
        const idx = k.indexOf("|||");
        return [k.slice(0, idx), k.slice(idx + 3)] as [string, string];
      });
      for (const [seg, ambs] of Object.entries(grouped)) {
        for (const amb of Object.keys(ambs)) {
          if (!custom.includes(`${seg}|||${amb}`)) raw.push([seg, amb]);
        }
      }
      // Consolida: pares do mesmo seg ficam adjacentes (links antigos podem vir não-contíguos)
      const segOrder: string[] = [];
      const segMap: Record<string, [string, string][]> = {};
      for (const [s, a] of raw) {
        if (!segMap[s]) { segOrder.push(s); segMap[s] = []; }
        segMap[s].push([s, a]);
      }
      orderedPairs = segOrder.flatMap(s => segMap[s]);
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
  let lastSeg    = "";
  let segTotal   = 0;
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
    const soSpecial = list.every(it => it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos");
    if (!soSpecial) {
      rows.push([{content:amb, colSpan:5, styles:{halign:"center" as const,fontStyle:"bold" as const,fillColor:[238,238,238]}}]);
    }
    for (const it of list) {
      const qtd         = Number(it.quantidade)%1===0 ? `${Math.round(it.quantidade)},00` : String(it.quantidade);
      const isPaying    = it.tipo_item === "venda_normal" || it.tipo_item === "mao_de_obra" || it.tipo_item === "cabos";
      const showPrecoUn = it.tipo_item === "venda_normal";
      const tipo        = it.tipo_item === "venda_normal" ? "" : (TIPO_ITEM_LABELS[it.tipo_item] ?? "");
      const descProduto = it.nome_fantasia ? it.nome_fantasia : it.produto_titulo;
      const desc        = `${descProduto}${it.observacao ? " - " + it.observacao : ""}`;
      rows.push([
        {content:qtd,                                         styles:{halign:"right" as const}},
        {content:desc},
        {content:tipo,                                        styles:{halign:"center" as const,fontStyle:"italic" as const,fontSize:7}},
        {content:showPrecoUn ? brl(it.preco_unitario) : "",   styles:{halign:"right" as const,fontSize:7.5}},
        {content:isPaying    ? brl(it.valor_total)    : "",   styles:{halign:"right" as const,fontSize:7.5}},
      ]);
      if (isPaying) {
        segTotal    += Number(it.valor_total)   || 0;
        segDesconto += Number(it.desconto_item) || 0;
      }
    }
  }
  if (lastSeg !== "") emitSegSubtotal();

  // ── Totais gerais ─────────────────────────────────────────────────────────────
  const descontoGeral = Number(orc.desconto)    || 0;
  const valorFinalOrc = Number(orc.valor_final) || 0;

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
    startY:(pdf as any).lastAutoTable.finalY+1, margin:{left:margin,right:margin,top:40},
    head:itemHead, body:rows, theme:"grid",
    styles:{fontSize:8, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0]},
    headStyles:{fillColor:[230,230,230], textColor:[0,0,0], fontSize:7.5},
    columnStyles:{0:{cellWidth:12},1:{cellWidth:"auto"},2:{cellWidth:26},3:{cellWidth:25},4:{cellWidth:25}},
    didDrawPage: () => header(),
  });

  const autoY = () => (pdf as any).lastAutoTable.finalY;

  // ── Condições de pagamento ────────────────────────────────────────────────────
  if (orc.condicoes_pagamento) {
    autoTable(pdf, {
      startY: autoY()+1, margin:{left:margin,right:margin,top:40},
      body:[
        [{content:"CONDIÇÕES DE PAGAMENTO", styles:{fontStyle:"bold" as const, fontSize:8, cellPadding:{top:1.5,left:1.5,bottom:0.5,right:1.5}}}],
        [{content:orc.condicoes_pagamento,  styles:{fontStyle:"normal" as const, fontSize:8, cellPadding:{top:0.5,left:1.5,bottom:1.5,right:1.5}}}],
      ],
      theme:"grid",
      styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
      didDrawPage:()=>header(),
    });
  }

  // ── Dados para depósito ───────────────────────────────────────────────────────
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
    startY: autoY()+1, margin:{left:margin,right:margin,top:40},
    body:[
      [{content:"DADOS PARA DEPÓSITO:", styles:{fontStyle:"bold" as const, fontSize:8, cellPadding:{top:1.5,left:1.5,bottom:0.5,right:1.5}}}],
      [{content:depositoContent,          styles:{fontStyle:"normal" as const, fontSize:7.5, cellPadding:{top:0.5,left:1.5,bottom:1.5,right:1.5}}}],
    ],
    theme:"grid",
    styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
    didDrawPage:()=>header(),
  });

  // ── Prazo + Garantia (texto inline) ──────────────────────────────────────────
  let y  = autoY()+4;
  const pH  = pdf.internal.pageSize.getHeight();
  const chk = (h: number) => { if (y+h > pH-42) { pdf.addPage(); header(); y = 42; } };
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

  // ── Observações fixas ─────────────────────────────────────────────────────────
  const obsParas = [
    "O móvel que irá acondicionar os equipamentos deverá:\n- Ter um fundo falso de 70mm de espessura.\n- Ter um furo de 2\" atrás de cada equipamento.\n- Ter folga de 50mm na largura, altura e profundidade dos equipamentos para ventilação.\n- Para receivers adotar a profundidade do equipamento de 500mm",
    "CASO A REDE WIFI NÃO TENHA SIDO ADQUIRIDA COM A FONEPLAN, O RESPONSÁVEL TÉCNICO PELA REDE DEVERÁ ESTAR PRESENTE NA DATA DA INSTALAÇÃO DO SOFTWARE PARA AUTOMAÇÃO.",
    "A MARCA E MODELO DAS PERSIANAS E DOS EQUIPAMENTOS DE AR CONDICIONADO QUE SERÃO AUTOMATIZADOS DEVERÃO SER INFORMADAS PELO CLIENTE, PARA VERIFICARMOS A COMPATIBILIDADE DOS EQUIPAMENTOS. CASO ISSO NÃO OCORRA, A FONEPLAN NÃO SE RESPONSALIZA PELA INTEGRAÇÃO DESSES EQUIPAMENTOS À AUTOMAÇÃO.",
    "É DE RESPONSABILIDADE DO CLIENTE TODOS OS SERVIÇOS DE OBRAS CIVIS, COMO TUBULAÇÕES, INFRA ESTRUTURA, CORTES EM ALVENARIAS (QUANDO NECESSÁRIOS), TAMBÉM O FORNECIMENTO DE MATERIAIS ELÉTRICOS COMO, PULSADORES E INTERRUPTORES, ESPELHOS PARA PULSADORES E INTERRUPTORES, TOMADAS, CAIXAS DE PASSAGEM, CONDUITES, DISJUNTORES, DPS, ATERRAMENTO, PROTEÇÕES ELÉTRICAS E CABOS ELÉTRICOS (COM A DEVIDA IDENTIFICAÇÃO NO QUADRO DE AUTOMAÇÃO COM O NÚMERO DO RETORNO DE ILUMINAÇÃO CORRESPONDENTE). EXCETO KEYPADS ADQUIRIDOS COM A FONEPLAN.",
    "NO CASO DA AQUISIÇÃO DE PISO TÉRMICO, OS SERVIÇOS DE REBAIXO DE PISO PARA EMENDA, COLAGEM DE EMENDA COM COMPOUND É DE RESPONSABILIDADE DO CLIENTE, A FONEPLAN SOMENTE FORNECE E FIXA OS CABOS PARA PISO TÉRMICO.",
    "A IMPERMEABILIZAÇÃO DEVERÁ SER EXECUTADA PELO CLIENTE SOMENTE APÓS A FIXAÇÃO DOS CABOS CALEFATORES, EFETUADA PELA FONEPLAN, POIS É NECESSÁRIO FIXAR OS SUPORTES E DEMAIS ACESSÓRIOS.",
  ];
  autoTable(pdf, {
    startY: y+2, margin:{left:margin,right:margin,top:40},
    body:[
      [{content:"OBSERVAÇÕES", styles:{fontStyle:"bold" as const, fontSize:8,   cellPadding:{top:1.5,left:1.5,bottom:1,right:1.5}}}],
      ...obsParas.map(p => ([{content:p, styles:{fontStyle:"normal" as const, fontSize:7.5, cellPadding:{top:1,left:1.5,bottom:1,right:1.5}}}])),
    ],
    theme:"grid",
    styles:{lineColor:[0,0,0], lineWidth:0.15, textColor:[0,0,0], overflow:"linebreak"},
    didDrawPage:()=>header(),
  });

  // ── Assinatura / vendedor ─────────────────────────────────────────────────────
  const nV = (vendedor?.nome || "—").toUpperCase();
  const cV = [vendedor?.celular, vendedor?.email].filter(Boolean).join("  |  ");
  autoTable(pdf, {
    startY:autoY()+1, margin:{left:margin,right:margin,top:40},
    body:[[
      {content:dataExtenso(new Date(orc.created_at)), styles:{halign:"center" as const}},
      {content:cV ? `${nV}\n${cV}` : nV, styles:{halign:"center" as const, fontStyle:"bold" as const}},
    ]],
    theme:"grid",
    styles:{fontSize:8, cellPadding:3, lineColor:[0,0,0], lineWidth:0.2, textColor:[0,0,0]},
    columnStyles:{0:{cellWidth:usableW/2}},
    didDrawPage:()=>header(),
  });

  // ── Rodapé: logos de marcas ───────────────────────────────────────────────────
  const pY = autoY();
  pdf.setFillColor(245,245,245); pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.2);
  pdf.rect(margin, pY, usableW, 7, "FD");
  pdf.setFont("helvetica","bold"); pdf.setFontSize(8);
  pdf.text("Distribuidor Credenciado", pageW/2, pY+4.5, {align:"center"});

  const lY=pY+7, lH=16, slotW=usableW/4;
  pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.15);
  pdf.rect(margin, lY, usableW, lH, "D");
  const logo4 = (img: ImgData | null, i: number, pH: number, pW: number, dark = false) => {
    const sx = margin + i * slotW;
    if (dark) { pdf.setFillColor(25, 25, 25); pdf.rect(sx, lY, slotW, lH, "F"); }
    if (i > 0) { pdf.setDrawColor(200, 200, 200); pdf.line(sx, lY, sx, lY + lH); }
    addImgContain(pdf, img, sx + pW, lY + pH, slotW - pW*2, lH - pH*2);
  };
  logo4(iSavant,  0, 1,   2,   true);
  logo4(iRoehn,   1, 2,   4,   false);
  logo4(iFocal,   2, 2,   4,   false);
  logo4(iSonance, 3, 0.5, 1,   true);

  return pdf.output("blob");
}

/** Gera nome de arquivo padronizado para o PDF. */
export function pdfFileName(nomeRazaoSocial: string | undefined, numero: number | null, versao: string | null): string {
  const slug = (nomeRazaoSocial || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `Foneplan-${fmtOrcNumV(numero, versao)}-${slug}.pdf`;
}

/** Abre um Blob de PDF numa nova aba; força download como fallback se popup bloqueado. */
export function abrirBlobPdf(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const nova = window.open(url, "_blank");
  if (!nova) {
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
