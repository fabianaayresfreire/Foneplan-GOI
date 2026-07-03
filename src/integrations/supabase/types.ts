export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ambientes: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          status: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          status?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          status?: boolean
        }
        Relationships: []
      }
      arquitetos: {
        Row: {
          celular: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa: string | null
          id: string
          nome: string
          observacoes: string | null
          status: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          arquiteto_id: string | null
          bairro: string | null
          celular: string | null
          celular_responsavel_obra: string | null
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_responsavel_obra: string | null
          endereco: string | null
          endereco_instalacao: string | null
          estado: string | null
          id: string
          informacoes_adicionais: string | null
          nome_razao_social: string
          numero_cliente: number
          responsavel_obra: string | null
          rg_inscricao: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          arquiteto_id?: string | null
          bairro?: string | null
          celular?: string | null
          celular_responsavel_obra?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_responsavel_obra?: string | null
          endereco?: string | null
          endereco_instalacao?: string | null
          estado?: string | null
          id?: string
          informacoes_adicionais?: string | null
          nome_razao_social: string
          numero_cliente?: number
          responsavel_obra?: string | null
          rg_inscricao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          arquiteto_id?: string | null
          bairro?: string | null
          celular?: string | null
          celular_responsavel_obra?: string | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_responsavel_obra?: string | null
          endereco?: string | null
          endereco_instalacao?: string | null
          estado?: string | null
          id?: string
          informacoes_adicionais?: string | null
          nome_razao_social?: string
          numero_cliente?: number
          responsavel_obra?: string | null
          rg_inscricao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_arquiteto_id_fkey"
            columns: ["arquiteto_id"]
            isOneToOne: false
            referencedRelation: "arquitetos"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_itens: {
        Row: {
          categoria_produto: string | null
          created_at: string
          descricao: string
          id: string
          kit_id: string
          ordem: number
          produto_codigo: string | null
          quantidade: number
        }
        Insert: {
          categoria_produto?: string | null
          created_at?: string
          descricao: string
          id?: string
          kit_id: string
          ordem?: number
          produto_codigo?: string | null
          quantidade?: number
        }
        Update: {
          categoria_produto?: string | null
          created_at?: string
          descricao?: string
          id?: string
          kit_id?: string
          ordem?: number
          produto_codigo?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          status: boolean
          tipo: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          status?: boolean
          tipo?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          status?: boolean
          tipo?: string
        }
        Relationships: []
      }
      orcamento_itens: {
        Row: {
          ambiente_id: string | null
          ambiente_nome: string | null
          created_at: string
          desconto_item: number
          id: string
          kit_nome: string | null
          nome_fantasia: string | null
          observacao: string | null
          orcamento_id: string
          ordem_exibicao: number
          preco_unitario: number
          produto_id: string | null
          produto_sku: string | null
          produto_titulo: string
          quantidade: number
          segmento_id: string | null
          tipo_item: Database["public"]["Enums"]["tipo_item"]
          unidade: string
          valor_total: number
        }
        Insert: {
          ambiente_id?: string | null
          ambiente_nome?: string | null
          created_at?: string
          desconto_item?: number
          id?: string
          kit_nome?: string | null
          nome_fantasia?: string | null
          observacao?: string | null
          orcamento_id: string
          ordem_exibicao?: number
          preco_unitario?: number
          produto_id?: string | null
          produto_sku?: string | null
          produto_titulo: string
          quantidade?: number
          segmento_id?: string | null
          tipo_item?: Database["public"]["Enums"]["tipo_item"]
          unidade?: string
          valor_total?: number
        }
        Update: {
          ambiente_id?: string | null
          ambiente_nome?: string | null
          created_at?: string
          desconto_item?: number
          id?: string
          kit_nome?: string | null
          nome_fantasia?: string | null
          observacao?: string | null
          orcamento_id?: string
          ordem_exibicao?: number
          preco_unitario?: number
          produto_id?: string | null
          produto_sku?: string | null
          produto_titulo?: string
          quantidade?: number
          segmento_id?: string | null
          tipo_item?: Database["public"]["Enums"]["tipo_item"]
          unidade?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string
          condicoes_pagamento: string | null
          created_at: string
          desconto: number
          garantia: string | null
          id: string
          nome_projeto: string
          numero_orcamento: number
          observacoes_cliente: string | null
          observacoes_internas: string | null
          prazo: string | null
          status: Database["public"]["Enums"]["orcamento_status"]
          tipo_projeto: Database["public"]["Enums"]["tipo_projeto"]
          updated_at: string
          valor_bruto: number
          valor_final: number
          vendedor_id: string
          versao: string | null
        }
        Insert: {
          cliente_id: string
          condicoes_pagamento?: string | null
          created_at?: string
          desconto?: number
          garantia?: string | null
          id?: string
          nome_projeto: string
          numero_orcamento?: number
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          tipo_projeto?: Database["public"]["Enums"]["tipo_projeto"]
          updated_at?: string
          valor_bruto?: number
          valor_final?: number
          vendedor_id: string
          versao?: string | null
        }
        Update: {
          cliente_id?: string
          condicoes_pagamento?: string | null
          created_at?: string
          desconto?: number
          garantia?: string | null
          id?: string
          nome_projeto?: string
          numero_orcamento?: number
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          tipo_projeto?: Database["public"]["Enums"]["tipo_projeto"]
          updated_at?: string
          valor_bruto?: number
          valor_final?: number
          vendedor_id?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          marca: string | null
          modelo: string | null
          msrp: number
          nome_fantasia: string | null
          sku: string | null
          status: boolean
          titulo: string
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          msrp?: number
          nome_fantasia?: string | null
          sku?: string | null
          status?: boolean
          titulo: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          msrp?: number
          nome_fantasia?: string | null
          sku?: string | null
          status?: boolean
          titulo?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          celular: string | null
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      segmentos: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          status: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          status?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          status?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor"
      orcamento_status:
        | "em_elaboracao"
        | "enviado_cliente"
        | "aprovado"
        | "cancelado"
      tipo_item:
        | "venda_normal"
        | "cabos"
        | "cliente"
        | "cortesia"
        | "fase_anterior"
        | "mao_de_obra"
        | "proxima_fase"
        | "opcional"
        | "nao_incluso"
      tipo_projeto: "residencial" | "corporativo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor"],
      orcamento_status: [
        "em_elaboracao",
        "enviado_cliente",
        "aprovado",
        "cancelado",
      ],
      tipo_item: [
        "venda_normal",
        "cabos",
        "cliente",
        "cortesia",
        "fase_anterior",
        "mao_de_obra",
        "proxima_fase",
        "opcional",
        "nao_incluso",
      ],
      tipo_projeto: ["residencial", "corporativo"],
    },
  },
} as const
