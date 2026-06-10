# Humble Bundle Helper

Tampermonkey userscript for Humble Bundle game bundles, Humble Choice, and
download pages.

## Features

- Highlights Steam-owned games in green and wishlisted games in blue.
- Adds a SteamGifts discussion search for potential region-lock reports.
- Shows the total Steam current price, original price, and historical low for
  the games currently included by the Bundle Filters.
- Switches price totals between all bundle games and games not owned by the
  current Steam account.
- Converts Steam totals to the currency displayed by Humble Bundle when the
  currencies differ.
- Supports game bundle pages and the Humble Choice membership page.
- Shows Steam key activation restrictions on Humble download pages.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Edge, or
   Firefox. Greasemonkey and compatible userscript managers should also work.
2. [Install Humble Bundle Helper](https://github.com/penguin-madagascar/HumbleBundle_Helper/raw/refs/heads/main/HB_Helper.user.js).

## Usage

Log in to Steam in the same browser before opening Humble Bundle. The script
uses the current Steam account and Steam store region for owned-game checks and
regional prices.

On a game bundle page, the controls appear above
`Pay at least [price] for these [number] items`. On Humble Choice, they appear
below `YOUR GAMES` and above the current month's game heading.

The price summary follows the active Bundle Filters. Use `Show unowned` or
`Show all` in the top-right corner of the summary to change which games are
included.

## Data Sources

- Steam provides account ownership, wishlist, app matching, and store region.
- Xiaoheihe provides Steam regional price history.
- [Frankfurter](https://frankfurter.dev/) provides exchange rates when Steam
  and Humble Bundle use different currencies.

Game matching uses Steam titles. Games without an exact Steam title match are
excluded from the price total but remain in the matched-game denominator.
