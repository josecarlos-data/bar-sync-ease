export const ALLERGENS = [
  { value: "gluten", examples: "trigo, cebada, centeno, avena, espelta, kamut; pan, harina, rebozados, cerveza", label: "Gluten" },
  { value: "crustaceos", examples: "gamba, langostino, cigala, cangrejo, bogavante", label: "Crustáceos" },
  { value: "huevos", examples: "huevo, mayonesa, alioli, rebozados", label: "Huevos" },
  { value: "pescado", examples: "cualquier pescado, anchoa, atún, caldo o salsa de pescado", label: "Pescado" },
  { value: "cacahuetes", examples: "cacahuete, aceite o crema de cacahuete", label: "Cacahuetes" },
  { value: "soja", examples: "soja, salsa de soja, tofu, lecitina de soja", label: "Soja" },
  { value: "lacteos", examples: "leche, nata, queso, mantequilla, yogur (incluida la lactosa)", label: "Lácteos" },
  { value: "frutos_cascara", examples: "almendra, avellana, nuez, anacardo, pistacho, pacana, nuez de Brasil, macadamia", label: "Frutos de cáscara" },
  { value: "apio", examples: "apio, raíz o sal de apio, algunos caldos", label: "Apio" },
  { value: "mostaza", examples: "mostaza, salsas y aliños con mostaza", label: "Mostaza" },
  { value: "sesamo", examples: "sésamo, tahini, panes con semillas", label: "Sésamo" },
  { value: "sulfitos", examples: "vino, vinagre, frutos secos desecados, embutidos (más de 10 mg/kg)", label: "Sulfitos" },
  { value: "altramuces", examples: "altramuz, harina de altramuz", label: "Altramuces" },
  { value: "moluscos", examples: "almeja, mejillón, calamar, sepia, pulpo, caracol", label: "Moluscos" },
] as const;

export type AllergenValue = (typeof ALLERGENS)[number]["value"];

export function allergenLabel(value: string): string {
  return ALLERGENS.find((a) => a.value === value)?.label ?? value;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}
