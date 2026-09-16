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
      bar_settings: {
        Row: {
          auto_close_hours: number
          bar_id: string
          free_tapa_with_drink: boolean
          payments_enabled: boolean
          queue_sort: Database["public"]["Enums"]["queue_sort"]
          require_session_approval: boolean
          show_prices: boolean
          split_bar_kitchen: boolean
          updated_at: string
          waiter_can_order: boolean
        }
        Insert: {
          auto_close_hours?: number
          bar_id: string
          free_tapa_with_drink?: boolean
          payments_enabled?: boolean
          queue_sort?: Database["public"]["Enums"]["queue_sort"]
          require_session_approval?: boolean
          show_prices?: boolean
          split_bar_kitchen?: boolean
          updated_at?: string
          waiter_can_order?: boolean
        }
        Update: {
          auto_close_hours?: number
          bar_id?: string
          free_tapa_with_drink?: boolean
          payments_enabled?: boolean
          queue_sort?: Database["public"]["Enums"]["queue_sort"]
          require_session_approval?: boolean
          show_prices?: boolean
          split_bar_kitchen?: boolean
          updated_at?: string
          waiter_can_order?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bar_settings_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          allergens: Database["public"]["Enums"]["allergen"][]
          available: boolean
          bar_id: string
          category_id: string | null
          created_at: string
          description: string | null
          destination: Database["public"]["Enums"]["item_destination"]
          id: string
          image_url: string | null
          is_drink: boolean
          is_tapa: boolean
          name: string
          position: number
          price: number
          tax_rate: number
        }
        Insert: {
          allergens?: Database["public"]["Enums"]["allergen"][]
          available?: boolean
          bar_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination?: Database["public"]["Enums"]["item_destination"]
          id?: string
          image_url?: string | null
          is_drink?: boolean
          is_tapa?: boolean
          name: string
          position?: number
          price?: number
          tax_rate?: number
        }
        Update: {
          allergens?: Database["public"]["Enums"]["allergen"][]
          available?: boolean
          bar_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination?: Database["public"]["Enums"]["item_destination"]
          id?: string
          image_url?: string | null
          is_drink?: boolean
          is_tapa?: boolean
          name?: string
          position?: number
          price?: number
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bar_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          destination: Database["public"]["Enums"]["item_destination"]
          id: string
          item_id: string | null
          name_snapshot: string
          note: string | null
          order_id: string
          price_snapshot: number
          qty: number
          ready_at: string | null
          served_at: string | null
          status: Database["public"]["Enums"]["line_status"]
          tax_rate_snapshot: number
        }
        Insert: {
          bar_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          destination?: Database["public"]["Enums"]["item_destination"]
          id?: string
          item_id?: string | null
          name_snapshot: string
          note?: string | null
          order_id: string
          price_snapshot?: number
          qty?: number
          ready_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["line_status"]
          tax_rate_snapshot?: number
        }
        Update: {
          bar_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          destination?: Database["public"]["Enums"]["item_destination"]
          id?: string
          item_id?: string | null
          name_snapshot?: string
          note?: string | null
          order_id?: string
          price_snapshot?: number
          qty?: number
          ready_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["line_status"]
          tax_rate_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bar_id: string
          created_at: string
          created_by: string | null
          created_by_role: string
          id: string
          note: string | null
          session_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          id?: string
          note?: string | null
          session_id: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          id?: string
          note?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bar_id: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          bar_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          bar_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      service_calls: {
        Row: {
          bar_id: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          session_id: string
          status: Database["public"]["Enums"]["call_status"]
          type: Database["public"]["Enums"]["call_type"]
        }
        Insert: {
          bar_id: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          session_id: string
          status?: Database["public"]["Enums"]["call_status"]
          type?: Database["public"]["Enums"]["call_type"]
        }
        Update: {
          bar_id?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["call_status"]
          type?: Database["public"]["Enums"]["call_type"]
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          bar_id: string
          display_name: string | null
          id: string
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          bar_id: string
          display_name?: string | null
          id?: string
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          bar_id?: string
          display_name?: string | null
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          bar_id: string
          closed_at: string | null
          closed_by: string | null
          id: string
          last_activity_at: string
          nickname: string | null
          opened_at: string
          status: Database["public"]["Enums"]["session_status"]
          table_id: string
        }
        Insert: {
          bar_id: string
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          last_activity_at?: string
          nickname?: string | null
          opened_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          table_id: string
        }
        Update: {
          bar_id?: string
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          last_activity_at?: string
          nickname?: string | null
          opened_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          active: boolean
          bar_id: string
          created_at: string
          id: string
          name: string | null
          number: number
          qr_token: string
        }
        Insert: {
          active?: boolean
          bar_id: string
          created_at?: string
          id?: string
          name?: string | null
          number: number
          qr_token: string
        }
        Update: {
          active?: boolean
          bar_id?: string
          created_at?: string
          id?: string
          name?: string | null
          number?: number
          qr_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_bar: { Args: { _bar_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _bar_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_of: { Args: { _bar_id: string }; Returns: boolean }
      is_guest_of_bar: { Args: { _bar_id: string }; Returns: boolean }
      is_session_member: { Args: { _session_id: string }; Returns: boolean }
      is_staff_of: { Args: { _bar_id: string }; Returns: boolean }
      session_is_open: { Args: { _session_id: string }; Returns: boolean }
    }
    Enums: {
      allergen:
        | "gluten"
        | "crustaceos"
        | "huevos"
        | "pescado"
        | "cacahuetes"
        | "soja"
        | "lacteos"
        | "frutos_cascara"
        | "apio"
        | "mostaza"
        | "sesamo"
        | "sulfitos"
        | "altramuces"
        | "moluscos"
      app_role: "admin" | "waiter" | "bar" | "kitchen"
      call_status: "open" | "done"
      call_type: "waiter" | "bill"
      item_destination: "bar" | "kitchen"
      line_status: "pending" | "ready" | "served"
      queue_sort: "arrival" | "table" | "product"
      session_status: "pending" | "open" | "closed" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      allergen: [
        "gluten",
        "crustaceos",
        "huevos",
        "pescado",
        "cacahuetes",
        "soja",
        "lacteos",
        "frutos_cascara",
        "apio",
        "mostaza",
        "sesamo",
        "sulfitos",
        "altramuces",
        "moluscos",
      ],
      app_role: ["admin", "waiter", "bar", "kitchen"],
      call_status: ["open", "done"],
      call_type: ["waiter", "bill"],
      item_destination: ["bar", "kitchen"],
      line_status: ["pending", "ready", "served"],
      queue_sort: ["arrival", "table", "product"],
      session_status: ["pending", "open", "closed", "rejected"],
    },
  },
} as const
