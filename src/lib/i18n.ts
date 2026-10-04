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
  tomorrow: { es: "mañana", en: "tomorrow", fr: "demain", de: "morgen", it: "domani", pt: "amanhã", ca: "demà" },
  rejectedTitle: { es: "Mesa no aceptada", en: "Table not accepted", fr: "Table non acceptée", de: "Tisch nicht angenommen", it: "Tavolo non accettato", pt: "Mesa não aceite", ca: "Taula no acceptada" },
  rejectedText: { es: "Esta mesa no ha sido aceptada. Avisa al camarero.", en: "This table has not been accepted. Ask a waiter.", fr: "Cette table n'a pas été acceptée. Prévenez le serveur.", de: "Dieser Tisch wurde nicht angenommen. Bitte den Service informieren.", it: "Questo tavolo non è stato accettato. Avvisa il cameriere.", pt: "Esta mesa não foi aceite. Avise o empregado.", ca: "Aquesta taula no ha estat acceptada. Avisa el cambrer." },
  tableWord: { es: "Mesa", en: "Table", fr: "Table", de: "Tisch", it: "Tavolo", pt: "Mesa", ca: "Taula" },
  enterWord: { es: "Entrar", en: "Enter", fr: "Entrer", de: "Eintreten", it: "Entra", pt: "Entrar", ca: "Entrar" },
  welcome: { es: "¡Bienvenidos!", en: "Welcome!", fr: "Bienvenue !", de: "Willkommen!", it: "Benvenuti!", pt: "Bem-vindos!", ca: "Benvinguts!" },
  nicknameAsk: { es: "Si queréis, poned un nombre para que el camarero os identifique.", en: "If you like, add a name so the waiter can find you.", fr: "Si vous le souhaitez, donnez un nom pour que le serveur vous retrouve.", de: "Wenn ihr mögt, gebt einen Namen an, damit der Service euch findet.", it: "Se vuoi, dai un nome per farti riconoscere dal cameriere.", pt: "Se quiserem, deem um nome para vos encontrarmos.", ca: "Si voleu, poseu un nom perquè el cambrer us identifiqui." },
  orAs: { es: "Si no, entraréis como", en: "Otherwise you'll join as", fr: "Sinon vous entrerez comme", de: "Sonst tretet ihr als ein", it: "Altrimenti entrerai come", pt: "Caso contrário, entram como", ca: "Si no, entrareu com" },
  sameGroup: { es: "Somos del mismo grupo, unirme", en: "We're in the same group, join us", fr: "Nous sommes du même groupe, rejoignez-nous", de: "Wir gehören zur gleichen Gruppe, beitreten", it: "Siamo dello stesso gruppo, unisciti", pt: "Somos do mesmo grupo, entrar", ca: "Som del mateix grup, unir-me" },
  otherClients: { es: "No, somos otros clientes", en: "No, we're different customers", fr: "Non, nous sommes d'autres clients", de: "Nein, wir sind andere Gäste", it: "No, siamo altri clienti", pt: "Não, somos outros clientes", ca: "No, som altres clients" },
  tableOpenNotice: { es: "Mesa abierta. Avisa al camarero. Ya le hemos enviado un aviso.", en: "Table already open. Ask a waiter — we've just sent them a notice.", fr: "Table déjà ouverte. Prévenez le serveur — nous venons de l'avertir.", de: "Tisch bereits offen. Bitten Sie den Service – wir haben ihn gerade informiert.", it: "Tavolo già aperto. Avvisa il cameriere: lo abbiamo appena avvisato.", pt: "Mesa aberta. Avise o empregado: já enviámos um aviso.", ca: "Taula oberta. Avisa el cambrer: ja li hem enviat un avís." },
  sendOrder: { es: "Enviar comanda", en: "Send order", fr: "Envoyer la commande", de: "Bestellung senden", it: "Invia ordine", pt: "Enviar pedido", ca: "Enviar comanda" },
  articlesWord: { es: "artículos", en: "items", fr: "articles", de: "Artikel", it: "articoli", pt: "artigos", ca: "articles" },
  confirmTitle: { es: "¿Enviamos la comanda?", en: "Send the order?", fr: "Envoyer la commande ?", de: "Bestellung senden?", it: "Inviare l'ordine?", pt: "Enviar o pedido?", ca: "Enviem la comanda?" },
  ticketPdf: { es: "Ticket o factura (PDF)", en: "Ticket or invoice (PDF)", fr: "Ticket ou facture (PDF)", de: "Beleg oder Rechnung (PDF)", it: "Scontrino o fattura (PDF)", pt: "Talão ou fatura (PDF)", ca: "Tiquet o factura (PDF)" },
  readyToast: { es: "¡Tu pedido está listo!", en: "Your order is ready!", fr: "Votre commande est prête !", de: "Ihre Bestellung ist fertig!", it: "Il tuo ordine è pronto!", pt: "O seu pedido está pronto!", ca: "La teva comanda està llesta!" },
  waitlistAsk: { es: "¿Esperáis mesa? Apuntaos y os llaman", en: "Waiting for a table? Join the list and we'll call you", fr: "Vous attendez une table ? Inscrivez-vous, on vous appelle", de: "Warten Sie auf einen Tisch? Tragen Sie sich ein, wir rufen Sie an", it: "Aspetti un tavolo? Iscriviti e ti chiamiamo", pt: "À espera de mesa? Inscreva-se e chamamos", ca: "Espereu taula? Apunteu-vos i us truquem" },
  yourName: { es: "Tu nombre", en: "Your name", fr: "Votre nom", de: "Ihr Name", it: "Il tuo nome", pt: "O seu nome", ca: "El teu nom" },
  peopleWord: { es: "Personas", en: "People", fr: "Personnes", de: "Personen", it: "Persone", pt: "Pessoas", ca: "Persones" },
  phoneOptional: { es: "Teléfono (opcional)", en: "Phone (optional)", fr: "Téléphone (facultatif)", de: "Telefon (optional)", it: "Telefono (facoltativo)", pt: "Telefone (opcional)", ca: "Telèfon (opcional)" },
  joinList: { es: "Apuntarme a la lista", en: "Join the list", fr: "M'inscrire sur la liste", de: "Auf die Liste setzen", it: "Iscrivimi alla lista", pt: "Inscrever-me na lista", ca: "Apuntar-me a la llista" },
  joining: { es: "Apuntando…", en: "Adding…", fr: "Inscription…", de: "Wird eingetragen…", it: "Iscrizione…", pt: "A inscrever…", ca: "Apuntant…" },
  joinedTitle: { es: "Apuntados", en: "You're on the list", fr: "Vous êtes inscrit", de: "Sie sind eingetragen", it: "Sei iscritto", pt: "Inscrito", ca: "Apuntat" },
  personOne: { es: "persona", en: "person", fr: "personne", de: "Person", it: "persona", pt: "pessoa", ca: "persona" },
  personMany: { es: "personas", en: "people", fr: "personnes", de: "Personen", it: "persone", pt: "pessoas", ca: "persones" },
  joinedHint: { es: "Os llaman cuando quede sitio.", en: "We'll call you when a table frees up.", fr: "Nous vous appelons dès qu'une table se libère.", de: "Wir rufen Sie an, wenn ein Platz frei wird.", it: "Ti chiamiamo quando si libera un posto.", pt: "Chamamos quando houver lugar.", ca: "Us truquem quan quedi lloc." },
  joinNameError: { es: "Escribe tu nombre", en: "Please write your name", fr: "Indiquez votre nom", de: "Bitte Namen angeben", it: "Scrivi il tuo nome", pt: "Escreva o seu nome", ca: "Escriu el teu nom" },
  joinFail: { es: "No hemos podido apuntarte. Avisa a alguien del bar.", en: "We couldn't add you. Ask someone at the bar.", fr: "Impossible de vous inscrire. Prévenez quelqu'un au bar.", de: "Eintragung fehlgeschlagen. Fragen Sie an der Theke.", it: "Non siamo riusciti a iscriverti. Avvisa il bar.", pt: "Não foi possível inscrever. Avise alguém do bar.", ca: "No us hem pogut apuntar. Avisa algú del bar." },
  noQr: { es: "¿No tenéis QR? Compartid el enlace", en: "No QR code? Share the link", fr: "Pas de QR ? Partagez le lien", de: "Kein QR-Code? Link teilen", it: "Niente QR? Condividi il link", pt: "Sem QR? Partilhe a ligação", ca: "No teniu QR? Compartiu l'enllaç" },
  addedBy: { es: "Añadida por el camarero", en: "Added by the waiter", fr: "Ajoutée par le serveur", de: "Vom Service hinzugefügt", it: "Aggiunto dal cameriere", pt: "Adicionado pelo empregado", ca: "Afegida pel cambrer" },
  preparing: { es: "En preparación", en: "Preparing", fr: "En préparation", de: "In Zubereitung", it: "In preparazione", pt: "Em preparação", ca: "En preparació" },
  orderOne: { es: "comanda", en: "order", fr: "commande", de: "Bestellung", it: "ordine", pt: "pedido", ca: "comanda" },
  orderMany: { es: "comandas", en: "orders", fr: "commandes", de: "Bestellungen", it: "ordini", pt: "pedidos", ca: "comandes" },
  billHelp: { es: "¿Algo está mal en la cuenta? Avisa al camarero: es quien puede corregir las comandas ya enviadas.", en: "Something wrong with the bill? Ask a waiter: only they can correct orders already sent.", fr: "Un souci avec l'addition ? Prévenez le serveur : lui seul peut corriger les commandes envoyées.", de: "Stimmt etwas mit der Rechnung nicht? Bitten Sie den Service – nur er kann gesendete Bestellungen korrigieren.", it: "Qualcosa non va nel conto? Avvisa il cameriere: solo lui può correggere gli ordini già inviati.", pt: "Está tudo bem com a conta? Avise o empregado: só ele pode corrigir pedidos já enviados.", ca: "Alguna cosa no va bé amb el compte? Avisa el cambrer: només ell pot corregir les comandes enviades." },
  ticketTitle: { es: "Ticket de mesa", en: "Table ticket", fr: "Ticket de la table", de: "Tischbon", it: "Scontrino del tavolo", pt: "Talão de mesa", ca: "Tiquet de taula" },
  clearOrder: { es: "Eliminar comanda", en: "Clear order", fr: "Vider la commande", de: "Bestellung löschen", it: "Svuota ordine", pt: "Limpar pedido", ca: "Esborra la comanda" },
  sendingWord: { es: "Enviando…", en: "Sending…", fr: "Envoi…", de: "Wird gesendet…", it: "Invio…", pt: "A enviar…", ca: "Enviant…" },
  confirmSend: { es: "Confirmar y enviar", en: "Confirm and send", fr: "Confirmer et envoyer", de: "Bestätigen und senden", it: "Conferma e invia", pt: "Confirmar e enviar", ca: "Confirmar i enviar" },
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
