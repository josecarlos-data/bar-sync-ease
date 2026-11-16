import { describe, expect, it } from "vitest";
import { houseTapaLines, priceCart, proposeRounds, type SessionTapaLine } from "@/lib/tapas";
import { placeOrderErrorMessage } from "@/lib/placeOrder";
import { legacyOrderRequest } from "@/lib/offline";
import type { Item } from "@/lib/types";

// Mismos casos y mismas cifras que se comprobaron contra place_order en la base de datos.
const item = (p: Partial<Item>) => ({ available: true, is_drink: false, is_tapa: false, includes_tapa: true, tapa_supplement: 0, ...p }) as Item;
const cana = item({ id: "cana", name: "Caña", price: 1.8, is_drink: true });
const agua = item({ id: "agua", name: "Agua", price: 1.5, is_drink: true, includes_tapa: false });
const albo = item({ id: "albo", name: "Albóndigas", price: 2.5, is_tapa: true });
const items = [cana, agua, albo];
const settings = { tapa_mode: "house", tapa_rounds: [], tapa_extra_price: 1.5 } as never;

describe("vista previa de tapas = servidor", () => {
  it("Granada: 2 cañas + agua dan 2 primeras gratis", () => {
    const l = houseTapaLines(settings, proposeRounds(2, []), 2, items);
    expect(l.map((x) => [x.tapa_round, x.qty, x.price])).toEqual([[1, 2, 0]]);
  });
  it("Granada: 2 cañas más dan 2 segundas", () => {
    const ses: SessionTapaLine[] = [{ item_id: null, qty: 2, tapa_round: 1 }];
    expect(proposeRounds(2, ses)).toEqual([{ round: 2, qty: 2 }]);
  });
  it("Granada: 3 tapas con 2 bebidas → 1 extra a 1,50 €", () => {
    const l = houseTapaLines(settings, [{ round: 3, qty: 3 }], 2, items);
    expect(l.map((x) => [x.tapa_kind, x.qty, x.price])).toEqual([["round", 2, 0], ["extra", 1, 1.5]]);
  });
  it("Almería: 3 cañas en la mesa + 4 albóndigas → 3 incluidas y 1 a precio de carta", () => {
    const ses: SessionTapaLine[] = [{ item_id: "cana", qty: 2 }];
    const p = priceCart({ tapa_mode: "choice" } as never, [{ itemId: "cana", qty: 1, note: "" }, { itemId: "albo", qty: 4, note: "" }], items, ses);
    expect(p.filter((x) => x.item.id === "albo").map((x) => [x.tapa_kind, x.qty, x.price])).toEqual([["included", 3, 0], [null, 1, 2.5]]);
  });
});

describe("comandas sin conexión antiguas", () => {
  it("se convierten en artículos y cantidades, sin precios", () => {
    const r = legacyOrderRequest("11111111-2222-3333-4444-555555555555", [
      { item_id: "cana", qty: 2, price_snapshot: 0, status: "served" },
      { item_id: null, qty: 2, tapa_kind: "round", price_snapshot: 0 },
    ]);
    expect(r.requestId).toBe("11111111-2222-3333-4444-555555555555");
    expect(r.lines).toEqual([{ item_id: "cana", qty: 2, note: "" }]);
    expect(r.tapas).toBe(2);
    expect(r.served).toBe("all");
  });
});

describe("mensajes de error", () => {
  it("nombra los artículos agotados", () => {
    expect(placeOrderErrorMessage("sold_out:Callos|Pulpo")).toContain("Callos, Pulpo");
  });
  it("límite del cliente 20", () => {
    expect(placeOrderErrorMessage("qty_limit:20")).toContain("20");
  });
});
