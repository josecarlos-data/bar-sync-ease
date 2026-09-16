export const ALLERGENS = [
  { value: "gluten", label: "Gluten" },
  { value: "crustaceos", label: "Crustáceos" },
  { value: "huevos", label: "Huevos" },
  { value: "pescado", label: "Pescado" },
  { value: "cacahuetes", label: "Cacahuetes" },
  { value: "soja", label: "Soja" },
  { value: "lacteos", label: "Lácteos" },
  { value: "frutos_cascara", label: "Frutos de cáscara" },
  { value: "apio", label: "Apio" },
  { value: "mostaza", label: "Mostaza" },
  { value: "sesamo", label: "Sésamo" },
  { value: "sulfitos", label: "Sulfitos" },
  { value: "altramuces", label: "Altramuces" },
  { value: "moluscos", label: "Moluscos" },
] as const;

export type AllergenValue = (typeof ALLERGENS)[number]["value"];

export function allergenLabel(value: string): string {
  return ALLERGENS.find((a) => a.value === value)?.label ?? value;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}
