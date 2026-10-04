import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { suggestAllergens, type AllergenSuggestion } from "@/lib/kitchen.functions";
import { allergenLabel } from "@/lib/allergens";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  barId: string | null;
  name: string;
  ingredients: string;
  onIngredients: (v: string) => void;
  /** Marca los alérgenos sugeridos (se suman a los ya marcados). */
  onSuggest: (codes: string[]) => void;
  onDescription: (v: string) => void;
};

export function AllergenAssistant({ barId, name, ingredients, onIngredients, onSuggest, onDescription }: Props) {
  const run = useServerFn(suggestAllergens);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AllergenSuggestion | null>(null);

  async function detect() {
    if (!barId || ingredients.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await run({ data: { barId, name, ingredients } });
      if (!r.ok) { toast.error(r.error); return; }
      setRes(r);
      onSuggest(r.allergens.map((a) => a.code));
    } catch {
      toast.error("No se pudieron detectar los alérgenos");
    } finally {
      setBusy(false);
    }
  }

  const sure = res?.allergens.filter((a) => a.certainty === "sure") ?? [];
  const doubt = res?.allergens.filter((a) => a.certainty === "doubt") ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm font-semibold">Ingredientes y alérgenos con ayuda</p>
      <Textarea
        rows={2}
        placeholder="Escribe los ingredientes: carne de cerdo, tomate frito, vino blanco, pan rallado…"
        value={ingredients}
        onChange={(e) => onIngredients(e.target.value)}
      />
      <Button type="button" size="sm" variant="secondary" disabled={busy || ingredients.trim().length < 2} onClick={detect}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
        Detectar alérgenos
      </Button>
      {res && (
        <div className="space-y-2 text-xs">
          {sure.length > 0 && (
            <div>
              <p className="font-semibold">Contiene</p>
              <ul className="list-disc pl-4">{sure.map((a) => <li key={a.code}><b>{allergenLabel(a.code)}</b> — {a.reason}</li>)}</ul>
            </div>
          )}
          {doubt.length > 0 && (
            <div>
              <p className="font-semibold text-destructive">Puede contener (marcado por precaución)</p>
              <ul className="list-disc pl-4">{doubt.map((a) => <li key={a.code}><b>{allergenLabel(a.code)}</b> — {a.reason}</li>)}</ul>
            </div>
          )}
          {!res.allergens.length && <p>No se han detectado alérgenos. Revisa igualmente las etiquetas.</p>}
          {res.questions.length > 0 && (
            <div><p className="font-semibold">Para salir de dudas</p><ul className="list-disc pl-4">{res.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
          )}
          {res.tips.length > 0 && (
            <div><p className="font-semibold">Consejos</p><ul className="list-disc pl-4">{res.tips.map((q) => <li key={q}>{q}</li>)}</ul></div>
          )}
          {res.description && (
            <div className="flex items-center gap-2">
              <p className="flex-1 italic">"{res.description}"</p>
              <Button type="button" size="sm" variant="outline" onClick={() => onDescription(res.description!)}>Usar</Button>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Orientativo. La responsabilidad final es del establecimiento; revisa las etiquetas de los productos que compras. Los ingredientes no se muestran al cliente.
      </p>
    </div>
  );
}
