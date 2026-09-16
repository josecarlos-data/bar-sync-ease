export type Destination = "bar" | "kitchen";
export type SessionStatus = "pending" | "open" | "closed";
export type LineStatus = "pending" | "ready" | "served";
export type AppRole = "admin" | "waiter" | "bar" | "kitchen";

export type BarSettings = {
  bar_id: string;
  show_prices: boolean;
  split_bar_kitchen: boolean;
  waiter_can_order: boolean;
  free_tapa_with_drink: boolean;
  payments_enabled: boolean;
  queue_sort: "arrival" | "table" | "product";
  require_session_approval: boolean;
  auto_close_hours: number;
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
  allergens: string[];
  available: boolean;
  destination: Destination;
  is_drink: boolean;
  is_tapa: boolean;
  position: number;
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
