import { describe, expect, it } from "vitest";
import { houseTapaLines, nextAvailableRound } from "./tapas";
import type { Item } from "./types";

const it_ = (id: string, name: string, available: boolean) => ({ id, name, available }) as Item;
const settings = { tapa_rounds: ["Patatas", "Albóndigas", "Migas"], tapa_rounds_after: "cycle" };
const items = [it_("p", "Patatas", true), it_("a", "Albóndigas", false), it_("m", "Migas", true)];

describe("rondas ligadas a existencias", () => {
  it("salta una ronda cuyo plato está agotado", () => {
    expect(nextAvailableRound(settings, 2, items)).toBe(3);
  });
  it("la línea de cocina apunta al plato de la ronda para descontar stock", () => {
    const l = houseTapaLines(settings, [{ round: 2, qty: 4 }], 4, items)[0]!;
    expect(l.tapa_round).toBe(3);
    expect(l.tapa_item_id).toBe("m");
    expect(l.skipped_from).toBe(2);
  });
  it("una ronda sin plato enlazado no salta", () => {
    expect(nextAvailableRound({ tapa_rounds: ["Sorpresa"] }, 1, items)).toBe(1);
  });
});
