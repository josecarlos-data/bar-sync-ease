/** Etiquetas de la interfaz para el cliente, en los idiomas que el bar active. */

export const LANGS = ["es", "en", "fr", "de", "it", "pt", "ca"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ca: "Català",
};

type Entry = { es: string } & Partial<Record<Lang, string>>;

const T: Record<string, Entry> = {
  search: { es: "Buscar en la carta…", en: "Search the menu…", fr: "Rechercher dans la carte…", de: "Speisekarte durchsuchen…", it: "Cerca nel menu…", pt: "Pesquisar na carta…", ca: "Cerca a la carta…" },
  clearSearch: { es: "Borrar búsqueda", en: "Clear search", fr: "Effacer la recherche", de: "Suche löschen", it: "Cancella ricerca", pt: "Limpar pesquisa", ca: "Esborra la cerca" },
  allergens: { es: "Alérgenos", en: "Allergens", fr: "Allergènes", de: "Allergene", it: "Allergeni", pt: "Alergénios", ca: "Al·lergògens" },
  sin: { es: "Sin", en: "Without", fr: "Sans", de: "Ohne", it: "Senza", pt: "Sem", ca: "Sense" },
  favorites: { es: "Mis favoritas", en: "My favourites", fr: "Mes favoris", de: "Meine Favoriten", it: "I miei preferiti", pt: "Os meus favoritos", ca: "Els meus preferits" },
  favoritesHint: {
    es: "Las que tenéis en mente. Añadid las que queráis pedir.",
    en: "The ones you keep coming back to. Add what you'd like to order.",
    fr: "Celles auxquelles vous pensez. Ajoutez ce que vous souhaitez commander.",
    de: "Die Ihnen im Kopf sind. Fügen Sie hinzu, was Sie bestellen möchten.",
    it: "Quelli a cui pensi. Aggiungi quello che vuoi ordinare.",
    pt: "Aqueles em quem pensas. Adiciona o que quiseres pedir.",
    ca: "Aquells que tens al cap. Afegeix el que vulguis demanar.",
  },
  noMatch: { es: "No hay nada que coincida.", en: "Nothing matches.", fr: "Aucun résultat.", de: "Nichts gefunden.", it: "Nessun risultato.", pt: "Nada corresponde.", ca: "No hi ha res que coincideix." },
  soldOut: { es: "Agotado", en: "Sold out", fr: "Épuisé", de: "Ausverkauft", it: "Esaurito", pt: "Esgotado", ca: "Esgotat" },
  notePlaceholder: {
    es: "Nota: sin cebolla, poco hecho…",
    en: "Note: no onions, rare…",
    fr: "Note : sans oignon, pas cuit…",
    de: "Hinweis: ohne Zwiebel, kurz gebraten…",
    it: "Nota: senza cipolla, al sangue…",
    pt: "Nota: sem cebola, mal passado…",
    ca: "Nota: sense ceba, poc fet…",
  },
  allergenPrefix: { es: "Alérgenos:", en: "Allergens:", fr: "Allergènes :", de: "Allergene:", it: "Allergeni:", pt: "Alergénios:", ca: "Al·lergògens:" },
  addWord: { es: "Añadir", en: "Add", fr: "Ajouter", de: "Hinzufügen", it: "Aggiungi", pt: "Engadir", ca: "Afegeix" },
  removeWord: { es: "Quitar uno de", en: "Remove one of", fr: "Retirer un de", de: "Entfernen von", it: "Rimuovi uno di", pt: "Quitar um de", ca: "Treu un de" },
  favAdd: { es: "Marcar como favorita", en: "Mark as favourite", fr: "Marquer comme favori", de: "Als Favorit markieren", it: "Segna come preferito", pt: "Marcar como favorito", ca: "Marca com a preferit" },
  favRemove: { es: "Quitar de favoritas", en: "Remove from favourites", fr: "Retirer des favoris", de: "Aus Favoriten entfernen", it: "Rimuovi dai preferiti", pt: "Quitar dos favoritos", ca: "Treu dels preferits" },
  tabCarta: { es: "Carta", en: "Menu", fr: "Carte", de: "Karte", it: "Menu", pt: "Carta", ca: "Carta" },
  tabBill: { es: "Cuenta", en: "Bill", fr: "Addition", de: "Rechnung", it: "Conto", pt: "Conta", ca: "Compta" },
  tabTicket: { es: "Ticket", en: "Receipt", fr: "Ticket", de: "Bon", it: "Scontrino", pt: "Talão", ca: "Tiquet" },
  awaiting: {
    es: "Podéis pedir ya. Vuestras comandas quedan pendientes de confirmar: llegarán a barra y cocina en cuanto el camarero acepte la mesa.",
    en: "You can order now. Your tickets stay pending confirmation: they reach the bar and kitchen as soon as the waiter accepts the table.",
    fr: "Vous pouvez commander. Vos tickets restent en attente de confirmation : ils arrivent au bar et en cuisine dès que le serveur accepte la table.",
    de: "Ihr könnt jetzt bestellen. Eure Bestellungen warten auf Bestätigung: Sie gehen an Bar und Küche, sobald der Kellner den Tisch annimmt.",
    it: "Potete ordinare. I vostri scontrini restano in attesa di conferma: arrivano a barra e cucina quando il cameriere accetta il tavolo.",
    pt: "Podedes pedir. Os vosos tickets quedan pendentes de confirmar: chegan á barra e á cociña cando o camareiro acepta a mesa.",
    ca: "Podeu demanar. Els vostres tiquets queden pendents de confirmar: arriben a la barra i a la cuina quan el camaner accepta la taula.",
  },
  emptyBill: { es: "Todavía no habéis pedido nada.", en: "You haven't ordered anything yet.", fr: "Vous n'avez pas encore commandé.", de: "Ihr habt noch nichts bestellt.", it: "Non avete ancora ordinato nulla.", pt: "Aínda non pedistes nada.", ca: "Encara no heu demanat res." },
  orderWord: { es: "Comanda", en: "Order", fr: "Commande", de: "Bestellung", it: "Comanda", pt: "Comanda", ca: "Comanda" },
  pendingConfirm: { es: "Pendiente de confirmar", en: "Waiting for confirmation", fr: "En attente de confirmation", de: "Warten auf Bestätigung", it: "In attesa di conferma", pt: "Pendente de confirmar", ca: "Pendent de confirmar" },
  special: { es: "Especial de hoy", en: "Today's special", fr: "Spécial du jour", de: "Gericht des Tages", it: "Piatto del giorno", pt: "Especial do día", ca: "Especial del dia" },
  openUntil: { es: "Abierto hasta las", en: "Open until", fr: "Ouvert jusqu'à", de: "Geöffnet bis", it: "Aperto fino alle", pt: "Aberto até as", ca: "Obert fins a les" },
  closingIn: { es: "Cerramos en", en: "Closing in", fr: "Fermeture dans", de: "Schließt in", it: "Chiusura tra", pt: "Pechar en", ca: "Tancament en" },
  closedNow: { es: "Cerrado ahora", en: "Closed now", fr: "Fermé actuellement", de: "Jetzt geschlossen", it: "Chiuso ora", pt: "Pechado agora", ca: "Tancat ara" },
  opens: { es: "abre", en: "opens", fr: "ouvre", de: "öffnet", it: "apre", pt: "abre", ca: "obre" },
  at: { es: "a las", en: "at", fr: "à", de: "um", it: "alle", pt: "às", ca: "a les" },
  today: { es: "hoy", en: "today", fr: "aujourd'hui", de: "heute", it: "oggi", pt: "hoxe", ca: "avui" },
  tomorrow: { es: "mañana", en: "tomorrow", fr: "demain", de: "morgen", it: "domani", pt: "mañá", ca: "demà" },
};

export function t(key: string, lang: Lang = "es"): string {
  const e = T[key];
  if (!e) return key;
  return e[lang] ?? e.es;
}

const DAY_NAMES: Record<Lang, Record<string, string>> = {
  es: { mon: "el lunes", tue: "el martes", wed: "el miércoles", thu: "el jueves", fri: "el viernes", sat: "el sábado", sun: "el domingo" },
  en: { mon: "on Monday", tue: "on Tuesday", wed: "on Wednesday", thu: "on Thursday", fri: "on Friday", sat: "on Saturday", sun: "on Sunday" },
  fr: { mon: "lundi", tue: "mardi", wed: "mercredi", thu: "jeudi", fri: "vendredi", sat: "samedi", sun: "dimanche" },
  de: { mon: "am Montag", tue: "am Dienstag", wed: "am Mittwoch", thu: "am Donnerstag", fri: "am Freitag", sat: "am Samstag", sun: "am Sonntag" },
  it: { mon: "lunedì", tue: "martedì", wed: "mercoledì", thu: "giovedì", fri: "venerdì", sat: "sabato", sun: "domenica" },
  pt: { mon: "a segunda", tue: "a terça", wed: "a quarta", thu: "a quinta", fri: "a sexta", sat: "o sábado", sun: "o domingo" },
  ca: { mon: "dilluns", tue: "dimarts", wed: "dimecres", thu: "dijous", fri: "divendres", sat: "dissabte", sun: "diumenge" },
};

export function dayName(key: string, lang: Lang = "es"): string {
  return DAY_NAMES[lang]?.[key] ?? DAY_NAMES.es[key] ?? key;
}

const STORE_KEY = "***";

/** Idioma guardado en el teléfono, si lo hay y sigue activado. */
export function storedLang(available: string[]): Lang | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v && (LANGS as readonly string[]).includes(v) && available.includes(v)) return v as Lang;
  } catch {
    /* sin almacenamiento */
  }
  return null;
}

export function rememberLang(lang: Lang) {
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    /* sin almacenamiento */
  }
}

/** El idioma del móvil, si el bar lo tiene activado; si no, el primero disponible. */
export function detectLang(available: string[]): Lang {
  const browser = (navigator.language ?? "es").slice(0, 2).toLowerCase();
  const match = available.find((l) => l.toLowerCase() === browser);
  if (match && (LANGS as readonly string[]).includes(match)) return match as Lang;
  const first = available.find((l) => (LANGS as readonly string[]).includes(l));
  return (first ?? "es") as Lang;
}
