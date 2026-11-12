# Humble Bundle Helper

Tampermonkey userscript for Humble Bundle game bundles, Humble Choice, and
download pages.

## Features

- Highlights Steam-owned games in green and wishlisted games in blue.
- Highlights non-Steam games and miscellaneous products in blue, with platform
  or item icons at the right of their title rows.
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
- Adds a white toolbar to individual purchased bundle download pages for
  selecting eligible Steam keys, showing activation restrictions, and
  activating keys sequentially.
- Supports game bundle pages, the Humble Choice membership page, and individual
  purchased bundle order pages.
- Supports the redesigned Next.js bundle listings, game bundle cards, and Choice
  carousel, including navigation between pages without a full reload.
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
checks, wishlist checks, and regional prices. Account-dependent price summaries
and Choice controls first appear after an authenticated Steam snapshot and
remain visible during later retained-account checks. The `Activate` action
on Choice and Downloads stays disabled until the check settles as authenticated;
local selection controls remain usable as described below.

On redesigned Next.js pages, controls and game markings wait until their
corresponding React components have finished hydration, so the helper does not
change the initial HTML while React is still claiming it.

When the first Steam Store check cannot verify a valid session, the helper
attempts one background renewal through Steam's login server, then checks the
Store session and account data again. It does not open a Steam tab
automatically. Concurrent checks share their pending work; a newer forced check
waits for an outstanding renewal to finish before reading the account, so its
snapshot reflects the browser's latest Steam cookies.

Missing login markers, network failures, and Steam service errors are not
treated as a confirmed logout. If recovery cannot verify the session, use
`Open Steam to refresh session`, return to Humble, or choose `Check again`.
The login link appears only after Steam reports no renewable login session and
a second Store check explicitly reports logged out. Activation stays disabled
until the complete authenticated check succeeds.

During a retained-account Steam session check, Choice and Downloads keep their
controls, results, selection mode, and selected presentation. Local selection
remains usable while `Activate` is temporarily disabled. A settled logout or
error still applies the existing cleanup and disabled behavior.

The current implementation keeps newly loaded Steam account and session data
in memory for the current page only; it does not persist new session or account
data.

The script follows your browser language by default. Open the Tampermonkey
script menu on a Humble Bundle page, choose `Settings` or `设置`, and change
the language in the settings dialog.
The settings dialog stays centered and uses a light background with dark text
on both light and dark Humble pages.

On redesigned game bundle pages, the controls appear above the game grid and
the price totals follow the currently selected bundle tier. On redesigned
Humble Choice, the controls appear above the game grid on the member home page
at `/membership/home`, including localized month headings, or above the public
game carousel. Non-Steam products are excluded from Steam totals and highlights.
Steam links follow the currently displayed game details. On older pages, controls remain
above `Pay at least [price] for these [number] items` or below `YOUR GAMES`.

Non-Steam delivery platforms and miscellaneous products, including IGN Plus
subscriptions and coupons, receive blue card highlights and small title-row
icons without requiring a Steam login. Hover an icon to see its platform or
item name. Battle.net, Epic Games, GOG, and IGN have embedded brand icons;
other platforms use a generic icon with their name. On the public Choice
carousel, which has image-only slides, the icon appears beside the selected
game's detail heading. Games offering Steam alongside another platform keep
their normal Steam ownership and wishlist behavior. Missing platform metadata
is left unmarked, and Windows, Mac, and Linux are treated as operating systems.

Expand `Other platform items` or `其他平台项目` in the Steam price summary to
see the currently included non-Steam games and miscellaneous products with
their platform or item names. This list follows the active bundle filters,
stays available in both Steam ownership scopes, and retains its own expanded
state across scope changes and price refreshes. These items do not contribute
to Steam price totals.

On the Humble Games, Bundles, Books, and Software landing pages, sorting
controls appear next to each bundle section heading. Use `Default` to restore
Humble's original order, `Ending Soon` to show bundles closest to ending first,
and `Newly Added` to show the newest bundles first. A click changes only that
section immediately, while the last clicked mode initializes every landing
section on the next page load.

Redesigned listings use Humble's supplied end dates for `Ending Soon` and keep
the original grid order for `Default`. `Newly Added` is disabled when Humble
does not supply bundle start dates; a previously saved `Newly Added` preference
then displays the default order. Sorting preserves the page's grid elements.

When Humble provides activation metadata that can be mapped reliably, a
restriction card appears at the end of the Choice redemption container in both
unclaimed and claimed views. For games with multiple keys, each card is labeled
`Key 1/2`, `Key 2/2`, and so on to match redemption-row order. Humble download
pages use the same restriction card. A card saying Humble has not marked a
regional restriction means only that both supplied country lists are explicitly
empty; it is not a guarantee that the key is global. Missing or ambiguous
metadata is not shown. These notices are an early warning based on Humble
metadata; Steam's activation result is authoritative.

Long country-code lists (13 or more) use the same native disclosure control
and visual interaction as the price summary's `Show unpriced items` control;
lists of 12 or fewer remain visible inline. The control is accessible by
keyboard and mouse. When the exact same validated Choice game or Downloads
order mapping is redrawn, each row's expanded or collapsed state is retained
independently in memory. Switching games or orders, changing key counts,
losing a reliable mapping or view, or returning later after invalidation
starts the rows collapsed; state is not restored across page reloads or other
contexts.

The price summary follows the active Bundle Filters. Its header shows the
current all/unowned scope immediately before the existing `Show unowned` or
`Show all` action. If every identified Steam item is owned, the unowned scope
shows only a centered, bold `🎉 All items are owned 🎉` or `🎉 已全部拥有 🎉`
below its header while retaining the full price body's size, including when
rows wrap on narrow screens. The all-items scope keeps its normal totals and
counts. During a same-page refresh, the prior
successful values and summary dimensions remain visible until the new result is
ready to replace them atomically. If a background refresh fails, the previous
totals remain and a localized warning appears beside the title. If an item
cannot be priced, expand
the matching details to see whether Steam identification or regional price
history is missing. HB conversion uses the Humble Bundle account Location,
including the redesigned localized settings row. If the setting cannot be
identified or loaded, Steam prices remain available and HB conversion is
omitted instead of assuming a currency.

### Humble Choice activation

The redesigned public Choice carousel and authenticated member grid support
highlights, price totals, and Steam links. Choice activation controls remain
limited to the older redemption tiles described below. New Library support is
described separately below. Purchased order activation also remains available
through `/downloads?key=...`.

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

### Redesigned Library

The helper recognizes Purchased, bundle details, and individual content details
under `/home/library`. Purchased has selection and activation controls below
the Library heading, including eligible entries in the featured Choice block.
Bundle and content details also show Steam price totals, other platforms,
SteamGifts region discussions, and native key disclaimers. Missing region data
is labelled as not provided. Owned, wishlisted, and non-Steam indicators and
independent Steam links follow the verified delivery platform.

Selections exist only in memory and clear when navigating, switching tabs,
searching, filtering, sorting, or changing pagination. Duplicate appearances of
the same purchased entitlement share a selection; separate purchases keep
separate identities even when they deliver the same Steam app. Public Choice
product metadata alone does not establish a claimable entitlement.

Activation starts only after an explicit click. It freezes the selected key
slots, verifies the current Humble and Steam accounts before collection and
each Steam submission, and reuses the existing global batch locks. Native
bundle/content rows with the verified `兑换` action can reveal eligible Steam
keys. Purchased activation currently requires already revealed keys: an
unrevealed entry asks you to reveal it in the original game details and retry.
Multi-key entries run as one batch, with successful slots skipped on retry.
Selection clears only after all selected Steam slots for that purchase succeed.

Account or view changes stop subsequent submissions; an in-flight result is
recorded when known. Interrupted Library batches never resume automatically.
Result details and copying failed keys require the matching account context.
Humble identity uses an in-memory hash of the verified primary email setting;
the email itself is not logged or stored. Identity verification failure disables
activation.

Custom page sizes remain unavailable until the native pagination contract is
confirmed. The helper does not hide or rebuild native lists to simulate a page
size. Purchased unrevealed-key requests and automatic platform selection are
not implemented. Automated tests simulate reveal and activation responses;
live account and redemption behavior still needs browser verification.

### Bundle download activation

On an individual purchased bundle order at `/downloads?key=...`, a white
toolbar appears at the top of the order with `Activate`, `Select unowned`,
`Select`/`Done`, and `Clear`. This feature does not extend `/home/keys`, and the
existing Humble Choice appearance stays unchanged. Only Steam key entries are
eligible; gifts and direct or keyless redemption are excluded. Hidden entries
that are expired or sold out are also excluded, but an already revealed valid
Steam key remains usable if it later expires or sells out.

The white Steam status card at the top of this toolbar reports the session
check. On the initial page load it checks whether Steam is logged in. If a
previously verified account is retained, it reports that the Steam session is
being revalidated while keeping the order controls and local selection usable.
If Steam is logged out, the card provides a Steam login link; if the check
fails, it provides a retry action. `Activate` remains disabled during either
check and becomes available only after exact authentication succeeds.

Selections are persisted and synchronized separately for each order.
`Select unowned` excludes only entries positively matched to games owned by the
current Steam account, so unknown items remain selected.

Selecting an entry does not reveal its hidden Humble key. After you click
`Activate`, the helper first performs a fresh authenticated Steam-session check,
then retrieves hidden keys as needed and submits Steam activations sequentially.
An item-specific Humble retrieval or Steam activation failure does not stop
later entries. Successful entries are cleared from the selection; failed
entries remain selected for follow-up. If the helper successfully reveals at
least one previously hidden key, it waits for the complete activation batch to
be persisted and for selection reconciliation to finish, then reloads the same
order once so Humble can render the revealed rows. This reload still occurs
when Steam activation fails after a successful Humble reveal. It does not occur
when every key was already visible, a Humble reveal fails without revealing a
key, or the route or order changes before processing finishes.

If you use Humble's native `Reveal` action, a newly visible valid key that is
absent from the helper's canonical cached order triggers one coalesced,
authoritative order reload. Selection and activation are disabled during that
request, and the stale snapshot is not remapped. After a successful reload, the
helper restores exact-key row mapping, region notices, and the persisted
selection. A late response is discarded after navigation. If the current
order cannot be reloaded, usable mappings and actions are cleared while the
persisted selection is retained, and a localized order-loading error remains
until a successful reinitialization or page reload.

If the same order is refreshed or its rows are remapped during the mandatory
Steam preflight, activation continues when the order, selection, and eligible
rows still match. A genuine route or order change, selection change, or
eligibility change remains fail-closed before any key is revealed.

While activation work is active, Choice and every order's activation controls
are locked. Detailed results, including failed Steam keys, are visible only on
the matching Choice or exact order page; other scopes show only a generic busy
status.

The raw order key is held in memory only for Humble order and reveal requests.
It is never written to GM storage, activation batch or item IDs, DOM attributes,
lock names, logs, errors, or tests. The helper uses a SHA-256 order scope
instead. If Web Crypto SHA-256 or Web Locks is unavailable, activation is
disabled or stopped without storing the raw key.

If API entries cannot be mapped to page rows without ambiguity, including a
duplicate-group count mismatch, the affected entries are disabled with a
warning; a native reveal does not weaken these strict mapping rules. A Humble
reveal failure never falls back to clicking page controls. If a successful
reveal response omits the key, the helper fetches the order once more and
reconciles it by the exact `(machine_name,keyindex)` pair.

Humble key reveal and Steam activation are live, irreversible actions and
should be verified manually by you on the intended account. Automated coverage
uses controlled tests rather than live Humble or Steam activation.

## Data Sources

- Steam provides account ownership, wishlist, app matching, store region, and
  game-key activation.
- Steam's login server renews existing browser sessions when needed, following
  its [web session refresh flow](https://store.akamai.steamstatic.com/public/shared/javascript/auth_refresh.js).
- Humble Bundle account settings provide the account Location used for HB
  currency conversion; unavailable settings omit the conversion.
- Humble Choice and order metadata provide advisory Steam activation country
  lists; the final availability decision comes from Steam during activation.
- Xiaoheihe provides Steam regional price history.
- [Frankfurter](https://frankfurter.dev/) provides exchange rates when Steam
  and Humble Bundle use different currencies.
- Embedded Battle.net, Epic Games, GOG, and IGN SVG paths come from
  [Simple Icons](https://github.com/simple-icons/simple-icons), whose project
  is released under [CC0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md).

Game matching normalizes punctuation, accents, trademark symbols, and numeric
separators, but still requires an exact normalized Steam title. Bundle coupons
and items not delivered through Steam are excluded. Items identified on Steam
without Xiaoheihe regional price history remain listed separately from
unidentified items.

## Development

Run `npm ci`, `npm test`, and `npm run check` to install the test dependencies,
run the regression suite, and check userscript syntax. The userscript itself
has no added runtime dependency. Redesign tests use reduced page markup,
controlled data responses, and real React hydration (including delayed
Suspense boundaries) without revealing or activating keys. The hydration
adapter uses `unsafeWindow` only to inspect React's committed DOM-node
bookkeeping, without reading component props or account data.
