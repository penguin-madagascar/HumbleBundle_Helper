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
- Converts Steam totals to the currency displayed by Humble Bundle when the
  currencies differ.
- Adds sorting controls to the Humble Games landing page for default order,
  bundles ending soon, and newly added bundles.
- Supports game bundle pages and the Humble Choice membership page.
- Shows Steam key activation restrictions on Humble download pages.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Edge, or
   Firefox. Greasemonkey and compatible userscript managers should also work.
2. [Install Humble Bundle Helper](https://github.com/penguin-madagascar/HumbleBundle_Helper/raw/refs/heads/main/HB_Helper.user.js).

## Usage

Steam Store links use public Steam search and work without logging in to Steam.
Log in to Steam in the same browser before opening Humble Bundle to enable
owned-game checks, wishlist checks, and regional prices.

On a game bundle page, the controls appear above
`Pay at least [price] for these [number] items`. On Humble Choice, they appear
below `YOUR GAMES` and above the current month's game heading.

On the Humble Games landing page, sorting controls appear next to the `Games`
heading. Use `Default` to restore Humble's original order, `Ending Soon` to
show bundles closest to ending first, and `Newly Added` to show the newest
bundles first.

The price summary follows the active Bundle Filters. Use `Show unowned` or
`Show all` in the top-right corner of the summary to change which games are
included. If an item cannot be priced, expand the matching details to see
whether Steam identification or regional price history is missing.

## Data Sources

- Steam provides account ownership, wishlist, app matching, and store region.
- Xiaoheihe provides Steam regional price history.
- [Frankfurter](https://frankfurter.dev/) provides exchange rates when Steam
  and Humble Bundle use different currencies.

Game matching normalizes punctuation, accents, trademark symbols, and numeric
separators, but still requires an exact normalized Steam title. Bundle coupons
and items not delivered through Steam are excluded. Items identified on Steam
without Xiaoheihe regional price history remain listed separately from
unidentified items.
