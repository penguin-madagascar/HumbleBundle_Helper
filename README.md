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
- Adds Humble Choice controls for selecting games, revealing every selected
  Steam key in sequence, activating them directly from Humble Choice, and
  showing per-key partial failures while a Steam account is authenticated.
- Supports game bundle pages and the Humble Choice membership page.
- Shows Humble-provided Steam activation restrictions before reveal in Choice
  game dialogs and with the same presentation on Humble download pages.
- Supports English and Chinese script UI.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Edge, or
   Firefox. Greasemonkey and compatible userscript managers should also work.
2. [Install Humble Bundle Helper](https://github.com/penguin-madagascar/HumbleBundle_Helper/raw/refs/heads/main/HB_Helper.user.js).

## Usage

Steam Store links use public Steam search and work without logging in to Steam.
The helper synchronizes the live Steam login state when Humble first loads and
again when the page regains focus or becomes visible, including after returning
from Steam login. Log in to Steam in the same browser to enable owned-game
checks, wishlist checks, and regional prices. Account-dependent controls,
price summaries, and Choice activation controls appear only while that live
Steam session is authenticated.

The current implementation keeps newly loaded Steam account and session data
in memory for the current page only; it does not persist new session or account
data.

The script follows your browser language by default. Open the Tampermonkey
script menu on a Humble Bundle page, choose `Settings` or `设置`, and change
the language in the settings dialog.

On a game bundle page, the controls appear above
`Pay at least [price] for these [number] items`. On Humble Choice, they appear
below `YOUR GAMES` and above the current month's game heading.

On the Humble Games, Bundles, Books, and Software landing pages, sorting
controls appear next to each bundle section heading. Use `Default` to restore
Humble's original order, `Ending Soon` to show bundles closest to ending first,
and `Newly Added` to show the newest bundles first. A click changes only that
section immediately, while the last clicked mode initializes every landing
section on the next page load.

When Humble provides activation metadata that can be mapped reliably, each
Steam redemption row in a Choice game dialog shows its restriction below
`Gift to a friend on Steam` before the key is revealed. Humble download pages
use the same restriction card. A card saying Humble has not marked a regional
restriction means only that both supplied country lists are explicitly empty;
it is not a guarantee that the key is global. Missing or ambiguous metadata is
not shown. These notices are an early warning based on Humble metadata; Steam's
activation result is authoritative.

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
selected Steam keys and activate them directly while staying on Humble Choice.
No separate Steam activation page is opened. Log in to the Steam Store in the
same browser before activation. The helper checks the live Steam session again
before revealing any key. It reveals every pending `Get Game` Steam row for a
selected game one at a time, then submits the collected keys to Steam one at a
time and reports progress on the same Humble page. A normal Humble key
retrieval or Steam product activation failure does not stop a later sibling
key or selected game from being processed.

Activation results remain below the Choice controls and group Humble key
retrieval failures separately from Steam activation failures. A failed Steam
key is shown in full; clicking it copies the key without opening or navigating
to Steam. Successfully activated games are removed from the selection, while
failed games remain selected for follow-up. Return to Humble Choice and start
activation again to retry them. Results remain visible until the next batch.
If the Humble page is closed, reloaded, or loses a verifiable Steam session
while processing a key, the script marks that key's result as uncertain,
cancels every key not yet submitted, and never resumes or retries the batch
automatically. Check uncertain keys in Steam before trying again. A game is
removed from the selection only when every key processed for that game succeeds.
If only some keys fail, the next activation attempt skips the slots recorded as
successful by the previous completed batch and retries the failed slots without
retaining the successful key text. After each completed batch, the script
synchronizes Steam ownership and wishlist data so highlights, selection, and
price totals reflect the latest account state.

## Data Sources

- Steam provides account ownership, wishlist, app matching, store region, and
  game-key activation.
- Humble Bundle account settings provide the account Location used for HB
  currency conversion, with USD as the fallback when settings cannot be loaded.
- Humble Choice and order metadata provide advisory Steam activation country
  lists; the final availability decision comes from Steam during activation.
- Xiaoheihe provides Steam regional price history.
- [Frankfurter](https://frankfurter.dev/) provides exchange rates when Steam
  and Humble Bundle use different currencies.

Game matching normalizes punctuation, accents, trademark symbols, and numeric
separators, but still requires an exact normalized Steam title. Bundle coupons
and items not delivered through Steam are excluded. Items identified on Steam
without Xiaoheihe regional price history remain listed separately from
unidentified items.
