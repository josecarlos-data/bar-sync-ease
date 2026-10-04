<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep virtual-menu ordering in `bar_settings.menu_sort` and compute 30-day item popularity with an authenticated, bar-scoped aggregate RPC; this avoids exposing customer orders while sharing ordering between guest and staff views.
- Preserve print and admin manual-position ordering through the shared menu grouping helper; virtual-menu sort choices should not rearrange printed layouts or category/group order.
- Standing/counter accounts are internal `tables` rows with `kind='counter'` (numbers 901+, label via `tableLabel`), hidden from QR/Mesas; reusing tables keeps queue, ticket, stock and invoice flows unchanged.
- Tapa con la bebida: modos en bar_settings.tapa_mode; precios y rondas se calculan en src/lib/tapas.ts y se guardan en order_items (tapa_kind/tapa_round) — un solo helper para cliente y personal.
