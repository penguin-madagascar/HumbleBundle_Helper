# Humble Bundle Helper

Tampermonkey userscript for Humble Bundle game bundles, Humble Choice, and
download pages.

## Features

- Highlights Steam-owned games in green and wishlisted games in blue.
- Adds Steam Store links to expanded game details.
- Adds a SteamGifts discussion search for potential region-lock reports.
- Shows the total Steam current price, original price, and historical low for
  the games currently included by the Bundle Filters.
- Matches Steam games and DLC through Steam Store search with Steam Community
  search as a fallback.
- Switches price totals between all bundle games and games not owned by the
  current Steam account.
- Converts Steam totals to the currency from the current Humble Bundle account
  Location when the currencies differ.
- Adds sorting controls to Humble bundle landing pages for default order,
  bundles ending soon, and newly added bundles.
- Adds Humble Choice controls for selecting games, revealing selected Steam
  keys, activating them on Steam, and showing partial failures.
- Supports game bundle pages and the Humble Choice membership page.
- Shows Steam key activation restrictions on Humble download pages.
- Supports English and Chinese script UI.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Edge, or
   Firefox. Greasemonkey and compatible userscript managers should also work.
2. [Install Humble Bundle Helper](https://github.com/penguin-madagascar/HumbleBundle_Helper/raw/refs/heads/main/HB_Helper.user.js).

## Usage

Steam Store links use public Steam search and work without logging in to Steam.
Log in to Steam in the same browser before opening Humble Bundle to enable
owned-game checks, wishlist checks, and regional prices.

The script follows your browser language by default. Open the Tampermonkey
script menu on a Humble Bundle page, choose `Settings` or `设置`, and change
the language in the settings dialog.

On a game bundle page, the controls appear above
`Pay at least [price] for these [number] items`. On Humble Choice, they appear
below `YOUR GAMES` and above the current month's game heading.

On the Humble Games, Bundles, Books, and Software landing pages, sorting
controls appear next to each bundle section heading. Use `Default` to restore
Humble's original order, `Ending Soon` to show bundles closest to ending first,
and `Newly Added` to show the newest bundles first.

The price summary follows the active Bundle Filters. Use `Show unowned` or
`Show all` in the top-right corner of the summary to change which games are
included. If an item cannot be priced, expand the matching details to see
whether Steam identification or regional price history is missing. HB
conversion uses the Humble Bundle account Location, defaulting to USD if that
setting cannot be loaded.

### Humble Choice activation

On Humble Choice, use `Select` or `选择` to enter selection mode. In that mode,
clicking a game tile toggles whether it is selected instead of opening the
game details; selected games have an amber outline and check mark. Use
`Select unowned` or `选择未拥有` to replace the current
selection with visible Choice games that are not marked as owned, `Clear` or
`清空选择` to clear the current selection, and `Activate` or `激活` to reveal
selected Steam keys and open one foreground Steam key activation tab. Log in
to the Steam Store in the same browser before activation. If Steam asks you to
sign in, complete the login and refresh the activation tab. A failed Humble key
retrieval or Steam activation does not stop later selected games from being
processed.

Activation results remain below the Choice controls and group Humble key
retrieval failures separately from Steam activation failures. A failed Steam
key is shown in full; clicking it copies the key without opening or navigating
to Steam. Successfully activated games are removed from the selection, while
failed games remain selected for follow-up. Return to Humble Choice and start
activation again to retry them. Results remain visible until the next batch.
If the activation page is closed or interrupted while processing a key, the
script will not retry that key automatically; check it in Steam before trying
again. After each completed batch, the script refreshes Steam ownership and
wishlist data so highlights, selection, and price totals reflect the latest
account state.

## Data Sources

- Steam provides account ownership, wishlist, app matching, store region, and
  game-key activation.
- Humble Bundle account settings provide the account Location used for HB
  currency conversion, with USD as the fallback when settings cannot be loaded.
- Xiaoheihe provides Steam regional price history.
- [Frankfurter](https://frankfurter.dev/) provides exchange rates when Steam
  and Humble Bundle use different currencies.

Game matching normalizes punctuation, accents, trademark symbols, and numeric
separators, but still requires an exact normalized Steam title. Bundle coupons
and items not delivered through Steam are excluded. Items identified on Steam
without Xiaoheihe regional price history remain listed separately from
unidentified items.
