// ── Máscara CPF / CNPJ ──────────────────────────────────────────────────────
// Até 11 dígitos → CPF (000.000.000-00)
// 12-14 dígitos  → CNPJ (00.000.000/0000-00)
export const maskCpfCnpj = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    let r = d;
    r = r.replace(/(\d{3})(\d{1,})/, "$1.$2");
    r = r.replace(/(\d{3})\.(\d{3})(\d{1,})/, "$1.$2.$3");
    r = r.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    return r;
  }
  let r = d;
  r = r.replace(/(\d{2})(\d{1,})/, "$1.$2");
  r = r.replace(/(\d{2})\.(\d{3})(\d{1,})/, "$1.$2.$3");
  r = r.replace(/(\d{2})\.(\d{3})\.(\d{3})(\d{1,})/, "$1.$2.$3/$4");
  r = r.replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
  return r;
};

// ── Máscara CEP ──────────────────────────────────────────────────────────────
// 00000-000
export const maskCep = (v: string): string => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
};

// ── Busca ViaCEP ─────────────────────────────────────────────────────────────
export interface ViaCepData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export const fetchViaCep = async (
  cep: string
): Promise<ViaCepData | "not_found" | "error"> => {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return "error";
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return "error";
    const data = await res.json();
    if (data.erro) return "not_found";
    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return "error";
  }
};
