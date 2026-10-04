import type { AllergenValue } from "@/lib/allergens";

export type Destination = "bar" | "kitchen";
export type SessionStatus = "pending" | "open" | "rejected" | "closed";
export type SessionDecision = "approved" | "rejected" | "restored";
export type LineStatus = "pending" | "preparing" | "ready" | "served";
export type AppRole = "admin" | "waiter" | "bar" | "kitchen";

export type BarSettings = {
  bar_id: string;
  show_prices: boolean;
  split_bar_kitchen: boolean;
  waiter_can_order: boolean;
  ask_nickname: boolean;
  service_mode?: "team" | "solo" | string;
  free_tapa_with_drink: boolean;
  payments_enabled: boolean;
  queue_sort: "arrival" | "table" | "product";
  require_session_approval: boolean;
  auto_close_hours: number;
  kitchen_voice: "device" | "ai";
  kitchen_voice_auto: boolean;
  order_voice_auto?: "off" | "summary" | "full";
  printer_enabled?: boolean;
  printer_trigger?: "new" | "ready";
  printer_scope?: "kitchen" | "bar" | "both";
  printer_width?: number;
  ticket_printer_enabled?: boolean;
  ticket_print_on_bill?: boolean;
  ticket_print_on_paid?: boolean;
  ticket_printer_width?: number;
  legal_name?: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone?: string | null;
  ticket_footer?: string | null;
  public_base_url?: string | null;
  menu_print?: import("@/integrations/supabase/types").Json;
  menu_sort?: "alpha" | "popular" | "manual";
};

export type Item = {
  id: string;
  bar_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  tax_rate: number;
  image_url: string | null;
  allergens: AllergenValue[];
  available: boolean;
  destination: Destination;
  is_drink: boolean;
  is_tapa: boolean;
  position: number;
  group_name?: string | null;
  ingredients?: string | null;
  tags?: string[];
};

export type Category = { id: string; bar_id: string; name: string; position: number };

export type BarTable = {
  id: string;
  bar_id: string;
  number: number;
  name: string | null;
  qr_token: string;
  active: boolean;
};

export type OrderLine = {
  id: string;
  order_id: string;
  item_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  tax_rate_snapshot: number;
  qty: number;
  note: string | null;
  destination: Destination;
  status: LineStatus;
  created_at: string;
  deleted_at: string | null;
};
