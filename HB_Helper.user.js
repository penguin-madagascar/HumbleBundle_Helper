// ==UserScript==
// @name         HumbleBundle Helper
// @name:zh-CN   Humble Bundle 助手
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.1.7
// @description  Highlight Steam games and summarize regional prices on Humble Bundle
// @description:zh-CN 在 Humble Bundle 上标记 Steam 游戏并汇总区域价格
// @icon         https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-32.png
// @icon64       https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-64.png
// @author       PenguinOfMadagascar
// @license      MIT
// @match        https://www.humblebundle.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      www.humblebundle.com
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// @connect      login.steampowered.com
// @connect      steamcommunity.com
// @connect      api.xiaoheihe.cn
// @connect      api.frankfurter.dev
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
    .tier-item-view.owned {
      box-sizing: border-box !important;
      background: rgba(100,255,100,.35) !important;
      border-radius: 8px !important;
      padding: 6px !important;
    }
    .tier-item-view.wishlist {
      box-sizing: border-box !important;
      background: rgba(100,100,255,.35) !important;
      border-radius: 8px !important;
      padding: 6px !important;
    }
    [data-testid="bundle-item-card"].owned,
    main button > [data-testid="product-card"].owned,
    [data-media-index].owned,
    .hb-helper-library-card.owned {
      background: rgba(100,255,100,.35) !important;
      outline: 3px solid #64df64 !important;
      outline-offset: -3px !important;
      border-radius: 8px !important;
    }
    [data-testid="bundle-item-card"].wishlist,
    main button > [data-testid="product-card"].wishlist,
    [data-media-index].wishlist,
    .hb-helper-library-card.wishlist {
      background: rgba(100,100,255,.35) !important;
      outline: 3px solid #8d9dff !important;
      outline-offset: -3px !important;
      border-radius: 8px !important;
    }
    .tier-item-view.hb-helper-non-steam,
    .choice-content.js-open-choice-modal.hb-helper-non-steam,
    [data-testid="bundle-item-card"].hb-helper-non-steam,
    main button > [data-testid="product-card"].hb-helper-non-steam,
    [data-media-index].hb-helper-non-steam,
    .hb-helper-library-card.hb-helper-non-steam {
      background: rgba(59, 130, 246, 0.3) !important;
      outline: 3px solid #51adff !important;
      outline-offset: -3px !important;
      border-radius: 8px !important;
    }
    .hb-helper-platform-title-row {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 8px !important;
      min-width: 0 !important;
    }
    .hb-helper-platform-title-row > :first-child:not(.hb-helper-platform-badges) {
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }
    .hb-helper-platform-title-details {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: center !important;
      column-gap: 8px !important;
    }
    .hb-helper-platform-title-details > h3 {
      grid-area: 1 / 1 !important;
    }
    .hb-helper-platform-title-details > :not(h3):not(.hb-helper-platform-badges) {
      grid-column: 1 / -1 !important;
    }
    .hb-helper-platform-badges {
      display: inline-flex !important;
      flex: 0 0 auto !important;
      align-items: center !important;
      gap: 6px !important;
      margin-left: auto !important;
      color: #bfe3ff !important;
    }
    .hb-helper-platform-title-details > .hb-helper-platform-badges {
      grid-area: 1 / 2 !important;
    }
    .hb-helper-library-card .hb-helper-platform-title-details > :first-child {
      grid-area: 1 / 1 !important;
    }
    .hb-helper-platform-badge {
      box-sizing: border-box !important;
      display: inline-flex !important;
      width: 24px !important;
      height: 24px !important;
      align-items: center !important;
      justify-content: center !important;
      background: #164d7a !important;
      border-radius: 4px !important;
      color: #fff !important;
      padding: 2px !important;
    }
    .hb-helper-platform-badge svg {
      width: 100% !important;
      height: 100% !important;
      fill: currentColor !important;
    }
    .hb-helper-landing-sort-header[data-hb-helper-sort-layout="grid"] {
      margin-bottom: 0 !important;
    }
    .hb-helper-landing-sort-controls button:disabled {
      cursor: default !important;
      opacity: .5 !important;
    }
    .choice-content.js-open-choice-modal.owned {
      background: rgba(100,255,100,.35) !important;
    }
    .choice-content.js-open-choice-modal.wishlist {
      background: rgba(100,100,255,.35) !important;
    }
    #hb-helper-controls {
      box-sizing: border-box !important;
      margin: 8px 0 !important;
    }
    .hb-helper-library-status {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      border-radius: 4px !important;
      color: #fff !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
      padding: 10px !important;
    }
    .hb-helper-library-status button {
      background: #334155 !important;
      border: 1px solid #64748b !important;
      border-radius: 4px !important;
      color: #e2e8f0 !important;
      cursor: default !important;
      font: inherit !important;
      font-weight: 700 !important;
      min-height: 32px !important;
      padding: 5px 10px !important;
    }
    .hb-helper-library-status p {
      margin: 8px 0 0 !important;
    }
    #hb-helper-login-reminder {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      color: #fff !important;
      padding: 10px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
    }
    #hb-helper-login-reminder a {
      color: #fff !important;
    }
    #steamgifts-discussion {
      box-sizing: border-box !important;
      margin: 8px 0 !important;
    }
    #steamgifts-discussion a {
      display: inline-block !important;
      background: #3b7bbf !important;
      color: #fff !important;
      padding: 6px 10px !important;
      border-radius: 4px !important;
      text-decoration: none !important;
    }
    #steamgifts-discussion a:hover {
      opacity: .9 !important;
    }
    .hb-helper-steam-store-link {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      background: #1b75bb !important;
      color: #fff !important;
      min-height: 36px !important;
      padding: 8px 14px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
      text-decoration: none !important;
      font-weight: bold !important;
      line-height: 1.2 !important;
      cursor: pointer !important;
    }
    .hb-helper-steam-store-row {
      box-sizing: border-box !important;
      display: block !important;
      flex-basis: 100% !important;
      grid-column: 1 / -1 !important;
      margin-top: 8px !important;
      width: 100% !important;
    }
    .hb-helper-steam-store-link:hover {
      opacity: .9 !important;
    }
    #hb-helper-price-summary {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      color: #fff !important;
      padding: 10px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
      line-height: 1.5 !important;
    }
    #hb-helper-price-summary .hb-helper-price-title {
      font-weight: bold !important;
    }
    #hb-helper-price-summary .hb-helper-price-stale {
      color: #ffd166 !important;
      flex: 1 1 auto !important;
      visibility: hidden;
    }
    #hb-helper-price-summary .hb-helper-price-scope-controls {
      display: inline-flex !important;
      align-items: center !important;
      flex: 0 0 auto !important;
      gap: 8px !important;
    }
    #hb-helper-price-summary .hb-helper-price-header {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      margin-bottom: 4px !important;
    }
    #hb-helper-price-scope {
      flex: 0 0 auto !important;
      background: rgba(255, 255, 255, 0.15) !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      padding: 3px 8px !important;
    }
    #hb-helper-price-scope:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.25) !important;
    }
    #hb-helper-price-scope:disabled {
      cursor: default !important;
      opacity: 0.5 !important;
    }
    #hb-helper-choice-activation-controls {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      border-radius: 4px !important;
      color: #fff !important;
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
      padding: 10px !important;
    }
    #hb-helper-choice-activation-controls button {
      box-sizing: border-box !important;
      border: 1px solid transparent !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      font: inherit !important;
      font-weight: 700 !important;
      min-height: 32px !important;
      padding: 5px 10px !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="activate"] {
      background: rgba(35, 134, 54, 0.92) !important;
      border-color: rgba(93, 190, 117, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="activate"]:hover:not(:disabled) {
      background: rgba(46, 160, 67, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select-unowned"] {
      background: rgba(9, 105, 218, 0.92) !important;
      border-color: rgba(84, 174, 255, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select-unowned"]:hover:not(:disabled) {
      background: rgba(31, 111, 235, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select"] {
      background: rgba(111, 66, 193, 0.92) !important;
      border-color: rgba(163, 113, 247, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select"]:hover:not(:disabled) {
      background: rgba(130, 80, 223, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="clear"] {
      background: rgba(207, 34, 46, 0.92) !important;
      border-color: rgba(255, 129, 130, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="clear"]:hover:not(:disabled) {
      background: rgba(218, 54, 51, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button:disabled {
      cursor: default !important;
      opacity: 0.5 !important;
    }
    #hb-helper-choice-activation-controls .hb-helper-choice-status {
      flex: 1 0 100% !important;
      min-height: 20px !important;
    }
    #hb-helper-choice-activation-results {
      box-sizing: border-box !important;
      flex: 1 0 100% !important;
      width: 100% !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-summary {
      font-weight: 700 !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-warning {
      color: #ffd166 !important;
      margin-top: 4px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-group {
      background: rgba(255, 255, 255, 0.08) !important;
      border-radius: 4px !important;
      margin-top: 8px !important;
      padding: 8px !important;
    }
    #hb-helper-choice-activation-results h4 {
      font-size: 1em !important;
      margin: 0 0 4px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-row +
    .hb-helper-choice-result-row {
      margin-top: 5px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-failed-key {
      background: rgba(0, 0, 0, 0.35) !important;
      border-color: rgba(255, 255, 255, 0.45) !important;
      display: block !important;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
      font-weight: 400 !important;
      margin-top: 4px !important;
      overflow-wrap: anywhere !important;
      text-align: left !important;
      width: 100% !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-copy-feedback {
      min-height: 1.5em !important;
      margin-top: 4px !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls {
      background: #fff !important;
      border: 1px solid #d0d7de !important;
      color: #1f2328 !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls
    .hb-helper-choice-result-group {
      background: #f6f8fa !important;
      border: 1px solid #d0d7de !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls
    .hb-helper-choice-result-warning {
      color: #9a6700 !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls
    .hb-helper-choice-failed-key {
      background: #fff !important;
      border-color: #d0d7de !important;
      color: #1f2328 !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls
    #hb-helper-login-reminder {
      background: #fff !important;
      border: 1px solid #d0d7de !important;
      color: #1f2328 !important;
      flex: 1 0 100% !important;
      margin: 0 !important;
    }
    #hb-helper-choice-activation-controls.hb-helper-downloads-controls
    #hb-helper-login-reminder a {
      color: #0969da !important;
    }
    .key-redeemer.hb-helper-download-selected {
      box-shadow: 0 0 0 4px #ffbf00 !important;
      background: rgba(255, 191, 0, 0.2) !important;
      position: relative !important;
    }
    html.hb-helper-download-select-mode .key-redeemer:not(.hb-helper-download-mapping-disabled) {
      cursor: pointer !important;
    }
    .hb-helper-download-mapping-disabled {
      opacity: 0.72 !important;
    }
    .hb-helper-download-mapping-warning,
    .hb-helper-download-mapping-summary-warning,
    .hb-helper-download-region-warning {
      box-sizing: border-box !important;
      color: #9a6700 !important;
      font-weight: 700 !important;
      margin-top: 6px !important;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected {
      position: relative !important;
      box-shadow: 0 0 0 4px #ffbf00 !important;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 191, 0, 0.25);
      pointer-events: none;
      z-index: 1;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected::after {
      content: '✓';
      position: absolute;
      top: 8px;
      right: 8px;
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border-radius: 50%;
      background: #ffbf00;
      color: #1a1a1a;
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      pointer-events: none;
      z-index: 2;
    }
    html.hb-helper-choice-select-mode .choice-content.js-open-choice-modal {
      cursor: pointer !important;
    }
    html.hb-helper-choice-select-mode .choice-content.js-open-choice-modal * {
      pointer-events: none !important;
    }
    .hb-helper-landing-sort-header {
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 12px !important;
      margin-bottom: 28px !important;
      width: 100% !important;
    }
    .hb-helper-landing-sort-header > h3 {
      flex: 1 1 auto !important;
      margin: 0 !important;
      min-width: 0 !important;
    }
    .hb-helper-landing-sort-controls {
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      flex: 0 0 auto !important;
      gap: 6px !important;
      justify-content: flex-end !important;
      margin-left: auto !important;
      vertical-align: middle !important;
    }
    .hb-helper-landing-sort-controls button {
      box-sizing: border-box !important;
      background: rgba(255, 255, 255, 0.12) !important;
      border: 1px solid rgba(255, 255, 255, 0.35) !important;
      border-radius: 4px !important;
      color: inherit !important;
      cursor: pointer !important;
      font: inherit !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      min-height: 32px !important;
      padding: 6px 10px !important;
    }
    .hb-helper-landing-sort-controls button:hover {
      background: rgba(255, 255, 255, 0.2) !important;
    }
    .hb-helper-landing-sort-controls button:focus-visible {
      outline: 2px solid currentColor !important;
      outline-offset: 2px !important;
    }
    .hb-helper-landing-sort-controls button.hb-helper-landing-sort-active {
      background: rgba(255, 255, 255, 0.28) !important;
      border-color: currentColor !important;
    }
    @media (max-width: 640px) {
      .hb-helper-landing-sort-header {
        align-items: flex-start !important;
        flex-wrap: wrap !important;
      }
      .hb-helper-landing-sort-controls {
        display: flex !important;
        flex: 1 0 100% !important;
        justify-content: flex-start !important;
        margin-left: 0 !important;
        margin-bottom: 10px !important;
      }
    }
    #hb-helper-price-summary .hb-helper-price-value {
      font-weight: bold !important;
    }
    #hb-helper-price-summary .hb-helper-all-owned-state {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
    }
    #hb-helper-price-summary .hb-helper-all-owned-state > * {
      grid-area: 1 / 1 !important;
    }
    #hb-helper-price-summary .hb-helper-all-owned-sizing {
      visibility: hidden !important;
    }
    #hb-helper-price-summary .hb-helper-all-owned {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      font-weight: 700 !important;
    }
    #hb-helper-price-summary .hb-helper-match-details,
    #hb-helper-price-summary .hb-helper-other-platform-details {
      margin-top: 4px !important;
    }
    .hb-helper-disclosure summary {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: rgba(255, 255, 255, 0.15) !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      list-style: none !important;
      margin-top: 2px !important;
      padding: 3px 8px !important;
      user-select: none !important;
    }
    .hb-helper-disclosure summary::-webkit-details-marker {
      display: none !important;
    }
    .hb-helper-disclosure summary::before {
      content: '' !important;
      border-bottom: 4px solid transparent !important;
      border-left: 6px solid currentColor !important;
      border-top: 4px solid transparent !important;
      transition: transform 0.15s ease !important;
    }
    .hb-helper-disclosure summary:hover {
      background: rgba(255, 255, 255, 0.25) !important;
    }
    .hb-helper-disclosure summary:focus-visible {
      outline: 2px solid #fff !important;
      outline-offset: 2px !important;
    }
    .hb-helper-disclosure[open] summary::before {
      transform: rotate(90deg) !important;
    }
    #hb-helper-price-summary .hb-helper-match-group {
      margin-top: 4px !important;
    }
    #hb-helper-price-summary .hb-helper-match-group ul {
      margin: 2px 0 0 20px !important;
      padding: 0 !important;
    }
    .hb-helper-region-restrictions {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      border: 1px solid rgba(255, 209, 102, 0.85) !important;
      border-radius: 4px !important;
      color: #fff !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
      padding: 10px !important;
    }
    .hb-helper-region-restrictions--allowed,
    .hb-helper-region-restrictions--unmarked {
      border-color: rgba(93, 190, 117, 0.9) !important;
    }
    .hb-helper-region-restrictions--restricted {
      border-color: rgba(255, 129, 130, 0.95) !important;
    }
    .hb-helper-region-restrictions__status {
      display: block !important;
      font-weight: 700 !important;
    }
    .hb-helper-region-restrictions__key-label {
      display: block !important;
      font-weight: 700 !important;
      margin-bottom: 4px !important;
    }
    .hb-helper-region-restrictions__list {
      margin-top: 4px !important;
    }
    .hb-helper-region-restrictions__details {
      margin-top: 4px !important;
    }
    .hb-helper-region-restrictions__countries {
      margin-top: 4px !important;
      overflow-wrap: anywhere !important;
    }
    #hb-helper-settings-dialog {
      box-sizing: border-box !important;
      position: fixed !important;
      inset: 0 !important;
      margin: auto !important;
      background: #fff !important;
      color-scheme: light !important;
      border: 0 !important;
      border-radius: 8px !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28) !important;
      color: #222 !important;
      font: 14px/1.4 Arial, sans-serif !important;
      height: fit-content !important;
      max-height: calc(100dvh - 32px) !important;
      max-width: min(420px, calc(100vw - 32px)) !important;
      overflow-y: auto !important;
      padding: 20px !important;
      width: 420px !important;
    }
    #hb-helper-settings-dialog::backdrop {
      background: rgba(0, 0, 0, 0.38) !important;
    }
    #hb-helper-settings-dialog h2 {
      color: inherit !important;
      font-size: 18px !important;
      font-weight: 700 !important;
      line-height: 1.3 !important;
      margin: 0 0 16px !important;
    }
    #hb-helper-settings-dialog .hb-helper-settings-row {
      display: grid !important;
      gap: 6px !important;
      margin-bottom: 18px !important;
    }
    #hb-helper-settings-dialog label {
      font-weight: 700 !important;
    }
    #hb-helper-settings-dialog select {
      box-sizing: border-box !important;
      background: #fff !important;
      border: 1px solid #b8bec4 !important;
      border-radius: 4px !important;
      color: #222 !important;
      font: inherit !important;
      min-height: 36px !important;
      padding: 6px 8px !important;
      width: 100% !important;
    }
    #hb-helper-settings-dialog .hb-helper-settings-actions {
      display: flex !important;
      gap: 8px !important;
      justify-content: flex-end !important;
    }
    #hb-helper-settings-dialog button {
      box-sizing: border-box !important;
      background: #fff !important;
      border: 1px solid #b8bec4 !important;
      border-radius: 4px !important;
      color: #222 !important;
      cursor: pointer !important;
      font: inherit !important;
      min-height: 34px !important;
      padding: 6px 12px !important;
    }
    #hb-helper-settings-dialog button:hover {
      background: #edf3f8 !important;
    }
    #hb-helper-settings-dialog button[type="submit"] {
      background: #1b75bb !important;
      border-color: #1b75bb !important;
      color: #fff !important;
    }
    #hb-helper-settings-dialog button[type="submit"]:hover {
      background: #155f98 !important;
    }
    #hb-helper-settings-dialog :is(button, select):focus-visible {
      outline: 2px solid #1b75bb !important;
      outline-offset: 2px !important;
    }`;
    (document.head || document.documentElement).appendChild(style);

    const languageValueKey = 'hb-helper-language-v1';
    const languageSettings = ['auto', 'en', 'zh-CN'];
    const messages = {
        en: {
            settingsMenu: 'Settings',
            settingsTitle: 'Humble Bundle Helper Settings',
            languageLabel: 'Language',
            languageAuto: 'Follow browser',
            languageEnglish: 'English',
            languageChinese: '中文',
            cancel: 'Cancel',
            save: 'Save',
            landingDefaultLabel: 'Default',
            landingDefaultTitle: 'Use Humble Bundle default order',
            landingEndingLabel: 'Ending Soon',
            landingEndingTitle: 'Sort bundles by nearest end date',
            landingNewestLabel: 'Newly Added',
            landingNewestTitle: 'Sort bundles by newest start date',
            landingNewestUnavailableTitle: 'Humble does not provide bundle start dates on this page',
            landingSortAria: 'Sort {heading} bundles',
            loginSteamLoadAccountData: 'Log in to Steam, then return to this Humble page to synchronize account data automatically.',
            steamInvalidAccountData: 'Steam returned invalid account data',
            steamSyncLoggedOut: 'Log in to Steam, then return to Humble Bundle. Your Steam session will synchronize automatically.',
            steamSyncError: 'Could not synchronize your Steam session. Open Steam to refresh it, then return and check again.',
            steamSyncRetry: 'Check again',
            steamRefreshLink: 'Open Steam to refresh session',
            steamSessionRefreshing: 'Refreshing Steam session…',
            steamSessionChecking: 'Checking Steam login status…',
            steamSessionRechecking: 'Rechecking Steam session; activation becomes available when complete.',
            steamGiftsSearch: 'Search SteamGifts discussions (for potential region lock)',
            loadingPriceTotals: 'Loading Steam price totals...',
            stalePriceTotals: 'Refresh failed; showing previous totals.',
            loginSteamCheckOwned: 'Log in to Steam to synchronize account features',
            viewOnSteam: 'View on Steam',
            requestFailedHttp: 'Request failed with HTTP {status}',
            networkRequestFailed: 'Network request failed',
            requestTimedOut: 'The network request timed out.',
            xiaoheiheNoPrice: 'Xiaoheihe has no {region} price for Steam app {appId}',
            xiaoheiheInvalidPrice: 'Invalid Xiaoheihe price for Steam app {appId}',
            invalidExchangeRate: 'Invalid Frankfurter exchange rate',
            steamItemNotFound: 'Steam item not found',
            regionalPriceUnavailable: 'Regional price unavailable',
            showUnpricedItems: ({count}) =>
                `Show ${count} unpriced item${count === 1 ? '' : 's'}`,
            unavailable: 'Unavailable',
            libraryKeyInformationPending: 'Complete key information is not yet available. Use the original redemption controls for now.',
            libraryActivate: 'Activate selected games',
            libraryActivateGame: 'Activate this game',
            hbPrice: 'HB: {price}',
            showUnowned: 'Show unowned',
            showAll: 'Show all',
            togglePriceScope: 'Toggle between all games and games not owned on Steam',
            loginFilterOwned: 'Login to Steam to filter out owned games',
            allItems: 'all items',
            unownedItems: 'unowned items',
            showingPriceScope: 'Showing: {scope}',
            priceTotalsTitle: 'Steam price totals ({priceRegion})',
            currentPrice: 'Current',
            originalPrice: 'Original',
            historicalLow: 'Historical low',
            matchedItems: '{matched}/{selected} Steam items identified ({scope})',
            allSteamItemsOwned: '🎉 All items are owned 🎉',
            otherRedemption: 'Other redemption platform',
            otherPlatformItems: 'Other platform items ({count})',
            miscellaneousItem: 'Miscellaneous item',
            subscriptionItem: 'Subscription',
            couponItem: 'Coupon',
            drmFreeItem: 'DRM-free download',
            pricedItems: '{priced}/{matched} identified items have price history',
            choiceActivate: 'Activate',
            choiceSelectUnowned: 'Select unowned',
            choiceSelect: 'Select',
            choiceSelectDone: 'Done',
            choiceClearSelection: 'Clear',
            choiceSelectedCount: '{count} selected',
            choiceNoSelection: 'Select at least one Choice game first',
            choiceActivationBusy: 'Another Humble Choice activation batch is already in progress.',
            activationBusy: 'Another Humble key activation batch is already in progress.',
            downloadNoSelection: 'Select at least one eligible Steam key from this order first.',
            downloadWebCryptoUnavailable: 'Activation is disabled because this browser does not support Web Crypto SHA-256.',
            downloadOrderInvalid: 'Humble returned invalid order data.',
            downloadOrderLoadFailed: 'Could not load this Humble order.',
            downloadMappingMismatch: 'This key entry could not be matched safely. Activation is disabled for this duplicate group.',
            downloadMappingSummaryMismatch: 'One or more order keys have no matching page entry. Activation is disabled for those keys.',
            downloadRevealStarting: 'Preparing {count} selected key(s) from this order for Steam activation...',
            downloadRevealProgress: 'Retrieving the Steam key for {title} from this order ({current}/{total})...',
            downloadRevealFailed: 'Could not retrieve a Steam key for {title} from this order.',
            downloadHumbleFailureReason: 'Humble did not provide a valid Steam key for this order item.',
            downloadLoginSteam: 'Log in to Steam, then return to this downloads page to activate selected keys.',
            choiceWebLocksUnavailable: 'Activation was stopped because this browser does not support the Web Locks API. Update or switch browsers, then try again.',
            choiceRevealStarting: 'Preparing {count} selected game key(s) for activation on this Humble page...',
            choiceRevealProgress: 'Revealing the key for {title} on this page ({current}/{total})...',
            choiceRevealFailed: 'Could not reveal a Steam key for {title}',
            choiceModalCloseFailed: 'Could not safely close the Humble details dialog for {title}. The key was not queued.',
            choiceHumbleFailureReason: 'Humble did not provide a Steam key for this game.',
            choiceActivationSummary: '{total} processed: {activated} activated, {humbleFailed} Humble key retrieval failure(s), {steamFailed} Steam activation failure(s), {pending} pending.',
            choiceHumbleFailureGroup: 'Humble key retrieval failures',
            choiceSteamFailureGroup: 'Steam activation failures',
            choiceFailureRow: 'Game: {title} — Reason: {reason}',
            choiceCopyFailedKey: 'Copy the failed Steam key for {title}',
            choiceCopiedFailedKey: 'Copied the Steam key for {title}.',
            choiceOwnershipRefreshWarning: 'Warning: Steam ownership could not be refreshed after activation.',
            choiceOwnershipRefreshUnsupportedWarning: 'Warning: Steam ownership could not be refreshed because this browser does not support the Web Locks API. Activation controls have been unlocked.',
            steamActivationProgress: 'Activating {title} from this Humble page ({current}/{total})...',
            steamActivationAlreadyOwned: 'The Steam account already owns this product.',
            steamActivationRegionRestricted: 'This product cannot be activated in the Steam account region.',
            steamActivationInvalidKey: 'Steam rejected this product key as invalid.',
            steamActivationAlreadyUsed: 'This product key has already been activated on another Steam account.',
            steamActivationBaseGameRequired: 'The required base game is not owned by this Steam account.',
            steamActivationRateLimited: 'Steam rejected the request because the activation or request limit was reached.',
            steamActivationUnknownCode: 'Steam activation failed (result code {code}).',
            steamActivationRequestFailed: 'The Steam activation request failed: {message}',
            steamActivationInterruptedUncertain: 'Steam activation was interrupted after the request began. The result is uncertain; check Steam before trying this key again.',
            steamActivationCancelledNotSubmitted: 'Activation was cancelled before this key was submitted to Steam. It was not queued for automatic retry.',
            noRegionRestrictions: 'No Region Restrictions',
            exclusiveCountries: 'Exclusive countries: {countries}',
            disallowedCountries: 'Disallowed countries: {countries}',
            regionUnmarked: 'Humble has not declared a region restriction for this key.',
            regionAllowed: 'Humble metadata indicates this key can be activated in your Steam region ({country}).',
            regionRestricted: 'Humble metadata indicates this key is restricted in your Steam region ({country}).',
            regionCountryUnavailable: 'Humble activation metadata is available, but your Steam region is unavailable.',
            regionExclusiveCountries: 'Humble allowlist: {countries}',
            regionDisallowedCountries: 'Humble blocklist: {countries}',
            regionCountryList: 'Show {count} country codes from Humble metadata',
            regionKeyLabel: 'Key {current}/{total}',
        },
        'zh-CN': {
            settingsMenu: '设置',
            settingsTitle: 'Humble Bundle Helper 设置',
            languageLabel: '语言',
            languageAuto: '跟随浏览器',
            languageEnglish: 'English',
            languageChinese: '中文',
            cancel: '取消',
            save: '保存',
            landingDefaultLabel: '默认',
            landingDefaultTitle: '使用 Humble Bundle 默认排序',
            landingEndingLabel: '即将结束',
            landingEndingTitle: '按最近结束时间排序慈善包',
            landingNewestLabel: '最新添加',
            landingNewestTitle: '按最新开始时间排序慈善包',
            landingNewestUnavailableTitle: 'Humble 未在此页面提供慈善包开始时间',
            landingSortAria: '排序 {heading} 慈善包',
            loginSteamLoadAccountData: '登录 Steam 后返回此 Humble 页面，助手会自动同步账号数据。',
            steamInvalidAccountData: 'Steam 返回了无效的账号数据',
            steamSyncLoggedOut: '登录 Steam 后返回 Humble Bundle，助手会自动同步 Steam 会话。',
            steamSyncError: '无法同步 Steam 会话。可打开 Steam 刷新会话，返回后重新检测。',
            steamSyncRetry: '重新检测',
            steamRefreshLink: '打开 Steam 刷新会话',
            steamSessionRefreshing: '正在刷新 Steam 会话…',
            steamSessionChecking: '正在检查 Steam 登录状态…',
            steamSessionRechecking: '正在重新检查 Steam 会话；完成后即可激活。',
            steamGiftsSearch: '搜索 SteamGifts 讨论（查看可能的区域限制）',
            loadingPriceTotals: '正在加载 Steam 价格汇总...',
            stalePriceTotals: '刷新失败，正在显示上次成功的价格汇总。',
            loginSteamCheckOwned: '登录 Steam 以同步账号功能',
            viewOnSteam: '在 Steam 中查看',
            requestFailedHttp: '请求失败，HTTP 状态码 {status}',
            networkRequestFailed: '网络请求失败',
            requestTimedOut: '网络请求超时。',
            xiaoheiheNoPrice: '小黑盒没有 Steam 应用 {appId} 的 {region} 区价格',
            xiaoheiheInvalidPrice: 'Steam 应用 {appId} 的小黑盒价格无效',
            invalidExchangeRate: 'Frankfurter 汇率无效',
            steamItemNotFound: '未找到 Steam 项目',
            regionalPriceUnavailable: '区域价格不可用',
            showUnpricedItems: ({count}) => `显示 ${count} 个无法定价的项目`,
            unavailable: '不可用',
            libraryKeyInformationPending: '暂时无法读取完整的 Key 信息，请使用原站领取入口。',
            libraryActivate: '激活所选游戏',
            libraryActivateGame: '激活此游戏',
            hbPrice: 'HB：{price}',
            showUnowned: '显示未拥有',
            showAll: '显示全部',
            togglePriceScope: '在所有游戏和 Steam 未拥有游戏之间切换',
            loginFilterOwned: '登录 Steam 后可过滤已拥有游戏',
            allItems: '全部项目',
            unownedItems: '未拥有项目',
            showingPriceScope: '当前显示：{scope}',
            priceTotalsTitle: 'Steam 价格汇总（{priceRegion}）',
            currentPrice: '当前价格',
            originalPrice: '原价',
            historicalLow: '史低价格',
            matchedItems: '已识别 {matched}/{selected} 个 Steam 项目（{scope}）',
            allSteamItemsOwned: '🎉 已全部拥有 🎉',
            otherRedemption: '其他兑换平台',
            otherPlatformItems: '其他平台项目（{count}）',
            miscellaneousItem: '杂项',
            subscriptionItem: '订阅',
            couponItem: '优惠券',
            drmFreeItem: '无 DRM 下载',
            pricedItems: '{matched} 个已识别项目中有 {priced} 个包含价格历史',
            choiceActivate: '激活',
            choiceSelectUnowned: '选择未拥有',
            choiceSelect: '选择',
            choiceSelectDone: '完成选择',
            choiceClearSelection: '清空选择',
            choiceSelectedCount: '已选择 {count} 个',
            choiceNoSelection: '请先至少选择一个 Humble Choice 游戏',
            choiceActivationBusy: '另一个 Humble Choice 激活批次正在处理中。',
            activationBusy: '另一个 Humble key 激活批次正在处理中。',
            downloadNoSelection: '请先在此订单中至少选择一个符合条件的 Steam key。',
            downloadWebCryptoUnavailable: '此浏览器不支持 Web Crypto SHA-256，已禁用激活功能。',
            downloadOrderInvalid: 'Humble 返回的订单数据无效。',
            downloadOrderLoadFailed: '无法加载此 Humble 订单。',
            downloadMappingMismatch: '无法安全匹配此 key 条目，已禁用该重复组的激活功能。',
            downloadMappingSummaryMismatch: '一个或多个订单 key 没有匹配的页面条目，已禁用这些 key 的激活功能。',
            downloadRevealStarting: '正在准备此订单中选中的 {count} 个 key，以便在 Steam 激活...',
            downloadRevealProgress: '正在从此订单获取 {title} 的 Steam key（{current}/{total}）...',
            downloadRevealFailed: '无法从此订单获取 {title} 的 Steam key。',
            downloadHumbleFailureReason: 'Humble 未能为此订单条目提供有效的 Steam key。',
            downloadLoginSteam: '登录 Steam 后返回此下载页面，即可激活所选 key。',
            choiceWebLocksUnavailable: '此浏览器不支持 Web Locks API，已停止激活。请更新或更换浏览器后重试。',
            choiceRevealStarting: '正在准备 {count} 个已选游戏的 key，以便在此 Humble 页面激活...',
            choiceRevealProgress: '正在此页面显示 {title} 的 key（{current}/{total}）...',
            choiceRevealFailed: '无法显示 {title} 的 Steam key',
            choiceModalCloseFailed: '无法安全关闭 {title} 的 Humble 详情弹窗，因此未将此 key 加入队列。',
            choiceHumbleFailureReason: 'Humble 未能为此游戏提供 Steam key。',
            choiceActivationSummary: '共处理 {total} 个：已激活 {activated} 个，Humble key 获取失败 {humbleFailed} 个，Steam 激活失败 {steamFailed} 个，等待处理 {pending} 个。',
            choiceHumbleFailureGroup: 'Humble key 获取失败',
            choiceSteamFailureGroup: 'Steam 激活失败',
            choiceFailureRow: '游戏：{title} — 原因：{reason}',
            choiceCopyFailedKey: '复制 {title} 激活失败的 Steam key',
            choiceCopiedFailedKey: '已复制 {title} 的 Steam key。',
            choiceOwnershipRefreshWarning: '警告：激活完成后无法刷新 Steam 拥有状态。',
            choiceOwnershipRefreshUnsupportedWarning: '警告：此浏览器不支持 Web Locks API，无法刷新 Steam 拥有状态。激活控件已解锁。',
            steamActivationProgress: '正在从此 Humble 页面激活 {title}（{current}/{total}）...',
            steamActivationAlreadyOwned: '此 Steam 账号已拥有该产品。',
            steamActivationRegionRestricted: '该产品无法在此 Steam 账号所在地区激活。',
            steamActivationInvalidKey: 'Steam 判定此产品 key 无效。',
            steamActivationAlreadyUsed: '此产品 key 已在其他 Steam 账号上激活。',
            steamActivationBaseGameRequired: '此 Steam 账号尚未拥有所需的基础游戏。',
            steamActivationRateLimited: '已达到 Steam 激活或请求频率限制，本次请求被拒绝。',
            steamActivationUnknownCode: 'Steam 激活失败（结果代码 {code}）。',
            steamActivationRequestFailed: 'Steam 激活请求失败：{message}',
            steamActivationInterruptedUncertain: 'Steam 激活请求开始后被中断，结果不确定；再次尝试此 key 前请先在 Steam 中确认。',
            steamActivationCancelledNotSubmitted: '此 key 在提交到 Steam 前已取消激活，不会自动重试。',
            noRegionRestrictions: '无区域限制',
            exclusiveCountries: '仅限国家/地区：{countries}',
            disallowedCountries: '禁止激活国家/地区：{countries}',
            regionUnmarked: 'Humble 未声明此 key 存在区域限制。',
            regionAllowed: 'Humble 元数据表明此 key 可在你的 Steam 地区（{country}）激活。',
            regionRestricted: 'Humble 元数据表明此 key 在你的 Steam 地区（{country}）受限。',
            regionCountryUnavailable: 'Humble 激活元数据可用，但无法获取你的 Steam 地区。',
            regionExclusiveCountries: 'Humble 允许列表：{countries}',
            regionDisallowedCountries: 'Humble 禁止列表：{countries}',
            regionCountryList: '显示 Humble 元数据中的 {count} 个国家/地区代码',
            regionKeyLabel: 'Key {current}/{total}',
        },
    };

    function getBrowserLanguage() {
        const languages = Array.isArray(navigator.languages) && navigator.languages.length
            ? navigator.languages
            : [navigator.language];
        return languages.some(language => String(language || '').toLowerCase().startsWith('zh'))
            ? 'zh-CN'
            : 'en';
    }

    function getLanguageSetting() {
        const savedLanguage = GM_getValue(languageValueKey, 'auto');
        return languageSettings.includes(savedLanguage) ? savedLanguage : 'auto';
    }

    function getCurrentLanguage() {
        const languageSetting = getLanguageSetting();
        return languageSetting === 'auto' ? getBrowserLanguage() : languageSetting;
    }

    const currentLanguage = getCurrentLanguage();

    function t(key, values = {}) {
        const message = messages[currentLanguage]?.[key] ?? messages.en[key] ?? key;
        const template = typeof message === 'function' ? message(values) : message;
        return String(template).replace(/\{(\w+)\}/g, (match, name) =>
            Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
        );
    }

    function saveSettingsDialog(event) {
        event.preventDefault();
        const languageSelect = document.getElementById('hb-helper-settings-language');
        const languageSetting = languageSettings.includes(languageSelect?.value)
            ? languageSelect.value
            : 'auto';
        GM_setValue(languageValueKey, languageSetting);
        location.reload();
    }

    function createSettingsDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'hb-helper-settings-dialog';
        dialog.setAttribute('aria-labelledby', 'hb-helper-settings-title');

        const form = document.createElement('form');
        form.addEventListener('submit', saveSettingsDialog);

        const title = document.createElement('h2');
        title.id = 'hb-helper-settings-title';
        title.textContent = t('settingsTitle');

        const row = document.createElement('div');
        row.className = 'hb-helper-settings-row';

        const label = document.createElement('label');
        label.htmlFor = 'hb-helper-settings-language';
        label.textContent = t('languageLabel');

        const languageSelect = document.createElement('select');
        languageSelect.id = 'hb-helper-settings-language';
        [
            ['auto', t('languageAuto')],
            ['en', t('languageEnglish')],
            ['zh-CN', t('languageChinese')],
        ].forEach(([value, labelText]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = labelText;
            languageSelect.appendChild(option);
        });

        row.append(label, languageSelect);

        const actions = document.createElement('div');
        actions.className = 'hb-helper-settings-actions';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = t('cancel');
        cancelButton.addEventListener('click', () => dialog.close());

        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.textContent = t('save');

        actions.append(cancelButton, saveButton);
        form.append(title, row, actions);
        dialog.appendChild(form);
        (document.body || document.documentElement).appendChild(dialog);
        return dialog;
    }

    function openSettingsDialog() {
        const dialog = document.getElementById('hb-helper-settings-dialog')
            || createSettingsDialog();
        const languageSelect = dialog.querySelector('#hb-helper-settings-language');
        if (languageSelect) languageSelect.value = getLanguageSetting();
        if (!dialog.open && typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }

    function registerSettingsMenuCommand() {
        GM_registerMenuCommand(t('settingsMenu'), openSettingsDialog);
    }

    registerSettingsMenuCommand();

    function normalizeSteamTitle(value) {
        return String(value)
            .replace(/[™®©℠]/g, '')
            .replace(/&/g, 'and')
            .normalize('NFKD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, '');
    }

    const communityAppSearchCache = new Map();
    const storeAppSearchCache = new Map();
    const steamAppMatchCache = new Map();
    const librarySteamSearchConcurrency = 3;
    let librarySteamSearchActive = 0;
    const librarySteamSearchQueue = [];
    const priceHistoryCache = new Map();
    const exchangeRateCache = new Map();
    const choiceSelectionCacheKey = 'hb-helper-choice-selected-games-v1';
    const downloadSelectionCacheKeyPrefix = 'hb-helper-download-selected-games-v1:';
    const landingSortModeStorageKey = 'hb-helper-landing-sort-mode';
    const steamActivationBatchKey = 'hb-helper-steam-activation-batch-v2';
    const choiceActivationItemIdPrefix = 'hb-helper-key-v1:';
    const legacySteamActivationQueueKey = 'hb-helper-steam-activation-queue-v1';
    const choiceActivationBatchStates = Object.freeze({
        collecting: 'collecting',
        activating: 'activating',
        complete: 'complete',
    });
    const choiceActivationItemStates = Object.freeze({
        humbleFailed: 'humble-key-retrieval-failed',
        pending: 'pending-steam-activation',
        activating: 'activating',
        activated: 'activated',
        steamFailed: 'steam-activation-failed',
    });
    const choiceActivationOwnershipStates = Object.freeze({
        waiting: 'waiting',
        pending: 'pending',
        refreshing: 'refreshing',
        complete: 'complete',
        failed: 'failed',
    });
    const choiceActivationBatchVersion = 2;
    const choiceActivationRunnerLeaseMs = 120000;
    const choiceOwnershipRefreshLeaseMs = 60000;
    const choiceCollectionLockName = 'hb-helper-choice-collection';
    const steamActivationLockName = 'hb-helper-choice-steam-activation';
    const choiceOwnershipRefreshLockName = 'hb-helper-choice-ownership-refresh';
    const choiceSelectionLockName = 'hb-helper-choice-selection';
    const choiceLockRetryMs = 250;
    const downloadRevealReloadRetryMaxMs = 8000;
    const gmRequestTimeoutMs = 20000;
    const choiceRuntimeOwnerId = typeof crypto !== 'undefined'
        && crypto
        && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const steamRequestOptions = {
        cookiePartition: {topLevelSite: 'https://store.steampowered.com'},
    };
    let humbleAccountCurrencyPromise;
    let steamSessionSynchronizer;
    let steamSessionSyncTrigger;
    let steamSessionState = {status: 'syncing', account: null, error: null};
    let steamSessionTriggersObserved = false;
    let pageChangesObserved = false;
    let landingSortPageChangesObserved = false;
    let helperRouteLifecycleInstalled = false;
    let helperRouteFingerprint;
    let helperRouteTransitionGeneration = 0;
    let helperRouteTransitionPromise = Promise.resolve();
    let helperRouteDependencies = {};
    let pageRefreshTimer;
    let pageRefreshPromise = Promise.resolve();
    let pageRefreshDownloadOrderReloadIntent;
    let choiceRegionRefreshTimer;
    let choiceCollectionRecoveryTimer;
    let choiceActivationRecoveryTimer;
    let choiceOwnershipRefreshTimer;
    let landingSortRefreshTimer;
    let priceTotalsRunId = 0;
    let lastPriceInputKey = '';
    let lastPriceResult;
    let priceScope = 'all';
    let landingPageDataCache;
    let landingPageDataSourcePromise;
    const landingSortModeBySection = new Map();
    let ownedApps;
    let wishlistApps;
    let choiceSelectionMode = false;
    let choiceActivationInProgress = false;
    let choiceActivationContext;
    let choiceActivationBatchListener;
    let choiceSelectionListener;
    let downloadOrderCache;
    let downloadOrderScope;
    let downloadOrderData;
    let downloadOrderMapping;
    let downloadOrderRouteKey;
    let downloadOrderInitializationGeneration = 0;
    let downloadOrderLoadError = false;
    let downloadOrderReloadPending = false;
    let queuedDownloadOrderReloadIntent;
    let downloadOrderReloadMutationGeneration = 0;
    let downloadOrderReloadConsumedMutationGeneration = 0;
    const observedUnknownDownloadSteamKeys = new Set();
    let downloadOrderInitialLoadContext;
    let downloadRegionDisclosureState;
    let downloadSelectionMode = false;
    let downloadActivationInProgress = false;
    let downloadActivationContext;
    let pendingDownloadRevealReload;
    let downloadRevealReloadCompletionPromise = Promise.resolve();
    const downloadSelectionListeners = new Map();
    const selectedDownloadItemIds = new Set();
    const downloadRowInteractionState = new WeakMap();
    const downloadMappingAriaState = new WeakMap();
    const cachedChoiceSelection = GM_getValue(choiceSelectionCacheKey, []);
    const selectedChoiceGameIds = new Set(
        Array.isArray(cachedChoiceSelection) ? cachedChoiceSelection : []
    );
    GM_deleteValue(legacySteamActivationQueueKey);
    const landingSortModes = [
        {
            key: 'default',
            labelKey: 'landingDefaultLabel',
            titleKey: 'landingDefaultTitle',
        },
        {
            key: 'ending',
            labelKey: 'landingEndingLabel',
            titleKey: 'landingEndingTitle',
        },
        {
            key: 'newest',
            labelKey: 'landingNewestLabel',
            titleKey: 'landingNewestTitle',
        },
    ];
    const landingSortSectionConfigs = [
        {
            sectionKey: 'games',
            heading: 'Games',
            dataKey: 'games',
            mosaicSelector: '.js-games-mosaic',
            pathPrefix: '/games/',
            stamp: 'games',
        },
        {
            sectionKey: 'books',
            heading: 'Books',
            dataKey: 'books',
            mosaicSelector: '.js-books-mosaic',
            pathPrefix: '/books/',
            stamp: 'books',
        },
        {
            sectionKey: 'software',
            heading: 'Software',
            dataKey: 'software',
            mosaicSelector: '.js-software-mosaic',
            pathPrefix: '/software/',
            stamp: 'software',
        },
    ];

    function isLandingSortMode(value) {
        return ['default', 'ending', 'newest'].includes(value);
    }

    function readLandingSortMode() {
        const value = GM_getValue(landingSortModeStorageKey, 'default');
        return isLandingSortMode(value) ? value : 'default';
    }

    function initializeLandingSortModes() {
        const mode = readLandingSortMode();
        landingSortSectionConfigs.forEach(config => {
            landingSortModeBySection.set(config.sectionKey, mode);
        });
    }

    initializeLandingSortModes();

    const europeanSteamCountries = new Set([
        'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
    ]);
    const euroHumbleCountries = new Set([
        'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR',
        'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI',
        'SK',
    ]);
    const humbleCurrencyByCountryCode = new Map([
        ['US', 'USD'],
        ['CA', 'CAD'],
        ['AU', 'AUD'],
        ['NZ', 'NZD'],
        ['HK', 'HKD'],
        ['SG', 'SGD'],
        ['GB', 'GBP'],
        ['UK', 'GBP'],
        ['UA', 'UAH'],
        ['RU', 'RUB'],
        ['IN', 'INR'],
        ['BR', 'BRL'],
        ['PL', 'PLN'],
        ['KR', 'KRW'],
        ['CN', 'CNY'],
        ['JP', 'JPY'],
        ['CH', 'CHF'],
        ['EL', 'EUR'],
        ...Array.from(euroHumbleCountries, countryCode => [countryCode, 'EUR']),
    ]);
    const humbleCurrencyByLocationName = new Map([
        ['AUSTRALIA', 'AUD'],
        ['AUSTRIA', 'EUR'],
        ['BELGIUM', 'EUR'],
        ['BRAZIL', 'BRL'],
        ['BULGARIA', 'EUR'],
        ['CANADA', 'CAD'],
        ['CHINA', 'CNY'],
        ['CHINA PEOPLES REPUBLIC OF', 'CNY'],
        ['CROATIA', 'EUR'],
        ['CYPRUS', 'EUR'],
        ['ESTONIA', 'EUR'],
        ['FINLAND', 'EUR'],
        ['FRANCE', 'EUR'],
        ['GERMANY', 'EUR'],
        ['GREAT BRITAIN', 'GBP'],
        ['GREECE', 'EUR'],
        ['HONG KONG', 'HKD'],
        ['HONG KONG S A R', 'HKD'],
        ['HONG KONG SAR', 'HKD'],
        ['HONG KONG SAR CHINA', 'HKD'],
        ['INDIA', 'INR'],
        ['IRELAND', 'EUR'],
        ['ITALY', 'EUR'],
        ['JAPAN', 'JPY'],
        ['KOREA REPUBLIC OF', 'KRW'],
        ['KOREA SOUTH', 'KRW'],
        ['LATVIA', 'EUR'],
        ['LITHUANIA', 'EUR'],
        ['LUXEMBOURG', 'EUR'],
        ['MALTA', 'EUR'],
        ['NETHERLANDS', 'EUR'],
        ['NEW ZEALAND', 'NZD'],
        ['PEOPLES REPUBLIC OF CHINA', 'CNY'],
        ['POLAND', 'PLN'],
        ['PORTUGAL', 'EUR'],
        ['REPUBLIC OF KOREA', 'KRW'],
        ['RUSSIA', 'RUB'],
        ['RUSSIAN FEDERATION', 'RUB'],
        ['SINGAPORE', 'SGD'],
        ['SLOVAKIA', 'EUR'],
        ['SLOVENIA', 'EUR'],
        ['SOUTH KOREA', 'KRW'],
        ['SPAIN', 'EUR'],
        ['SWITZERLAND', 'CHF'],
        ['THE NETHERLANDS', 'EUR'],
        ['UKRAINE', 'UAH'],
        ['UK', 'GBP'],
        ['USA', 'USD'],
        ['U S', 'USD'],
        ['U S A', 'USD'],
        ['UNITED KINGDOM', 'GBP'],
        ['UNITED STATES', 'USD'],
        ['UNITED STATES OF AMERICA', 'USD'],
    ]);
    const choiceMonthPattern = new RegExp(
        '^(January|February|March|April|May|June|July|August|September|October|November|December)'
        + '\\s+\\d{4}\\s+GAMES$',
        'i'
    );

    function searchSteamCommunity(keyword, timeout) {
        if (communityAppSearchCache.has(keyword)) {
            return communityAppSearchCache.get(keyword);
        }

        const request = new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://steamcommunity.com/actions/SearchApps/' + encodeURIComponent(keyword),
                responseType: 'json',
                ...(timeout ? {timeout, ontimeout: () => resolve([])} : {}),
                onload: ({status, response}) => {
                    if (status === 200 && Array.isArray(response)) resolve(response);
                    else resolve([]);
                },
                onerror: () => resolve([])
            });
        });
        communityAppSearchCache.set(keyword, request);
        return request;
    }

    function searchSteamStore(keyword, timeout) {
        if (storeAppSearchCache.has(keyword)) return storeAppSearchCache.get(keyword);

        const params = new URLSearchParams({
            term: keyword,
            f: 'games',
            cc: 'US',
            l: 'english',
            use_store_query: '1',
            use_search_spellcheck: '1',
        });
        const request = new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://store.steampowered.com/search/suggest?${params}`,
                responseType: 'text',
                ...(timeout ? {timeout, ontimeout: () => resolve([])} : {}),
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        resolve([]);
                        return;
                    }
                    const html = responseText || response || '';
                    const searchPage = new DOMParser().parseFromString(html, 'text/html');
                    const results = Array.from(
                        searchPage.querySelectorAll('.match[data-ds-appid]')
                    ).map(element => ({
                        appid: Number(element.getAttribute('data-ds-appid')),
                        name: element.querySelector('.match_name')?.textContent.trim() || '',
                    })).filter(app => app.appid && app.name);
                    resolve(results);
                },
                onerror: () => resolve([]),
            });
        });
        storeAppSearchCache.set(keyword, request);
        return request;
    }

    function findExactSteamApp(title, results) {
        const normalizedTitle = normalizeSteamTitle(title);
        const matches = new Map();
        for (const app of results) {
            const appId = Number(app.appid);
            if (appId && normalizeSteamTitle(app.name) === normalizedTitle) {
                matches.set(appId, {appid: appId, name: app.name});
            }
        }
        return matches.size === 1 ? matches.values().next().value : null;
    }

    function findSteamApp(title) {
        const cacheKey = normalizeSteamTitle(title);
        if (steamAppMatchCache.has(cacheKey)) return steamAppMatchCache.get(cacheKey);

        const librarySearch = getLibraryView().kind !== 'unsupported';
        const request = (async () => {
            if (librarySearch) {
                if (librarySteamSearchActive >= librarySteamSearchConcurrency) {
                    await new Promise(resolve => librarySteamSearchQueue.push(resolve));
                } else {
                    librarySteamSearchActive += 1;
                }
            }
            try {
                const timeout = librarySearch ? gmRequestTimeoutMs : undefined;
                const storeMatch = findExactSteamApp(title, await searchSteamStore(title, timeout));
                if (storeMatch) return storeMatch;
                return findExactSteamApp(title, await searchSteamCommunity(title, timeout));
            } finally {
                if (librarySearch) {
                    const next = librarySteamSearchQueue.shift();
                    // Transfer the occupied slot directly to the next queued lookup.
                    if (next) next();
                    else librarySteamSearchActive -= 1;
                }
            }
        })();
        request.then(() => schedulePageRefresh(), () => schedulePageRefresh());
        steamAppMatchCache.set(cacheKey, request);
        return request;
    }

    function getSteamStoreUrl(appId) {
        return `https://store.steampowered.com/app/${appId}/`;
    }

    async function refreshSteamSession({request = gmRequest, isCurrent = () => true} = {}) {
        if (!isCurrent()) return false;
        const storeUrl = 'https://store.steampowered.com/';
        const postOptions = {
            ...steamRequestOptions,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Origin: 'https://store.steampowered.com',
                Referer: storeUrl,
            },
        };
        const response = await request(
            'https://login.steampowered.com/jwt/ajaxrefresh',
            'json',
            {...postOptions, data: new URLSearchParams({redir: storeUrl}).toString()}
        );
        if (!isCurrent()) return false;
        // EResult.NotLoggedOn; other refusals can be transient service failures.
        if ((response?.success === false || response?.success === 0) && response.error === 21) return false;
        if ((response?.success !== true && response?.success !== 1)
            || !['steamID', 'nonce', 'auth'].every(key => isNonEmptyString(response[key]))) {
            throw new Error(t('steamInvalidAccountData'));
        }
        let exchangeUrl;
        try {
            exchangeUrl = new URL(response.login_url);
        } catch (_) {
            throw new Error(t('steamInvalidAccountData'));
        }
        if (exchangeUrl.origin !== 'https://store.steampowered.com'
            || exchangeUrl.pathname.replace(/\/$/, '') !== '/login/settoken'
            || exchangeUrl.username || exchangeUrl.password || exchangeUrl.search || exchangeUrl.hash) {
            throw new Error(t('steamInvalidAccountData'));
        }
        const result = await request(exchangeUrl.href, 'json', {
            ...postOptions,
            data: new URLSearchParams({
                steamID: response.steamID,
                nonce: response.nonce,
                auth: response.auth,
                redir: storeUrl,
            }).toString(),
        });
        if (!isCurrent()) return false;
        if (result?.result === 21) return false;
        if (result?.result !== 1 || !isNonEmptyString(result.token)) {
            throw new Error(t('steamInvalidAccountData'));
        }
        return true;
    }

    function isSteamAccountData(data) {
        return Boolean(data
            && /^[A-Z]{2}$/.test(data.countryCode)
            && Array.isArray(data.ownedApps)
            && Array.isArray(data.wishlistApps)
            && isNonEmptyString(data.sessionId));
    }

    function parseSteamSession(html) {
        const steamPage = new DOMParser().parseFromString(html, 'text/html');
        const userInfoText = steamPage.querySelector('#application_config')
            ?.getAttribute('data-userinfo');
        const userInfo = JSON.parse(userInfoText || '{}');
        const sessionId = String(html).match(
            /\bg_sessionID\s*=\s*["']([^"']+)["']/
        )?.[1] || '';
        const session = {
            loggedIn: typeof userInfo.logged_in === 'boolean' ? userInfo.logged_in : null,
            countryCode: typeof userInfo.country_code === 'string'
                ? userInfo.country_code.toUpperCase()
                : '',
            sessionId,
        };
        if (session.loggedIn === true) {
            const inlineScripts = Array.from(steamPage.querySelectorAll?.('script:not([src])') || [])
                .filter(script => !script.type || /^(?:text|application)\/javascript$/i.test(script.type))
                .map(script => script.textContent.replace(
                    /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
                    match => ' '.repeat(match.length)
                ));
            const sessionScripts = inlineScripts.filter(script => /\bvar\s+g_sessionID\s*=/.test(script));
            // Steam's observed inline bootstrap starts with g_AccountID. Keep unrelated
            // script records and nested declarations outside this identity contract.
            const accountIds = (sessionScripts.length ? sessionScripts : inlineScripts)
                .filter(script => /^\s*var\s+g_AccountID\s*=/.test(script))
                .flatMap(script => Array.from(script.matchAll(/\bvar\s+g_AccountID\s*=\s*([^;]*);/g),
                    match => match[1].trim()));
            if (accountIds.length && accountIds.every(accountId => /^[1-9]\d*$/.test(accountId)
                && Number(accountId) <= 0xFFFFFFFF && accountId === accountIds[0])) {
                session.steamAccountId = accountIds[0];
            }
        }
        return session;
    }

    function createSteamSessionSynchronizer({
        request = gmRequest,
        parseSession = parseSteamSession,
        refreshSession = refreshSteamSession,
        onStateChange = () => {},
        onClearDerivedState = () => {},
    } = {}) {
        let state = {status: 'syncing', account: null, error: null};
        let generation = 0;
        let pendingSync;
        let pendingRefresh;

        const hasAuthenticatedSession = session => session.loggedIn === true
            && /^[A-Z]{2}$/.test(session.countryCode)
            && isNonEmptyString(session.sessionId);
        const readSession = async () => parseSession(await request(
            `https://store.steampowered.com/?l=english&_=${Date.now()}`,
            'text',
            {...steamRequestOptions, headers: {'Cache-Control': 'no-cache'}}
        ));

        const updateState = nextState => {
            state = nextState;
            onStateChange(state);
            if (state.status === 'logged-out' || state.status === 'error') {
                onClearDerivedState(state);
            }
            return state;
        };
        const sync = ({force = false} = {}) => {
            if (!force && pendingSync) return pendingSync;
            const requestGeneration = ++generation;
            const retainedAccount = isSteamAccountData(state.account) ? state.account : null;
            const retainedError = state.status === 'error' ? state.error : null;
            updateState({status: 'syncing', account: retainedAccount, error: retainedError});
            const task = (async () => {
                try {
                    // A dispatched token exchange can still update cookies after its generation expires.
                    if (pendingRefresh) await pendingRefresh.catch(() => {});
                    if (requestGeneration !== generation) return state;
                    let session = await readSession();
                    if (requestGeneration !== generation) return state;
                    if (!hasAuthenticatedSession(session)) {
                        updateState({
                            status: 'syncing', account: retainedAccount, error: retainedError,
                            phase: 'refreshing',
                        });
                        let refreshed = false;
                        let refreshError;
                        let refreshWork;
                        try {
                            refreshWork = Promise.resolve().then(() => refreshSession({
                                request,
                                isCurrent: () => requestGeneration === generation,
                            }));
                            pendingRefresh = refreshWork;
                            refreshed = await refreshWork;
                        } catch (error) {
                            refreshError = error;
                        } finally {
                            if (pendingRefresh === refreshWork) pendingRefresh = undefined;
                        }
                        if (requestGeneration !== generation) return state;
                        session = await readSession();
                        if (requestGeneration !== generation) return state;
                        if (session.loggedIn === false && refreshed === false && !refreshError) {
                            return updateState({status: 'logged-out', account: null, error: null});
                        }
                        if (!hasAuthenticatedSession(session)) {
                            throw refreshError || new Error(t('steamInvalidAccountData'));
                        }
                    }
                    const userData = await request(
                        `https://store.steampowered.com/dynamicstore/userdata/?_=${Date.now()}`,
                        'json',
                        {...steamRequestOptions, headers: {'Cache-Control': 'no-cache'}}
                    );
                    if (requestGeneration !== generation) return state;
                    if (!Array.isArray(userData?.rgOwnedApps)
                        || !Array.isArray(userData?.rgWishlist)) {
                        throw new Error(t('steamInvalidAccountData'));
                    }
                    return updateState({
                        status: 'authenticated',
                        account: {
                            countryCode: session.countryCode,
                            ownedApps: userData.rgOwnedApps,
                            wishlistApps: userData.rgWishlist,
                            sessionId: session.sessionId,
                            ...(session.steamAccountId ? {steamAccountId: session.steamAccountId} : {}),
                        },
                        error: null,
                    });
                } catch (error) {
                    if (requestGeneration !== generation) return state;
                    return updateState({status: 'error', account: null, error});
                }
            })();
            let requestPromise;
            requestPromise = task.finally(() => {
                if (pendingSync === requestPromise) pendingSync = undefined;
            });
            pendingSync = requestPromise;
            return requestPromise;
        };
        return {sync, getState: () => state};
    }

    function createSteamSessionSyncTrigger(synchronizer, schedule = callback => setTimeout(callback, 0)) {
        let pendingTrigger;
        return () => {
            if (pendingTrigger) return pendingTrigger;
            pendingTrigger = new Promise((resolve, reject) => {
                schedule(() => {
                    Promise.resolve(synchronizer.sync())
                        .then(resolve, reject)
                        .finally(() => { pendingTrigger = undefined; });
                });
            });
            return pendingTrigger;
        };
    }

    function hasSteamAccountData() {
        return isSteamAccountData(steamSessionState.account)
            && ['authenticated', 'syncing'].includes(steamSessionState.status);
    }

    function isChoiceActivationUiAvailable() {
        return steamSessionState.status === 'authenticated'
            && isSteamAccountData(steamSessionState.account);
    }

    function applySteamSessionState(nextState) {
        steamSessionState = nextState;
        renderChoiceSelectionState();
        renderDownloadSelectionState();
        if (hasSteamAccountData()) {
            ownedApps = new Set(nextState.account.ownedApps);
            wishlistApps = new Set(nextState.account.wishlistApps);
            reconcileVisibleGameClasses(ownedApps, wishlistApps).catch(error => {
                console.warn('[HB-Helper] Reconcile Steam ownership classes failed:', error);
            });
        }
        if (isChoiceActivationUiAvailable()) {
            satisfyDeferredChoiceOwnershipRefresh().catch(error => {
                console.warn('[HB-Helper] Complete deferred ownership refresh failed:', error);
            });
        }
        refreshHelperPage(nextState.status === 'authenticated', {skipDownloadRemap: true});
    }

    function clearSteamAccountDerivedState() {
        ownedApps = undefined;
        wishlistApps = undefined;
        priceScope = 'all';
        lastPriceResult = undefined;
        priceTotalsRunId++;
        choiceSelectionMode = false;
        document.documentElement.classList.remove('hb-helper-choice-select-mode');
        renderChoiceSelectionTiles(getVisibleChoiceTiles(), new Set());
        downloadSelectionMode = false;
        document.documentElement.classList.remove('hb-helper-download-select-mode');
        for (const pair of downloadOrderMapping?.pairs || []) {
            setDownloadRowSelectionInteraction(pair.row, false);
        }
        renderDownloadSelectionState();
        return reconcileVisibleGameClasses(new Set(), new Set()).catch(error => {
            console.warn('[HB-Helper] Clear Steam ownership classes failed:', error);
        });
    }

    function getSteamSessionSynchronizer() {
        if (!steamSessionSynchronizer) {
            steamSessionSynchronizer = createSteamSessionSynchronizer({
                onStateChange: applySteamSessionState,
                onClearDerivedState: clearSteamAccountDerivedState,
            });
        }
        return steamSessionSynchronizer;
    }

    function syncSteamSession(options = {}) {
        return getSteamSessionSynchronizer().sync(options);
    }

    function getLiveSteamAccount() {
        if (!hasSteamAccountData()) throw new Error(t('loginSteamLoadAccountData'));
        return steamSessionState.account;
    }

    function fetchSteamAccountData(options = {}) {
        return syncSteamSession(options).then(state => {
            if (state.status === 'authenticated' && isSteamAccountData(state.account)) {
                return state.account;
            }
            throw state.error || new Error(t('loginSteamLoadAccountData'));
        });
    }

    async function loadSteamAccountSets(options = {}) {
        const account = await fetchSteamAccountData(options);
        return {ownedApps: new Set(account.ownedApps), wishlistApps: new Set(account.wishlistApps)};
    }

    function getLoadedSteamAccountSets() {
        return {ownedApps, wishlistApps};
    }

    function getBundleTitle() {
        const meta = document.querySelector('meta[property="og:title"]');
        if (meta && meta.content) return meta.content.trim();
        const logo = document.querySelector('.bundle-logo');
        if (logo && logo.getAttribute('alt')) return logo.getAttribute('alt').trim();
        return document.title.trim();
    }

    function getCurrentPath() {
        return location.pathname.replace(/\/$/, '') || '/';
    }

    function isLandingSortPage() {
        return ['/bundles', '/games', '/books', '/software'].includes(getCurrentPath());
    }

    function getActiveLandingSortConfigs() {
        const path = getCurrentPath();
        if (path === '/bundles') return landingSortSectionConfigs;
        const dataKey = path.slice(1);
        return landingSortSectionConfigs.filter(config => config.dataKey === dataKey);
    }

    function isGamesBundlePage() {
        return location.pathname.startsWith('/games/') && getCurrentPath() !== '/games';
    }

    function isChoicePathname(pathname) {
        return pathname === '/membership'
            || pathname === '/membership/'
            || pathname === '/membership/home'
            || pathname.startsWith('/membership/home/');
    }

    function isChoicePage() {
        return isChoicePathname(location.pathname);
    }

    function getDownloadsOrderKey() {
        if (location.pathname !== '/downloads') return null;
        const orderKey = new URLSearchParams(location.search || '').get('key');
        return isNonEmptyString(orderKey) ? orderKey : null;
    }

    function isDownloadsPage() {
        return getDownloadsOrderKey() !== null;
    }

    // Read-only view descriptors; route UUIDs are not entitlement or key-slot identities.
    function getLibraryView() {
        const unsupported = {kind: 'unsupported', routeId: null, heading: null, form: null, featuredRegion: null};
        const route = location.pathname.match(/^\/home\/library(?:\/(content\/)?([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}))?\/?$/i);
        const main = document.querySelector('main, [role="main"]');
        if (!route || !main) return unsupported;
        if (route[2]) {
            const heading = Array.from(main.querySelectorAll('h1')).find(node => !node.closest('aside, nav')) || null;
            return {kind: route[1] ? 'content' : 'bundle', routeId: route[2], heading, form: null, featuredRegion: null};
        }
        const tablist = Array.from(main.querySelectorAll('[role="tablist"]')).find(node =>
            !node.closest('aside, nav') && node.nextElementSibling?.tagName === 'FORM'
        );
        const selected = tablist?.querySelectorAll('[role="tab"][aria-selected="true"]');
        if (selected?.length !== 1) return unsupported;
        const label = normalizedText(selected[0]);
        if (!['Purchased', 'Bundles', 'Vault'].includes(label)) return unsupported;
        const kind = label.toLowerCase();
        const heading = Array.from(main.querySelectorAll('h2')).find(node =>
            !node.closest('aside, nav') && ['您的游戏库', 'Your Library'].includes(normalizedText(node))
        ) || null;
        const featuredRegion = heading ? Array.from(main.querySelectorAll('[role="region"][aria-label]')).find(node =>
            node.getAttribute('aria-label') === normalizedText(heading) && !node.closest('aside, nav')
        ) || null : null;
        return {kind, routeId: null, heading, form: tablist.nextElementSibling, featuredRegion};
    }

    function getLibraryDomEntries() {
        const view = getLibraryView();
        if (!['purchased', 'bundle', 'content'].includes(view.kind)) return [];
        const entries = [];
        if (view.kind === 'purchased' && view.featuredRegion) {
            for (const card of view.featuredRegion.querySelectorAll('[role="group"] > button > [data-testid="product-card"]')) {
                const footer = card.querySelector('[data-testid="product-card-footer"]');
                const titleElement = footer?.firstElementChild?.firstElementChild?.firstElementChild
                    || footer?.querySelector('.line-clamp-1');
                const title = titleElement ? normalizedText(titleElement) : '';
                const actionHost = card.closest('[role="group"]');
                if (title && card.querySelector('img')
                    && actionHost && !actionHost.closest('a, button')) {
                    entries.push({element: card, titleElement, title, platformLabels: [], actionHost});
                }
            }
        }
        const root = view.kind === 'purchased' ? view.form : document.querySelector('main, [role="main"]');
        if (!root || (view.kind !== 'purchased' && !view.heading)) return entries;
        for (const element of root.querySelectorAll('div.flex.flex-col.border-0')) {
            if (element.closest('aside, nav') || (view.form && element.closest('form') !== view.form)) continue;
            const header = element.firstElementChild;
            if (!header || !header.nextElementSibling?.matches('div.overflow-hidden')) continue;
            let routeContentId;
            if (view.kind === 'purchased') {
                const link = header.tagName === 'A' && header.getAttribute('href')?.match(/^\/home\/library\/content\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i);
                if (!link) continue;
                routeContentId = link[1];
            } else {
                if (!header.matches('div.flex.flex-wrap.items-center.justify-between')
                    || header.querySelectorAll(':scope > div:last-child > button').length !== 2) continue;
            }
            const titleColumn = header.querySelector('div.flex.flex-1.flex-col.justify-center');
            const titleElement = titleColumn?.firstElementChild;
            const title = titleElement ? normalizedText(titleElement) : '';
            if (!title || titleElement.tagName !== 'DIV') continue;
            const platformLabels = [...new Set(Array.from(titleColumn.parentElement.children)
                .filter(node => node !== titleColumn)
                .flatMap(node => [node, ...node.querySelectorAll('[aria-label]')])
                .map(node => node.getAttribute('aria-label')?.trim()).filter(Boolean))];
            const actionHost = view.kind === 'purchased' ? element : titleColumn;
            if (actionHost.closest('a, button')) continue;
            entries.push({element, titleElement, title, platformLabels, actionHost,
                ...(routeContentId ? {routeContentId} : {})});
        }
        if (view.kind === 'content' && entries.length === 1) entries[0].routeContentId = view.routeId;
        return entries;
    }

    function getLibraryOwnData(object, key, allowArray = false) {
        if (!object || typeof object !== 'object' || (!allowArray && Array.isArray(object))) return undefined;
        const page = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
        const descriptor = (page.Object || Object).getOwnPropertyDescriptor(object, key);
        return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value !== 'function'
            ? descriptor.value : undefined;
    }

    // Follow only the committed host's actual child path, never an alternate's props.
    function getLibraryReactProps(entry) {
        try {
            const page = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
            const objectApi = page.Object || Object;
            const readData = getLibraryOwnData;
            const element = readData(entry, 'element');
            const titleElement = readData(entry, 'titleElement');
            const title = readData(entry, 'title');
            if (!element?.isConnected || !titleElement || !element.contains(titleElement)
                || typeof title !== 'string' || !normalizeSteamTitle(title)
                || normalizeSteamTitle(normalizedText(titleElement)) !== normalizeSteamTitle(title)) return [];
            const keys = objectApi.getOwnPropertyNames(element).filter(key => key.startsWith('__reactFiber$'));
            if (keys.length !== 1) return [];
            let root = readData(element, keys[0]);
            if (readData(root, 'stateNode') !== element) return [];
            const visited = new Set();
            for (let depth = 0; depth < 128; depth += 1) {
                if (!root || visited.has(root)) return [];
                visited.add(root);
                const parent = readData(root, 'return');
                if (parent === null) break;
                root = parent;
            }
            if (readData(root, 'tag') !== 3 || readData(root, 'return') !== null) return [];
            const current = readData(readData(root, 'stateNode'), 'current');
            if (readData(current, 'tag') !== 3
                || readData(readData(current, 'memoizedState'), 'isDehydrated')) return [];

            // DOM expandos may retain an alternate. Use the committed tree's actual
            // child path, since shared React children may also retain old return links.
            const pending = [{fiber: current, ancestry: []}];
            const seen = new Set();
            let ancestry;
            for (let count = 0; pending.length && count < 20000; count += 1) {
                const item = pending.pop();
                const {fiber} = item;
                if (seen.has(fiber)) return [];
                seen.add(fiber);
                if (readData(fiber, 'tag') === 5 && readData(fiber, 'stateNode') === element) {
                    ancestry = [fiber, ...item.ancestry].slice(0, 16);
                    break;
                }
                const sibling = readData(fiber, 'sibling');
                const child = readData(fiber, 'child');
                if (sibling) pending.push({fiber: sibling, ancestry: item.ancestry});
                if (child) pending.push({fiber: child, ancestry: [fiber, ...item.ancestry].slice(0, 15)});
            }
            return ancestry ? ancestry.map(fiber => readData(fiber, 'memoizedProps'))
                .filter(props => props && typeof props === 'object' && !Array.isArray(props)) : [];
        } catch (_) {
            // Unavailable page-realm expandos or descriptors leave the row unbound.
            return [];
        }
    }

    // Preserve the original identity-only reader for callers that need no key data.
    function getLibraryEntitlement(entry) {
        try {
            const title = getLibraryOwnData(entry, 'title');
            const routeContentId = getLibraryOwnData(entry, 'routeContentId');
            let result = null;
            for (const props of getLibraryReactProps(entry)) {
                const entitlement = getLibraryOwnData(props, 'entitlement');
                const id = getLibraryOwnData(entitlement, 'id');
                const entitlementTitle = getLibraryOwnData(entitlement, 'title');
                if (typeof id !== 'string' || !id.trim() || typeof entitlementTitle !== 'string'
                    || !normalizeSteamTitle(entitlementTitle)) continue;
                if (normalizeSteamTitle(entitlementTitle) !== normalizeSteamTitle(title)
                    || (routeContentId && id !== routeContentId)
                    || (result && result.id !== id)) return null;
                result = {id, title: entitlementTitle};
            }
            return result;
        } catch (_) {
            return null;
        }
    }

    function getLibraryArrayData(value) {
        if (!Array.isArray(value)) return null;
        const length = getLibraryOwnData(value, 'length', true);
        if (length > 1000) return null;
        const values = [];
        for (let index = 0; index < length; index += 1) {
            values.push(getLibraryOwnData(value, String(index), true));
        }
        return values;
    }

    function getLibraryKeySlot(entitlement) {
        const id = getLibraryOwnData(entitlement, 'id');
        const title = getLibraryOwnData(entitlement, 'title');
        if (typeof id !== 'string' || !id.trim() || typeof title !== 'string'
            || !normalizeSteamTitle(title)) return null;
        const formatted = getLibraryOwnData(getLibraryOwnData(entitlement, 'redemptionData'), 'keyFormatted');
        const slot = {id, title};
        const type = getLibraryOwnData(entitlement, 'type');
        if (typeof type === 'string') slot.type = type;
        const key = typeof formatted === 'string' ? formatted.trim().toUpperCase() : '';
        slot.keyFormatted = /^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){2,4}$/.test(key) ? key : null;
        const disclaimer = getLibraryOwnData(entitlement, 'customDisclaimer');
        if (typeof disclaimer === 'string') slot.customDisclaimer = disclaimer;
        for (const field of ['expired', 'preOrdered', 'outOfStock', 'redeemable']) {
            const value = getLibraryOwnData(entitlement, field);
            if (typeof value === 'boolean') slot[field] = value;
        }
        const giftStatus = getLibraryOwnData(entitlement, 'giftStatus');
        if (typeof giftStatus === 'string') slot.giftStatus = giftStatus;
        slot.directRedeem = getLibraryOwnData(entitlement, 'directRedeem') === null ? null : 'unsupported';
        return slot;
    }

    // Schema 3 item ids identify purchases; only each key's own id identifies its slot.
    function getLibraryRecord(entry) {
        try {
            const propsList = getLibraryReactProps(entry);
            const nativeTitle = normalizeSteamTitle(getLibraryOwnData(entry, 'title'));
            const routeContentId = getLibraryOwnData(entry, 'routeContentId');
            const matchesRow = object => {
                const id = getLibraryOwnData(object, 'id');
                const title = getLibraryOwnData(object, 'title');
                return typeof id === 'string' && id.trim() && typeof title === 'string'
                    && normalizeSteamTitle(title) === nativeTitle && (!routeContentId || id === routeContentId);
            };
            let result = null;
            const accept = record => {
                if (result && JSON.stringify(result) !== JSON.stringify(record)) return false;
                result = record;
                return true;
            };
            for (const props of propsList) {
                const item = getLibraryOwnData(props, 'item');
                if (!matchesRow(item)) continue;
                const keys = getLibraryArrayData(getLibraryOwnData(getLibraryOwnData(item, 'entitlements'), 'keys'));
                if (!keys) return null;
                const keySlots = keys.map(getLibraryKeySlot);
                if (keySlots.some(slot => !slot) || new Set(keySlots.map(slot => slot.id)).size !== keySlots.length) return null;
                const record = {id: getLibraryOwnData(item, 'id'), title: getLibraryOwnData(item, 'title')};
                const contentId = getLibraryOwnData(item, 'contentId');
                if (contentId !== undefined) {
                    if (typeof contentId !== 'string' || !contentId.trim()) return null;
                    record.contentId = contentId;
                }
                const methods = getLibraryOwnData(item, 'deliveryMethods');
                if (methods !== undefined) {
                    const deliveryMethods = getLibraryArrayData(methods);
                    if (!deliveryMethods || deliveryMethods.some(method => typeof method !== 'string')) return null;
                    record.deliveryMethods = deliveryMethods;
                }
                record.keySlots = keySlots;
                if (!accept(record)) return null;
            }
            if (result) return result;
            for (const props of propsList) {
                const entitlement = getLibraryOwnData(props, 'entitlement');
                if (!entitlement) continue;
                const slot = getLibraryKeySlot(entitlement);
                if (!slot) continue;
                if (!matchesRow(entitlement) || !accept({id: slot.id, title: slot.title, keySlots: [slot]})) return null;
            }
            return result;
        } catch (_) {
            return null;
        }
    }

    function isPriceTotalsPage() {
        return isGamesBundlePage() || isChoicePage()
            || ['bundle', 'content'].includes(getLibraryView().kind);
    }

    function getHelperPageMode() {
        if (isLandingSortPage()) return 'landing';
        if (isDownloadsPage()) return 'downloads';
        if (getLibraryView().kind !== 'unsupported') return 'library';
        if (isPriceTotalsPage()) return 'price-totals';
        return 'unsupported';
    }

    function validateDownloadOrder(order, expectedOrderKey) {
        if (!order
            || typeof order !== 'object'
            || Array.isArray(order)
            || order.gamekey !== expectedOrderKey
            || !order.tpkd_dict
            || !Array.isArray(order.tpkd_dict.all_tpks)) {
            throw new Error(t('downloadOrderInvalid'));
        }
        return order;
    }

    function invalidateDownloadOrder() {
        downloadOrderCache = undefined;
    }

    function loadDownloadOrder(
        orderKey = getDownloadsOrderKey(),
        {requestOrder = url => gmRequest(url)} = {}
    ) {
        if (!isNonEmptyString(orderKey)) {
            return Promise.reject(new Error(t('downloadOrderInvalid')));
        }
        if (downloadOrderCache?.orderKey === orderKey) return downloadOrderCache.promise;

        const cache = {orderKey, promise: null};
        const apiUrl = `${location.origin}/api/v1/order/${encodeURIComponent(orderKey)}?all_tpkds=true`;
        cache.promise = Promise.resolve()
            .then(() => requestOrder(apiUrl))
            .then(order => validateDownloadOrder(order, orderKey))
            .catch(error => {
                if (downloadOrderCache === cache) downloadOrderCache = undefined;
                throw error;
            });
        downloadOrderCache = cache;
        return cache.promise;
    }

    async function hashDownloadOrderKey(orderKey, cryptoProvider = globalThis.crypto) {
        if (!isNonEmptyString(orderKey)
            || !cryptoProvider?.subtle
            || typeof cryptoProvider.subtle.digest !== 'function'
            || typeof TextEncoder !== 'function') {
            return null;
        }
        try {
            const digest = await cryptoProvider.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(orderKey)
            );
            const bytes = new Uint8Array(digest);
            if (bytes.length !== 32) return null;
            return Array.from(bytes)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            return null;
        }
    }

    function getValidDownloadTuple(value) {
        const machineName = value?.machine_name;
        const keyindex = value?.keyindex;
        if (!isNonEmptyString(machineName)
            || machineName !== machineName.trim()
            || !Number.isInteger(keyindex)
            || keyindex < 0) {
            return null;
        }
        return {machineName, keyindex};
    }

    function getDownloadActivationItemId(scope, tpkd) {
        const tuple = getValidDownloadTuple(tpkd);
        if (!/^[0-9a-f]{64}$/.test(scope || '') || !tuple) return null;
        return `download:${scope}:${encodeURIComponent(tuple.machineName)}:${tuple.keyindex}`;
    }

    function parseDownloadActivationItemId(id) {
        const match = String(id || '').match(/^download:([0-9a-f]{64}):(.+):(\d+)$/);
        if (!match) return null;
        let machineName;
        try {
            machineName = decodeURIComponent(match[2]);
        } catch (error) {
            return null;
        }
        const keyindex = Number(match[3]);
        const parsed = {scope: match[1], machineName, keyindex};
        const normalized = getDownloadActivationItemId(parsed.scope, {
            machine_name: parsed.machineName,
            keyindex: parsed.keyindex,
        });
        return normalized === id ? parsed : null;
    }

    function isEligibleDownloadTpkd(tpkd) {
        if (!getValidDownloadTuple(tpkd) || tpkd.is_gift === true) return false;
        const keyType = String(tpkd.key_type || '').trim().toLowerCase();
        const keyTypeDescription = [keyType, tpkd.key_type_human_name]
            .join(' ')
            .toLowerCase();
        if (keyType !== 'steam'
            || /(?:direct|keyless)/.test(keyTypeDescription)
            || tpkd.is_direct === true
            || tpkd.direct === true
            || tpkd.direct_redeem === true
            || tpkd.is_keyless === true
            || tpkd.keyless === true) {
            return false;
        }

        const revealedKey = findSteamKeyInText(tpkd.redeemed_key_val);
        if (revealedKey) return true;
        if (isNonEmptyString(tpkd.redeemed_key_val)) return false;
        return !isDownloadTpkdExpired(tpkd) && tpkd.sold_out !== true;
    }

    let nextPageDataCache;
    const nextPageScriptDataCache = new WeakMap();
    const nextPageSourceLoads = new Map();

    function loadNextPageDataFromSource(
        routeFingerprint = getHelperRouteFingerprint(),
        {requestPage = url => fetch(url, {credentials: 'include'})} = {}
    ) {
        if (routeFingerprint !== getHelperRouteFingerprint()) {
            return Promise.resolve({stale: true});
        }
        const generation = helperRouteTransitionGeneration;
        const cached = nextPageSourceLoads.get(routeFingerprint);
        if (cached && (cached.document || cached.generation === generation)) {
            return cached.promise;
        }
        const requestUrl = new URL(location.href);
        requestUrl.hash = '';
        if (requestUrl.origin !== location.origin) {
            return Promise.reject(new Error('Invalid Humble page source origin.'));
        }
        const state = {generation, document: null, promise: null};
        state.promise = Promise.resolve()
            .then(() => requestPage(requestUrl.href))
            .then(async response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                if (response.url && new URL(response.url).origin !== requestUrl.origin) {
                    throw new Error('Invalid Humble page source origin.');
                }
                const html = await response.text();
                if (routeFingerprint !== getHelperRouteFingerprint()
                    || generation !== helperRouteTransitionGeneration) {
                    if (nextPageSourceLoads.get(routeFingerprint) === state) {
                        nextPageSourceLoads.delete(routeFingerprint);
                    }
                    return {stale: true};
                }
                state.document = new DOMParser().parseFromString(html, 'text/html');
                return {loaded: true};
            });
        nextPageSourceLoads.set(routeFingerprint, state);
        return state.promise;
    }

    function readNextPageRecords(source) {
        const bytes = new TextEncoder().encode(source);
        const decoder = new TextDecoder();
        const records = new Map();
        let offset = 0;
        while (offset < bytes.length) {
            const header = decoder.decode(bytes.subarray(offset, offset + 80))
                .match(/^([\da-f]*):([TAOobUSsLlGgMmV])?([\da-f]+,)?/);
            if (!header) break;
            offset += header[0].length;
            if (header[2]) {
                if (!header[3]) break;
                const end = offset + parseInt(header[3], 16);
                if (end > bytes.length) break;
                if (header[2] === 'T') {
                    records.set(header[1], decoder.decode(bytes.subarray(offset, end)));
                }
                offset = end;
                continue;
            }
            const end = bytes.indexOf(10, offset);
            if (end < 0) break;
            const text = decoder.decode(bytes.subarray(offset, end));
            if (/^[\[{"\d-]|^(?:null|true|false)$/.test(text)) {
                try {
                    records.set(header[1], JSON.parse(text));
                } catch (_) {
                    // Ignore non-JSON protocol rows; never evaluate page scripts.
                }
            }
            offset = end + 1;
        }
        return records;
    }

    function resolveNextPageValue(value, records, ancestors = new Set(), references = new Set()) {
        if (typeof value === 'string') {
            if (value.startsWith('$$')) return value.slice(1);
            const reference = value.match(/^\$([\da-f]+)(?::(.*))?$/);
            if (!reference) return value.startsWith('$') ? undefined : value;
            if (references.has(value)) return undefined;
            const nextReferences = new Set(references).add(value);
            let target = records.get(reference[1]);
            for (const property of reference[2]?.split(':') || []) {
                if (typeof target === 'string') {
                    target = resolveNextPageValue(target, records, ancestors, nextReferences);
                }
                const key = property === 'props' && Array.isArray(target) && target[0] === '$'
                    ? 3
                    : property;
                target = target && Object.prototype.hasOwnProperty.call(target, key)
                    ? target[key]
                    : undefined;
            }
            return resolveNextPageValue(target, records, ancestors, nextReferences);
        }
        if (!value || typeof value !== 'object') return value;
        if (ancestors.has(value)) return undefined;
        const nextAncestors = new Set(ancestors).add(value);
        if (Array.isArray(value)) {
            return value.map(item => resolveNextPageValue(item, records, nextAncestors, references));
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            resolveNextPageValue(item, records, nextAncestors, references),
        ]));
    }

    function getNextPageData(propertyName) {
        const sourceState = nextPageSourceLoads.get(getHelperRouteFingerprint());
        const sourceDocument = sourceState ? sourceState.document : document;
        if (!sourceDocument) return [];
        const chunks = [];
        for (const script of sourceDocument.querySelectorAll('script')) {
            const text = script.textContent;
            const cached = nextPageScriptDataCache.get(script);
            if (cached?.text === text) {
                chunks.push(...cached.chunks);
                continue;
            }
            const scriptChunks = [];
            const pattern = /self\.__next_f\.push\(\s*(\[\s*1\s*,\s*"(?:[^"\\]|\\.)*"\s*\])\s*\)/g;
            for (const match of text.matchAll(pattern)) {
                try {
                    scriptChunks.push(JSON.parse(match[1])[1]);
                } catch (_) {
                    // A script still being streamed may not contain complete JSON yet.
                }
            }
            nextPageScriptDataCache.set(script, {text, chunks: scriptChunks});
            chunks.push(...scriptChunks);
        }
        const source = chunks.join('');
        if (!source) return [];
        if (!nextPageDataCache || nextPageDataCache.source !== source) {
            nextPageDataCache = {source, records: readNextPageRecords(source), properties: new Map()};
        }
        const {records, properties} = nextPageDataCache;
        if (!properties.has(propertyName)) {
            const values = [];
            const visit = value => {
                if (!value || typeof value !== 'object') return;
                for (const [key, item] of Object.entries(value)) {
                    if (key === propertyName) {
                        const resolved = resolveNextPageValue(item, records);
                        if (resolved !== undefined) values.push(resolved);
                    }
                    visit(item);
                }
            };
            for (const record of records.values()) visit(record);
            properties.set(propertyName, values);
        }
        return properties.get(propertyName);
    }

    function normalizedText(element) {
        return element.textContent.replace(/\s+/g, ' ').trim();
    }

    function normalizeHumblePath(value) {
        try {
            return new URL(value, location.origin).pathname.replace(/\/$/, '') || '/';
        } catch (error) {
            return String(value || '').split(/[?#]/)[0].replace(/\/$/, '');
        }
    }

    function parseHumbleDateTime(value) {
        if (!value) return null;
        const dateText = String(value);
        const hasTimezone = /(?:Z|[+-]\d\d:\d\d)$/i.test(dateText);
        const time = Date.parse(hasTimezone ? dateText : `${dateText}Z`);
        return Number.isFinite(time) ? time : null;
    }

    function isDownloadTpkdExpired(tpkd, now = Date.now()) {
        if (tpkd?.is_expired === true) return true;
        const expiryTime = parseHumbleDateTime(tpkd?.expiry_date);
        return expiryTime !== null && expiryTime <= now;
    }

    function hasLandingPageProductData(pageData) {
        return landingSortSectionConfigs.some(config =>
            Array.isArray(pageData?.data?.[config.dataKey]?.mosaic)
        );
    }

    function parseLandingPageData(text, sourceLabel) {
        try {
            const pageData = JSON.parse(text || '{}');
            if (!hasLandingPageProductData(pageData)) return null;
            landingPageDataCache = pageData;
            return pageData;
        } catch (error) {
            console.warn(`[HB-Helper] Failed to parse landing data from ${sourceLabel}:`, error);
            return null;
        }
    }

    function readLandingPageDataElement() {
        const dataElement = document.getElementById('landingPage-json-data');
        return dataElement ? parseLandingPageData(dataElement.textContent, 'document') : null;
    }

    function readLandingPageDataFromHtml(html) {
        const match = String(html || '').match(
            /<script id="landingPage-json-data" type="application\/json">\s*([\s\S]*?)\s*<\/script>/
        );
        return match ? parseLandingPageData(match[1], 'source') : null;
    }

    function loadLandingPageDataFromSource() {
        if (landingPageDataSourcePromise) return landingPageDataSourcePromise;
        landingPageDataSourcePromise = fetch(location.href, {credentials: 'include'})
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(html => {
                if (readLandingPageDataFromHtml(html)) scheduleLandingSortPageRefresh();
            })
            .catch(error => {
                console.warn('[HB-Helper] Failed to load landing data source:', error);
            });
        return landingPageDataSourcePromise;
    }

    function getLandingPageData() {
        const pageData = readLandingPageDataElement() || landingPageDataCache || null;
        if (!pageData && isLandingSortPage()
            && !document.querySelector('script[src^="/_next/"]')) {
            loadLandingPageDataFromSource();
        }
        return pageData;
    }

    function observeLandingPageDataElement() {
        if (!isLandingSortPage() || readLandingPageDataElement()
            || getNextPageData('feedItems').length) return;
        const observer = new MutationObserver(() => {
            if (readLandingPageDataElement() || getNextPageData('feedItems').length) {
                observer.disconnect();
                scheduleLandingSortPageRefresh();
            }
        });
        observer.observe(document.documentElement || document, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    observeLandingPageDataElement();

    function getLandingSortProductData(config) {
        const nextProducts = new Map();
        for (const feed of getNextPageData('feedItems')) {
            if (!Array.isArray(feed)) continue;
            for (const item of feed) {
                const product = item?.value || item;
                if (product?.productType !== 'humble-bundle'
                    || product.category !== config.dataKey
                    || !String(product.url || '').startsWith(config.pathPrefix)) {
                    continue;
                }
                const productUrl = normalizeHumblePath(product.url);
                if (nextProducts.has(productUrl)) continue;
                nextProducts.set(productUrl, {
                    productUrl,
                    originalIndex: nextProducts.size,
                    startTime: parseHumbleDateTime(product.startDate),
                    endTime: parseHumbleDateTime(product.endDate),
                });
            }
        }
        if (nextProducts.size > 1) return [...nextProducts.values()];

        const sections = getLandingPageData()?.data?.[config.dataKey]?.mosaic;
        if (!Array.isArray(sections)) return null;

        const products = [];
        for (const section of sections) {
            for (const product of section.products || []) {
                if (product?.type !== 'bundle'
                    || product.tile_stamp !== config.stamp
                    || !String(product.product_url || '').startsWith(config.pathPrefix)) {
                    continue;
                }
                products.push({
                    productUrl: normalizeHumblePath(product.product_url),
                    originalIndex: products.length,
                    startTime: parseHumbleDateTime(product['start_date|datetime']),
                    endTime: parseHumbleDateTime(product['end_date|datetime']),
                });
            }
        }

        return products.length > 1 ? products : null;
    }

    function findLandingSortSection(config) {
        const legacySection = Array.from(document.querySelectorAll('.landing-mosaic-section'))
            .find(section => findLandingSortHeading(section, config)
                && section.querySelector(`.landing-page-mosaic ${config.mosaicSelector}`)) || null;
        if (legacySection) return legacySection;

        for (const heading of document.querySelectorAll('main h2')) {
            if (normalizedText(heading) !== config.heading) continue;
            for (let section = heading.parentElement; section; section = section.parentElement) {
                if (section.matches('main')) break;
                const cards = Array.from(section.querySelectorAll('[data-testid="product-card"]'));
                if (cards.length < 2) continue;
                const grid = cards[0].parentElement;
                if (grid?.classList.contains('grid')
                    && cards.every(card => card.parentElement === grid
                        && card.querySelector(`a[data-testid="product-link"][href^="${config.pathPrefix}"]`))) {
                    return section;
                }
                break;
            }
        }
        return null;
    }

    function findLandingSortHeading(section, config) {
        return Array.from(section.querySelectorAll(
            ':scope > h3, :scope > .hb-helper-landing-sort-header > h3'
        )).find(heading => normalizedText(heading) === config.heading)
            || Array.from(section.querySelectorAll('h2'))
                .find(heading => normalizedText(heading) === config.heading) || null;
    }

    function getLandingSortTileEntries(section, productByUrl) {
        const nextCards = Array.from(section.querySelectorAll('[data-testid="product-card"]'));
        const holders = nextCards.length ? nextCards
            : Array.from(section.querySelectorAll('.tile-holder.js-tile-holder'));
        return holders
            .map((holder, domIndex) => {
                if (!holder.dataset.hbHelperLandingOriginalIndex && canModifyHelperTarget(holder)) {
                    holder.dataset.hbHelperLandingOriginalIndex = String(domIndex);
                }
                const link = holder.matches('a[href]') ? holder : holder.querySelector('a[href]');
                const product = productByUrl.get(normalizeHumblePath(link?.getAttribute('href')));
                const originalDomIndex = Number(holder.dataset.hbHelperLandingOriginalIndex);
                return {
                    holder,
                    domIndex,
                    originalDomIndex: Number.isFinite(originalDomIndex) ? originalDomIndex : domIndex,
                    product,
                };
            });
    }

    function getLandingSortState(config) {
        const section = findLandingSortSection(config);
        const products = getLandingSortProductData(config);
        if (!section || !products) return null;

        const productByUrl = new Map(products.map(product => [product.productUrl, product]));
        const entries = getLandingSortTileEntries(section, productByUrl);
        const layout = entries[0]?.holder.matches('[data-testid="product-card"]') ? 'grid' : 'mosaic';
        return {config, section, products, entries, layout};
    }

    function compareOptionalTime(a, b, direction) {
        const aHasTime = Number.isFinite(a);
        const bHasTime = Number.isFinite(b);
        if (!aHasTime && !bHasTime) return 0;
        if (!aHasTime) return 1;
        if (!bHasTime) return -1;
        return (a - b) * direction;
    }

    function getLandingSortMode(sectionKey) {
        return landingSortModeBySection.get(sectionKey) || 'default';
    }

    function setLandingSortMode(config, mode) {
        const state = getLandingSortState(config);
        if (mode === 'newest' && state?.layout === 'grid'
            && !state.products.some(product => Number.isFinite(product.startTime))) return;
        landingSortModeBySection.set(config.sectionKey, mode);
        GM_setValue(landingSortModeStorageKey, mode);
        renderLandingSortControls(config, state);
        applyLandingSort(state);
    }

    function compareLandingSortEntries(a, b, mode) {
        let result = 0;
        if (mode === 'ending') {
            result = compareOptionalTime(a.product.endTime, b.product.endTime, 1);
        } else if (mode === 'newest') {
            result = compareOptionalTime(a.product.startTime, b.product.startTime, -1);
        }

        return result
            || a.product.originalIndex - b.product.originalIndex
            || a.originalDomIndex - b.originalDomIndex;
    }

    function getDefaultLandingSortIndex(entry) {
        return entry.product ? entry.product.originalIndex : entry.originalDomIndex;
    }

    function getLandingSortDesiredEntries(state) {
        const mode = getEffectiveLandingSortMode(state);
        if (mode === 'default') {
            return [...state.entries].sort((a, b) =>
                (state.layout === 'grid'
                    ? a.originalDomIndex - b.originalDomIndex
                    : getDefaultLandingSortIndex(a) - getDefaultLandingSortIndex(b))
                || a.originalDomIndex - b.originalDomIndex
            );
        }

        const matchedEntries = state.entries
            .filter(entry => entry.product)
            .sort((a, b) => compareLandingSortEntries(a, b, mode));
        const unmatchedEntries = state.entries
            .filter(entry => !entry.product)
            .sort((a, b) => a.originalDomIndex - b.originalDomIndex);
        return matchedEntries.concat(unmatchedEntries);
    }

    function getEffectiveLandingSortMode(state) {
        const mode = getLandingSortMode(state.config.sectionKey);
        return mode === 'newest' && state.layout === 'grid'
            && !state.products.some(product => Number.isFinite(product.startTime))
            ? 'default' : mode;
    }

    function renderLandingSortControls(config, state = getLandingSortState(config)) {
        const controls = document.querySelector(
            `.hb-helper-landing-sort-controls[data-hb-helper-sort-section="${config.sectionKey}"]`
        );
        if (!controls) return;

        const activeMode = state ? getEffectiveLandingSortMode(state) : getLandingSortMode(config.sectionKey);
        landingSortModes.forEach(mode => {
            const button = controls.querySelector(`[data-hb-helper-sort="${mode.key}"]`);
            if (!button) return;
            const isActive = mode.key === activeMode;
            button.classList.toggle('hb-helper-landing-sort-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
            button.disabled = mode.key === 'newest' && state?.layout === 'grid'
                && !state.products.some(product => Number.isFinite(product.startTime));
            button.title = t(button.disabled ? 'landingNewestUnavailableTitle' : mode.titleKey);
        });
    }

    function ensureLandingSortControls(state) {
        const {config, section, layout} = state;
        const heading = findLandingSortHeading(section, config);
        if (!heading || !canModifyHelperTarget(heading)
            || !canModifyHelperTarget(heading.parentElement)) return null;

        let header = section.querySelector(
            `.hb-helper-landing-sort-header[data-hb-helper-sort-section="${config.sectionKey}"]`
        );
        if (!header) {
            header = document.createElement('div');
            header.className = 'hb-helper-landing-sort-header';
            header.dataset.hbHelperSortSection = config.sectionKey;
            if (layout === 'grid') {
                header.dataset.hbHelperSortLayout = 'grid';
                heading.insertAdjacentElement('afterend', header);
            } else {
                heading.insertAdjacentElement('beforebegin', header);
                header.appendChild(heading);
            }
        } else if (layout !== 'grid' && heading.parentElement !== header) {
            header.insertBefore(heading, header.firstChild);
        }

        let controls = header.querySelector('.hb-helper-landing-sort-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'hb-helper-landing-sort-controls';
            controls.dataset.hbHelperSortSection = config.sectionKey;
            controls.setAttribute('role', 'group');
            controls.setAttribute('aria-label', t('landingSortAria', {heading: config.heading}));

            for (const mode of landingSortModes) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = t(mode.labelKey);
                button.title = t(mode.titleKey);
                button.dataset.hbHelperSort = mode.key;
                button.addEventListener('click', () => {
                    setLandingSortMode(config, mode.key);
                });
                controls.appendChild(button);
            }
        }

        if (controls.parentElement !== header) {
            header.appendChild(controls);
        }
        renderLandingSortControls(config, state.products ? state : undefined);
        return controls;
    }

    function getLandingSortLayoutSlots(state) {
        const layouts = Array.from(state.section.querySelectorAll('.mosaic-layout'))
            .map(layout => ({
                container: layout,
                count: layout.querySelectorAll(':scope > .tile-holder.js-tile-holder').length,
            }))
            .filter(slot => slot.count > 0);

        if (layouts.length) return layouts;

        const fallbackContainer = state.section.querySelector(state.config.mosaicSelector);
        const fallbackCount = fallbackContainer
            ? fallbackContainer.querySelectorAll(':scope > .tile-holder.js-tile-holder').length
            : 0;
        return fallbackContainer && fallbackCount
            ? [{container: fallbackContainer, count: fallbackCount}]
            : [];
    }

    function applyLandingSort(state) {
        if (!state) return;
        if (!state.entries.every(entry => canModifyHelperTarget(entry.holder))) return;

        const desiredHolders = getLandingSortDesiredEntries(state).map(entry => entry.holder);
        if (state.layout === 'grid') {
            const isDefault = getEffectiveLandingSortMode(state) === 'default';
            desiredHolders.forEach((holder, index) => {
                const order = isDefault ? '' : String(index);
                if (holder.style.order !== order) holder.style.order = order;
            });
            return;
        }
        const currentHolders = state.entries.map(entry => entry.holder);
        if (desiredHolders.every((holder, index) => holder === currentHolders[index])) return;

        const slots = getLandingSortLayoutSlots(state);
        let holderIndex = 0;
        for (const slot of slots) {
            for (let i = 0; i < slot.count && holderIndex < desiredHolders.length; i++) {
                slot.container.appendChild(desiredHolders[holderIndex]);
                holderIndex++;
            }
        }
    }

    function removeLandingSortControls(config) {
        document.querySelectorAll(
            `.hb-helper-landing-sort-header[data-hb-helper-sort-section="${config.sectionKey}"]`
        ).forEach(header => {
            const heading = header.querySelector('h3');
            if (heading) header.insertAdjacentElement('beforebegin', heading);
            header.remove();
        });
        document.querySelectorAll(
            `.hb-helper-landing-sort-controls[data-hb-helper-sort-section="${config.sectionKey}"]`
        ).forEach(controls => controls.remove());
    }

    function refreshLandingSortPage() {
        const activeConfigs = getActiveLandingSortConfigs();
        if (activeConfigs.length === 0) return;

        const activeSectionKeys = new Set(activeConfigs.map(config => config.sectionKey));
        document.querySelectorAll('.hb-helper-landing-sort-controls').forEach(controls => {
            if (!activeSectionKeys.has(controls.dataset.hbHelperSortSection)) {
                controls.remove();
            }
        });

        for (const config of activeConfigs) {
            const state = getLandingSortState(config);
            if (!state) {
                removeLandingSortControls(config);
                continue;
            }
            if (!canModifyHelperTarget(findLandingSortHeading(state.section, config))) continue;
            ensureLandingSortControls(state);
            applyLandingSort(state);
        }
    }

    function scheduleLandingSortPageRefresh() {
        clearTimeout(landingSortRefreshTimer);
        landingSortRefreshTimer = setTimeout(refreshLandingSortPage, 150);
    }

    function observeLandingSortPageChanges() {
        if (landingSortPageChangesObserved) return;
        landingSortPageChangesObserved = true;
        const observer = new MutationObserver(() => scheduleLandingSortPageRefresh());
        observer.observe(document.body, {childList: true, subtree: true});
    }

    let hydratedHelperTargets = new WeakSet();
    let hydrationRetryTimer;
    let hydrationRetryDeadline = 0;

    function resetHelperHydration() {
        clearTimeout(hydrationRetryTimer);
        hydrationRetryTimer = undefined;
        hydrationRetryDeadline = 0;
        hydratedHelperTargets = new WeakSet();
    }

    function deferHelperHydration() {
        if (!hydrationRetryDeadline) hydrationRetryDeadline = Date.now() + 10000;
        if (hydrationRetryTimer || Date.now() >= hydrationRetryDeadline) return;
        const route = getHelperRouteFingerprint();
        hydrationRetryTimer = setTimeout(() => {
            hydrationRetryTimer = undefined;
            if (route === getHelperRouteFingerprint()) schedulePageRefresh();
        }, 100);
    }

    function retryHelperHydrationAfterPageEvent() {
        if (hydrationRetryDeadline && Date.now() < hydrationRetryDeadline) return;
        hydrationRetryDeadline = 0;
        schedulePageRefresh();
    }

    function isCommittedReactHost(target) {
        try {
            const page = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
            const keys = (page.Object || Object).getOwnPropertyNames(target);
            const key = keys.find(name => name.startsWith('__reactFiber$') || name.startsWith('__reactContainer$'));
            let fiber = key && (page.Reflect || Reflect).get(target, key);
            for (let depth = 0; fiber?.return && depth < 1000; depth += 1) fiber = fiber.return;
            const current = fiber?.stateNode?.current;
            if (!current || current.memoizedState?.isDehydrated) return false;
            if (key.startsWith('__reactContainer$')) return true;
            const pending = [current];
            for (let count = 0; pending.length && count < 20000; count += 1) {
                const node = pending.pop();
                if (node.stateNode?.nodeType === target.nodeType
                    && node.stateNode.isSameNode(target)) return true;
                if (node.child) pending.push(node.child);
                if (node.sibling) pending.push(node.sibling);
            }
        } catch (_) {
            // An unavailable page-realm adapter must never force a pre-hydration write.
        }
        return false;
    }

    function canModifyHelperTarget(target) {
        if (!target) return false;
        if (!document.querySelector('script[src*="/_next/"]')) return true;
        if (!target.isConnected) return false;
        if (hydratedHelperTargets.has(target)) return true;
        if (isCommittedReactHost(target)) {
            hydratedHelperTargets.add(target);
            return true;
        }
        deferHelperHydration();
        return false;
    }

    function findTextAnchor(pattern) {
        return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div'))
            .filter(element => pattern.test(normalizedText(element)))
            .sort((a, b) =>
                a.childElementCount - b.childElementCount
                || normalizedText(a).length - normalizedText(b).length
            )[0] || null;
    }

    function findHelperInsertionPoint() {
        const library = getLibraryView();
        if (['bundle', 'content'].includes(library.kind)) {
            return library.heading ? {anchor: library.heading, position: 'afterend'} : null;
        }
        if (isGamesBundlePage()) {
            const itemSection = document.querySelector('[data-bundle-section="games"]');
            if (itemSection) return {anchor: itemSection, position: 'beforebegin'};
            const anchor = findTextAnchor(
                /^Pay at least .+ for (?:these )?\d+ items?[.!]?$/i
            );
            return anchor ? {anchor, position: 'beforebegin'} : null;
        }

        if (isChoicePage()) {
            const memberGrid = getModernChoiceMemberGrid();
            if (memberGrid) return {anchor: memberGrid, position: 'beforebegin'};
            const carousel = document.querySelector('section[aria-label="Media carousel"]');
            if (carousel && getModernChoiceGameEntries().length) {
                return {anchor: carousel.parentElement, position: 'beforebegin'};
            }
            const yourGamesHeading = findTextAnchor(/^YOUR GAMES$/i);
            if (yourGamesHeading) return {anchor: yourGamesHeading, position: 'afterend'};
            if (!document.querySelector('.choice-content.js-open-choice-modal')) return null;
            const monthHeading = findTextAnchor(choiceMonthPattern);
            if (monthHeading) return {anchor: monthHeading, position: 'beforebegin'};
        }
        return null;
    }

    function getChoicePeriod() {
        const heading = findTextAnchor(choiceMonthPattern);
        if (heading) return normalizedText(heading).replace(/\s+GAMES$/i, '');
        const memberHeading = getModernChoiceMemberGrid()?.closest('section')?.querySelector('h1');
        if (!memberHeading) return '';
        const period = normalizedText(memberHeading).replace(/\s*Humble\s+Choice$/i, '').trim();
        const chineseDate = period.match(/^(\d{4})年\s*(\d{1,2})月$/);
        if (!chineseDate) return period;
        const month = Number(chineseDate[2]);
        if (month < 1 || month > 12) return '';
        return new Intl.DateTimeFormat('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'})
            .format(new Date(Date.UTC(Number(chineseDate[1]), month - 1, 1)));
    }

    function normalizeHumbleLocationText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeHumbleLocationName(value) {
        return normalizeHumbleLocationText(value)
            .replace(/\s*\([^)]*\)\s*/g, ' ')
            .replace(/[.'’]/g, '')
            .replace(/[^A-Za-z0-9]+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function getHumbleCurrencyCodeForLocation(value) {
        const locationText = normalizeHumbleLocationText(value);
        if (!locationText) return null;

        const countryCode = locationText.toUpperCase().match(/^[A-Z]{2}$/)?.[0]
            || locationText.toUpperCase().match(/^([A-Z]{2})\b/)?.[1];
        if (countryCode && humbleCurrencyByCountryCode.has(countryCode)) {
            return humbleCurrencyByCountryCode.get(countryCode);
        }

        return humbleCurrencyByLocationName.get(normalizeHumbleLocationName(locationText)) || null;
    }

    function getHumbleSettingsFieldDescriptor(element) {
        const parts = [
            element.getAttribute('name'),
            element.getAttribute('id'),
            element.getAttribute('class'),
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.getAttribute('data-field'),
            element.getAttribute('data-name'),
        ];
        if (element.labels) {
            parts.push(...Array.from(element.labels).map(label => label.textContent));
        }
        const wrappingLabel = element.closest('label');
        if (wrappingLabel) parts.push(wrappingLabel.textContent);
        return parts.filter(Boolean).join(' ');
    }

    function isHumbleLocationField(element) {
        return /location|country|region/i.test(getHumbleSettingsFieldDescriptor(element));
    }

    function cleanHumbleLocationCandidate(value) {
        return normalizeHumbleLocationText(value)
            .replace(/^Account Information\s*/i, '')
            .replace(/^Location\s*:?\s*/i, '')
            .replace(/\b(?:Change|Edit|Update)\b.*$/i, '')
            .trim();
    }

    function findHumbleAccountCurrencyCode(settingsPage) {
        for (const heading of settingsPage.querySelectorAll('h3')) {
            if (!/^(?:Location|位置)\s*[:：]?$/i.test(normalizedText(heading))) continue;
            const value = heading.parentElement?.nextElementSibling;
            if (value?.matches('p')) {
                return getHumbleCurrencyCodeForLocation(normalizedText(value));
            }
        }
        const candidates = [];
        const addCandidate = value => {
            const text = normalizeHumbleLocationText(value);
            if (text) candidates.push(text);
        };

        settingsPage.querySelectorAll('[data-country-code], [data-country], [data-location]')
            .forEach(element => {
                addCandidate(element.getAttribute('data-country-code'));
                addCandidate(element.getAttribute('data-country'));
                addCandidate(element.getAttribute('data-location'));
                addCandidate(element.textContent);
            });

        settingsPage.querySelectorAll('select').forEach(select => {
            if (!isHumbleLocationField(select)) return;
            const selectedOptions = Array.from(select.options || [])
                .filter(option => option.hasAttribute('selected') || option.defaultSelected);
            selectedOptions.forEach(option => {
                addCandidate(option.value);
                addCandidate(option.textContent);
            });
            if (selectedOptions.length === 0) addCandidate(select.getAttribute('value'));
        });

        settingsPage.querySelectorAll('input, textarea').forEach(input => {
            if (!isHumbleLocationField(input)) return;
            if (/^(?:button|password|submit)$/i.test(input.type || '')) return;
            addCandidate(input.value);
            addCandidate(input.getAttribute('value'));
        });

        const locationLabels = Array.from(settingsPage.querySelectorAll(
            'label, dt, th, strong, b, span, div'
        ))
            .filter(element => /^Location\b/i.test(normalizedText(element))
                && normalizedText(element).length <= 80)
            .sort((a, b) =>
                a.childElementCount - b.childElementCount
                || normalizedText(a).length - normalizedText(b).length
            );
        for (const label of locationLabels) {
            [
                label,
                label.nextElementSibling,
                label.parentElement,
                label.closest('tr'),
                label.closest('li'),
                label.closest('fieldset'),
            ].filter(Boolean).forEach(element => addCandidate(
                cleanHumbleLocationCandidate(element.textContent)
            ));
        }

        for (const candidate of candidates) {
            const currencyCode = getHumbleCurrencyCodeForLocation(candidate);
            if (currencyCode) return currencyCode;
        }
        return null;
    }

    function fetchHumbleAccountCurrencyCode() {
        if (!humbleAccountCurrencyPromise) {
            humbleAccountCurrencyPromise = (async () => {
                const html = await gmRequest(
                    `https://www.humblebundle.com/user/settings?_=${Date.now()}`,
                    'text',
                    {headers: {'Cache-Control': 'no-cache'}}
                );
                const settingsPage = new DOMParser().parseFromString(html, 'text/html');
                const currencyCode = findHumbleAccountCurrencyCode(settingsPage);
                if (!currencyCode) throw new Error('Humble account location not found');
                return currencyCode;
            })().catch(error => {
                console.warn('[HB-Helper] Humble account currency unavailable; skipping HB conversion:', error);
                return null;
            });
        }
        return humbleAccountCurrencyPromise;
    }

    function resolveHumbleCurrencyCode() {
        return fetchHumbleAccountCurrencyCode();
    }

    function buildSteamGiftsSearchUrl() {
        let term;
        const library = getLibraryView();
        if (['bundle', 'content'].includes(library.kind)) {
            term = `[Humble Bundle] ${normalizedText(library.heading)}`;
        } else if (isChoicePage()) {
            term = `[Humble Bundle] ${getChoicePeriod()}`.trim();
        } else {
            const title = getBundleTitle();
            const word = title.match(/[A-Za-z0-9]+/)?.[0] || title.trim().split(/\s+/)[0] || 'Bundle';
            term = `[Humble Bundle] ${word}`;
        }
        return 'https://www.steamgifts.com/discussions/search?q=' + encodeURIComponent(term);
    }

    function waitForCondition(check, timeout = 8000, interval = 120) {
        return new Promise(resolve => {
            const startedAt = Date.now();
            const timer = setInterval(() => {
                const result = check();
                if (result || Date.now() - startedAt >= timeout) {
                    clearInterval(timer);
                    resolve(result || null);
                }
            }, interval);
        });
    }

    function getModernChoiceMemberGrid() {
        if (!isChoicePage() || !/^\/membership\/home(?:\/|$)/.test(location.pathname)) return null;
        const grids = new Set();
        for (const heading of document.querySelectorAll('main h1')) {
            if (!/\bHumble\s+Choice\b/i.test(normalizedText(heading))) continue;
            const section = heading.closest('section');
            for (const grid of section?.querySelectorAll('.grid') || []) {
                if (grid.getClientRects().length === 0) continue;
                const children = Array.from(grid.children);
                if (children.length && children.every(child => child.matches('button')
                    && child.querySelectorAll('[data-testid="product-card"]').length === 1)) {
                    grids.add(grid);
                }
            }
        }
        return grids.size === 1 ? grids.values().next().value : null;
    }

    function getModernChoiceGameEntries() {
        if (!isChoicePage()) return [];
        const seenProducts = new Set();
        const products = getNextPageData('subscriptionProducts')
            .filter(Array.isArray)
            .flat()
            .filter(item => item?.productType === 'humble-choice'
                && typeof item.title === 'string' && item.title.trim()
                && typeof item.thumbnail === 'string' && item.thumbnail)
            .filter(item => {
                if (typeof item.id !== 'string' || !item.id.trim()) return true;
                const signature = JSON.stringify([
                    item.id, item.title, item.thumbnail, item.deliveryMethods, item.platforms,
                ]);
                if (seenProducts.has(signature)) return false;
                seenProducts.add(signature);
                return true;
            });
        if (!products.length) return [];

        const tiles = Array.from(document.querySelectorAll(
            'section[aria-label="Media carousel"] [data-media-index]'
        ));
        const memberGrid = getModernChoiceMemberGrid();
        if (memberGrid) tiles.push(...Array.from(memberGrid.children, button =>
            button.querySelector('[data-testid="product-card"]')
        ));
        return tiles.flatMap(tile => {
            const isMemberCard = tile.matches('[data-testid="product-card"]');
            const titleElement = isMemberCard ? tile.querySelector(
                '[data-testid="product-card-footer"] [class~="group/product-title"] .line-clamp-1'
            ) : null;
            const title = titleElement ? normalizedText(titleElement) : '';
            const source = tile.querySelector(isMemberCard
                ? '[data-testid="product-thumbnail"] img[src]' : 'button img[src]')?.getAttribute('src');
            let imageUrl;
            if (source) {
                try {
                    const url = new URL(source, location.origin);
                    imageUrl = url.pathname === '/_next/image'
                        ? url.searchParams.get('url')
                        : url.href;
                } catch (_) {
                    imageUrl = null;
                }
            }
            let matches = products.filter(item => item.thumbnail === imageUrl);
            if (!matches.length && title) {
                matches = products.filter(item => item.title.trim().replace(/\s+/g, ' ') === title);
            }
            if (title && matches.length === 1
                && matches[0].title.trim().replace(/\s+/g, ' ') !== title) return [];
            return matches.length === 1
                ? [{tile, title: matches[0].title.trim(), item: matches[0]}]
                : [];
        });
    }

    function getModernChoiceSteamLinkTargets() {
        const entries = getModernChoiceGameEntries();
        const sections = new Set(entries.map(entry =>
            entry.tile.closest('section[aria-label="Media carousel"]')
        ).filter(Boolean));
        const targets = [];
        for (const section of sections) {
            const games = entries.filter(entry => section.contains(entry.tile));
            const matches = Array.from(section.parentElement.children)
                .filter(container => container !== section)
                .flatMap(container => Array.from(container.querySelectorAll('h3'))
                    .flatMap(heading => {
                        const matchingGames = games.filter(entry =>
                            normalizedText(heading) === entry.title.replace(/\s+/g, ' ')
                        );
                        return matchingGames.length === 1
                            && Array.isArray(matchingGames[0].item.deliveryMethods)
                            && matchingGames[0].item.deliveryMethods.includes('steam')
                            ? [{container, heading, game: matchingGames[0]}]
                            : [];
                    }));
            if (matches.length !== 1) continue;
            const {container, heading, game} = matches[0];
            targets.push({
                container,
                title: game.title,
                placementContainer: heading.parentElement.parentElement,
                after: heading.parentElement,
            });
        }
        return targets;
    }

    function getVisibleChoiceTiles() {
        return Array.from(document.querySelectorAll('.choice-content.js-open-choice-modal'))
            .filter(tile => tile.getClientRects().length > 0);
    }

    function getChoiceTileTitle(tile) {
        return normalizedText(tile.querySelector('.content-choice-title, .human-name-title, .item-title') || tile);
    }

    function getChoiceTileId(tile) {
        const dataKeys = [
            'machineName',
            'productMachineName',
            'subproductMachineName',
            'contentChoiceId',
            'humanName',
            'slug',
            'id',
        ];
        for (const key of dataKeys) {
            if (tile.dataset[key]) return `${key}:${tile.dataset[key]}`;
        }

        const attributeNames = [
            'data-machine-name',
            'data-product-machine-name',
            'data-subproduct-machine-name',
            'data-content-choice-id',
            'data-human-name',
            'data-slug',
            'data-id',
        ];
        for (const name of attributeNames) {
            const value = tile.getAttribute(name);
            if (value) return `${name}:${value}`;
        }

        return `title:${normalizeSteamTitle(getChoiceTileTitle(tile))}`;
    }

    function getChoiceSelection(value = GM_getValue(choiceSelectionCacheKey, [])) {
        const values = Array.isArray(value) || value instanceof Set ? [...value] : [];
        return new Set(values.filter(isNonEmptyString));
    }

    function getSelectedChoiceGameIds() {
        return new Set(selectedChoiceGameIds);
    }

    function replaceChoiceSelection(value) {
        const nextSelection = getChoiceSelection(value);
        if (nextSelection.size === selectedChoiceGameIds.size
            && [...nextSelection].every(id => selectedChoiceGameIds.has(id))) {
            return false;
        }
        selectedChoiceGameIds.clear();
        nextSelection.forEach(id => selectedChoiceGameIds.add(id));
        renderChoiceSelectionState();
        return true;
    }

    function observeChoiceSelection() {
        if (choiceSelectionListener !== undefined) return;
        choiceSelectionListener = GM_addValueChangeListener(
            choiceSelectionCacheKey,
            (name, oldValue, newValue) => replaceChoiceSelection(newValue)
        );
        replaceChoiceSelection(GM_getValue(choiceSelectionCacheKey, []));
    }

    async function updateChoiceSelection(update, {lockManager} = {}) {
        const mutateStoredSelection = async () => {
            const storedSelection = getChoiceSelection();
            const nextSelection = new Set(storedSelection);
            await update(nextSelection);
            const changed = nextSelection.size !== storedSelection.size
                || [...nextSelection].some(id => !storedSelection.has(id));
            if (changed) GM_setValue(choiceSelectionCacheKey, [...nextSelection]);
            const persistedSelection = getChoiceSelection();
            const persisted = persistedSelection.size === nextSelection.size
                && [...nextSelection].every(id => persistedSelection.has(id));
            replaceChoiceSelection(persistedSelection);
            return {
                updated: changed && persisted,
                persisted,
                selection: persistedSelection,
            };
        };
        const lockResult = await requestChoiceExclusiveLock(
            choiceSelectionLockName,
            mutateStoredSelection,
            {lockManager}
        );
        if (lockResult.unsupported) return mutateStoredSelection();
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    function getDownloadSelectionStorageKey(scope) {
        return /^[0-9a-f]{64}$/.test(scope || '')
            ? `${downloadSelectionCacheKeyPrefix}${scope}`
            : null;
    }

    function getDownloadSelectionMap(scope, value) {
        const map = {};
        const storageKey = getDownloadSelectionStorageKey(scope);
        if (!storageKey) return map;
        const storedValue = value === undefined ? GM_getValue(storageKey, {}) : value;
        if (!storedValue || typeof storedValue !== 'object' || Array.isArray(storedValue)) {
            return map;
        }
        const ids = storedValue[scope];
        if (!Array.isArray(ids)) return map;
        const selection = [...new Set(ids.filter(id =>
            parseDownloadActivationItemId(id)?.scope === scope
        ))];
        if (selection.length > 0) map[scope] = selection;
        return map;
    }

    function getDownloadSelection(scope, value) {
        return new Set(getDownloadSelectionMap(scope, value)[scope] || []);
    }

    function replaceDownloadSelection(scope, value) {
        if (scope !== downloadOrderScope) return false;
        const nextSelection = getDownloadSelection(scope, value);
        if (nextSelection.size === selectedDownloadItemIds.size
            && [...nextSelection].every(id => selectedDownloadItemIds.has(id))) {
            return false;
        }
        selectedDownloadItemIds.clear();
        nextSelection.forEach(id => selectedDownloadItemIds.add(id));
        renderDownloadSelectionState();
        return true;
    }

    function observeDownloadSelection(scope) {
        downloadOrderScope = scope;
        const storageKey = getDownloadSelectionStorageKey(scope);
        if (!storageKey) return;
        if (!downloadSelectionListeners.has(scope)) {
            const listenerScope = scope;
            const id = GM_addValueChangeListener(
                storageKey,
                (name, oldValue, newValue) => {
                    if (downloadOrderScope === listenerScope) {
                        replaceDownloadSelection(listenerScope, newValue);
                    }
                }
            );
            downloadSelectionListeners.set(scope, id);
        }
        replaceDownloadSelection(scope, GM_getValue(storageKey, {}));
    }

    async function updateDownloadSelection(
        scope,
        update,
        {lockManager, shouldPersist = () => true} = {}
    ) {
        if (!/^[0-9a-f]{64}$/.test(scope || '')) {
            return {updated: false, invalidScope: true, selection: new Set()};
        }
        const storageKey = getDownloadSelectionStorageKey(scope);
        const mutateStoredSelection = async () => {
            const storedMap = getDownloadSelectionMap(scope);
            const storedSelection = new Set(storedMap[scope] || []);
            const nextSelection = new Set(storedSelection);
            await update(nextSelection);
            if (!shouldPersist()) {
                const currentMap = getDownloadSelectionMap(scope);
                const currentSelection = new Set(currentMap[scope] || []);
                replaceDownloadSelection(scope, currentMap);
                return {
                    updated: false,
                    persisted: false,
                    aborted: true,
                    selection: currentSelection,
                };
            }
            for (const id of [...nextSelection]) {
                if (parseDownloadActivationItemId(id)?.scope !== scope) {
                    nextSelection.delete(id);
                }
            }
            const changed = nextSelection.size !== storedSelection.size
                || [...nextSelection].some(id => !storedSelection.has(id));
            if (changed) {
                if (nextSelection.size > 0) storedMap[scope] = [...nextSelection];
                else delete storedMap[scope];
                GM_setValue(storageKey, storedMap);
            }
            const persistedMap = getDownloadSelectionMap(scope);
            const persistedSelection = new Set(persistedMap[scope] || []);
            const persisted = persistedSelection.size === nextSelection.size
                && [...nextSelection].every(id => persistedSelection.has(id));
            replaceDownloadSelection(scope, persistedMap);
            return {
                updated: changed && persisted,
                persisted,
                selection: persistedSelection,
            };
        };
        const lockResult = await requestChoiceExclusiveLock(
            scope,
            mutateStoredSelection,
            {lockManager}
        );
        if (!lockResult.acquired) return {...lockResult, updated: false};
        return lockResult.value;
    }

    function encodeLibraryActivationItemId(viewScope, entitlementId, keySlotId) {
        const identity = [viewScope, entitlementId, keySlotId];
        if (!identity.every(isNonEmptyString)) {
            throw new TypeError('Library key IDs require a view, entitlement, and key-slot identity.');
        }
        return `library:v1:${encodeURIComponent(JSON.stringify(identity))}`;
    }

    function parseLibraryActivationItemId(id) {
        const prefix = 'library:v1:';
        if (typeof id !== 'string' || !id.startsWith(prefix)) return null;
        try {
            const identity = JSON.parse(decodeURIComponent(id.slice(prefix.length)));
            if (!Array.isArray(identity)
                || identity.length !== 3
                || !identity.every(isNonEmptyString)
                || encodeLibraryActivationItemId(...identity) !== id) {
                return null;
            }
            const [viewScope, entitlementId, keySlotId] = identity;
            return {viewScope, entitlementId, keySlotId};
        } catch (_) {
            return null;
        }
    }

    function inferActivationBatchScope(batch) {
        if (!Array.isArray(batch?.items) || batch.items.length === 0) return null;
        const ids = batch.items.map(item => item?.id);
        if (ids.some(id => !isNonEmptyString(id))
            || new Set(ids).size !== ids.length) {
            return null;
        }
        let kind;
        let scope;
        const librarySlots = new Set();
        for (const id of ids) {
            const decoded = decodeChoiceActivationItemId(id);
            if (!decoded) return null;
            if (decoded.gameId.startsWith('library:')) {
                const parsed = parseLibraryActivationItemId(decoded.gameId);
                if (!parsed || decoded.keyIndex !== 0 || (kind && kind !== 'library')) {
                    return null;
                }
                // View identity is separate from the physical entitlement/key slot.
                const slot = JSON.stringify([parsed.entitlementId, parsed.keySlotId]);
                if ((scope && scope !== parsed.viewScope) || librarySlots.has(slot)) return null;
                kind = 'library';
                scope = parsed.viewScope;
                librarySlots.add(slot);
            } else if (id.startsWith('download:')) {
                const parsed = parseDownloadActivationItemId(id);
                if (!parsed || (kind && kind !== 'download')) return null;
                kind = 'download';
                if (scope && scope !== parsed.scope) return null;
                scope = parsed.scope;
            } else {
                if (kind && kind !== 'choice') return null;
                kind = 'choice';
            }
        }
        return kind === 'choice' ? {kind} : {kind, scope};
    }

    function preflightActivationSelection(selectedItems) {
        if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
            return {valid: false, scope: null};
        }
        if (selectedItems.some(item =>
            !isNonEmptyString(item?.id) || !isNonEmptyString(item?.title))) {
            return {valid: false, scope: null};
        }
        const scope = inferActivationBatchScope({items: selectedItems});
        return scope ? {valid: true, scope} : {valid: false, scope: null};
    }

    function activationScopesMatch(left, right) {
        if (!left || !right || left.kind !== right.kind) return false;
        return left.kind === 'choice' || left.scope === right.scope;
    }

    function getActivationBatchPresentation(batch, currentScope) {
        if (!batch) return {kind: 'none'};
        const batchScope = inferActivationBatchScope(batch);
        if (activationScopesMatch(batchScope, currentScope)) {
            return {kind: 'details', batch};
        }
        if (isChoiceActivationBatchActive(batch)) return {kind: 'busy'};
        return {kind: 'none'};
    }

    function setElementTextContent(element, value) {
        if (!element) return;
        const nextValue = value || '';
        if (element.textContent !== nextValue) element.textContent = nextValue;
    }

    function setChoiceStatus(message) {
        const status = document.querySelector(
            '#hb-helper-choice-activation-controls .hb-helper-choice-status'
        );
        setElementTextContent(status, message);
    }

    function renderChoiceSelectionTiles(tiles, selection = selectedChoiceGameIds) {
        tiles.forEach(tile => {
            const id = getChoiceTileId(tile);
            tile.classList.toggle('hb-helper-choice-selected', selection.has(id));
        });
    }

    function renderChoiceSelectionState() {
        if (!isChoicePage()) return;
        const activationCurrent = choiceActivationInProgress
            && isActivationUiContextCurrent(choiceActivationContext);
        if (!hasSteamAccountData() && !activationCurrent) {
            choiceSelectionMode = false;
            document.documentElement.classList.remove('hb-helper-choice-select-mode');
            renderChoiceSelectionTiles(getVisibleChoiceTiles(), new Set());
            document.getElementById('hb-helper-choice-activation-controls')?.remove();
            document.getElementById('hb-helper-choice-activation-results')?.remove();
            return;
        }
        renderChoiceSelectionTiles(getVisibleChoiceTiles());

        const controls = document.getElementById('hb-helper-choice-activation-controls');
        if (!controls) return;
        const controlsLocked = activationCurrent || isChoiceActivationBatchActive();
        if (controlsLocked) choiceSelectionMode = false;
        const activateButton = controls.querySelector('[data-hb-helper-choice-action="activate"]');
        const selectUnownedButton = controls.querySelector('[data-hb-helper-choice-action="select-unowned"]');
        const selectButton = controls.querySelector('[data-hb-helper-choice-action="select"]');
        const clearButton = controls.querySelector('[data-hb-helper-choice-action="clear"]');
        if (activateButton) {
            activateButton.disabled = controlsLocked || !isChoiceActivationUiAvailable();
        }
        if (selectUnownedButton) selectUnownedButton.disabled = controlsLocked;
        if (selectButton) {
            selectButton.disabled = controlsLocked;
            setElementTextContent(
                selectButton,
                choiceSelectionMode ? t('choiceSelectDone') : t('choiceSelect')
            );
            selectButton.setAttribute('aria-pressed', String(choiceSelectionMode));
        }
        if (clearButton) clearButton.disabled = controlsLocked;
        if (!activationCurrent) {
            setChoiceStatus(t('choiceSelectedCount', {count: selectedChoiceGameIds.size}));
        }
        document.documentElement.classList.toggle('hb-helper-choice-select-mode', choiceSelectionMode);
    }

    function setChoiceSelectionMode(enabled) {
        if (enabled && isChoiceActivationBatchActive()) return;
        choiceSelectionMode = enabled;
        renderChoiceSelectionState();
    }

    async function toggleChoiceTileSelection(tile) {
        if (isChoiceActivationBatchActive()) return;
        const id = getChoiceTileId(tile);
        return updateChoiceSelection(selection => {
            if (selection.has(id)) selection.delete(id);
            else selection.add(id);
        });
    }

    async function selectUnownedChoiceTiles() {
        if (isChoiceActivationBatchActive()) return;
        const unownedIds = getVisibleChoiceTiles()
            .filter(tile => !tile.classList.contains('owned'))
            .map(getChoiceTileId);
        return updateChoiceSelection(selection => {
            selection.clear();
            unownedIds.forEach(id => selection.add(id));
        });
    }

    async function clearChoiceSelection() {
        if (isChoiceActivationBatchActive()) return;
        return updateChoiceSelection(selection => selection.clear());
    }

    function getSelectedChoiceTiles() {
        return getVisibleChoiceTiles()
            .filter(tile => selectedChoiceGameIds.has(getChoiceTileId(tile)));
    }

    function handleChoiceSelectionClick(event) {
        if (!choiceSelectionMode || !isChoicePage() || isChoiceActivationBatchActive()) return;
        const tile = event.target.closest?.('.choice-content.js-open-choice-modal');
        if (!tile) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleChoiceTileSelection(tile).catch(error => {
            console.warn('[HB-Helper] Update Choice selection failed:', error);
        });
    }

    function getDownloadMappingPairForRow(row) {
        return downloadOrderMapping?.pairs.find(pair => pair.row === row) || null;
    }

    function isDownloadMappingPairEligible(
        pair,
        mapping = downloadOrderMapping,
        scope = downloadOrderScope
    ) {
        return Boolean(pair
            && !mapping?.disabledRows.has(pair.row)
            && isEligibleDownloadTpkd(pair.tpkd)
            && getDownloadActivationItemId(scope, pair.tpkd));
    }

    function isDownloadSelectionUiAvailable() {
        const lockManager = getChoiceLockManager();
        return isDownloadsPage()
            && downloadOrderRouteKey === getDownloadsOrderKey()
            && /^[0-9a-f]{64}$/.test(downloadOrderScope || '')
            && Boolean(downloadOrderMapping)
            && !downloadOrderLoadError
            && !isDownloadOrderRefreshPending()
            && Boolean(lockManager && typeof lockManager.request === 'function')
            && hasSteamAccountData();
    }

    function isDownloadActivationUiAvailable() {
        return steamSessionState.status === 'authenticated'
            && isDownloadSelectionUiAvailable();
    }

    function setDownloadRowSelectionInteraction(row, enabled) {
        if (enabled) {
            if (downloadRowInteractionState.has(row)) return;
            downloadRowInteractionState.set(row, {
                hadTabindex: row.hasAttribute?.('tabindex') || false,
                tabindex: row.getAttribute?.('tabindex'),
                hadRole: row.hasAttribute?.('role') || false,
                role: row.getAttribute?.('role'),
            });
            row.setAttribute?.('tabindex', '0');
            row.setAttribute?.('role', 'button');
            return;
        }
        const previous = downloadRowInteractionState.get(row);
        if (!previous) return;
        if (previous.hadTabindex) row.setAttribute?.('tabindex', previous.tabindex);
        else row.removeAttribute?.('tabindex');
        if (previous.hadRole) row.setAttribute?.('role', previous.role);
        else row.removeAttribute?.('role');
        downloadRowInteractionState.delete(row);
    }

    function renderSteamSessionReminder(reminder, {loggedOutMessageKey}) {
        reminder.setAttribute('role', 'status');
        reminder.setAttribute('aria-live', 'polite');
        let link = reminder.querySelector('a');
        let message = reminder.querySelector('.hb-helper-login-message');
        if (!message) {
            message = document.createElement('div');
            message.className = 'hb-helper-login-message';
            reminder.appendChild(message);
        }
        const errorPresentation = steamSessionState.status === 'error'
            || (steamSessionState.status === 'syncing' && steamSessionState.error);
        const loggedOut = steamSessionState.status === 'logged-out';
        const refreshing = steamSessionState.status === 'syncing'
            && steamSessionState.phase === 'refreshing';
        if (errorPresentation || loggedOut) {
            if (!link) {
                link = document.createElement('a');
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                reminder.insertBefore(link, reminder.firstChild);
            }
            link.href = loggedOut ? 'https://store.steampowered.com/login/' : 'https://store.steampowered.com/';
            link.textContent = t(loggedOut ? 'loginSteamCheckOwned' : 'steamRefreshLink');
            message.textContent = t(refreshing ? 'steamSessionRefreshing'
                : loggedOut ? loggedOutMessageKey : 'steamSyncError');
            let retryButton = reminder.querySelector('button');
            if (!retryButton) {
                retryButton = document.createElement('button');
                retryButton.type = 'button';
                retryButton.addEventListener('click', () => {
                    retryButton.disabled = true;
                    syncSteamSession({force: true}).finally(() => {
                        retryButton.disabled = false;
                    });
                });
                reminder.appendChild(retryButton);
            }
            retryButton.textContent = t('steamSyncRetry');
            retryButton.disabled = steamSessionState.status === 'syncing';
            return;
        }
        reminder.querySelector('button')?.remove();
        link?.remove();
        message.textContent = t(refreshing ? 'steamSessionRefreshing'
            : hasSteamAccountData() ? 'steamSessionRechecking' : 'steamSessionChecking');
    }

    function ensureDownloadLoginReminder(controls) {
        let reminder = document.getElementById('hb-helper-login-reminder');
        if (steamSessionState.status === 'authenticated' && isSteamAccountData(steamSessionState.account)) {
            reminder?.remove();
            return;
        }
        if (!reminder) {
            reminder = document.createElement('div');
            reminder.id = 'hb-helper-login-reminder';
            reminder.className = 'hb-helper-downloads-login';
        }
        renderSteamSessionReminder(reminder, {loggedOutMessageKey: 'downloadLoginSteam'});
        if (reminder.parentNode !== controls || controls.firstElementChild !== reminder) {
            controls.insertBefore(reminder, controls.firstChild);
        }
    }

    function upsertDownloadMappingSummaryWarning(controls, mapping) {
        let warning = controls.querySelector(
            '.hb-helper-download-mapping-summary-warning'
        );
        const hasApiOnlyMismatch = (mapping?.mismatches || []).some(mismatch =>
            mismatch.tpkds.length > 0 && mismatch.rows.length === 0
        );
        if (!hasApiOnlyMismatch) {
            warning?.remove();
            return;
        }
        if (!warning) {
            warning = document.createElement('div');
            warning.className = 'hb-helper-download-mapping-summary-warning';
            controls.appendChild(warning);
        }
        warning.textContent = t('downloadMappingSummaryMismatch');
    }

    function renderDownloadSelectionState() {
        if (!isDownloadsPage()) return;
        const controls = document.getElementById('hb-helper-choice-activation-controls');
        if (!controls?.classList.contains('hb-helper-downloads-controls')) return;

        const batchActive = isChoiceActivationBatchActive();
        const activationCurrent = downloadActivationInProgress
            && isActivationUiContextCurrent(downloadActivationContext);
        const controlsLocked = batchActive || activationCurrent;
        const selectionUiAvailable = isDownloadSelectionUiAvailable();
        if (!selectionUiAvailable || controlsLocked) downloadSelectionMode = false;
        for (const pair of downloadOrderMapping?.pairs || []) {
            const eligible = isDownloadMappingPairEligible(pair);
            const id = eligible
                ? getDownloadActivationItemId(downloadOrderScope, pair.tpkd)
                : null;
            pair.row.classList.toggle(
                'hb-helper-download-selected',
                Boolean(selectionUiAvailable && id && selectedDownloadItemIds.has(id))
            );
            setDownloadRowSelectionInteraction(
                pair.row,
                Boolean(downloadSelectionMode && eligible && !controlsLocked)
            );
        }
        document.documentElement.classList.toggle(
            'hb-helper-download-select-mode',
            downloadSelectionMode
        );

        const activateButton = controls.querySelector('[data-hb-helper-choice-action="activate"]');
        const selectUnownedButton = controls.querySelector(
            '[data-hb-helper-choice-action="select-unowned"]'
        );
        const selectButton = controls.querySelector('[data-hb-helper-choice-action="select"]');
        const clearButton = controls.querySelector('[data-hb-helper-choice-action="clear"]');
        if (activateButton) {
            activateButton.disabled = !isDownloadActivationUiAvailable() || controlsLocked;
        }
        for (const button of [selectUnownedButton, selectButton, clearButton]) {
            if (button) button.disabled = !selectionUiAvailable || controlsLocked;
        }
        if (selectButton) {
            setElementTextContent(
                selectButton,
                downloadSelectionMode ? t('choiceSelectDone') : t('choiceSelect')
            );
            selectButton.setAttribute('aria-pressed', String(downloadSelectionMode));
        }

        upsertDownloadMappingSummaryWarning(controls, downloadOrderMapping);
        ensureDownloadLoginReminder(controls);
        if (!activationCurrent) {
            if (downloadOrderLoadError) {
                setChoiceStatus(t('downloadOrderLoadFailed'));
            } else if (downloadOrderReloadPending) {
                setChoiceStatus(t('choiceSelectedCount', {
                    count: selectedDownloadItemIds.size,
                }));
            } else if (!globalThis.crypto?.subtle || !downloadOrderScope) {
                setChoiceStatus(t('downloadWebCryptoUnavailable'));
            } else if (!getChoiceLockManager()?.request) {
                setChoiceStatus(t('choiceWebLocksUnavailable'));
            } else if (batchActive) {
                setChoiceStatus(t('activationBusy'));
            } else if (!selectionUiAvailable) {
                setChoiceStatus(t('downloadLoginSteam'));
            } else {
                setChoiceStatus(t('choiceSelectedCount', {
                    count: selectedDownloadItemIds.size,
                }));
            }
        }
        renderChoiceActivationResults();
    }

    function setDownloadSelectionMode(enabled) {
        if (enabled && (!isDownloadSelectionUiAvailable()
            || isChoiceActivationBatchActive())) {
            return;
        }
        downloadSelectionMode = enabled;
        renderDownloadSelectionState();
    }

    async function toggleDownloadRowSelection(row) {
        if (!isDownloadSelectionUiAvailable() || isChoiceActivationBatchActive()) return;
        const pair = getDownloadMappingPairForRow(row);
        if (!isDownloadMappingPairEligible(pair)) return;
        const id = getDownloadActivationItemId(downloadOrderScope, pair.tpkd);
        return updateDownloadSelection(downloadOrderScope, selection => {
            if (selection.has(id)) selection.delete(id);
            else selection.add(id);
        });
    }

    async function isOwnedDownloadMappingPair(pair) {
        if (!ownedApps) return false;
        const rawAppId = pair.tpkd.steam_app_id;
        const numericAppId = Number(rawAppId);
        if (Number.isInteger(numericAppId) && numericAppId > 0) {
            return ownedApps.has(numericAppId) || ownedApps.has(String(rawAppId));
        }
        try {
            const app = await findSteamApp(pair.tpkd.human_name);
            return Boolean(app && (ownedApps.has(app.appid) || ownedApps.has(String(app.appid))));
        } catch (error) {
            return false;
        }
    }

    async function selectUnownedDownloadRows({isOwned = isOwnedDownloadMappingPair} = {}) {
        if (!isDownloadSelectionUiAvailable() || isChoiceActivationBatchActive()) return;
        const routeKey = downloadOrderRouteKey;
        const scope = downloadOrderScope;
        const generation = downloadOrderInitializationGeneration;
        const mapping = downloadOrderMapping;
        const isSnapshotCurrent = () =>
            routeKey === downloadOrderRouteKey
            && routeKey === getDownloadsOrderKey()
            && scope === downloadOrderScope
            && generation === downloadOrderInitializationGeneration
            && mapping === downloadOrderMapping
            && isDownloadSelectionUiAvailable()
            && !isChoiceActivationBatchActive();
        const eligiblePairs = (mapping?.pairs || [])
            .filter(pair => isDownloadMappingPairEligible(pair, mapping, scope));
        const ownership = await Promise.all(eligiblePairs.map(isOwned));
        if (!isSnapshotCurrent()) return {stale: true};
        const ids = eligiblePairs
            .filter((pair, index) => !ownership[index])
            .map(pair => getDownloadActivationItemId(scope, pair.tpkd));
        let stale = false;
        const result = await updateDownloadSelection(scope, selection => {
            if (!isSnapshotCurrent()) {
                stale = true;
                return;
            }
            selection.clear();
            ids.forEach(id => selection.add(id));
        }, {
            shouldPersist: () => {
                const current = isSnapshotCurrent();
                if (!current) stale = true;
                return current;
            },
        });
        return stale || result.aborted ? {...result, stale: true} : result;
    }

    function clearDownloadSelection() {
        if (!isDownloadSelectionUiAvailable() || isChoiceActivationBatchActive()) return;
        return updateDownloadSelection(
            downloadOrderScope,
            selection => selection.clear()
        );
    }

    function handleDownloadSelectionEvent(event) {
        if (!downloadSelectionMode
            || !isDownloadsPage()
            || !isDownloadSelectionUiAvailable()
            || isChoiceActivationBatchActive()) {
            return;
        }
        if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) {
            return;
        }
        if (event.target.closest?.('.hb-helper-region-restrictions')) return;
        const row = event.target.closest?.('.key-redeemer');
        if (!isDownloadMappingPairEligible(getDownloadMappingPairForRow(row))) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const update = toggleDownloadRowSelection(row);
        update.catch(error => {
            console.warn('[HB-Helper] Update download selection failed:', error);
        });
        return update;
    }

    function getActiveChoiceModal() {
        const modal = document.getElementById('site-modal');
        if (!modal || modal.getClientRects().length === 0) return null;
        return normalizedText(modal) ? modal : null;
    }

    function findSteamKeysInText(text) {
        return Array.from(
            String(text || '').matchAll(/\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){2,4}\b/gi),
            match => match[0].toUpperCase()
        );
    }

    function findSteamKeyInText(text) {
        return findSteamKeysInText(text)[0] || null;
    }

    function getDownloadTupleSignature(tuple) {
        return tuple ? JSON.stringify([tuple.machineName, tuple.keyindex]) : null;
    }

    function getDownloadRowNativeTuple(row) {
        const candidates = [
            row,
            ...Array.from(row.querySelectorAll?.(
                '[data-machine-name], [data-keyindex], [data-key-index]'
            ) || []),
        ];
        for (const source of candidates) {
            const machineName = source.dataset?.machineName
                || source.getAttribute?.('data-machine-name');
            const rawIndex = source.dataset?.keyindex
                ?? source.dataset?.keyIndex
                ?? source.getAttribute?.('data-keyindex')
                ?? source.getAttribute?.('data-key-index');
            if (!/^\d+$/.test(String(rawIndex ?? ''))) continue;
            const tuple = getValidDownloadTuple({
                machine_name: machineName,
                keyindex: Number(rawIndex),
            });
            if (tuple) return tuple;
        }
        return null;
    }

    function normalizeDownloadPlatform(value) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (/\bsteam\b/i.test(text)) return 'steam';
        return normalizeSteamTitle(text);
    }

    function getDownloadTpkdDisplayState(tpkd) {
        if (findSteamKeyInText(tpkd.redeemed_key_val)) return 'revealed';
        if (tpkd.is_gift === true) return 'gift';
        if (isDownloadTpkdExpired(tpkd)) return 'expired';
        if (tpkd.sold_out === true) return 'sold-out';
        return 'hidden';
    }

    function getDownloadRowDisplayState(row, displayedKey) {
        if (displayedKey) return 'revealed';
        const explicitState = row.dataset?.downloadDisplayState;
        if (isNonEmptyString(explicitState)) return explicitState.trim().toLowerCase();
        const statusElements = Array.from(row.querySelectorAll?.([
            '[data-key-state]',
            '[data-redeem-state]',
            '.key-redeemer-status',
            '.keyfield-status-message',
            '.keyfield-gifted',
            '.keyfield-expired',
            '.keyfield-sold-out',
            '.gifted-key',
            '.expired-key',
            '.sold-out',
            '.keyfield',
        ].join(', ')) || []);
        const statusText = [
            row.dataset?.keyState,
            row.dataset?.redeemState,
            row.dataset?.status,
            row.getAttribute?.('data-key-state'),
            row.getAttribute?.('data-redeem-state'),
            row.getAttribute?.('data-status'),
            row.getAttribute?.('status'),
            row.className,
            ...statusElements.flatMap(element => [
                element.dataset?.keyState,
                element.dataset?.redeemState,
                element.dataset?.status,
                element.getAttribute?.('data-key-state'),
                element.getAttribute?.('data-redeem-state'),
                element.getAttribute?.('data-status'),
                element.getAttribute?.('title'),
                element.getAttribute?.('aria-label'),
                element.className,
                normalizedText(element),
            ]),
        ].join(' ').toLowerCase();
        if (/\bgift(?:ed)?\b|赠送|礼物/.test(statusText)) return 'gift';
        if (/expired|已过期|过期/.test(statusText)) return 'expired';
        if (/sold[\s-]*out|out\s*of\s*keys|已售罄|暂无.*key/.test(statusText)) {
            return 'sold-out';
        }
        return 'hidden';
    }

    function getDownloadCompositeSignature(title, platform, displayState) {
        const normalizedTitle = normalizeSteamTitle(title);
        const normalizedPlatform = normalizeDownloadPlatform(platform);
        if (!normalizedTitle || !normalizedPlatform || !isNonEmptyString(displayState)) return null;
        return JSON.stringify([normalizedTitle, normalizedPlatform, displayState]);
    }

    function getDownloadTpkdDescriptor(tpkd, index) {
        const tuple = getValidDownloadTuple(tpkd);
        const displayedKey = findSteamKeyInText(tpkd.redeemed_key_val);
        return {
            value: tpkd,
            index,
            tuple,
            tupleSignature: getDownloadTupleSignature(tuple),
            displayedKey,
            compositeSignature: getDownloadCompositeSignature(
                tpkd.human_name || tpkd.machine_name,
                tpkd.key_type_human_name || tpkd.key_type,
                getDownloadTpkdDisplayState(tpkd)
            ),
            assigned: false,
            blocked: false,
        };
    }

    function getDownloadRowTitle(row) {
        const heading = row.querySelector?.('.heading-text');
        const headingTitle = heading?.dataset?.title
            || heading?.getAttribute?.('data-title');
        if (isNonEmptyString(headingTitle)) return headingTitle.trim();
        const headingText = heading?.querySelector?.('h4');
        if (headingText && isNonEmptyString(normalizedText(headingText))) {
            return normalizedText(headingText);
        }
        const titleElement = row.querySelector?.([
            '.human-name-title',
            '.key-redeemer-title',
            '.product-title',
            '.game-title',
            'h1',
            'h2',
            'h3',
            'h4',
        ].join(', '));
        return titleElement ? normalizedText(titleElement) : row.dataset?.humanName;
    }

    function getDownloadRowPlatform(row) {
        const platformElement = row.querySelector?.([
            '.key-type',
            '.key-type-human-name',
            '.platform',
            '.platform-name',
        ].join(', '));
        if (platformElement && isNonEmptyString(normalizedText(platformElement))) {
            return normalizedText(platformElement);
        }
        const keyfield = row.querySelector?.('.keyfield');
        const keyfieldEvidence = [
            keyfield?.dataset?.keyType,
            keyfield?.dataset?.platform,
            keyfield?.getAttribute?.('data-key-type'),
            keyfield?.getAttribute?.('data-platform'),
            keyfield?.getAttribute?.('title'),
            keyfield?.getAttribute?.('aria-label'),
            keyfield?.className,
        ].filter(isNonEmptyString).join(' ');
        return keyfieldEvidence || row.dataset?.keyType;
    }

    function getDownloadRowDescriptor(row, index) {
        const displayedKey = extractSteamKeyFromScope(row);
        const tuple = getDownloadRowNativeTuple(row);
        return {
            value: row,
            index,
            tuple,
            tupleSignature: getDownloadTupleSignature(tuple),
            displayedKey,
            compositeSignature: getDownloadCompositeSignature(
                getDownloadRowTitle(row),
                getDownloadRowPlatform(row),
                getDownloadRowDisplayState(row, displayedKey)
            ),
            assigned: false,
            blocked: false,
        };
    }

    function groupUnassignedDownloadEntries(entries, signatureKey) {
        const groups = new Map();
        for (const entry of entries) {
            const signature = entry.assigned || entry.blocked ? null : entry[signatureKey];
            if (!signature) continue;
            if (!groups.has(signature)) groups.set(signature, []);
            groups.get(signature).push(entry);
        }
        return groups;
    }

    function clearDownloadMappingWarning(row) {
        row.classList.remove('hb-helper-download-mapping-disabled');
        const previousAriaState = downloadMappingAriaState.get(row);
        if (previousAriaState) {
            if (previousAriaState.hadAriaDisabled) {
                row.setAttribute?.('aria-disabled', previousAriaState.ariaDisabled);
            } else {
                row.removeAttribute?.('aria-disabled');
            }
            downloadMappingAriaState.delete(row);
        }
        row.querySelectorAll?.('.hb-helper-download-mapping-warning')
            .forEach(warning => warning.remove());
    }

    function markDownloadMappingMismatch(rows) {
        for (const row of rows) {
            row.classList.add('hb-helper-download-mapping-disabled');
            if (!downloadMappingAriaState.has(row)) {
                downloadMappingAriaState.set(row, {
                    hadAriaDisabled: row.hasAttribute?.('aria-disabled') || false,
                    ariaDisabled: row.getAttribute?.('aria-disabled'),
                });
            }
            row.setAttribute?.('aria-disabled', 'true');
            let warning = row.querySelector?.('.hb-helper-download-mapping-warning');
            if (!warning) {
                warning = document.createElement('div');
                warning.className = 'hb-helper-download-mapping-warning';
                row.appendChild(warning);
            }
            warning.textContent = t('downloadMappingMismatch');
        }
    }

    function mapDownloadOrderRows(
        tpkds,
        rows = Array.from(document.querySelectorAll('.key-redeemer'))
    ) {
        const apiEntries = Array.from(tpkds || [], getDownloadTpkdDescriptor);
        const domEntries = Array.from(rows || [], getDownloadRowDescriptor);
        domEntries.forEach(entry => clearDownloadMappingWarning(entry.value));
        const pairs = [];
        const mismatches = [];
        const disabledRows = new Set();

        const pairEntries = (apiEntry, domEntry, matchedBy) => {
            apiEntry.assigned = true;
            domEntry.assigned = true;
            pairs.push({
                tpkd: apiEntry.value,
                row: domEntry.value,
                apiIndex: apiEntry.index,
                domIndex: domEntry.index,
                matchedBy,
            });
        };

        const recordMismatch = (signature, apiGroup, domGroup) => {
            apiGroup.forEach(entry => { entry.blocked = true; });
            domGroup.forEach(entry => { entry.blocked = true; });
            mismatches.push({
                signature,
                tpkds: apiGroup.map(entry => entry.value),
                rows: domGroup.map(entry => entry.value),
            });
        };

        const nativeApiGroups = groupUnassignedDownloadEntries(apiEntries, 'tupleSignature');
        const nativeDomGroups = groupUnassignedDownloadEntries(domEntries, 'tupleSignature');
        const sharedNativeSignatures = [...nativeApiGroups.keys()]
            .filter(signature => nativeDomGroups.has(signature));
        for (const signature of sharedNativeSignatures) {
            const apiGroup = nativeApiGroups.get(signature);
            const domGroup = nativeDomGroups.get(signature);
            if (apiGroup.length === 1 && domGroup.length === 1) {
                pairEntries(apiGroup[0], domGroup[0], 'native');
            } else if (apiGroup.length !== domGroup.length) {
                recordMismatch(signature, apiGroup, domGroup);
            }
        }
        for (const [signatureKey, matchedBy] of [
            ['displayedKey', 'displayed-key'],
            ['compositeSignature', 'composite'],
        ]) {
            const apiGroups = groupUnassignedDownloadEntries(apiEntries, signatureKey);
            const domGroups = groupUnassignedDownloadEntries(domEntries, signatureKey);
            const signatures = new Set([...apiGroups.keys(), ...domGroups.keys()]);
            for (const signature of signatures) {
                const apiGroup = apiGroups.get(signature) || [];
                const domGroup = domGroups.get(signature) || [];
                if (apiGroup.length > 0 && apiGroup.length === domGroup.length) {
                    apiGroup.forEach((apiEntry, index) => {
                        pairEntries(apiEntry, domGroup[index], matchedBy);
                    });
                } else {
                    recordMismatch(signature, apiGroup, domGroup);
                }
            }
        }

        const unmatchedApiEntries = apiEntries.filter(entry =>
            !entry.assigned && !entry.blocked
        );
        const unmatchedDomEntries = domEntries.filter(entry =>
            !entry.assigned && !entry.blocked
        );
        if (unmatchedApiEntries.some(entry => !entry.compositeSignature)
            || unmatchedDomEntries.some(entry => !entry.compositeSignature)) {
            recordMismatch(
                null,
                unmatchedApiEntries.filter(entry => !entry.compositeSignature),
                unmatchedDomEntries.filter(entry => !entry.compositeSignature)
            );
        }
        for (const mismatch of mismatches) {
            mismatch.rows.forEach(row => disabledRows.add(row));
            markDownloadMappingMismatch(mismatch.rows);
        }
        const duplicateTupleSignatures = new Set(
            [...nativeApiGroups.entries()]
                .filter(([, group]) => group.length > 1)
                .map(([signature]) => signature)
        );
        const duplicateIdRows = new Set();
        for (const pair of pairs) {
            const tupleSignature = getDownloadTupleSignature(
                getValidDownloadTuple(pair.tpkd)
            );
            if (!duplicateTupleSignatures.has(tupleSignature)) continue;
            duplicateIdRows.add(pair.row);
            disabledRows.add(pair.row);
            markDownloadMappingMismatch([pair.row]);
        }
        return {
            pairs: pairs.sort((left, right) => left.apiIndex - right.apiIndex),
            mismatches,
            disabledRows,
            duplicateIdRows,
            unmatchedTpks: apiEntries.filter(entry => !entry.assigned).map(entry => entry.value),
            unmatchedRows: domEntries.filter(entry => !entry.assigned).map(entry => entry.value),
        };
    }

    function getDownloadRegionDisclosureContext(mapping) {
        const tpkds = downloadOrderData?.tpkd_dict?.all_tpks;
        if (!/^[0-9a-f]{64}$/.test(downloadOrderScope || '')
            || !Array.isArray(tpkds)
            || !mapping
            || !Array.isArray(mapping.pairs)
            || !Array.isArray(mapping.mismatches)
            || !Array.isArray(mapping.unmatchedTpks)
            || !Array.isArray(mapping.unmatchedRows)
            || !(mapping.disabledRows instanceof Set)
            || !(mapping.duplicateIdRows instanceof Set)
            || mapping.pairs.length !== tpkds.length
            || mapping.mismatches.length
            || mapping.unmatchedTpks.length
            || mapping.unmatchedRows.length
            || mapping.disabledRows?.size
            || mapping.duplicateIdRows?.size) {
            return null;
        }
        const entries = [];
        const identities = new Set();
        const indexes = new Set();
        const rows = new Set();
        const fallbackEvidence = new Set();
        for (const pair of mapping.pairs) {
            const apiIndex = pair?.apiIndex;
            const tuple = getValidDownloadTuple(pair?.tpkd);
            const currentTuple = Number.isInteger(apiIndex)
                ? getValidDownloadTuple(tpkds[apiIndex])
                : null;
            const apiDescriptor = getDownloadTpkdDescriptor(pair?.tpkd);
            const rowDescriptor = pair?.row
                ? getDownloadRowDescriptor(pair.row)
                : null;
            if (!tuple
                || !currentTuple
                || tuple.machineName !== currentTuple.machineName
                || tuple.keyindex !== currentTuple.keyindex
                || apiIndex < 0
                || apiIndex >= tpkds.length
                || !pair.row
                || indexes.has(apiIndex)
                || rows.has(pair.row)) {
                return null;
            }
            let matchEvidence;
            if (pair.matchedBy === 'native') {
                if (!apiDescriptor.tupleSignature
                    || apiDescriptor.tupleSignature !== rowDescriptor.tupleSignature) {
                    return null;
                }
            } else if (pair.matchedBy === 'displayed-key') {
                matchEvidence = apiDescriptor.displayedKey;
                if (!matchEvidence || matchEvidence !== rowDescriptor.displayedKey) return null;
            } else if (pair.matchedBy === 'composite') {
                matchEvidence = apiDescriptor.compositeSignature;
                if (!matchEvidence || matchEvidence !== rowDescriptor.compositeSignature) return null;
            } else {
                return null;
            }
            if (matchEvidence) {
                const evidenceIdentity = JSON.stringify([pair.matchedBy, matchEvidence]);
                if (fallbackEvidence.has(evidenceIdentity)) return null;
                fallbackEvidence.add(evidenceIdentity);
            }
            const identity = JSON.stringify([
                downloadOrderScope,
                apiIndex,
                tuple.machineName,
                tuple.keyindex,
            ]);
            if (identities.has(identity)) return null;
            identities.add(identity);
            indexes.add(apiIndex);
            rows.add(pair.row);
            entries.push({identity, pair});
        }
        entries.sort((left, right) => left.pair.apiIndex - right.pair.apiIndex);
        return {
            scope: downloadOrderScope,
            identities: entries.map(entry => entry.identity),
            entries,
        };
    }

    function hasSameDownloadRegionDisclosureContext(state, context) {
        return Boolean(state)
            && Boolean(context)
            && state.scope === context.scope
            && state.identities.length === context.identities.length
            && state.identities.every((identity, index) =>
                identity === context.identities[index]);
    }

    function captureDownloadRegionDisclosureState(mapping = downloadOrderMapping) {
        const context = getDownloadRegionDisclosureContext(mapping);
        if (!context) {
            downloadRegionDisclosureState = undefined;
            return null;
        }
        if (!hasSameDownloadRegionDisclosureContext(downloadRegionDisclosureState, context)) {
            downloadRegionDisclosureState = undefined;
            return context;
        }
        downloadRegionDisclosureState.openIdentities = new Set(
            downloadRegionDisclosureState.identities.filter(identity =>
                downloadRegionDisclosureState.disclosures.get(identity)?.open)
        );
        return context;
    }

    function upsertDownloadRegionWarnings(mapping) {
        const disclosureContext = captureDownloadRegionDisclosureState(mapping);
        const openIdentities = hasSameDownloadRegionDisclosureContext(
            downloadRegionDisclosureState,
            disclosureContext
        ) ? downloadRegionDisclosureState.openIdentities : new Set();
        const disclosureIdentities = new Map(
            disclosureContext?.entries.map(({identity, pair}) => [pair, identity]) || []
        );
        const disclosures = new Map();
        const staleRows = new Set([
            ...(Array.isArray(mapping?.unmatchedRows) ? mapping.unmatchedRows : []),
            ...(mapping?.disabledRows instanceof Set ? mapping.disabledRows : []),
        ]);
        for (const row of staleRows) {
            row.querySelectorAll?.([
                '.hb-helper-download-region-warning',
                '.hb-helper-region-restrictions',
            ].join(', ')).forEach(panel => panel.remove());
        }
        for (const pair of mapping?.pairs || []) {
            const {tpkd, row} = pair;
            row.querySelectorAll?.([
                '.hb-helper-download-region-warning',
                '.hb-helper-region-restrictions',
            ].join(', ')).forEach(panel => panel.remove());
            const panel = createRegionRestrictionPanel(
                tpkd,
                steamSessionState.account?.countryCode || null
            );
            if (!panel) continue;
            const identity = disclosureIdentities.get(pair);
            const disclosure = panel.querySelector?.(
                '.hb-helper-region-restrictions__details'
            );
            if (identity && disclosure) {
                disclosure.open = openIdentities.has(identity);
                disclosures.set(identity, disclosure);
            }
            const container = row.querySelector?.('.disclaimer') || row;
            container.appendChild(panel);
        }
        downloadRegionDisclosureState = disclosureContext ? {
            scope: disclosureContext.scope,
            identities: disclosureContext.identities,
            openIdentities: new Set(openIdentities),
            disclosures,
        } : undefined;
    }

    function extractUniqueSteamKeyFromScope(scope) {
        const keys = new Set();
        for (const input of scope.querySelectorAll('input, textarea')) {
            if (!isVisibleElement(input)) continue;
            findSteamKeysInText(input.value).forEach(key => keys.add(key));
        }
        for (const keyField of scope.querySelectorAll('.keyfield-value')) {
            if (!isVisibleElement(keyField)) continue;
            findSteamKeysInText(normalizedText(keyField)).forEach(key => keys.add(key));
        }
        return keys.size === 1 ? keys.values().next().value : null;
    }

    function extractSteamKeyFromScope(scope) {
        return extractUniqueSteamKeyFromScope(scope);
    }

    function isVisibleElement(element) {
        return !element.disabled && element.getClientRects().length > 0;
    }

    async function closeChoiceModal(modal = getActiveChoiceModal()) {
        const activeModal = getActiveChoiceModal();
        if (!activeModal) return true;
        if (!modal || activeModal !== modal) return false;
        const closeButton = Array.from(
            modal.querySelectorAll('button, a, [role="button"]')
        ).find(element => {
            const text = [
                element.textContent,
                element.getAttribute('aria-label'),
                element.getAttribute('title'),
                element.className,
            ].join(' ');
            return isVisibleElement(element) && /(close|dismiss|×|关闭|取消)/i.test(text);
        });
        if (closeButton) closeButton.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        return Boolean(await waitForCondition(() => !getActiveChoiceModal(), 1200));
    }

    function isChoiceModalForTile(modal, tile) {
        const modalTitle = normalizeSteamTitle(normalizedText(findChoiceModalTitle(modal)));
        const tileTitle = normalizeSteamTitle(getChoiceTileTitle(tile));
        return Boolean(modalTitle && tileTitle && modalTitle === tileTitle);
    }

    function getSmallestNonSkippedChoiceKeyIndex(skipIndexes) {
        let keyIndex = 0;
        while (skipIndexes.has(keyIndex)) keyIndex += 1;
        return keyIndex;
    }

    function createChoiceModalCloseError(tile, keyIndex = 0) {
        const error = new Error(t('choiceModalCloseFailed', {title: getChoiceTileTitle(tile)}));
        error.choiceModalUnsafe = true;
        error.keyIndex = keyIndex;
        return error;
    }

    function createChoiceKeyFailure(keyIndex) {
        return {
            keyIndex,
            key: null,
            error: t('choiceHumbleFailureReason'),
        };
    }

    function getChoiceKeyRowTerminalState(row) {
        if (row.classList?.contains('redeemed')
            || row.querySelector('.js-keyfield.keyfield.redeemed')) {
            return 'redeemed';
        }
        if (row.classList?.contains('error') || row.querySelector('.error')) {
            return 'error';
        }
        return null;
    }

    function inspectLockedChoiceModal(modal, tile, initialRows = null) {
        const activeModal = getActiveChoiceModal();
        if (activeModal !== modal || !isChoiceModalForTile(modal, tile)) {
            return {fatal: true};
        }
        const rows = Array.from(modal.querySelectorAll('.key-redeemer'));
        if (modal.querySelector('.js-select-choice-container.error')
            || (initialRows && (rows.length !== initialRows.length
                || rows.some((row, index) => row !== initialRows[index])))) {
            return {fatal: true, rows};
        }
        return {fatal: false, rows};
    }

    function appendChoiceKeyFailures(outcomes, startIndex, rowCount, skipIndexes) {
        for (let keyIndex = startIndex; keyIndex < rowCount; keyIndex++) {
            if (!skipIndexes.has(keyIndex)) {
                outcomes.push(createChoiceKeyFailure(keyIndex));
            }
        }
    }

    function createChoiceFailClosedOutcomes(rowCount, skipIndexes) {
        const outcomes = [];
        appendChoiceKeyFailures(outcomes, 0, rowCount, skipIndexes);
        if (outcomes.length === 0) {
            outcomes.push(createChoiceKeyFailure(
                getSmallestNonSkippedChoiceKeyIndex(skipIndexes)
            ));
        }
        return outcomes;
    }

    async function revealChoiceSteamKeys(
        tile,
        {skipIndexes = new Set(), isContextCurrent = () => true} = {}
    ) {
        const requestedSkipIndexes = Array.from(skipIndexes);
        const invalidSkipIndex = requestedSkipIndexes.some(
            keyIndex => !Number.isSafeInteger(keyIndex) || keyIndex < 0
        );
        const skipped = new Set(requestedSkipIndexes.filter(
            keyIndex => Number.isSafeInteger(keyIndex) && keyIndex >= 0
        ));
        const firstNonSkippedIndex = getSmallestNonSkippedChoiceKeyIndex(skipped);
        if (!isContextCurrent()) return [createChoiceKeyFailure(firstNonSkippedIndex)];
        const activeModalBeforeClick = getActiveChoiceModal();
        if (activeModalBeforeClick && !await closeChoiceModal(activeModalBeforeClick)) {
            throw createChoiceModalCloseError(tile, firstNonSkippedIndex);
        }
        if (getActiveChoiceModal()) {
            throw createChoiceModalCloseError(tile, firstNonSkippedIndex);
        }
        if (!isContextCurrent()) return [createChoiceKeyFailure(firstNonSkippedIndex)];
        tile.click();
        const modal = await waitForCondition(() => {
            if (!isContextCurrent()) return {stale: true};
            const activeModal = getActiveChoiceModal();
            return activeModal && isChoiceModalForTile(activeModal, tile) ? activeModal : null;
        }, 8000);
        if (modal?.stale) return [createChoiceKeyFailure(firstNonSkippedIndex)];
        if (!modal) {
            const unmatchedModal = getActiveChoiceModal();
            if (unmatchedModal && (!isChoiceModalForTile(unmatchedModal, tile)
                || !await closeChoiceModal(unmatchedModal))) {
                throw createChoiceModalCloseError(tile, firstNonSkippedIndex);
            }
            return [createChoiceKeyFailure(firstNonSkippedIndex)];
        }

        try {
            const baseline = await waitForCondition(() => {
                if (!isContextCurrent()) return {stale: true};
                const current = inspectLockedChoiceModal(modal, tile);
                if (current.fatal) return current;
                return current.rows.length > 0 ? current : null;
            }, 8000);
            if (!baseline) {
                return [createChoiceKeyFailure(firstNonSkippedIndex)];
            }
            if (baseline.stale) return [createChoiceKeyFailure(firstNonSkippedIndex)];
            if (baseline.fatal) {
                return baseline.rows?.length
                    ? createChoiceFailClosedOutcomes(baseline.rows.length, skipped)
                    : [createChoiceKeyFailure(firstNonSkippedIndex)];
            }
            const initialRows = baseline.rows;
            const rowCount = initialRows.length;
            if (invalidSkipIndex || [...skipped].some(keyIndex => keyIndex >= rowCount)) {
                return createChoiceFailClosedOutcomes(rowCount, skipped);
            }

            const outcomes = [];
            for (let keyIndex = 0; keyIndex < rowCount; keyIndex++) {
                if (skipped.has(keyIndex)) continue;
                if (!isContextCurrent()) {
                    appendChoiceKeyFailures(outcomes, keyIndex, rowCount, skipped);
                    break;
                }
                const inspection = inspectLockedChoiceModal(modal, tile, initialRows);
                if (inspection.fatal) {
                    appendChoiceKeyFailures(outcomes, keyIndex, rowCount, skipped);
                    break;
                }

                const row = inspection.rows[keyIndex];
                const initialState = getChoiceKeyRowTerminalState(row);
                if (initialState === 'redeemed') {
                    const key = extractUniqueSteamKeyFromScope(row);
                    outcomes.push(key
                        ? {keyIndex, key}
                        : createChoiceKeyFailure(keyIndex));
                    continue;
                }
                if (initialState === 'error') {
                    outcomes.push(createChoiceKeyFailure(keyIndex));
                    continue;
                }

                const revealControl = row.querySelector('.js-keyfield.keyfield.enabled');
                if (!revealControl || !isVisibleElement(revealControl)) {
                    outcomes.push(createChoiceKeyFailure(keyIndex));
                    continue;
                }
                revealControl.click();

                const terminal = await waitForCondition(() => {
                    if (!isContextCurrent()) return {stale: true};
                    const current = inspectLockedChoiceModal(modal, tile, initialRows);
                    if (current.fatal) return current;
                    const currentRow = current.rows[keyIndex];
                    const state = getChoiceKeyRowTerminalState(currentRow);
                    if (state === 'redeemed') {
                        return {fatal: false, state: 'redeemed', row: currentRow};
                    }
                    if (state === 'error') {
                        return {fatal: false, state: 'error', row: currentRow};
                    }
                    return null;
                }, 60000);
                if (terminal?.stale) {
                    appendChoiceKeyFailures(outcomes, keyIndex, rowCount, skipped);
                    break;
                }
                if (!terminal || terminal.fatal) {
                    appendChoiceKeyFailures(outcomes, keyIndex, rowCount, skipped);
                    break;
                }
                if (terminal.state === 'error') {
                    outcomes.push(createChoiceKeyFailure(keyIndex));
                    continue;
                }
                const key = extractUniqueSteamKeyFromScope(terminal.row);
                outcomes.push(key
                    ? {keyIndex, key}
                    : createChoiceKeyFailure(keyIndex));
            }
            return outcomes;
        } finally {
            const activeModal = getActiveChoiceModal();
            if (activeModal && (!isChoiceModalForTile(activeModal, tile)
                || !await closeChoiceModal(activeModal))) {
                throw createChoiceModalCloseError(tile, firstNonSkippedIndex);
            }
        }
    }

    function postHumbleDownloadKey(tpkd, orderKey) {
        const tuple = getValidDownloadTuple(tpkd);
        if (!tuple || !isNonEmptyString(orderKey)) {
            return Promise.reject(new Error(t('downloadHumbleFailureReason')));
        }
        const data = new URLSearchParams({
            keytype: tuple.machineName,
            key: orderKey,
            keyindex: String(tuple.keyindex),
        }).toString();
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${location.origin}/humbler/redeemkey`,
                data,
                responseType: 'json',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                timeout: gmRequestTimeoutMs,
                onload: ({status, response, responseText}) => {
                    if (status < 200 || status >= 300) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    try {
                        const parsed = response || JSON.parse(responseText || '{}');
                        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                            throw new Error(t('downloadHumbleFailureReason'));
                        }
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(t('downloadHumbleFailureReason')));
                    }
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
                ontimeout: () => reject(new Error(t('requestTimedOut'))),
            });
        });
    }

    async function revealDownloadSteamKey(
        tpkd,
        {
            orderKey = getDownloadsOrderKey(),
            postReveal = postHumbleDownloadKey,
            reloadOrder = async () => {
                invalidateDownloadOrder();
                return loadDownloadOrder(orderKey);
            },
        } = {}
    ) {
        const existingKey = findSteamKeyInText(tpkd?.redeemed_key_val);
        if (existingKey) return existingKey;
        if (!isEligibleDownloadTpkd(tpkd) || !isNonEmptyString(orderKey)) {
            throw new Error(t('downloadHumbleFailureReason'));
        }

        const response = await postReveal(tpkd, orderKey);
        if (response?.success !== true) {
            throw new Error(t('downloadHumbleFailureReason'));
        }
        const revealedKey = findSteamKeyInText(response.key);
        if (revealedKey) return revealedKey;

        const tuple = getValidDownloadTuple(tpkd);
        const refreshedOrder = validateDownloadOrder(await reloadOrder(), orderKey);
        const matches = refreshedOrder.tpkd_dict.all_tpks.filter(candidate => {
            const candidateTuple = getValidDownloadTuple(candidate);
            return candidateTuple
                && candidateTuple.machineName === tuple.machineName
                && candidateTuple.keyindex === tuple.keyindex;
        });
        const refreshedKey = matches.length === 1
            ? findSteamKeyInText(matches[0].redeemed_key_val)
            : null;
        if (!refreshedKey) throw new Error(t('downloadHumbleFailureReason'));
        return refreshedKey;
    }

    function getChoiceLockManager(lockManager) {
        if (lockManager !== undefined) return lockManager;
        return typeof navigator !== 'undefined' ? navigator.locks : null;
    }

    async function requestChoiceExclusiveLock(
        name,
        callback,
        {lockManager, ifAvailable = false} = {}
    ) {
        const manager = getChoiceLockManager(lockManager);
        if (!manager || typeof manager.request !== 'function') {
            return {
                acquired: false,
                unsupported: true,
                message: t('choiceWebLocksUnavailable'),
            };
        }

        return manager.request(
            name,
            {mode: 'exclusive', ...(ifAvailable ? {ifAvailable: true} : {})},
            async lock => {
                if (!lock) return {acquired: false, unsupported: false};
                return {
                    acquired: true,
                    unsupported: false,
                    value: await callback(),
                };
            }
        );
    }

    function createChoiceActivationBatch(owner = choiceRuntimeOwnerId, now = Date.now()) {
        const randomId = typeof crypto !== 'undefined'
            && crypto
            && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return {
            version: choiceActivationBatchVersion,
            id: randomId,
            state: choiceActivationBatchStates.collecting,
            runner: {
                phase: choiceActivationBatchStates.collecting,
                owner,
                leaseExpiresAt: now + choiceActivationRunnerLeaseMs,
            },
            ownershipRefresh: {
                state: choiceActivationOwnershipStates.waiting,
                owner: null,
                leaseExpiresAt: null,
                error: null,
            },
            items: [],
        };
    }

    function hasOnlyKeys(value, allowedKeys) {
        return value
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.keys(value).every(key => allowedKeys.includes(key));
    }

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function encodeChoiceActivationItemId(gameId, keyIndex) {
        if (!isNonEmptyString(gameId)
            || !Number.isSafeInteger(keyIndex)
            || keyIndex < 0) {
            throw new TypeError('Choice key IDs require a game ID and non-negative safe index.');
        }
        return `${choiceActivationItemIdPrefix}${keyIndex}:${encodeURIComponent(gameId)}`;
    }

    function decodeChoiceActivationItemId(rawId) {
        if (!isNonEmptyString(rawId)) return null;
        if (!rawId.startsWith(choiceActivationItemIdPrefix)) {
            return {gameId: rawId, keyIndex: 0};
        }

        const encodedSlot = rawId.slice(choiceActivationItemIdPrefix.length);
        const separatorIndex = encodedSlot.indexOf(':');
        if (separatorIndex <= 0) return null;
        const indexText = encodedSlot.slice(0, separatorIndex);
        const encodedGameId = encodedSlot.slice(separatorIndex + 1);
        if (!/^(?:0|[1-9]\d*)$/.test(indexText) || !encodedGameId) return null;
        const keyIndex = Number(indexText);
        if (!Number.isSafeInteger(keyIndex)) return null;

        try {
            const gameId = decodeURIComponent(encodedGameId);
            if (!isNonEmptyString(gameId)
                || encodeURIComponent(gameId) !== encodedGameId) {
                return null;
            }
            return {gameId, keyIndex};
        } catch (_) {
            return null;
        }
    }

    function isValidChoiceActivationItem(item) {
        if (!hasOnlyKeys(item, ['id', 'title', 'key', 'status', 'error', 'code'])
            || !isNonEmptyString(item.id)
            || !decodeChoiceActivationItemId(item.id)
            || !isNonEmptyString(item.title)
            || !Object.values(choiceActivationItemStates).includes(item.status)
            || (item.key !== null && !isNonEmptyString(item.key))
            || (item.error !== undefined && !isNonEmptyString(item.error))
            || (item.code !== undefined
                && item.code !== null
                && !(typeof item.code === 'number' && Number.isFinite(item.code))
                && !isNonEmptyString(item.code))) {
            return false;
        }

        if (item.status === choiceActivationItemStates.humbleFailed) {
            return item.key === null && isNonEmptyString(item.error) && item.code === undefined;
        }
        if ([
            choiceActivationItemStates.pending,
            choiceActivationItemStates.activating,
        ].includes(item.status)) {
            return isNonEmptyString(item.key)
                && item.error === undefined
                && item.code === undefined;
        }
        if (item.status === choiceActivationItemStates.activated) {
            return item.key === null && item.error === undefined && item.code === undefined;
        }
        return isNonEmptyString(item.key) && isNonEmptyString(item.error);
    }

    function isValidChoiceActivationRunner(runner, batchState) {
        if (!runner
            || Object.keys(runner).sort().join(',') !== 'leaseExpiresAt,owner,phase') {
            return false;
        }
        if (batchState === choiceActivationBatchStates.collecting) {
            return runner.phase === choiceActivationBatchStates.collecting
                && isNonEmptyString(runner.owner)
                && Number.isFinite(runner.leaseExpiresAt)
                && runner.leaseExpiresAt > 0;
        }
        if (batchState === choiceActivationBatchStates.activating) {
            return runner.phase === choiceActivationBatchStates.activating
                && ((runner.owner === null && runner.leaseExpiresAt === null)
                    || (isNonEmptyString(runner.owner)
                        && Number.isFinite(runner.leaseExpiresAt)
                        && runner.leaseExpiresAt > 0));
        }
        return runner.phase === null
            && runner.owner === null
            && runner.leaseExpiresAt === null;
    }

    function isValidChoiceOwnershipRefresh(refresh, batchState) {
        if (!refresh
            || Object.keys(refresh).sort().join(',') !== 'error,leaseExpiresAt,owner,state'
            || !Object.values(choiceActivationOwnershipStates).includes(refresh.state)) {
            return false;
        }
        if (batchState !== choiceActivationBatchStates.complete) {
            return refresh.state === choiceActivationOwnershipStates.waiting
                && refresh.owner === null
                && refresh.leaseExpiresAt === null
                && refresh.error === null;
        }
        if (refresh.state === choiceActivationOwnershipStates.refreshing) {
            return isNonEmptyString(refresh.owner)
                && Number.isFinite(refresh.leaseExpiresAt)
                && refresh.leaseExpiresAt > 0
                && refresh.error === null;
        }
        if (refresh.state === choiceActivationOwnershipStates.failed) {
            return refresh.owner === null
                && refresh.leaseExpiresAt === null
                && isNonEmptyString(refresh.error);
        }
        return [
            choiceActivationOwnershipStates.pending,
            choiceActivationOwnershipStates.complete,
        ].includes(refresh.state)
            && refresh.owner === null
            && refresh.leaseExpiresAt === null
            && refresh.error === null;
    }

    function isChoiceActivationBatch(batch) {
        if (!hasOnlyKeys(
            batch,
            ['version', 'id', 'state', 'runner', 'ownershipRefresh', 'items']
        )) {
            return false;
        }
        if (batch.version !== choiceActivationBatchVersion
            || !isNonEmptyString(batch.id)
            || !Object.values(choiceActivationBatchStates).includes(batch.state)
            || !Array.isArray(batch.items)
            || !isValidChoiceActivationRunner(batch.runner, batch.state)
            || !isValidChoiceOwnershipRefresh(batch.ownershipRefresh, batch.state)
            || !batch.items.every(isValidChoiceActivationItem)) {
            return false;
        }
        if (batch.items.length > 0 && !inferActivationBatchScope(batch)) return false;

        const decodedSlots = new Set();
        for (const item of batch.items) {
            const decoded = decodeChoiceActivationItemId(item.id);
            const slot = JSON.stringify([decoded.gameId, decoded.keyIndex]);
            if (decodedSlots.has(slot)) return false;
            decodedSlots.add(slot);
        }

        const statuses = new Set(batch.items.map(item => item.status));
        if (batch.state === choiceActivationBatchStates.collecting) {
            return [...statuses].every(status => [
                choiceActivationItemStates.activated,
                choiceActivationItemStates.humbleFailed,
                choiceActivationItemStates.pending,
            ].includes(status));
        }
        if (batch.items.length === 0) return false;
        if (batch.state === choiceActivationBatchStates.complete) {
            return !statuses.has(choiceActivationItemStates.pending)
                && !statuses.has(choiceActivationItemStates.activating);
        }
        return true;
    }

    function getChoiceActivationBatch(value = GM_getValue(steamActivationBatchKey, null)) {
        return isChoiceActivationBatch(value) ? value : null;
    }

    function isChoiceActivationBatchActive(batch = getChoiceActivationBatch()) {
        if (!batch) return false;
        if ([
            choiceActivationBatchStates.collecting,
            choiceActivationBatchStates.activating,
        ].includes(batch.state)) {
            return true;
        }
        return batch.state === choiceActivationBatchStates.complete
            && [
                choiceActivationOwnershipStates.pending,
                choiceActivationOwnershipStates.refreshing,
            ].includes(batch.ownershipRefresh.state);
    }

    function saveChoiceActivationBatchIfCurrent(batch, expected = {}) {
        if (!isChoiceActivationBatch(batch)) return false;
        const current = getChoiceActivationBatch();
        if (!current || current.id !== batch.id) return false;
        if (Object.prototype.hasOwnProperty.call(expected, 'state')
            && current.state !== expected.state) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'runnerOwner')
            && current.runner.owner !== expected.runnerOwner) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'refreshOwner')
            && current.ownershipRefresh.owner !== expected.refreshOwner) {
            return false;
        }

        GM_setValue(steamActivationBatchKey, batch);
        const stored = getChoiceActivationBatch();
        return Boolean(stored
            && stored.id === batch.id
            && JSON.stringify(stored) === JSON.stringify(batch));
    }

    function requireLockScopedBatchPersistence(saveBatch) {
        if (typeof saveBatch !== 'function') {
            throw new Error('A lock-scoped persistence callback is required.');
        }
        return saveBatch;
    }

    function getChoiceCollectionRetryStates(previousBatch, selectedItems) {
        const states = new Map(selectedItems.map(item => [item.id, {
            activatedIndexes: new Set(),
            knownComplete: false,
        }]));
        if (previousBatch?.state !== choiceActivationBatchStates.complete) return states;

        const previousGroups = new Map();
        for (const item of previousBatch.items) {
            const decoded = decodeChoiceActivationItemId(item.id);
            if (!decoded || !states.has(decoded.gameId)) continue;
            if (!previousGroups.has(decoded.gameId)) previousGroups.set(decoded.gameId, []);
            previousGroups.get(decoded.gameId).push({
                item,
                keyIndex: decoded.keyIndex,
                composite: item.id.startsWith(choiceActivationItemIdPrefix),
            });
        }

        for (const [gameId, entries] of previousGroups) {
            const state = states.get(gameId);
            entries.forEach(entry => {
                if (entry.item.status === choiceActivationItemStates.activated) {
                    state.activatedIndexes.add(entry.keyIndex);
                }
            });
            const representedIndexes = entries
                .map(entry => entry.keyIndex)
                .sort((left, right) => left - right);
            const highestIndex = representedIndexes.at(-1);
            state.knownComplete = entries.length > 0
                && entries.every(entry => entry.composite)
                && entries.every(entry =>
                    entry.item.status === choiceActivationItemStates.activated
                )
                && entries.length === highestIndex + 1
                && representedIndexes.every((keyIndex, index) => keyIndex === index);
        }
        return states;
    }

    function appendChoiceActivatedMarkers(batch, selectedItems, retryStates) {
        for (const selectedItem of selectedItems) {
            const state = retryStates.get(selectedItem.id);
            for (const keyIndex of [...state.activatedIndexes].sort((left, right) => left - right)) {
                batch.items.push({
                    id: encodeChoiceActivationItemId(selectedItem.id, keyIndex),
                    title: selectedItem.title,
                    key: null,
                    status: choiceActivationItemStates.activated,
                });
            }
        }
    }

    function createChoiceCollectionFailureItem(selectedItem, keyIndex, error) {
        return {
            id: encodeChoiceActivationItemId(selectedItem.id, keyIndex),
            title: selectedItem.title,
            key: null,
            status: choiceActivationItemStates.humbleFailed,
            error: error || t('choiceHumbleFailureReason'),
        };
    }

    function createChoiceCollectionItems(selectedItem, outcomes, skipIndexes) {
        if (!Array.isArray(outcomes)) throw new TypeError('Choice reveal outcomes must be an array.');
        const items = [];
        let previousIndex = -1;
        for (const outcome of outcomes) {
            if (!hasOnlyKeys(outcome, ['keyIndex', 'key', 'error'])
                || !Number.isSafeInteger(outcome.keyIndex)
                || outcome.keyIndex < 0
                || outcome.keyIndex <= previousIndex
                || skipIndexes.has(outcome.keyIndex)
                || (outcome.key !== null && !isNonEmptyString(outcome.key))
                || (outcome.key === null && !isNonEmptyString(outcome.error))
                || (outcome.key !== null && outcome.error !== undefined)) {
                throw new TypeError('Choice reveal outcomes must contain unique row-ordered slots.');
            }
            previousIndex = outcome.keyIndex;
            items.push(outcome.key
                ? {
                    id: encodeChoiceActivationItemId(selectedItem.id, outcome.keyIndex),
                    title: selectedItem.title,
                    key: outcome.key,
                    status: choiceActivationItemStates.pending,
                }
                : createChoiceCollectionFailureItem(
                    selectedItem,
                    outcome.keyIndex,
                    outcome.error
                ));
        }
        return items;
    }

    async function collectSingleKeyActivationBatch(
        batch,
        selectedItems,
        revealKey,
        saveBatch,
        {isContextCurrent = () => true} = {}
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        if (typeof revealKey !== 'function') {
            throw new TypeError('A single-key reveal callback is required.');
        }
        for (const selectedItem of selectedItems) {
            if (!isContextCurrent()) return {stale: true};
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
            let key = null;
            let error;
            try {
                key = await revealKey(selectedItem);
            } catch (reason) {
                error = reason?.message;
            }
            const contextStale = !isContextCurrent();
            batch.items.push({
                id: selectedItem.id,
                title: selectedItem.title,
                key: key || null,
                status: key
                    ? choiceActivationItemStates.pending
                    : choiceActivationItemStates.humbleFailed,
                ...(key ? {} : {error: error || t('choiceHumbleFailureReason')}),
            });
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
            if (contextStale || !isContextCurrent()) return {stale: true};
        }
        return true;
    }

    async function collectChoiceActivationBatch(
        batch,
        selectedItems,
        retryStates,
        revealKeys,
        saveBatch,
        {isContextCurrent = () => true} = {}
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        for (const selectedItem of selectedItems) {
            const retryState = retryStates.get(selectedItem.id);
            if (retryState.knownComplete) continue;
            if (!isContextCurrent()) return {stale: true};
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
            let freshItems;
            let unsafeModal = false;
            try {
                const outcomes = await revealKeys(selectedItem, {
                    skipIndexes: new Set(retryState.activatedIndexes),
                    isContextCurrent,
                });
                freshItems = createChoiceCollectionItems(
                    selectedItem,
                    outcomes,
                    retryState.activatedIndexes
                );
            } catch (reason) {
                unsafeModal = reason?.choiceModalUnsafe === true;
                const keyIndex = Number.isSafeInteger(reason?.keyIndex)
                    && reason.keyIndex >= 0
                    && !retryState.activatedIndexes.has(reason.keyIndex)
                    ? reason.keyIndex
                    : getSmallestNonSkippedChoiceKeyIndex(retryState.activatedIndexes);
                freshItems = [createChoiceCollectionFailureItem(
                    selectedItem,
                    keyIndex,
                    reason?.message
                )];
            }
            const contextStale = !isContextCurrent();
            batch.items.push(...freshItems);
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
            if (contextStale || !isContextCurrent()) return {stale: true};
            if (unsafeModal) break;
        }
        return true;
    }

    function finishChoiceActivationCollection(batch, saveBatch) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        const pendingCount = batch.items.filter(
            item => item.status === choiceActivationItemStates.pending
        ).length;
        if (batch.state !== choiceActivationBatchStates.collecting) return pendingCount;
        if (pendingCount === 0) {
            batch.state = choiceActivationBatchStates.complete;
            batch.runner = {phase: null, owner: null, leaseExpiresAt: null};
            batch.ownershipRefresh = {
                state: choiceActivationOwnershipStates.pending,
                owner: null,
                leaseExpiresAt: null,
                error: null,
            };
        } else {
            batch.state = choiceActivationBatchStates.activating;
            batch.runner = {
                phase: choiceActivationBatchStates.activating,
                owner: batch.runner.owner,
                leaseExpiresAt: Date.now() + choiceActivationRunnerLeaseMs,
            };
        }
        const saved = persist(batch);
        if (saved === false) return null;
        return pendingCount;
    }

    async function runChoiceCollectionWork(
        selectedItems,
        {
            lockManager,
            revealKey,
            revealKeys,
            owner = choiceRuntimeOwnerId,
            onBatchStarted = () => {},
            onProgress = () => {},
            isContextCurrent = () => true,
            selectionScope,
        } = {}
    ) {
        const candidates = Array.isArray(selectedItems)
            ? selectedItems.map(item => ({...item}))
            : selectedItems;
        const initialPreflight = preflightActivationSelection(candidates);
        if (!initialPreflight.valid
            || (selectionScope
                && !activationScopesMatch(selectionScope, initialPreflight.scope))) {
            return {started: false, invalidSelection: true};
        }
        if (!isContextCurrent()) return {started: false, stale: true};
        const lockResult = await requestChoiceExclusiveLock(
            choiceCollectionLockName,
            async () => {
                const lockedPreflight = preflightActivationSelection(candidates);
                if (!lockedPreflight.valid
                    || !activationScopesMatch(initialPreflight.scope, lockedPreflight.scope)
                    || (selectionScope
                        && !activationScopesMatch(selectionScope, lockedPreflight.scope))) {
                    return {started: false, invalidSelection: true};
                }
                if (!isContextCurrent()) return {started: false, stale: true};
                const current = getChoiceActivationBatch();
                if (current?.state === choiceActivationBatchStates.collecting) {
                    return {started: false, busy: true, batch: current};
                } else if (isChoiceActivationBatchActive(current)) {
                    return {started: false, busy: true, batch: current};
                } else if (current) {
                    const expectedBatchId = current.id;
                    let reconciliation;
                    try {
                        reconciliation = await reconcileActivationSelectionStorageFromBatch(
                            current,
                            {lockManager}
                        );
                    } catch (error) {
                        return {
                            started: false,
                            stopped: true,
                            reconciliationFailed: true,
                            batch: current,
                        };
                    }
                    const latest = getChoiceActivationBatch();
                    if (!reconciliation.reconciled
                        || !latest
                        || latest.id !== expectedBatchId) {
                        return {
                            started: false,
                            stopped: true,
                            reconciliationFailed: !reconciliation.reconciled,
                            batch: latest,
                        };
                    }
                }
                const previousBatch = current?.state === choiceActivationBatchStates.complete
                    ? current
                    : null;
                const finalPreflight = preflightActivationSelection(candidates);
                if (!finalPreflight.valid
                    || !activationScopesMatch(initialPreflight.scope, finalPreflight.scope)
                    || (selectionScope
                        && !activationScopesMatch(selectionScope, finalPreflight.scope))) {
                    return {started: false, invalidSelection: true};
                }
                if (!isContextCurrent()) return {started: false, stale: true};
                const useSingleKeyCollection = finalPreflight.scope.kind === 'download'
                    || (typeof revealKey === 'function' && typeof revealKeys !== 'function');
                const retryStates = useSingleKeyCollection
                    ? null
                    : getChoiceCollectionRetryStates(previousBatch, candidates);
                const batch = createChoiceActivationBatch(owner);
                if (retryStates) {
                    appendChoiceActivatedMarkers(batch, candidates, retryStates);
                }
                GM_setValue(steamActivationBatchKey, batch);
                const saveBatch = nextBatch => saveChoiceActivationBatchIfCurrent(
                    nextBatch,
                    {runnerOwner: owner}
                );
                onBatchStarted(batch);
                const collected = useSingleKeyCollection
                    ? await collectSingleKeyActivationBatch(
                        batch,
                        candidates,
                        async item => {
                            onProgress(item);
                            return revealKey(item);
                        },
                        saveBatch,
                        {isContextCurrent}
                    )
                    : await collectChoiceActivationBatch(
                        batch,
                        candidates,
                        retryStates,
                        async (item, options) => {
                            onProgress(item);
                            const reveal = typeof revealKeys === 'function'
                                ? revealKeys
                                : ({tile}, revealOptions) =>
                                    revealChoiceSteamKeys(tile, revealOptions);
                            return reveal(item, options);
                        },
                        saveBatch,
                        {isContextCurrent}
                    );
                if (collected?.stale) {
                    if (batch.items.length === 0) {
                        const stored = getChoiceActivationBatch();
                        if (stored?.id === batch.id && stored.runner.owner === owner) {
                            GM_deleteValue(steamActivationBatchKey);
                        }
                        return {started: false, stale: true, batch: null};
                    }
                    const pendingCount = finishChoiceActivationCollection(batch, saveBatch);
                    if (pendingCount === null) {
                        return {started: false, stopped: true, stale: true, batch};
                    }
                    return {started: true, stale: true, batch, pendingCount};
                }
                if (!collected) return {started: false, stopped: true, batch};
                const pendingCount = finishChoiceActivationCollection(batch, saveBatch);
                if (pendingCount === null) {
                    return {started: false, stopped: true, batch};
                }
                return {started: true, batch, pendingCount};
            },
            {lockManager}
        );
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    async function recoverStaleChoiceCollection({lockManager} = {}) {
        const lockResult = await requestChoiceExclusiveLock(
            choiceCollectionLockName,
            async () => {
                const batch = getChoiceActivationBatch();
                if (batch?.state !== choiceActivationBatchStates.collecting) {
                    return {recovered: false};
                }
                GM_deleteValue(steamActivationBatchKey);
                return {recovered: true};
            },
            {lockManager, ifAvailable: true}
        );
        if (!lockResult.acquired) {
            return {
                recovered: false,
                lockUnavailable: !lockResult.unsupported,
                unsupported: lockResult.unsupported,
                message: lockResult.message,
            };
        }
        return lockResult.value;
    }

    function reconcileChoiceSelectionFromBatch(batch, selection = selectedChoiceGameIds) {
        if (batch?.state !== choiceActivationBatchStates.complete) return false;
        let changed = false;
        const gameIds = new Set();
        const itemsByGame = new Map();
        for (const item of batch?.items || []) {
            const decoded = decodeChoiceActivationItemId(item.id);
            if (!decoded) continue;
            gameIds.add(decoded.gameId);
            if (!itemsByGame.has(decoded.gameId)) itemsByGame.set(decoded.gameId, []);
            itemsByGame.get(decoded.gameId).push(item);
        }
        const retryStates = getChoiceCollectionRetryStates(
            batch,
            [...gameIds].map(id => ({id}))
        );
        for (const [gameId, state] of retryStates) {
            const items = itemsByGame.get(gameId) || [];
            const legacySingleKeyComplete = items.length === 1
                && !items[0].id.startsWith(choiceActivationItemIdPrefix)
                && items[0].status === choiceActivationItemStates.activated;
            if ((state.knownComplete || legacySingleKeyComplete)
                && selection.delete(gameId)) {
                changed = true;
            }
        }
        return changed;
    }

    function reconcileChoiceSelectionStorageFromBatch(batch, options = {}) {
        return updateChoiceSelection(
            selection => reconcileChoiceSelectionFromBatch(batch, selection),
            options
        );
    }

    async function reconcileActivationSelectionStorageFromBatch(batch, options = {}) {
        const batchScope = inferActivationBatchScope(batch);
        if (!batchScope) {
            if (batch?.state === choiceActivationBatchStates.collecting
                && Array.isArray(batch.items)
                && batch.items.length === 0) {
                return {reconciled: true, generic: true};
            }
            return {reconciled: false, invalidScope: true};
        }

        const successfulIds = batch.items
            .filter(item => item.status === choiceActivationItemStates.activated)
            .map(item => item.id);
        if (successfulIds.length === 0) return {reconciled: true, updated: false};

        if (batchScope.kind === 'choice') {
            const result = await reconcileChoiceSelectionStorageFromBatch(batch, options);
            if (result.acquired === false || result.persisted === false) {
                return {reconciled: false, ...result};
            }
            return {reconciled: true, ...result};
        }

        const successfulDownloadIds = successfulIds.filter(id =>
            parseDownloadActivationItemId(id)?.scope === batchScope.scope
        );
        if (successfulDownloadIds.length !== successfulIds.length) {
            return {reconciled: false, invalidScope: true};
        }
        const result = await updateDownloadSelection(
            batchScope.scope,
            selection => successfulDownloadIds.forEach(id => selection.delete(id)),
            options
        );
        if (result.unsupported
            || result.acquired === false
            || result.invalidScope
            || result.persisted === false) {
            return {reconciled: false, ...result};
        }
        return {reconciled: true, ...result};
    }

    function getChoiceActivationCounts(batch) {
        const count = status => batch.items.filter(item => item.status === status).length;
        return {
            total: batch.items.length,
            activated: count(choiceActivationItemStates.activated),
            humbleFailed: count(choiceActivationItemStates.humbleFailed),
            steamFailed: count(choiceActivationItemStates.steamFailed),
            pending: batch.items.filter(item => [
                choiceActivationItemStates.pending,
                choiceActivationItemStates.activating,
            ].includes(item.status)).length,
        };
    }

    function getChoiceActivationDisplayLabel(batch, item) {
        const decoded = decodeChoiceActivationItemId(item.id);
        if (!decoded) return item.title;
        let highestIndex = decoded.keyIndex;
        for (const candidate of batch?.items || []) {
            const candidateId = decodeChoiceActivationItemId(candidate.id);
            if (candidateId?.gameId === decoded.gameId) {
                highestIndex = Math.max(highestIndex, candidateId.keyIndex);
            }
        }
        const keyCount = highestIndex + 1;
        return keyCount === 1
            ? item.title
            : `${item.title} (key ${decoded.keyIndex + 1}/${keyCount})`;
    }

    function copySteamFailedKey(
        batch,
        item,
        feedback,
        setClipboard = GM_setClipboard
    ) {
        setClipboard(item.key, 'text');
        feedback.textContent = t('choiceCopiedFailedKey', {
            title: getChoiceActivationDisplayLabel(batch, item),
        });
    }

    function appendChoiceFailureGroup(
        results,
        titleText,
        batch,
        items,
        includeKeys = false
    ) {
        if (items.length === 0) return;
        const group = document.createElement('section');
        group.className = 'hb-helper-choice-result-group';

        const title = document.createElement('h4');
        title.textContent = titleText;
        group.appendChild(title);

        let feedback;
        if (includeKeys) {
            feedback = document.createElement('div');
            feedback.className = 'hb-helper-choice-copy-feedback';
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
        }

        items.forEach(item => {
            const displayLabel = getChoiceActivationDisplayLabel(batch, item);
            const row = document.createElement('div');
            row.className = 'hb-helper-choice-result-row';
            const detail = document.createElement('div');
            detail.textContent = t('choiceFailureRow', {
                title: displayLabel,
                reason: item.error || t('steamActivationUnknownCode', {
                    code: item.code ?? 'unknown',
                }),
            });
            row.appendChild(detail);

            if (includeKeys && item.key) {
                const keyButton = document.createElement('button');
                keyButton.type = 'button';
                keyButton.className = 'hb-helper-choice-failed-key';
                keyButton.textContent = item.key;
                keyButton.setAttribute('aria-label', t('choiceCopyFailedKey', {
                    title: displayLabel,
                }));
                keyButton.addEventListener('click', () =>
                    copySteamFailedKey(batch, item, feedback)
                );
                row.appendChild(keyButton);
            }
            group.appendChild(row);
        });

        if (feedback) group.appendChild(feedback);
        results.appendChild(group);
    }

    function getChoiceActivationResultsSignature(batch) {
        if (!batch) return JSON.stringify({language: currentLanguage, batch: null});
        return JSON.stringify({
            language: currentLanguage,
            counts: getChoiceActivationCounts(batch),
            refreshError: batch.ownershipRefresh.state === choiceActivationOwnershipStates.failed
                ? batch.ownershipRefresh.error || t('choiceOwnershipRefreshWarning')
                : null,
            failures: batch.items
                .filter(item => [
                    choiceActivationItemStates.humbleFailed,
                    choiceActivationItemStates.steamFailed,
                ].includes(item.status))
                .map(item => ({
                    id: item.id,
                    status: item.status,
                    title: getChoiceActivationDisplayLabel(batch, item),
                    key: item.status === choiceActivationItemStates.steamFailed ? item.key : null,
                    error: item.error || null,
                    code: item.code ?? null,
                })),
        });
    }

    function getCurrentActivationScope() {
        if (isChoicePage()) return {kind: 'choice'};
        if (isDownloadsPage()
            && downloadOrderRouteKey === getDownloadsOrderKey()
            && /^[0-9a-f]{64}$/.test(downloadOrderScope || '')) {
            return {kind: 'download', scope: downloadOrderScope};
        }
        return null;
    }

    function sortedActivationSelectionIds(selection) {
        return [...selection].sort();
    }

    function activationSelectionIdsMatch(capturedIds, selection) {
        const currentIds = sortedActivationSelectionIds(selection);
        return capturedIds.length === currentIds.length
            && capturedIds.every((id, index) => id === currentIds[index]);
    }

    function captureChoiceActivationUiContext() {
        return {
            scope: {kind: 'choice'},
            routeFingerprint: getHelperRouteFingerprint(),
            routeGeneration: helperRouteTransitionGeneration,
            controls: document.getElementById('hb-helper-choice-activation-controls'),
            selectionIds: sortedActivationSelectionIds(selectedChoiceGameIds),
        };
    }

    function captureDownloadActivationUiContext() {
        return {
            scope: {kind: 'download', scope: downloadOrderScope},
            routeFingerprint: getHelperRouteFingerprint(),
            routeGeneration: helperRouteTransitionGeneration,
            initializationGeneration: downloadOrderInitializationGeneration,
            routeKey: downloadOrderRouteKey,
            controls: document.getElementById('hb-helper-choice-activation-controls'),
            selectionIds: sortedActivationSelectionIds(selectedDownloadItemIds),
        };
    }

    function areCapturedDownloadSelectionsCurrent(context) {
        const capturedIds = new Set(context.selectionIds);
        const matchingPairCounts = new Map();
        for (const pair of downloadOrderMapping?.pairs || []) {
            if (!isDownloadMappingPairEligible(pair)) continue;
            const id = getDownloadActivationItemId(downloadOrderScope, pair.tpkd);
            if (!capturedIds.has(id)) continue;
            matchingPairCounts.set(id, (matchingPairCounts.get(id) || 0) + 1);
        }
        return context.selectionIds.every(id => matchingPairCounts.get(id) === 1);
    }

    function isActivationUiContextCurrent(context) {
        if (!context
            || context.routeFingerprint !== getHelperRouteFingerprint()
            || context.routeGeneration !== helperRouteTransitionGeneration
            || context.controls !== document.getElementById(
                'hb-helper-choice-activation-controls'
            )
            || !activationScopesMatch(context.scope, getCurrentActivationScope())) {
            return false;
        }
        if (context.scope.kind === 'choice') {
            return activationSelectionIdsMatch(
                context.selectionIds,
                selectedChoiceGameIds
            );
        }
        return context.routeKey === downloadOrderRouteKey
            && context.routeKey === getDownloadsOrderKey()
            && context.scope.scope === downloadOrderScope
            && context.initializationGeneration === downloadOrderInitializationGeneration
            && areCapturedDownloadSelectionsCurrent(context)
            && activationSelectionIdsMatch(
                context.selectionIds,
                selectedDownloadItemIds
            );
    }

    function setActivationUiContextStatus(context, message) {
        if (!isActivationUiContextCurrent(context)) return false;
        setElementTextContent(
            context.controls?.querySelector('.hb-helper-choice-status'),
            message
        );
        return true;
    }

    function renderActivationUiContextResults(context, batch) {
        if (!isActivationUiContextCurrent(context)) return false;
        renderChoiceActivationResults(batch);
        return true;
    }

    function renderChoiceActivationResults(batch = getChoiceActivationBatch()) {
        const results = document.getElementById('hb-helper-choice-activation-results');
        if (!results) return;
        const presentation = getActivationBatchPresentation(
            batch,
            getCurrentActivationScope()
        );
        const signature = presentation.kind === 'details'
            ? getChoiceActivationResultsSignature(batch)
            : JSON.stringify({language: currentLanguage, presentation: presentation.kind});
        if (results.dataset.hbHelperChoiceResultsSignature === signature) return;
        results.replaceChildren();
        results.dataset.hbHelperChoiceResultsSignature = signature;
        if (presentation.kind === 'none') return;
        if (presentation.kind === 'busy') {
            const busy = document.createElement('div');
            busy.className = 'hb-helper-choice-result-summary';
            busy.textContent = t('activationBusy');
            results.appendChild(busy);
            return;
        }

        const counts = getChoiceActivationCounts(batch);
        const summary = document.createElement('div');
        summary.className = 'hb-helper-choice-result-summary';
        summary.textContent = t('choiceActivationSummary', counts);
        results.appendChild(summary);

        if (batch.ownershipRefresh.state === choiceActivationOwnershipStates.failed) {
            const warning = document.createElement('div');
            warning.className = 'hb-helper-choice-result-warning';
            warning.textContent = batch.ownershipRefresh.error
                || t('choiceOwnershipRefreshWarning');
            results.appendChild(warning);
        }

        appendChoiceFailureGroup(
            results,
            t('choiceHumbleFailureGroup'),
            batch,
            batch.items.filter(item => item.status === choiceActivationItemStates.humbleFailed)
        );
        appendChoiceFailureGroup(
            results,
            t('choiceSteamFailureGroup'),
            batch,
            batch.items.filter(item => item.status === choiceActivationItemStates.steamFailed),
            true
        );
    }

    async function runDirectChoiceActivation(
        selectedItems,
        {
            syncSession = syncSteamSession,
            collectWork = runChoiceCollectionWork,
            activationWork = runSteamActivationWork,
            collectionOptions = {},
            activationOptions = {},
            isContextCurrent = () => true,
        } = {}
    ) {
        const candidates = Array.isArray(selectedItems)
            ? selectedItems.map(item => ({...item}))
            : selectedItems;
        const preflight = preflightActivationSelection(candidates);
        if (!preflight.valid) return {started: false, invalidSelection: true};
        if (!isContextCurrent()) return {started: false, stale: true};
        const sessionState = await syncSession({force: true});
        if (!isContextCurrent()) return {started: false, stale: true};
        if (sessionState.status !== 'authenticated'
            || !isSteamAccountData(sessionState.account)) {
            return {started: false, authenticationRequired: true, sessionState};
        }

        const collection = await collectWork(candidates, {
            ...collectionOptions,
            isContextCurrent,
            selectionScope: preflight.scope,
        });
        if (!collection?.started || collection.pendingCount === 0) return collection;

        const activation = await activationWork({
            ...activationOptions,
            sessionId: sessionState.account.sessionId,
            recheckSession: options => syncSession(options),
        });
        return {...collection, ...activation, activation};
    }

    function clearPendingDownloadRevealReload(request = pendingDownloadRevealReload) {
        if (!request || pendingDownloadRevealReload !== request) return false;
        clearTimeout(request.retryTimer);
        pendingDownloadRevealReload = undefined;
        return true;
    }

    function rememberDownloadRevealReload({
        batchId,
        context,
        revealedItemIds,
        reloadPage,
    }) {
        const scope = context?.scope?.kind === 'download'
            ? context.scope.scope
            : undefined;
        const routeIdentity = {
            routeFingerprint: context?.routeFingerprint,
            routeGeneration: context?.routeGeneration,
            initializationGeneration: context?.initializationGeneration,
            routeKey: context?.routeKey,
            scope,
            controls: context?.controls,
        };
        if (!isNonEmptyString(batchId)
            || !getDownloadSelectionStorageKey(scope)
            || !isDownloadRevealReloadRouteCurrent(routeIdentity)) {
            return false;
        }
        const revealedIds = [...revealedItemIds];
        if (revealedIds.length === 0 || revealedIds.some(id =>
            parseDownloadActivationItemId(id)?.scope !== scope
        )) return false;
        clearPendingDownloadRevealReload();
        pendingDownloadRevealReload = {
            batchId,
            ...routeIdentity,
            revealedItemIds: new Set(revealedIds),
            reloadPage,
            retryTimer: undefined,
            retryAttempt: 0,
        };
        return true;
    }

    function isDownloadRevealReloadRouteCurrent(request) {
        return request?.routeFingerprint === getHelperRouteFingerprint()
            && request.routeGeneration === helperRouteTransitionGeneration
            && request.initializationGeneration === downloadOrderInitializationGeneration
            && request.routeKey === downloadOrderRouteKey
            && request.routeKey === getDownloadsOrderKey()
            && request.scope === downloadOrderScope
            && request.controls === document.getElementById(
                'hb-helper-choice-activation-controls'
            );
    }

    function getDownloadRevealReloadBatchState(request) {
        const batch = getChoiceActivationBatch();
        if (!batch || batch.id !== request.batchId) return {invalid: true};
        const batchScope = inferActivationBatchScope(batch);
        if (batchScope?.kind !== 'download' || batchScope.scope !== request.scope) {
            return {invalid: true};
        }
        const itemsById = new Map(batch.items.map(item => [item.id, item]));
        const revealedItems = [...request.revealedItemIds].map(id => itemsById.get(id));
        if (revealedItems.some(item =>
            !item || item.status === choiceActivationItemStates.humbleFailed
        )) {
            return {invalid: true};
        }
        return {
            batch,
            complete: batch.state === choiceActivationBatchStates.complete,
        };
    }

    function scheduleDownloadRevealReloadReconciliation(request) {
        if (pendingDownloadRevealReload !== request || request.retryTimer !== undefined) return;
        const retryDelay = Math.min(
            choiceLockRetryMs * (2 ** Math.min(request.retryAttempt, 5)),
            downloadRevealReloadRetryMaxMs
        );
        request.retryAttempt += 1;
        request.retryTimer = setTimeout(async () => {
            request.retryTimer = undefined;
            if (pendingDownloadRevealReload !== request
                || !isDownloadRevealReloadRouteCurrent(request)) {
                clearPendingDownloadRevealReload(request);
                return;
            }
            const expected = getDownloadRevealReloadBatchState(request);
            if (expected.invalid || !expected.complete) {
                clearPendingDownloadRevealReload(request);
                return;
            }
            try {
                await reconcileActivationSelectionStorageFromBatch(expected.batch, {
                    shouldPersist: () => {
                        const current = getDownloadRevealReloadBatchState(request);
                        return isDownloadRevealReloadRouteCurrent(request)
                            && !current.invalid
                            && current.complete;
                    },
                });
            } catch (_) {
                // The stored batch and selection remain authoritative; retry below.
            }
            await queueDownloadRevealReloadCompletion();
        }, retryDelay);
    }

    function completePendingDownloadRevealReload() {
        const request = pendingDownloadRevealReload;
        if (!request) return false;
        if (!isDownloadRevealReloadRouteCurrent(request)) {
            clearPendingDownloadRevealReload(request);
            return false;
        }

        const expected = getDownloadRevealReloadBatchState(request);
        if (expected.invalid) {
            clearPendingDownloadRevealReload(request);
            return false;
        }
        if (!expected.complete) return false;

        const persistedSelection = getDownloadSelection(request.scope);
        const successfulIds = expected.batch.items
            .filter(item => item.status === choiceActivationItemStates.activated)
            .map(item => item.id);
        if (successfulIds.some(id => persistedSelection.has(id))) {
            scheduleDownloadRevealReloadReconciliation(request);
            return false;
        }

        clearPendingDownloadRevealReload(request);
        request.reloadPage();
        return true;
    }

    function queueDownloadRevealReloadCompletion() {
        const completion = downloadRevealReloadCompletionPromise.then(
            completePendingDownloadRevealReload,
            completePendingDownloadRevealReload
        );
        downloadRevealReloadCompletionPromise = completion.catch(() => false);
        return completion;
    }

    async function startChoiceActivation() {
        if (choiceActivationInProgress
            && isActivationUiContextCurrent(choiceActivationContext)) {
            setChoiceStatus(t('choiceActivationBusy'));
            return {started: false, busy: true};
        }
        const tiles = getSelectedChoiceTiles();
        if (tiles.length === 0) {
            setChoiceStatus(t('choiceNoSelection'));
            return {started: false, noSelection: true};
        }

        const selectedItems = tiles.map((tile, index) => ({
            id: getChoiceTileId(tile),
            title: getChoiceTileTitle(tile),
            tile,
            index,
        }));
        const context = captureChoiceActivationUiContext();
        choiceActivationInProgress = true;
        choiceActivationContext = context;
        let completionStatus = '';
        let result = {started: false};
        setActivationUiContextStatus(
            context,
            t('choiceRevealStarting', {count: tiles.length})
        );
        try {
            result = await runDirectChoiceActivation(selectedItems, {
                isContextCurrent: () => isActivationUiContextCurrent(context),
                collectionOptions: {
                    onBatchStarted: batch => {
                        if (!isActivationUiContextCurrent(context)) return;
                        setChoiceSelectionMode(false);
                        renderActivationUiContextResults(context, batch);
                    },
                    onProgress: item => setActivationUiContextStatus(
                        context,
                        t('choiceRevealProgress', {
                            title: item.title,
                            current: item.index + 1,
                            total: selectedItems.length,
                        })
                    ),
                    revealKeys: async (item, options) => {
                        if (!isActivationUiContextCurrent(context)) {
                            throw new Error(t('activationBusy'));
                        }
                        const outcomes = await revealChoiceSteamKeys(item.tile, options);
                        if (outcomes.some(outcome => !outcome.key)) {
                            setActivationUiContextStatus(
                                context,
                                t('choiceRevealFailed', {title: item.title})
                            );
                        }
                        return outcomes;
                    },
                },
                activationOptions: {
                    showProgress: (item, index, total, displayLabel) =>
                        setActivationUiContextStatus(context, t('steamActivationProgress', {
                            title: displayLabel,
                            current: index + 1,
                            total,
                        })),
                },
            });
            if (result.authenticationRequired) {
                completionStatus = t('loginSteamLoadAccountData');
            } else if (result.unsupported) {
                completionStatus = result.message;
            } else if (result.invalidSelection) {
                completionStatus = t('choiceNoSelection');
            } else if (!result.started && !result.stale) {
                completionStatus = t('choiceActivationBusy');
            }
            if (!result.invalidSelection) await reconcileChoiceActivationBatch();
        } finally {
            if (choiceActivationContext === context) {
                const contextCurrent = isActivationUiContextCurrent(context);
                choiceActivationInProgress = false;
                choiceActivationContext = undefined;
                if (contextCurrent) {
                    renderChoiceSelectionState();
                    renderChoiceActivationResults();
                    if (completionStatus) setChoiceStatus(completionStatus);
                }
            }
        }
        return result;
    }

    async function startDownloadActivation({
        directActivationOptions = {},
        reconcileBatch = reconcileChoiceActivationBatch,
        reloadPage = () => location.reload(),
    } = {}) {
        if (!isDownloadActivationUiAvailable()) {
            refreshDownloadOrderPage();
            return {started: false, unavailable: true};
        }
        if ((downloadActivationInProgress
                && isActivationUiContextCurrent(downloadActivationContext))
            || isChoiceActivationBatchActive()) {
            setChoiceStatus(t('activationBusy'));
            return {started: false, busy: true};
        }
        const selectedPairs = (downloadOrderMapping?.pairs || []).filter(pair => {
            if (!isDownloadMappingPairEligible(pair)) return false;
            const id = getDownloadActivationItemId(downloadOrderScope, pair.tpkd);
            return selectedDownloadItemIds.has(id);
        });
        if (selectedPairs.length === 0) {
            setChoiceStatus(t('downloadNoSelection'));
            return {started: false, noSelection: true};
        }

        const orderKey = downloadOrderRouteKey;
        const orderScope = downloadOrderScope;
        const selectedItems = selectedPairs.map((pair, index) => ({
            id: getDownloadActivationItemId(orderScope, pair.tpkd),
            title: [pair.tpkd.human_name, pair.tpkd.machine_name]
                .find(isNonEmptyString)?.trim() || '',
            tpkd: pair.tpkd,
            index,
        }));
        const hiddenItemIds = new Set(selectedItems
            .filter(item => !findSteamKeyInText(item.tpkd.redeemed_key_val))
            .map(item => item.id));
        const context = captureDownloadActivationUiContext();
        const {
            collectionOptions: providedCollectionOptions = {},
            activationOptions: providedActivationOptions = {},
            ...providedDirectOptions
        } = directActivationOptions || {};
        downloadActivationInProgress = true;
        downloadActivationContext = context;
        let completionStatus = '';
        let result = {started: false};
        let activationBatchId;
        const revealedHiddenItemIds = new Set();
        setActivationUiContextStatus(
            context,
            t('downloadRevealStarting', {count: selectedItems.length})
        );
        try {
            result = await runDirectChoiceActivation(selectedItems, {
                ...providedDirectOptions,
                isContextCurrent: () => isActivationUiContextCurrent(context),
                collectionOptions: {
                    ...providedCollectionOptions,
                    onBatchStarted: batch => {
                        if (isChoiceActivationBatch(batch)) activationBatchId = batch.id;
                        if (!isActivationUiContextCurrent(context)) return;
                        setDownloadSelectionMode(false);
                        renderActivationUiContextResults(context, batch);
                        providedCollectionOptions.onBatchStarted?.(batch);
                    },
                    onProgress: item => {
                        if (!isActivationUiContextCurrent(context)) return;
                        setActivationUiContextStatus(
                            context,
                            t('downloadRevealProgress', {
                                title: item.title,
                                current: item.index + 1,
                                total: selectedItems.length,
                            })
                        );
                        providedCollectionOptions.onProgress?.(item);
                    },
                    revealKey: async item => {
                        if (!isActivationUiContextCurrent(context)) {
                            throw new Error(t('activationBusy'));
                        }
                        try {
                            const key = providedCollectionOptions.revealKey
                                ? await providedCollectionOptions.revealKey(item)
                                : await revealDownloadSteamKey(item.tpkd, {orderKey});
                            if (hiddenItemIds.has(item.id) && findSteamKeyInText(key)) {
                                revealedHiddenItemIds.add(item.id);
                            }
                            return key;
                        } catch (error) {
                            setActivationUiContextStatus(
                                context,
                                t('downloadRevealFailed', {title: item.title})
                            );
                            throw error;
                        }
                    },
                },
                activationOptions: {
                    ...providedActivationOptions,
                    showProgress: (item, index, total) => {
                        if (!isActivationUiContextCurrent(context)) return;
                        setActivationUiContextStatus(context, t('steamActivationProgress', {
                            title: item.title,
                            current: index + 1,
                            total,
                        }));
                        providedActivationOptions.showProgress?.(item, index, total);
                    },
                },
            });
            if (result.authenticationRequired) {
                completionStatus = t('downloadLoginSteam');
            } else if (result.unsupported) {
                completionStatus = result.message;
            } else if (result.invalidSelection) {
                completionStatus = t('downloadNoSelection');
            } else if (!result.started && !result.stale) {
                completionStatus = t('activationBusy');
            }
            if (revealedHiddenItemIds.size > 0 && activationBatchId) {
                rememberDownloadRevealReload({
                    batchId: activationBatchId,
                    context,
                    revealedItemIds: revealedHiddenItemIds,
                    reloadPage,
                });
            }
            if (!result.invalidSelection) {
                try {
                    await reconcileBatch();
                } catch (_) {
                    console.warn('[HB-Helper] Reconcile activation batch failed.');
                }
            }
            await queueDownloadRevealReloadCompletion();
        } finally {
            if (downloadActivationContext === context) {
                const contextCurrent = isActivationUiContextCurrent(context);
                downloadActivationInProgress = false;
                downloadActivationContext = undefined;
                if (contextCurrent) {
                    renderDownloadSelectionState();
                    renderChoiceActivationResults();
                    if (completionStatus) setChoiceStatus(completionStatus);
                }
            }
        }
        return result;
    }

    function mountDownloadActivationControls() {
        if (!isDownloadsPage()) return null;
        const mount = document.querySelector('.key-container.wrapper')
            || document.querySelector('.inner-main-wrapper')
            || document.querySelector('main')
            || document.querySelector('#main-content')
            || document.body;
        if (!mount) return null;

        let controls = document.getElementById('hb-helper-choice-activation-controls');
        if (controls && !controls.classList.contains('hb-helper-downloads-controls')) {
            controls.remove();
            controls = null;
        }
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'hb-helper-choice-activation-controls';
            controls.className = 'hb-helper-downloads-controls';

            const activateButton = document.createElement('button');
            activateButton.type = 'button';
            activateButton.dataset.hbHelperChoiceAction = 'activate';
            activateButton.addEventListener('click', () => startDownloadActivation());

            const selectUnownedButton = document.createElement('button');
            selectUnownedButton.type = 'button';
            selectUnownedButton.dataset.hbHelperChoiceAction = 'select-unowned';
            selectUnownedButton.addEventListener('click', () => {
                selectUnownedDownloadRows().catch(error => {
                    console.warn('[HB-Helper] Select unowned download keys failed:', error);
                });
            });

            const selectButton = document.createElement('button');
            selectButton.type = 'button';
            selectButton.dataset.hbHelperChoiceAction = 'select';
            selectButton.addEventListener('click', () => {
                setDownloadSelectionMode(!downloadSelectionMode);
            });

            const clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.dataset.hbHelperChoiceAction = 'clear';
            clearButton.addEventListener('click', () => {
                clearDownloadSelection().catch(error => {
                    console.warn('[HB-Helper] Clear download selection failed:', error);
                });
            });

            const status = document.createElement('div');
            status.className = 'hb-helper-choice-status';
            const results = document.createElement('div');
            results.id = 'hb-helper-choice-activation-results';
            controls.append(
                activateButton,
                selectUnownedButton,
                selectButton,
                clearButton,
                status,
                results
            );
        }
        setElementTextContent(
            controls.querySelector('[data-hb-helper-choice-action="activate"]'),
            t('choiceActivate')
        );
        setElementTextContent(
            controls.querySelector('[data-hb-helper-choice-action="select-unowned"]'),
            t('choiceSelectUnowned')
        );
        setElementTextContent(
            controls.querySelector('[data-hb-helper-choice-action="clear"]'),
            t('choiceClearSelection')
        );
        if (mount.firstElementChild !== controls) mount.insertBefore(controls, mount.firstChild);
        renderDownloadSelectionState();
        return controls;
    }

    function clearDownloadMappingUi(mapping = downloadOrderMapping) {
        captureDownloadRegionDisclosureState(mapping);
        document.querySelector('.hb-helper-download-mapping-summary-warning')?.remove();
        const rows = new Set([
            ...(mapping?.pairs || []).map(pair => pair.row),
            ...(mapping?.unmatchedRows || []),
            ...(mapping?.disabledRows || []),
        ]);
        for (const row of rows) {
            setDownloadRowSelectionInteraction(row, false);
            row.classList.remove('hb-helper-download-selected');
            clearDownloadMappingWarning(row);
            row.querySelectorAll?.([
                '.hb-helper-download-region-warning',
                '.hb-helper-region-restrictions',
            ].join(', ')).forEach(panel => panel.remove());
        }
    }

    function resetDownloadOrderPage({removeControls = true} = {}) {
        downloadOrderInitializationGeneration += 1;
        clearPendingDownloadRevealReload();
        clearDownloadMappingUi();
        downloadOrderRouteKey = undefined;
        downloadOrderScope = undefined;
        downloadOrderData = undefined;
        downloadOrderMapping = undefined;
        downloadOrderLoadError = false;
        downloadOrderReloadPending = false;
        queuedDownloadOrderReloadIntent = undefined;
        downloadOrderReloadMutationGeneration = 0;
        downloadOrderReloadConsumedMutationGeneration = 0;
        observedUnknownDownloadSteamKeys.clear();
        downloadOrderInitialLoadContext = undefined;
        downloadRegionDisclosureState = undefined;
        downloadSelectionMode = false;
        selectedDownloadItemIds.clear();
        document.documentElement.classList.remove('hb-helper-download-select-mode');
        invalidateDownloadOrder();
        if (removeControls) {
            const controls = document.getElementById('hb-helper-choice-activation-controls');
            if (controls?.classList.contains('hb-helper-downloads-controls')) controls.remove();
        }
    }

    function refreshDownloadOrderPage({loadOrder, remap = true} = {}) {
        const orderKey = getDownloadsOrderKey();
        if (!orderKey) {
            resetDownloadOrderPage();
            return;
        }
        if (downloadOrderRouteKey !== orderKey) {
            return initializeDownloadOrderPage({orderKey, loadOrder})
                .catch(error => {
                    if (getDownloadsOrderKey() === orderKey) {
                        console.warn('[HB-Helper] Load download order failed.');
                        setChoiceStatus(t('downloadOrderLoadFailed'));
                    }
                    return {error};
                });
        }

        mountDownloadActivationControls();
        if (downloadOrderData && remap && !isDownloadOrderRefreshPending()) {
            clearDownloadMappingUi();
            downloadOrderMapping = mapDownloadOrderRows(
                downloadOrderData.tpkd_dict.all_tpks
            );
            upsertDownloadRegionWarnings(downloadOrderMapping);
        }
        renderDownloadSelectionState();
    }

    async function initializeDownloadOrderPage({
        loadOrder = loadDownloadOrder,
        orderKey = getDownloadsOrderKey(),
    } = {}) {
        if (!isNonEmptyString(orderKey) || getDownloadsOrderKey() !== orderKey) {
            return {stale: true};
        }
        if (downloadOrderRouteKey !== orderKey) resetDownloadOrderPage({removeControls: false});
        const retainingInitialReload = downloadOrderInitialLoadContext?.reloadQueued
            && downloadOrderInitialLoadContext.orderKey === orderKey;
        const takingOverReload = downloadOrderReloadPending
            && downloadOrderRouteKey === orderKey;
        const adoptingQueuedReload = !takingOverReload
            && queuedDownloadOrderReloadIntent?.orderKey === orderKey
            && downloadOrderRouteKey === orderKey;
        const authoritativeReload = takingOverReload || adoptingQueuedReload;
        downloadOrderRouteKey = orderKey;
        const generation = ++downloadOrderInitializationGeneration;
        if (adoptingQueuedReload) {
            queuedDownloadOrderReloadIntent = undefined;
            pageRefreshDownloadOrderReloadIntent = undefined;
            downloadOrderReloadPending = true;
            downloadOrderReloadConsumedMutationGeneration
                = downloadOrderReloadMutationGeneration;
            invalidateDownloadOrder();
        } else if (!takingOverReload) {
            downloadOrderReloadPending = false;
            queuedDownloadOrderReloadIntent = undefined;
            if (!retainingInitialReload) {
                downloadOrderReloadMutationGeneration = 0;
                downloadOrderReloadConsumedMutationGeneration = 0;
            }
        }
        downloadOrderInitialLoadContext = authoritativeReload
            ? undefined
            : {orderKey, generation, reloadQueued: Boolean(retainingInitialReload)};
        mountDownloadActivationControls();
        const scope = await hashDownloadOrderKey(orderKey);
        if (generation !== downloadOrderInitializationGeneration
            || getDownloadsOrderKey() !== orderKey) {
            return {stale: true};
        }
        downloadOrderScope = scope;
        if (scope) observeDownloadSelection(scope);
        try {
            const order = validateDownloadOrder(await loadOrder(orderKey), orderKey);
            return await completeDownloadOrderLoad(order, {
                generation,
                loadOrder,
                orderKey,
                scope,
                allowTrailingReload: authoritativeReload,
            });
        } catch (error) {
            if (!isCurrentDownloadOrderLoad(generation, orderKey)) {
                return {stale: true};
            }
            failDownloadOrderLoad();
            throw error;
        }
    }

    function isCurrentDownloadOrderLoad(generation, orderKey) {
        return generation === downloadOrderInitializationGeneration
            && orderKey === downloadOrderRouteKey
            && orderKey === getDownloadsOrderKey();
    }

    function getCurrentDownloadOrderInitialLoadContext() {
        const context = downloadOrderInitialLoadContext;
        return context
            && context.generation === downloadOrderInitializationGeneration
            && context.orderKey === downloadOrderRouteKey
            && context.orderKey === getDownloadsOrderKey()
            ? context
            : null;
    }

    function isDownloadOrderRefreshPending() {
        return downloadOrderReloadPending
            || Boolean(getCurrentDownloadOrderInitialLoadContext()?.reloadQueued);
    }

    function getDownloadOrderSteamKeys(order) {
        return new Set(order.tpkd_dict.all_tpks
            .map(tpkd => findSteamKeyInText(tpkd.redeemed_key_val))
            .filter(Boolean));
    }

    function getVisibleDownloadSteamKeys() {
        return new Set(Array.from(document.querySelectorAll('.key-redeemer'))
            .map(row => extractSteamKeyFromScope(row))
            .filter(Boolean));
    }

    function pruneObservedKnownDownloadSteamKeys(order) {
        const knownKeys = getDownloadOrderSteamKeys(order);
        for (const key of observedUnknownDownloadSteamKeys) {
            if (knownKeys.has(key)) observedUnknownDownloadSteamKeys.delete(key);
        }
        return knownKeys;
    }

    function pruneObservedInvisibleDownloadSteamKeys() {
        const visibleKeys = getVisibleDownloadSteamKeys();
        for (const key of observedUnknownDownloadSteamKeys) {
            if (!visibleKeys.has(key)) observedUnknownDownloadSteamKeys.delete(key);
        }
        return visibleKeys;
    }

    function hasUnknownVisibleDownloadSteamKey(order) {
        const knownKeys = pruneObservedKnownDownloadSteamKeys(order);
        const visibleKeys = pruneObservedInvisibleDownloadSteamKeys();
        return [...visibleKeys].some(key => !knownKeys.has(key));
    }

    function failDownloadOrderLoad() {
        clearDownloadMappingUi();
        downloadRegionDisclosureState = undefined;
        downloadOrderData = undefined;
        downloadOrderMapping = undefined;
        downloadOrderLoadError = true;
        downloadOrderReloadPending = false;
        queuedDownloadOrderReloadIntent = undefined;
        downloadOrderReloadMutationGeneration = 0;
        downloadOrderReloadConsumedMutationGeneration = 0;
        observedUnknownDownloadSteamKeys.clear();
        downloadOrderInitialLoadContext = undefined;
        renderDownloadSelectionState();
    }

    async function completeDownloadOrderLoad(order, {
        generation,
        loadOrder,
        orderKey,
        scope = downloadOrderScope,
        allowTrailingReload = false,
    }) {
        if (!isCurrentDownloadOrderLoad(generation, orderKey)) return {stale: true};
        const initialLoadContext = getCurrentDownloadOrderInitialLoadContext();
        let trailingReloadAllowed = allowTrailingReload;
        if (initialLoadContext?.generation === generation
            && initialLoadContext.orderKey === orderKey) {
            downloadOrderInitialLoadContext = undefined;
            if (initialLoadContext.reloadQueued) {
                downloadOrderReloadPending = true;
                trailingReloadAllowed = true;
                renderDownloadSelectionState();
            }
        }
        let currentOrder = order;
        downloadOrderLoadError = false;
        downloadOrderData = currentOrder;
        pruneObservedKnownDownloadSteamKeys(currentOrder);
        while (trailingReloadAllowed
            && downloadOrderReloadMutationGeneration
                !== downloadOrderReloadConsumedMutationGeneration) {
            downloadOrderReloadConsumedMutationGeneration
                = downloadOrderReloadMutationGeneration;
            if (hasUnknownVisibleDownloadSteamKey(currentOrder)) {
                invalidateDownloadOrder();
                currentOrder = validateDownloadOrder(
                    await loadOrder(orderKey),
                    orderKey
                );
                if (!isCurrentDownloadOrderLoad(generation, orderKey)) {
                    return {stale: true};
                }
                downloadOrderData = currentOrder;
                pruneObservedKnownDownloadSteamKeys(currentOrder);
                continue;
            }
            break;
        }
        if (!isCurrentDownloadOrderLoad(generation, orderKey)) return {stale: true};
        queuedDownloadOrderReloadIntent = undefined;
        downloadOrderReloadMutationGeneration = 0;
        downloadOrderReloadConsumedMutationGeneration = 0;
        downloadOrderReloadPending = false;
        downloadOrderInitialLoadContext = undefined;
        refreshDownloadOrderPage();
        return {scope, order: downloadOrderData, mapping: downloadOrderMapping};
    }

    async function reloadDownloadOrderPage({
        loadOrder = helperRouteDependencies.loadOrder || loadDownloadOrder,
        orderKey = getDownloadsOrderKey(),
    } = {}) {
        if (!isNonEmptyString(orderKey)
            || orderKey !== downloadOrderRouteKey
            || orderKey !== getDownloadsOrderKey()) {
            return {stale: true};
        }
        const generation = ++downloadOrderInitializationGeneration;
        queuedDownloadOrderReloadIntent = undefined;
        downloadOrderReloadPending = true;
        downloadOrderReloadConsumedMutationGeneration
            = downloadOrderReloadMutationGeneration;
        renderDownloadSelectionState();
        invalidateDownloadOrder();
        try {
            const order = validateDownloadOrder(await loadOrder(orderKey), orderKey);
            return await completeDownloadOrderLoad(order, {
                generation,
                loadOrder,
                orderKey,
                allowTrailingReload: true,
            });
        } catch (error) {
            if (!isCurrentDownloadOrderLoad(generation, orderKey)) {
                return {stale: true};
            }
            failDownloadOrderLoad();
            throw error;
        }
    }

    function ensureChoiceActivationControls(controls, summary) {
        let choiceControls = document.getElementById('hb-helper-choice-activation-controls');
        const activationCurrent = choiceActivationInProgress
            && isActivationUiContextCurrent(choiceActivationContext);
        if (!isChoicePage()
            || ((getModernChoiceMemberGrid() || getModernChoiceGameEntries().length > 0)
                && getVisibleChoiceTiles().length === 0)
            || (!hasSteamAccountData() && !activationCurrent)) {
            choiceControls?.remove();
            return;
        }

        if (!choiceControls) {
            choiceControls = document.createElement('div');
            choiceControls.id = 'hb-helper-choice-activation-controls';

            const activateButton = document.createElement('button');
            activateButton.type = 'button';
            activateButton.dataset.hbHelperChoiceAction = 'activate';
            activateButton.addEventListener('click', startChoiceActivation);

            const selectUnownedButton = document.createElement('button');
            selectUnownedButton.type = 'button';
            selectUnownedButton.dataset.hbHelperChoiceAction = 'select-unowned';
            selectUnownedButton.addEventListener('click', () => {
                selectUnownedChoiceTiles().catch(error => {
                    console.warn('[HB-Helper] Select unowned Choice games failed:', error);
                });
            });

            const selectButton = document.createElement('button');
            selectButton.type = 'button';
            selectButton.dataset.hbHelperChoiceAction = 'select';
            selectButton.addEventListener('click', () => setChoiceSelectionMode(!choiceSelectionMode));

            const clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.dataset.hbHelperChoiceAction = 'clear';
            clearButton.addEventListener('click', () => {
                clearChoiceSelection().catch(error => {
                    console.warn('[HB-Helper] Clear Choice selection failed:', error);
                });
            });

            const status = document.createElement('div');
            status.className = 'hb-helper-choice-status';

            const results = document.createElement('div');
            results.id = 'hb-helper-choice-activation-results';

            choiceControls.append(
                activateButton,
                selectUnownedButton,
                selectButton,
                clearButton,
                status,
                results
            );
        }

        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="activate"]'),
            t('choiceActivate')
        );
        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="select-unowned"]'),
            t('choiceSelectUnowned')
        );
        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="clear"]'),
            t('choiceClearSelection')
        );

        if (summary.nextElementSibling !== choiceControls) {
            summary.insertAdjacentElement('afterend', choiceControls);
        } else if (choiceControls.parentNode !== controls) {
            controls.appendChild(choiceControls);
        }
        renderChoiceSelectionState();
        renderChoiceActivationResults();
    }

    function ensureLibraryActivationNotice(controls) {
        const view = getLibraryView();
        let notice = controls.querySelector('.hb-helper-library-status');
        if (!['purchased', 'bundle', 'content'].includes(view.kind)) {
            notice?.remove();
            return;
        }
        if (!notice) {
            notice = document.createElement('div');
            notice.className = 'hb-helper-library-status';
            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.dataset.hbHelperLibraryAction = 'activate';
            const reason = document.createElement('p');
            reason.id = 'hb-helper-library-key-status';
            reason.setAttribute('role', 'status');
            button.setAttribute('aria-describedby', reason.id);
            notice.append(button, reason);
            controls.appendChild(notice);
        }
        setElementTextContent(notice.querySelector('button'), t(view.kind === 'content'
            ? 'libraryActivateGame' : 'libraryActivate'));
        setElementTextContent(notice.querySelector('p'), t('libraryKeyInformationPending'));
    }

    function refreshLibraryCards() {
        const entries = getLibraryGameEntries();
        const tiles = new Set(entries.map(entry => entry.tile));
        document.querySelectorAll('.hb-helper-library-card').forEach(tile => {
            if (!tiles.has(tile) && canModifyHelperTarget(tile)) {
                tile.classList.remove('hb-helper-library-card', 'owned', 'wishlist');
            }
        });
        for (const {tile} of entries) {
            if (!tile.classList.contains('hb-helper-library-card') && canModifyHelperTarget(tile)) {
                tile.classList.add('hb-helper-library-card');
            }
        }
    }

    function ensurePurchasedLibraryControls() {
        const view = getLibraryView();
        if (view.kind !== 'purchased' || !canModifyHelperTarget(view.heading)
            || !canModifyHelperTarget(view.heading.parentElement)) return;
        let controls = document.getElementById('hb-helper-library-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'hb-helper-library-controls';
        }
        let reminder = controls.querySelector('#hb-helper-login-reminder');
        if (hasSteamAccountData()) reminder?.remove();
        else {
            if (!reminder) {
                reminder = document.createElement('div');
                reminder.id = 'hb-helper-login-reminder';
                controls.insertBefore(reminder, controls.firstChild);
            }
            renderSteamSessionReminder(reminder, {loggedOutMessageKey: 'steamSyncLoggedOut'});
        }
        ensureLibraryActivationNotice(controls);
        if (view.heading.nextElementSibling !== controls) {
            view.heading.insertAdjacentElement('afterend', controls);
        }
    }

    function ensureHelperControls() {
        if (!isPriceTotalsPage()) return null;
        const insertionPoint = findHelperInsertionPoint();
        if (!insertionPoint) return null;
        if (!canModifyHelperTarget(insertionPoint.anchor)
            || !canModifyHelperTarget(insertionPoint.anchor.parentNode)) return null;

        let controls = document.getElementById('hb-helper-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'hb-helper-controls';
        }

        let steamGifts = document.getElementById('steamgifts-discussion');
        if (!steamGifts) {
            steamGifts = document.createElement('div');
            steamGifts.id = 'steamgifts-discussion';
            const link = document.createElement('a');
            link.id = 'hb-helper-steamgifts-link';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            steamGifts.appendChild(link);
        }
        const steamGiftsLink = steamGifts.querySelector('#hb-helper-steamgifts-link');
        steamGiftsLink.textContent = t('steamGiftsSearch');
        steamGiftsLink.href = buildSteamGiftsSearchUrl();

        let summary = document.getElementById('hb-helper-price-summary');
        const choiceActivationCurrent = choiceActivationInProgress
            && isActivationUiContextCurrent(choiceActivationContext);
        if (!hasSteamAccountData() && !choiceActivationCurrent) {
            summary?.remove();
            summary = null;
        }
        if ((hasSteamAccountData() || choiceActivationCurrent) && !summary) {
            summary = document.createElement('div');
            summary.id = 'hb-helper-price-summary';
            summary.textContent = t('loadingPriceTotals');
        }

        if (steamGifts.parentNode !== controls) controls.appendChild(steamGifts);
        if (summary && summary.parentNode !== controls) controls.appendChild(summary);
        if (summary && steamGifts.nextElementSibling !== summary) {
            controls.insertBefore(summary, steamGifts.nextSibling);
        }
        if (summary) ensureChoiceActivationControls(controls, summary);
        else if (!choiceActivationCurrent) {
            document.getElementById('hb-helper-choice-activation-controls')?.remove();
        }
        ensureLibraryActivationNotice(controls);
        const {anchor, position} = insertionPoint;
        if (position === 'beforebegin' && anchor.previousElementSibling !== controls) {
            anchor.insertAdjacentElement('beforebegin', controls);
        } else if (position === 'afterend' && anchor.nextElementSibling !== controls) {
            anchor.insertAdjacentElement('afterend', controls);
        }
        return controls;
    }

    function ensureSteamLoginReminder() {
        const controls = ensureHelperControls();
        if (!controls) return;

        let loginDiv = document.getElementById('hb-helper-login-reminder');
        if (!loginDiv) {
            loginDiv = document.createElement('div');
            loginDiv.id = 'hb-helper-login-reminder';
        }
        renderSteamSessionReminder(loginDiv, {loggedOutMessageKey: 'steamSyncLoggedOut'});
        if (loginDiv.parentNode !== controls || controls.firstElementChild !== loginDiv) {
            controls.insertBefore(loginDiv, controls.firstChild);
        }
    }

    function getSteamStoreLink(container) {
        return Array.from(container.querySelectorAll('.hb-helper-steam-store-link'))[0] || null;
    }

    function removeSteamStoreLink(link) {
        const row = link.parentElement?.classList.contains('hb-helper-steam-store-row')
            ? link.parentElement
            : null;
        link.remove();
        if (row && row.children.length === 0) row.remove();
    }

    function removeDuplicateSteamStoreLinks(container, keepLink) {
        Array.from(container.querySelectorAll('.hb-helper-steam-store-link'))
            .forEach(link => {
                if (link !== keepLink) removeSteamStoreLink(link);
            });
    }

    function getSteamStoreLinkRow(link) {
        if (link.parentElement?.classList.contains('hb-helper-steam-store-row')) {
            return link.parentElement;
        }

        const row = document.createElement('div');
        row.className = 'hb-helper-steam-store-row';
        row.appendChild(link);
        return row;
    }

    function insertSteamStoreLink(link, target) {
        const {container, placementContainer, before, after} = target;
        if (placementContainer) {
            const row = getSteamStoreLinkRow(link);
            if (after?.parentNode === placementContainer) {
                if (after.nextElementSibling !== row) {
                    after.insertAdjacentElement('afterend', row);
                }
            } else if (before?.parentNode === placementContainer) {
                if (before.previousElementSibling !== row) {
                    placementContainer.insertBefore(row, before);
                }
            } else if (row.parentNode !== placementContainer) {
                placementContainer.appendChild(row);
            }
            return;
        }

        const previousRow = link.parentElement?.classList.contains('hb-helper-steam-store-row')
            ? link.parentElement
            : null;
        if (before?.parentNode === container) {
            if (before.previousElementSibling !== link) {
                container.insertBefore(link, before);
            }
        } else if (after?.parentNode === container) {
            if (after.nextElementSibling !== link) {
                after.insertAdjacentElement('afterend', link);
            }
        } else if (link.parentNode !== container) {
            container.appendChild(link);
        }
        if (previousRow && previousRow.children.length === 0) previousRow.remove();
    }

    async function ensureSteamStoreLink(target) {
        const {container, title} = target;
        const normalizedTitle = normalizeSteamTitle(title);
        let existingLink = getSteamStoreLink(container);
        if (existingLink && existingLink.dataset.hbHelperTitle !== normalizedTitle) {
            removeSteamStoreLink(existingLink);
            existingLink = null;
        }

        if (!title || !shouldMatchSteamTitle(title)) {
            removeDuplicateSteamStoreLinks(container, null);
            return;
        }

        const app = await findSteamApp(title);
        if (!container.isConnected) return;
        if (!canModifyHelperTarget(container)
            || !canModifyHelperTarget(target.placementContainer || target.after || target.before || container)) return;
        if (!getSteamStoreLinkTargets().some(target => target.container === container
            && normalizeSteamTitle(target.title) === normalizedTitle)) return;

        if (!app) {
            removeDuplicateSteamStoreLinks(container, null);
            return;
        }

        let link = getSteamStoreLink(container);
        if (!link) {
            link = document.createElement('a');
        }
        link.className = 'hb-helper-steam-store-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('role', 'button');
        setElementTextContent(link, t('viewOnSteam'));
        link.href = getSteamStoreUrl(app.appid);
        link.dataset.hbHelperTitle = normalizedTitle;
        link.dataset.hbHelperAppid = String(app.appid);
        if (target.library) link.dataset.hbHelperLibraryLink = 'true';
        else delete link.dataset.hbHelperLibraryLink;
        removeDuplicateSteamStoreLinks(container, link);
        insertSteamStoreLink(link, target);
    }

    function findChoicePlatformPanel(scope) {
        const candidates = Array.from(scope.querySelectorAll('div, section, article, aside'))
            .filter(element => {
                const text = normalizedText(element);
                return /\bPLATFORM\b/i.test(text)
                    && /OPERATING\s+SYSTEMS/i.test(text)
                    && /\bSTEAM\b/i.test(text);
            })
            .sort((a, b) =>
                normalizedText(a).length - normalizedText(b).length
                || a.childElementCount - b.childElementCount
            );
        return candidates[0] || null;
    }

    function firstTextElement(scope, selectors) {
        return Array.from(scope.querySelectorAll(selectors))
            .find(element => normalizedText(element));
    }

    function findBundleDetailTitle(container, detailIndex) {
        const localTitleEl = firstTextElement(
            container,
            '.item-title, .human-name-title, .content-choice-title, .product-title, .game-title, h1, h2, h3'
        );
        if (localTitleEl) return {title: normalizedText(localTitleEl), anchor: localTitleEl};

        const tileTitleEl = Array.from(
            document.querySelectorAll('.tier-item-view .item-title')
        )[detailIndex];
        if (tileTitleEl) return {title: normalizedText(tileTitleEl), anchor: tileTitleEl};

        return {title: '', anchor: null};
    }

    function findChoiceModalTitle(modal) {
        return firstTextElement(
            modal,
            '.human-name-title, .content-choice-title, .product-title, .game-title, h1, h2, h3'
        );
    }

    function getSteamStoreLinkTargets() {
        const targets = [];
        for (const entry of getLibraryGameEntries()) {
            if (!isSteamBundleItem(entry.item)) continue;
            targets.push({container: entry.actionHost, placementContainer: entry.actionHost,
                title: entry.title, library: true});
        }
        document.querySelectorAll('.tier-item-details-view').forEach((container, detailIndex) => {
            const {title, anchor: titleEl} = findBundleDetailTitle(container, detailIndex);
            if (!title) return;
            const platformRows = Array.from(
                container.querySelectorAll('.delivery-and-oses.icons-and-blurbs')
            );
            const lastPlatformRow = platformRows.at(-1);
            targets.push({
                container,
                title,
                placementContainer: lastPlatformRow?.parentElement || null,
                after: lastPlatformRow || titleEl,
                before: lastPlatformRow ? null : container.querySelector('section.description'),
            });
        });

        document.querySelectorAll('#site-modal').forEach(container => {
            const titleEl = findChoiceModalTitle(container);
            const title = titleEl ? normalizedText(titleEl) : '';
            if (!container || !title) return;
            const platformPanel = findChoicePlatformPanel(container);
            targets.push({
                container,
                title,
                placementContainer: platformPanel,
                before: platformPanel
                    ? null
                    : container.querySelector('.recommendation-copy') || container.querySelector('.price'),
                after: platformPanel
                    ? null
                    : container.querySelector('.steam-rating') || titleEl,
            });
        });
        if (isGamesBundlePage() || isChoicePage()) {
            const entries = getModernGameEntries();
            document.querySelectorAll('[role="dialog"]').forEach(container => {
                if (container.id === 'site-modal') return;
                const titleEl = container.querySelector('h1, h2, h3');
                const title = titleEl ? normalizedText(titleEl) : '';
                const matches = entries.filter(entry =>
                    normalizeSteamTitle(entry.title) === normalizeSteamTitle(title));
                if (matches.length !== 1 || !isSteamBundleItem(matches[0].item)) return;
                const platformPanel = container.querySelector('[data-testid="platform-icons"]');
                targets.push({container, title, after: platformPanel || titleEl});
            });
        }
        targets.push(...getModernChoiceSteamLinkTargets());
        return targets;
    }

    function ensureSteamStoreLinks() {
        const targets = getSteamStoreLinkTargets();
        document.querySelectorAll('.hb-helper-steam-store-link').forEach(link => {
            if (!targets.some(target => target.container.contains(link)
                && normalizeSteamTitle(target.title) === link.dataset.hbHelperTitle)) {
                removeSteamStoreLink(link);
            }
        });
        targets.forEach(target => {
            ensureSteamStoreLink(target);
        });
    }

    async function reconcileVisibleGameClasses(
        nextOwnedApps = ownedApps,
        nextWishlistApps = wishlistApps
    ) {
        const elements = Array.from(
            document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal')
        );
        elements.push(...getModernGameEntries().map(entry => entry.tile));
        await Promise.all(elements.flatMap(element => [
            markOne(element, nextOwnedApps || new Set()),
            markWishlistOne(element, nextWishlistApps || new Set()),
        ]));
    }

    function markVisibleGames() {
        reconcileVisibleGameClasses().catch(error => {
            console.warn('[HB-Helper] Reconcile Steam ownership classes failed:', error);
        });
    }

    function refreshHelperPage(forcePriceReload = false, {skipDownloadRemap = false} = {}) {
        if (isDownloadsPage()) {
            refreshDownloadOrderPage({remap: !skipDownloadRemap});
            return;
        }
        if (downloadOrderRouteKey !== undefined || downloadOrderMapping) {
            resetDownloadOrderPage();
        }
        const library = getLibraryView();
        refreshLibraryCards();
        if (library.kind !== 'purchased') document.getElementById('hb-helper-library-controls')?.remove();
        if (['purchased', 'bundles', 'vault'].includes(library.kind)) {
            clearPriceHelperUi();
            refreshNonSteamGameMarkers();
            ensureSteamStoreLinks();
            if (library.kind === 'purchased') {
                ensurePurchasedLibraryControls();
                if (hasSteamAccountData()) markVisibleGames();
            }
            return;
        }
        if (!isPriceTotalsPage()) return;
        refreshNonSteamGameMarkers();
        ensureChoiceRegionRestrictions();
        const controls = ensureHelperControls();
        ensureSteamStoreLinks();
        if (!controls) return;
        if (['logged-out', 'error'].includes(steamSessionState.status)
            || (steamSessionState.status === 'syncing'
                && (steamSessionState.error || steamSessionState.phase === 'refreshing'))) {
            ensureSteamLoginReminder();
        } else if (hasSteamAccountData()) {
            document.getElementById('hb-helper-login-reminder')?.remove();
        }
        if (hasSteamAccountData()) {
            markVisibleGames();
            schedulePriceTotalsReload(forcePriceReload);
        }
    }

    function schedulePageRefresh(
        forcePriceReload = false,
        {reloadDownloadOrder = false} = {}
    ) {
        if (reloadDownloadOrder) {
            pageRefreshDownloadOrderReloadIntent = {
                routeFingerprint: getHelperRouteFingerprint(),
                orderKey: getDownloadsOrderKey(),
                generation: downloadOrderInitializationGeneration,
            };
        }
        clearTimeout(pageRefreshTimer);
        pageRefreshTimer = setTimeout(() => {
            const reloadIntent = pageRefreshDownloadOrderReloadIntent;
            pageRefreshDownloadOrderReloadIntent = undefined;
            const requiresDownloadOrderReload = Boolean(reloadIntent
                && reloadIntent.routeFingerprint === getHelperRouteFingerprint()
                && reloadIntent.orderKey === getDownloadsOrderKey()
                && reloadIntent.generation === downloadOrderInitializationGeneration);
            let refresh;
            if (helperRouteLifecycleInstalled
                && getHelperRouteFingerprint() !== helperRouteFingerprint) {
                refresh = scheduleHelperRouteSynchronization();
            } else if (isLandingSortPage()) {
                refresh = refreshLandingSortPage();
            } else if (isDownloadsPage()) {
                refresh = requiresDownloadOrderReload
                    ? reloadDownloadOrderPage()
                    : refreshDownloadOrderPage({remap: !isDownloadOrderRefreshPending()});
            } else {
                refresh = refreshHelperPage(forcePriceReload);
            }
            pageRefreshPromise = Promise.resolve(refresh).catch(error => {
                if (requiresDownloadOrderReload) {
                    console.warn('[HB-Helper] Load download order failed.');
                }
                return {error};
            });
        }, 300);
    }

    function hasChoiceHashChangeTransition(event) {
        if (event?.type !== 'hashchange'
            || typeof event.oldURL !== 'string'
            || typeof event.newURL !== 'string') {
            return false;
        }
        try {
            return new URL(event.oldURL).hash !== new URL(event.newURL).hash;
        } catch (_) {
            return true;
        }
    }

    function scheduleChoiceRegionRestrictionRefresh(event) {
        if (!isChoicePage()) return;
        if (hasChoiceHashChangeTransition(event)) {
            choiceRegionDisclosureState = undefined;
        } else {
            invalidateChoiceRegionDisclosureStateForCurrentView();
        }
        clearTimeout(choiceRegionRefreshTimer);
        choiceRegionRefreshTimer = setTimeout(() => {
            if (!isChoicePage()) return;
            ensureChoiceRegionRestrictions();
        }, 0);
    }

    function observeSteamSessionSynchronizationTriggers() {
        if (steamSessionTriggersObserved) return;
        steamSessionTriggersObserved = true;
        steamSessionSyncTrigger = createSteamSessionSyncTrigger(getSteamSessionSynchronizer());
        window.addEventListener('focus', () => steamSessionSyncTrigger());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') steamSessionSyncTrigger();
        });
    }

    function isInsideHelperUi(node) {
        const element = node?.nodeType === 3 ? node.parentElement : node;
        return Boolean(element?.closest?.([
            '#hb-helper-controls',
            '#hb-helper-library-controls',
            '#hb-helper-choice-activation-controls',
            '#hb-helper-choice-activation-results',
            '.hb-helper-region-restrictions',
            '.hb-helper-steam-store-link',
            '.hb-helper-steam-store-row',
            '.hb-helper-platform-badges',
            '.hb-helper-download-mapping-warning',
            '.hb-helper-download-mapping-summary-warning',
            '.hb-helper-download-region-warning',
        ].join(', ')));
    }

    function isHelperUiMutation(mutation) {
        if (isInsideHelperUi(mutation?.target)) return true;
        const changedNodes = [
            ...Array.from(mutation?.addedNodes || []),
            ...Array.from(mutation?.removedNodes || []),
        ];
        return changedNodes.length > 0 && changedNodes.every(isInsideHelperUi);
    }

    function shouldRefreshForPageMutations(mutations) {
        return mutations.some(mutation => !isHelperUiMutation(mutation));
    }

    function getDownloadRowsChangedByMutation(mutation) {
        const rows = new Set();
        const target = mutation?.target?.nodeType === 3
            ? mutation.target.parentElement
            : mutation?.target;
        const targetRow = target?.closest?.('.key-redeemer');
        if (targetRow) rows.add(targetRow);
        for (const node of Array.from(mutation?.addedNodes || [])) {
            const element = node?.nodeType === 3 ? node.parentElement : node;
            const row = element?.closest?.('.key-redeemer');
            if (row) rows.add(row);
            element?.querySelectorAll?.('.key-redeemer').forEach(candidate => rows.add(candidate));
        }
        return rows;
    }

    function shouldReloadDownloadOrderForPageMutations(mutations) {
        if (!isDownloadsPage()) return false;
        const initialLoadContext = getCurrentDownloadOrderInitialLoadContext();
        if (!downloadOrderData && !initialLoadContext) return false;
        const knownKeys = downloadOrderData
            ? pruneObservedKnownDownloadSteamKeys(downloadOrderData)
            : new Set();
        const relevantMutations = mutations.filter(mutation => !isHelperUiMutation(mutation));
        if (observedUnknownDownloadSteamKeys.size > 0
            && relevantMutations.some(mutation => mutation?.removedNodes?.length > 0)) {
            pruneObservedInvisibleDownloadSteamKeys();
        }
        const newlyObservedKeys = new Set();
        for (const mutation of relevantMutations) {
            for (const row of getDownloadRowsChangedByMutation(mutation)) {
                const displayedKey = extractSteamKeyFromScope(row);
                if (displayedKey
                    && !knownKeys.has(displayedKey)
                    && !observedUnknownDownloadSteamKeys.has(displayedKey)) {
                    newlyObservedKeys.add(displayedKey);
                }
            }
        }
        if (newlyObservedKeys.size === 0) return false;
        for (const key of newlyObservedKeys) observedUnknownDownloadSteamKeys.add(key);
        if (initialLoadContext) {
            initialLoadContext.reloadQueued = true;
            downloadOrderReloadMutationGeneration += 1;
            renderDownloadSelectionState();
            return false;
        }
        if (downloadOrderReloadPending) {
            downloadOrderReloadMutationGeneration += 1;
            return false;
        }
        queuedDownloadOrderReloadIntent = {orderKey: getDownloadsOrderKey()};
        return true;
    }

    function observePageChanges() {
        if (pageChangesObserved) return;
        pageChangesObserved = true;
        const observer = new MutationObserver(mutations => {
            if (!shouldRefreshForPageMutations(mutations)) return;
            if (isChoicePage()) invalidateChoiceRegionDisclosureStateForCurrentView();
            schedulePageRefresh(false, {
                reloadDownloadOrder: shouldReloadDownloadOrderForPageMutations(mutations),
            });
        });
        observer.observe(document.body, {childList: true, subtree: true});
        document.addEventListener('click', handleChoiceSelectionClick, true);
        document.addEventListener('click', handleDownloadSelectionEvent, true);
        document.addEventListener('keydown', handleDownloadSelectionEvent, true);
        document.addEventListener('click', event => {
            if (!isInsideHelperUi(event.target)) schedulePageRefresh();
        }, true);
        document.addEventListener('change', event => {
            if (!isInsideHelperUi(event.target)) schedulePageRefresh();
        }, true);
    }

    async function runChoiceOwnershipRefreshWork(
        batchId,
        {
            lockManager,
            loadAccount = getLiveSteamAccount,
            reconcileClasses = async () => {},
            owner = choiceRuntimeOwnerId,
            now = () => Date.now(),
            leaseMs = choiceOwnershipRefreshLeaseMs,
            heartbeatMs = Math.max(1000, Math.floor(leaseMs / 3)),
        } = {}
    ) {
        const manager = getChoiceLockManager(lockManager);
        if (!manager || typeof manager.request !== 'function') {
            const current = getChoiceActivationBatch();
            const message = t('choiceOwnershipRefreshUnsupportedWarning');
            if (current
                && current.id === batchId
                && current.state === choiceActivationBatchStates.complete
                && [
                    choiceActivationOwnershipStates.pending,
                    choiceActivationOwnershipStates.refreshing,
                ].includes(current.ownershipRefresh.state)) {
                const failedBatch = JSON.parse(JSON.stringify(current));
                failedBatch.ownershipRefresh = {
                    state: choiceActivationOwnershipStates.failed,
                    owner: null,
                    leaseExpiresAt: null,
                    error: message,
                };
                saveChoiceActivationBatchIfCurrent(failedBatch, {
                    refreshOwner: current.ownershipRefresh.owner,
                });
            }
            return {refreshed: false, unsupported: true, message};
        }

        const lockResult = await requestChoiceExclusiveLock(
            choiceOwnershipRefreshLockName,
            async () => {
                const current = getChoiceActivationBatch();
                if (!current
                    || current.id !== batchId
                    || current.state !== choiceActivationBatchStates.complete
                    || ![
                        choiceActivationOwnershipStates.pending,
                        choiceActivationOwnershipStates.refreshing,
                    ].includes(current.ownershipRefresh.state)) {
                    return {refreshed: false};
                }

                const claimed = JSON.parse(JSON.stringify(current));
                claimed.ownershipRefresh = {
                    state: choiceActivationOwnershipStates.refreshing,
                    owner,
                    leaseExpiresAt: now() + leaseMs,
                    error: null,
                };
                GM_setValue(steamActivationBatchKey, claimed);
                const ownsRefresh = () => {
                    const stored = getChoiceActivationBatch();
                    return Boolean(stored
                        && stored.id === batchId
                        && stored.state === choiceActivationBatchStates.complete
                        && stored.ownershipRefresh.state
                            === choiceActivationOwnershipStates.refreshing
                        && stored.ownershipRefresh.owner === owner);
                };
                if (!ownsRefresh()) return {refreshed: false, stopped: true};

                const heartbeat = setInterval(() => {
                    const stored = getChoiceActivationBatch();
                    if (!stored
                        || stored.id !== batchId
                        || stored.ownershipRefresh.owner !== owner) {
                        return;
                    }
                    const renewed = JSON.parse(JSON.stringify(stored));
                    renewed.ownershipRefresh.leaseExpiresAt = now() + leaseMs;
                    saveChoiceActivationBatchIfCurrent(renewed, {refreshOwner: owner});
                }, heartbeatMs);

                try {
                    const account = await loadAccount();
                    if (!Array.isArray(account?.ownedApps)
                        || !Array.isArray(account?.wishlistApps)) {
                        throw new Error(t('steamInvalidAccountData'));
                    }
                    if (!ownsRefresh()) return {refreshed: false, stopped: true};

                    const refreshedOwnedApps = new Set(account.ownedApps);
                    const refreshedWishlistApps = new Set(account.wishlistApps);
                    await reconcileClasses(
                        refreshedOwnedApps,
                        refreshedWishlistApps,
                        account
                    );
                    if (!ownsRefresh()) return {refreshed: false, stopped: true};

                    const completedBatch = JSON.parse(JSON.stringify(getChoiceActivationBatch()));
                    completedBatch.ownershipRefresh = {
                        state: choiceActivationOwnershipStates.complete,
                        owner: null,
                        leaseExpiresAt: null,
                        error: null,
                    };
                    if (!saveChoiceActivationBatchIfCurrent(
                        completedBatch,
                        {refreshOwner: owner}
                    )) {
                        return {refreshed: false, stopped: true};
                    }
                    return {
                        refreshed: true,
                        stopped: false,
                        ownedApps: refreshedOwnedApps,
                        wishlistApps: refreshedWishlistApps,
                    };
                } catch (error) {
                    console.warn('[HB-Helper] Refresh Steam account after activation failed:', error);
                    if (!ownsRefresh()) {
                        return {refreshed: false, stopped: true, error};
                    }
                    const failedBatch = JSON.parse(JSON.stringify(getChoiceActivationBatch()));
                    failedBatch.ownershipRefresh = {
                        state: choiceActivationOwnershipStates.failed,
                        owner: null,
                        leaseExpiresAt: null,
                        error: t('choiceOwnershipRefreshWarning'),
                    };
                    if (!saveChoiceActivationBatchIfCurrent(
                        failedBatch,
                        {refreshOwner: owner}
                    )) {
                        return {refreshed: false, stopped: true, error};
                    }
                    return {refreshed: false, error};
                } finally {
                    clearInterval(heartbeat);
                }
            },
            {lockManager: manager, ifAvailable: true}
        );
        if (!lockResult.acquired) {
            return {
                refreshed: false,
                lockUnavailable: !lockResult.unsupported,
                unsupported: lockResult.unsupported,
                message: lockResult.message,
            };
        }
        return lockResult.value;
    }

    async function fetchFreshSteamAccountAfterActivation(
        syncSession = syncSteamSession
    ) {
        const state = await syncSession({force: true});
        if (state.status !== 'authenticated' || !isSteamAccountData(state.account)) {
            throw state.error || new Error(t('loginSteamLoadAccountData'));
        }
        return state.account;
    }

    async function satisfyDeferredChoiceOwnershipRefresh({lockManager} = {}) {
        const deferredBatch = getChoiceActivationBatch();
        if (!deferredBatch
            || deferredBatch.state !== choiceActivationBatchStates.complete
            || deferredBatch.ownershipRefresh.state
                !== choiceActivationOwnershipStates.failed) {
            return {updated: false};
        }
        const expectedBatchId = deferredBatch.id;
        const lockResult = await requestChoiceExclusiveLock(
            choiceCollectionLockName,
            () => {
                const current = getChoiceActivationBatch();
                if (!current
                    || current.id !== expectedBatchId
                    || current.state !== choiceActivationBatchStates.complete
                    || current.ownershipRefresh.state
                        !== choiceActivationOwnershipStates.failed) {
                    return {updated: false, batch: current};
                }
                const completedBatch = JSON.parse(JSON.stringify(current));
                completedBatch.ownershipRefresh = {
                    state: choiceActivationOwnershipStates.complete,
                    owner: null,
                    leaseExpiresAt: null,
                    error: null,
                };
                const updated = saveChoiceActivationBatchIfCurrent(
                    completedBatch,
                    {state: choiceActivationBatchStates.complete}
                );
                return {
                    updated,
                    batch: updated ? completedBatch : getChoiceActivationBatch(),
                };
            },
            {lockManager}
        );
        if (!lockResult.acquired) return {...lockResult, updated: false};
        return lockResult.value;
    }

    async function refreshCompletedChoiceActivationBatch(batch) {
        const result = await runChoiceOwnershipRefreshWork(
            batch.id,
            {
                loadAccount: fetchFreshSteamAccountAfterActivation,
                reconcileClasses: async (refreshedOwnedApps, refreshedWishlistApps, account) =>
                    applySteamSessionState({status: 'authenticated', account, error: null}),
            }
        );
        if (result.unsupported) setChoiceStatus(result.message);
        if (result.error) {
            console.warn('[HB-Helper] Steam ownership refresh warning:', result.error);
        }
        const currentBatch = getChoiceActivationBatch();
        if (currentBatch?.id === batch.id) renderChoiceActivationResults(currentBatch);
        return result;
    }

    async function reconcileChoiceActivationBatchCore(
        batch = getChoiceActivationBatch(),
        {
            refreshBatch = refreshCompletedChoiceActivationBatch,
            ownershipRetryMs = choiceLockRetryMs,
            activationWork = runSteamActivationWork,
            scheduleActivationRetry = (callback, delay) => setTimeout(callback, delay),
            now = () => Date.now(),
        } = {}
    ) {
        const currentBatch = getChoiceActivationBatch();
        if (batch && currentBatch?.id !== batch.id) return;
        batch = currentBatch;
        if (!batch) {
            clearTimeout(choiceCollectionRecoveryTimer);
            clearTimeout(choiceActivationRecoveryTimer);
            clearTimeout(choiceOwnershipRefreshTimer);
            renderChoiceSelectionState();
            renderDownloadSelectionState();
            renderChoiceActivationResults(null);
            return;
        }

        const selectionReconciliation = await reconcileActivationSelectionStorageFromBatch(batch);
        const reconciledBatch = getChoiceActivationBatch();
        if (!reconciledBatch || reconciledBatch.id !== batch.id) {
            renderChoiceSelectionState();
            renderDownloadSelectionState();
            renderChoiceActivationResults(reconciledBatch);
            return {stale: true, batch: reconciledBatch};
        }
        if (!selectionReconciliation.reconciled) return selectionReconciliation;
        batch = reconciledBatch;
        renderChoiceSelectionState();
        renderDownloadSelectionState();
        renderChoiceActivationResults(batch);

        clearTimeout(choiceCollectionRecoveryTimer);
        clearTimeout(choiceActivationRecoveryTimer);
        if (batch.state === choiceActivationBatchStates.collecting) {
            choiceCollectionRecoveryTimer = setTimeout(async () => {
                const recovery = await recoverStaleChoiceCollection();
                if (recovery.recovered) {
                    await reconcileChoiceActivationBatch();
                } else if (recovery.lockUnavailable) {
                    choiceCollectionRecoveryTimer = setTimeout(() => {
                        reconcileChoiceActivationBatch().catch(error => {
                            console.warn('[HB-Helper] Recover collection lock failed:', error);
                        });
                    }, 1000);
                }
            }, Math.max(0, batch.runner.leaseExpiresAt - Date.now()) + 25);
            return;
        }
        if (batch.state === choiceActivationBatchStates.activating) {
            const result = await activationWork({
                sessionId: isChoiceActivationUiAvailable()
                    ? steamSessionState.account.sessionId
                    : '',
            });
            if (result.unsupported) setChoiceStatus(result.message);
            if (result.busy && Number.isFinite(result.retryAt)) {
                const retryDelay = Math.max(0, result.retryAt - now()) + 25;
                choiceActivationRecoveryTimer = scheduleActivationRetry(
                    () => reconcileChoiceActivationBatch(undefined, {
                        refreshBatch,
                        ownershipRetryMs,
                        activationWork,
                        scheduleActivationRetry,
                        now,
                    }).catch(error => {
                        console.warn('[HB-Helper] Recover activation lease failed:', error);
                    }),
                    retryDelay
                );
                return;
            }
            const latest = getChoiceActivationBatch();
            if (latest?.id === batch.id) {
                renderChoiceActivationResults(latest);
                if (latest.state === choiceActivationBatchStates.complete) {
                    await reconcileChoiceActivationBatch(latest, {
                        refreshBatch,
                        ownershipRetryMs,
                        activationWork,
                        scheduleActivationRetry,
                        now,
                    });
                }
            }
            return;
        }
        if (batch.state !== choiceActivationBatchStates.complete) return;
        clearTimeout(choiceOwnershipRefreshTimer);
        const refresh = batch.ownershipRefresh;
        if ([
            choiceActivationOwnershipStates.complete,
            choiceActivationOwnershipStates.failed,
        ].includes(refresh.state)) {
            return;
        }
        if (refresh.state === choiceActivationOwnershipStates.pending
            || refresh.state === choiceActivationOwnershipStates.refreshing) {
            const result = await refreshBatch(batch);
            if (result.lockUnavailable) {
                const latest = getChoiceActivationBatch();
                if (latest?.id === batch.id
                    && [
                        choiceActivationOwnershipStates.pending,
                        choiceActivationOwnershipStates.refreshing,
                    ].includes(latest.ownershipRefresh.state)) {
                    const retryDelay = latest.ownershipRefresh.state
                        === choiceActivationOwnershipStates.refreshing
                        ? Math.max(
                            ownershipRetryMs,
                            latest.ownershipRefresh.leaseExpiresAt - Date.now() + 25
                        )
                        : ownershipRetryMs;
                    choiceOwnershipRefreshTimer = setTimeout(
                        () => reconcileChoiceActivationBatch(undefined, {
                            refreshBatch,
                            ownershipRetryMs,
                        }).catch(error => {
                            console.warn('[HB-Helper] Recover ownership refresh lock failed:', error);
                        }),
                        retryDelay
                    );
                }
            }
        }
    }

    async function reconcileChoiceActivationBatch(...args) {
        try {
            return await reconcileChoiceActivationBatchCore(...args);
        } finally {
            await queueDownloadRevealReloadCompletion();
        }
    }

    function observeChoiceActivationBatch() {
        if (choiceActivationBatchListener !== undefined) return;
        choiceActivationBatchListener = GM_addValueChangeListener(
            steamActivationBatchKey,
            (name, oldValue, newValue) => {
                const batch = getChoiceActivationBatch(newValue);
                reconcileChoiceActivationBatch(batch).catch(error => {
                    console.warn('[HB-Helper] Reconcile activation batch failed:', error);
                });
            }
        );
    }

    function postSteamActivationKey(sessionId, key) {
        const url = 'https://store.steampowered.com/account/ajaxregisterkey/';
        const data = new URLSearchParams({
            product_key: key,
            sessionid: sessionId,
        }).toString();

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                ...steamRequestOptions,
                method: 'POST',
                url,
                data,
                responseType: 'json',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                timeout: gmRequestTimeoutMs,
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    try {
                        resolve(response || JSON.parse(responseText || '{}'));
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
                ontimeout: () => reject(new Error(t('requestTimedOut'))),
            });
        });
    }

    function getSteamActivationFailure(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info || {};
        const rawCode = data.purchase_result_details ?? data.purchase_result_detail ?? 'unknown';
        const numericCode = Number(rawCode);
        const code = Number.isFinite(numericCode) ? numericCode : rawCode;
        const knownReasonKeys = {
            9: 'steamActivationAlreadyOwned',
            13: 'steamActivationRegionRestricted',
            14: 'steamActivationInvalidKey',
            15: 'steamActivationAlreadyUsed',
            24: 'steamActivationBaseGameRequired',
            53: 'steamActivationRateLimited',
        };
        const returnedReason = receipt.error_headline
            || receipt.error_string
            || data.error_string
            || data.error_message;
        return {
            code,
            error: knownReasonKeys[code]
                ? t(knownReasonKeys[code])
                : returnedReason || t('steamActivationUnknownCode', {code}),
        };
    }

    function isSteamActivationSuccess(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info;
        const lineItems = receipt?.line_items || receipt?.lineItems;
        const detail = Number(data.purchase_result_details ?? data.purchase_result_detail);
        return detail === 0
            && Boolean(receipt)
            && !receipt.error_string
            && !receipt.error_headline
            && Array.isArray(lineItems)
            && lineItems.length > 0;
    }

    function isSteamActivationResponse(response) {
        const data = response?.response || response;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return false;
        }
        const hasResult = Object.prototype.hasOwnProperty.call(
            data,
            'purchase_result_details'
        ) || Object.prototype.hasOwnProperty.call(data, 'purchase_result_detail');
        if (!hasResult) return false;
        const rawDetail = data.purchase_result_details ?? data.purchase_result_detail;
        if (rawDetail === null || rawDetail === '' || !Number.isFinite(Number(rawDetail))) {
            return false;
        }
        const detail = Number(rawDetail);
        return detail !== 0 || isSteamActivationSuccess(response);
    }

    function completeSteamActivationBatch(batch) {
        batch.state = choiceActivationBatchStates.complete;
        batch.runner = {phase: null, owner: null, leaseExpiresAt: null};
        batch.ownershipRefresh = {
            state: choiceActivationOwnershipStates.pending,
            owner: null,
            leaseExpiresAt: null,
            error: null,
        };
    }

    function cancelUncertainSteamActivationBatch(batch) {
        for (const item of batch.items) {
            if (item.status === choiceActivationItemStates.activating) {
                item.status = choiceActivationItemStates.steamFailed;
                item.error = t('steamActivationInterruptedUncertain');
                item.code = null;
            } else if (item.status === choiceActivationItemStates.pending) {
                item.status = choiceActivationItemStates.steamFailed;
                item.error = t('steamActivationCancelledNotSubmitted');
                item.code = null;
            }
        }
        completeSteamActivationBatch(batch);
        return batch;
    }

    async function processSteamActivationBatch(
        batch,
        sessionId,
        activateKey = postSteamActivationKey,
        saveBatch,
        showProgress = () => {},
        {
            owner = batch.runner.owner,
            now = () => Date.now(),
            leaseMs = choiceActivationRunnerLeaseMs,
            recheckSession = options => syncSteamSession(options),
            isContextCurrent = () => true,
        } = {}
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        const stop = () => {
            cancelUncertainSteamActivationBatch(batch);
            persist(batch);
            return {batch, paused: false, stopped: true};
        };
        if (batch.items.some(item => item.status === choiceActivationItemStates.activating)) {
            return stop();
        }
        const pendingItems = batch.items.filter(
            item => item.status === choiceActivationItemStates.pending
        );
        if (!isNonEmptyString(sessionId) && pendingItems.length > 0) {
            return stop();
        }
        if (batch.state !== choiceActivationBatchStates.activating) {
            return {batch, paused: false, stopped: true};
        }

        for (let index = 0; index < pendingItems.length; index++) {
            if (!isContextCurrent()) return stop();
            const item = pendingItems[index];
            showProgress(
                item,
                index,
                pendingItems.length,
                getChoiceActivationDisplayLabel(batch, item)
            );
            item.status = choiceActivationItemStates.activating;
            if (isNonEmptyString(owner)) {
                batch.runner.leaseExpiresAt = now() + leaseMs;
            }
            if (persist(batch) === false) {
                return {batch, paused: false, stopped: true};
            }
            if (!isContextCurrent()) {
                item.status = choiceActivationItemStates.pending;
                return stop();
            }
            try {
                const response = await activateKey(sessionId, item.key);
                if (!isSteamActivationResponse(response)) {
                    throw new Error(t('steamInvalidAccountData'));
                }
                if (isSteamActivationSuccess(response)) {
                    item.status = choiceActivationItemStates.activated;
                    item.key = null;
                    delete item.error;
                    delete item.code;
                } else {
                    const failure = getSteamActivationFailure(response);
                    item.status = choiceActivationItemStates.steamFailed;
                    item.error = failure.error;
                    item.code = failure.code;
                }
            } catch (error) {
                if (!isContextCurrent()) return stop();
                item.status = choiceActivationItemStates.steamFailed;
                item.error = t('steamActivationRequestFailed', {
                    message: error?.message || String(error),
                });
                item.code = null;
                let recheckedState;
                try {
                    recheckedState = await recheckSession({force: true});
                } catch (syncError) {
                    recheckedState = {status: 'error', account: null, error: syncError};
                }
                if (!isContextCurrent()
                    || recheckedState.status !== 'authenticated'
                    || !isSteamAccountData(recheckedState.account)) {
                    item.status = choiceActivationItemStates.activating;
                    delete item.error;
                    delete item.code;
                    return stop();
                }
                sessionId = recheckedState.account.sessionId;
            }
            if (!isContextCurrent()) return stop();
            if (isNonEmptyString(owner)) {
                batch.runner.leaseExpiresAt = now() + leaseMs;
            }
            if (persist(batch) === false) {
                return {batch, paused: false, stopped: true};
            }
        }

        completeSteamActivationBatch(batch);
        if (persist(batch) === false) {
            return {batch, paused: false, stopped: true};
        }
        return {batch, paused: false, stopped: false};
    }

    async function runSteamActivationWork({
        lockManager,
        sessionId,
        activateKey = postSteamActivationKey,
        showProgress = () => {},
        owner = choiceRuntimeOwnerId,
        now = () => Date.now(),
        leaseMs = choiceActivationRunnerLeaseMs,
        recheckSession = options => syncSteamSession(options),
        isContextCurrent = () => true,
    } = {}) {
        const lockResult = await requestChoiceExclusiveLock(
            steamActivationLockName,
            async () => {
                const current = getChoiceActivationBatch();
                if (!current || current.state !== choiceActivationBatchStates.activating) {
                    return {processed: false, batch: current};
                }

                const batch = JSON.parse(JSON.stringify(current));
                const foreignRunner = batch.runner.owner !== owner;
                const runnerLeaseActive = isNonEmptyString(batch.runner.owner)
                    && Number.isFinite(batch.runner.leaseExpiresAt)
                    && batch.runner.leaseExpiresAt > now();
                if (foreignRunner && runnerLeaseActive) {
                    return {
                        processed: false,
                        busy: true,
                        retryAt: batch.runner.leaseExpiresAt,
                        batch: current,
                    };
                }
                if (foreignRunner || batch.items.some(
                        item => item.status === choiceActivationItemStates.activating
                    )) {
                    cancelUncertainSteamActivationBatch(batch);
                    GM_setValue(steamActivationBatchKey, batch);
                    return {processed: false, stopped: true, batch};
                }
                batch.runner = {
                    phase: choiceActivationBatchStates.activating,
                    owner,
                    leaseExpiresAt: now() + leaseMs,
                };
                GM_setValue(steamActivationBatchKey, batch);
                const claimed = getChoiceActivationBatch();
                if (claimed?.id !== batch.id || claimed.runner.owner !== owner) {
                    return {processed: false, stopped: true, batch: claimed};
                }

                const saveBatch = nextBatch => {
                    const stored = getChoiceActivationBatch();
                    if (!stored
                        || stored.id !== nextBatch.id
                        || stored.runner.owner !== owner) {
                        return false;
                    }
                    GM_setValue(steamActivationBatchKey, nextBatch);
                    const saved = getChoiceActivationBatch();
                    return Boolean(saved
                        && saved.id === nextBatch.id
                        && JSON.stringify(saved) === JSON.stringify(nextBatch));
                };
                const result = await processSteamActivationBatch(
                    batch,
                    sessionId,
                    activateKey,
                    saveBatch,
                    showProgress,
                    {owner, now, leaseMs, recheckSession, isContextCurrent}
                );
                return {...result, processed: !result.paused && !result.stopped};
            },
            {lockManager}
        );
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    function getHelperRouteFingerprint() {
        return `${location.pathname}\n${location.search || ''}`;
    }

    function clearPriceHelperUi() {
        refreshNonSteamGameMarkers();
        clearChoiceRegionRestrictionPanels();
        choiceRegionDisclosureState = undefined;
        priceTotalsRunId += 1;
        lastPriceInputKey = '';
        lastPriceResult = undefined;
        document.getElementById('hb-helper-controls')?.remove();
        document.getElementById('steamgifts-discussion')?.remove();
        document.getElementById('hb-helper-price-summary')?.remove();
        const activationControls = document.getElementById(
            'hb-helper-choice-activation-controls'
        );
        if (activationControls
            && !activationControls.classList.contains('hb-helper-downloads-controls')) {
            activationControls.remove();
        }
    }

    function leaveDownloadOrderPage() {
        if (downloadOrderRouteKey !== undefined
            || downloadOrderMapping
            || document.getElementById('hb-helper-choice-activation-controls')
                ?.classList.contains('hb-helper-downloads-controls')) {
            resetDownloadOrderPage();
        }
    }

    async function synchronizeHelperRoute(generation, routeFingerprint) {
        const mode = getHelperPageMode();
        const isCurrentRoute = () =>
            generation === helperRouteTransitionGeneration
            && routeFingerprint === getHelperRouteFingerprint();
        const loadOrder = helperRouteDependencies.loadOrder || loadDownloadOrder;
        const syncSession = helperRouteDependencies.syncSession || syncSteamSession;
        const reconcileBatch = helperRouteDependencies.reconcileBatch
            || reconcileChoiceActivationBatch;
        const recoverCollection = helperRouteDependencies.recoverCollection
            || recoverStaleChoiceCollection;

        if (mode !== 'downloads') leaveDownloadOrderPage();
        if (mode !== 'library') {
            document.getElementById('hb-helper-library-controls')?.remove();
            document.querySelectorAll('[data-hb-helper-library-link]').forEach(removeSteamStoreLink);
            refreshLibraryCards();
        }

        if (mode === 'landing') {
            clearPriceHelperUi();
            observeLandingSortPageChanges();
            refreshLandingSortPage();
            return {mode};
        }

        if (mode === 'unsupported') {
            clearPriceHelperUi();
            return {mode};
        }

        observeSteamSessionSynchronizationTriggers();
        if (mode === 'downloads') {
            clearPriceHelperUi();
            observeChoiceActivationBatch();
            try {
                await initializeDownloadOrderPage({loadOrder});
            } catch (error) {
                if (isCurrentRoute()) {
                    console.warn('[HB-Helper] Load download order failed.');
                    setChoiceStatus(t('downloadOrderLoadFailed'));
                }
            }
            if (!isCurrentRoute()) return {stale: true, mode};
            await syncSession();
            if (!isCurrentRoute()) return {stale: true, mode};
            refreshDownloadOrderPage();
            await reconcileBatch();
            return {mode};
        }

        const choiceRoute = isChoicePage();
        if (choiceRoute) {
            observeChoiceActivationBatch();
            observeChoiceSelection();
        }
        refreshHelperPage(true);

        if (choiceRoute) {
            const recovery = await recoverCollection();
            if (!isCurrentRoute()) return {stale: true, mode};
            if (recovery.recovered) {
                renderChoiceSelectionState();
                renderChoiceActivationResults(null);
            } else if (recovery.unsupported) {
                setChoiceStatus(recovery.message);
            }
        }

        await syncSession();
        if (!isCurrentRoute()) return {stale: true, mode};
        refreshHelperPage();
        if (choiceRoute) await reconcileBatch();
        return {mode};
    }

    function scheduleHelperRouteSynchronization({force = false} = {}) {
        const routeFingerprint = getHelperRouteFingerprint();
        if (!force && routeFingerprint === helperRouteFingerprint) {
            return helperRouteTransitionPromise;
        }
        const previousRoute = helperRouteFingerprint;
        helperRouteFingerprint = routeFingerprint;
        if (previousRoute !== routeFingerprint) resetHelperHydration();
        const generation = ++helperRouteTransitionGeneration;
        if (previousRoute !== undefined && previousRoute !== routeFingerprint) {
            landingPageDataCache = undefined;
            landingPageDataSourcePromise = undefined;
            if (['landing', 'price-totals'].includes(getHelperPageMode())
                && document.querySelector('script[src*="/_next/"]')) {
                const loadPage = helperRouteDependencies.loadNextPage || loadNextPageDataFromSource;
                Promise.resolve(loadPage(routeFingerprint)).then(result => {
                    if (result?.loaded && routeFingerprint === getHelperRouteFingerprint()) {
                        schedulePageRefresh(true);
                    }
                }).catch(() => {
                    console.warn('[HB-Helper] Failed to load current page data.');
                });
            }
        }
        choiceRegionDisclosureState = undefined;
        const transition = synchronizeHelperRoute(generation, routeFingerprint);
        helperRouteTransitionPromise = Promise.resolve(transition).catch(() => {
            if (generation === helperRouteTransitionGeneration) {
                console.warn('[HB-Helper] Route synchronization failed.');
            }
            return {error: true};
        });
        return helperRouteTransitionPromise;
    }

    function installHelperRouteLifecycle(options = {}) {
        if (helperRouteLifecycleInstalled) return helperRouteTransitionPromise;
        helperRouteLifecycleInstalled = true;
        helperRouteDependencies = {...options};
        observePageChanges();
        window.addEventListener('pagehide', () => {
            resetHelperHydration();
            clearTimeout(pageRefreshTimer);
            clearTimeout(landingSortRefreshTimer);
        });
        window.addEventListener('focus', retryHelperHydrationAfterPageEvent);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') retryHelperHydrationAfterPageEvent();
        });

        for (const methodName of ['pushState', 'replaceState']) {
            const original = window.history?.[methodName];
            if (typeof original !== 'function') continue;
            window.history[methodName] = function (...args) {
                const previousRoute = getHelperRouteFingerprint();
                const previousHash = location.hash;
                const result = original.apply(this, args);
                if (getHelperRouteFingerprint() !== previousRoute) {
                    scheduleHelperRouteSynchronization();
                } else if (location.hash !== previousHash) {
                    scheduleChoiceRegionRestrictionRefresh();
                }
                return result;
            };
        }
        window.addEventListener('popstate', () => {
            if (getHelperRouteFingerprint() !== helperRouteFingerprint) {
                scheduleHelperRouteSynchronization();
            } else {
                scheduleChoiceRegionRestrictionRefresh();
            }
        });
        window.addEventListener('hashchange', scheduleChoiceRegionRestrictionRefresh);
        return scheduleHelperRouteSynchronization({force: true});
    }

    function run() {
        return installHelperRouteLifecycle();
    }

    function startHelper() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', startHelper, {once: true});
            return;
        }
        run();
    }

    function gmRequest(url, responseType = 'json', options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                ...options,
                timeout: options.timeout ?? gmRequestTimeoutMs,
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    resolve(responseType === 'json' ? response : responseText || response);
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
                ontimeout: () => reject(new Error(t('requestTimedOut'))),
            });
        });
    }

    function getSteamCountryCode() {
        return getLiveSteamAccount().countryCode;
    }

    function getXiaoheiheRegionCode(steamCountryCode) {
        const countryCode = steamCountryCode.toLowerCase();
        const regionAliases = {
            gb: 'uk',
        };
        return regionAliases[countryCode]
            || (europeanSteamCountries.has(steamCountryCode) ? 'eu' : countryCode);
    }

    async function fetchXiaoheihePriceHistory(appId, steamCountryCode) {
        const cacheKey = `${steamCountryCode}:${appId}`;
        if (priceHistoryCache.has(cacheKey)) return priceHistoryCache.get(cacheKey);

        const request = (async () => {
            const params = new URLSearchParams({
                appid: appId,
                platf: 'steam',
                cc: getXiaoheiheRegionCode(steamCountryCode),
                days: '720',
            });
            const data = await gmRequest(
                `https://api.xiaoheihe.cn/game/get_game_prices/history/v2?${params}`
            );
            const prices = data.result?.prices;
            if (data.status !== 'ok' || !prices?.length) {
                throw new Error(t('xiaoheiheNoPrice', {region: steamCountryCode, appId}));
            }

            const latest = prices.at(-1);
            const current = Number(latest.price);
            const discount = Number(latest.discount);
            const previousFullPrice = prices.findLast(price => Number(price.discount) === 0);
            const original = discount > 0
                ? Number(previousFullPrice?.price) || current / (1 - discount / 100)
                : current;
            const lowest = Number(data.result.lowest_info?.price)
                || Math.min(...prices.map(price => Number(price.price)));
            const price = {current, original, lowest, currency: latest.currency};
            if (Object.values(price).some(value => value === undefined || value === null)
                || [current, original, lowest].some(value => !Number.isFinite(value))) {
                throw new Error(t('xiaoheiheInvalidPrice', {appId}));
            }
            return price;
        })();
        priceHistoryCache.set(cacheKey, request);
        try {
            return await request;
        } catch (error) {
            priceHistoryCache.delete(cacheKey);
            throw error;
        }
    }

    async function fetchExchangeRate(baseCurrency, quoteCurrency) {
        if (baseCurrency === quoteCurrency) return 1;
        const cacheKey = `${baseCurrency}:${quoteCurrency}`;
        if (exchangeRateCache.has(cacheKey)) return exchangeRateCache.get(cacheKey);

        const request = gmRequest(
            `https://api.frankfurter.dev/v2/rate/${baseCurrency}/${quoteCurrency}`
        ).then(data => {
            const rate = Number(data.rate);
            if (!Number.isFinite(rate)) throw new Error(t('invalidExchangeRate'));
            return rate;
        });
        exchangeRateCache.set(cacheKey, request);
        try {
            return await request;
        } catch (error) {
            exchangeRateCache.delete(cacheKey);
            throw error;
        }
    }

    // Simple Icons brand paths: https://github.com/simple-icons/simple-icons (CC0).
    const platformIconPaths = {
        gogdotcom: 'M7.15 15.24H4.36a.4.4 0 0 0-.4.4v2c0 .21.18.4.4.4h2.8v1.32h-3.5c-.56 0-1.02-.46-1.02-1.03v-3.39c0-.56.46-1.02 1.03-1.02h3.48v1.32zM8.16 11.54c0 .58-.47 1.05-1.05 1.05H2.63v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4H4.39a.4.4 0 0 0-.41.4v2.02c0 .23.18.4.4.4H6v1.35H3.68c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04H7.1c.58 0 1.05.47 1.05 1.04v5.86zM21.36 19.36h-1.32v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.42c0-.56.46-1.02 1.03-1.02h5.61v5.44zM21.37 11.54c0 .58-.47 1.05-1.05 1.05h-4.48v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4h-2.03a.4.4 0 0 0-.4.4v2.02c0 .23.18.4.4.4h1.62v1.35H16.9c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04h3.43c.58 0 1.05.47 1.05 1.04v5.86zM13.72 4.64h-3.44c-.58 0-1.04.47-1.04 1.04v3.44c0 .58.46 1.04 1.04 1.04h3.44c.57 0 1.04-.46 1.04-1.04V5.68c0-.57-.47-1.04-1.04-1.04m-.3 1.75v2.02a.4.4 0 0 1-.4.4h-2.03a.4.4 0 0 1-.4-.4V6.4c0-.22.17-.4.4-.4H13c.23 0 .4.18.4.4zM12.63 13.92H9.24c-.57 0-1.03.46-1.03 1.02v3.39c0 .57.46 1.03 1.03 1.03h3.39c.57 0 1.03-.46 1.03-1.03v-3.39c0-.56-.46-1.02-1.03-1.02m-.3 1.72v2a.4.4 0 0 1-.4.4v-.01H9.94a.4.4 0 0 1-.4-.4v-1.99c0-.22.18-.4.4-.4h2c.22 0 .4.18.4.4zM23.49 1.1a1.74 1.74 0 0 0-1.24-.52H1.75A1.74 1.74 0 0 0 0 2.33v19.34a1.74 1.74 0 0 0 1.75 1.75h20.5A1.74 1.74 0 0 0 24 21.67V2.33c0-.48-.2-.92-.51-1.24m0 20.58a1.23 1.23 0 0 1-1.24 1.24H1.75A1.23 1.23 0 0 1 .5 21.67V2.33a1.23 1.23 0 0 1 1.24-1.24h20.5a1.24 1.24 0 0 1 1.24 1.24v19.34z',
        ign: 'M5.38 7.66c.59-.9 1.359-1.67 2.26-2.26.13-1.18.31-2.26.52-3.21a10.602 10.602 0 0 0-6 6c.95-.22 2.03-.39 3.21-.52m10.97-2.3v.02c.9.59 1.67 1.37 2.27 2.27 1.18.13 2.26.31 3.21.52a10.632 10.632 0 0 0-6.02-6.01c.22.95.4 2.02.54 3.2m-8.7 13.26c-.9-.59-1.67-1.37-2.27-2.27h-.03c-1.19-.14-2.26-.32-3.19-.54 1.07 2.75 3.26 4.95 6.01 6.02-.22-.95-.39-2.03-.52-3.21m11-2.27h-.03c-.59.9-1.37 1.67-2.27 2.27v.03c-.14 1.17-.32 2.25-.54 3.19a10.593 10.593 0 0 0 6.03-6.03c-.94.22-2 .4-3.19.54M10.04.01h3.9c.85 1.85 1.2 4.59 1.3 5.52.04.22.06.43.06.63L12 9.12 8.7 6.16c0-.17.02-.35.05-.55.1-.95.43-3.75 1.29-5.61M8.7 17.84c0 .17.02.35.05.55.1.95.43 3.75 1.29 5.61h3.9c.85-1.84 1.2-4.59 1.3-5.52.04-.22.06-.43.06-.64L12 14.88l-3.3 2.96ZM6.16 8.69c-.17 0-.35.02-.55.05-.95.12-3.75.45-5.61 1.31v3.9c1.84.85 4.59 1.19 5.52 1.3.22.04.43.06.64.06l2.95-3.3-2.95-3.3v-.02ZM24 10.03c-1.86-.86-4.66-1.19-5.61-1.29-.2-.03-.38-.05-.55-.05l-2.96 3.3 2.96 3.3c.2 0 .41-.02.64-.06.93-.11 3.68-.45 5.52-1.3v-3.9Z',
        epicgames: 'M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z',
        battledotnet: 'M18.94 8.296C15.9 6.892 11.534 6 7.426 6.332c.206-1.36.714-2.308 1.548-2.508 1.148-.275 2.4.48 3.594 1.854.782.102 1.71.28 2.355.429C12.747 2.013 9.828-.282 7.607.565c-1.688.644-2.553 2.97-2.448 6.094-2.2.468-3.915 1.3-5.013 2.495-.056.065-.181.227-.137.305.034.058.146-.008.194-.04 1.274-.89 2.904-1.373 5.027-1.676.303 3.333 1.713 7.56 4.055 10.952-1.28.502-2.356.536-2.946-.087-.812-.856-.784-2.318-.19-4.04a26.764 26.764 0 0 1-.807-2.254c-2.459 3.934-2.986 7.61-1.143 9.11 1.402 1.14 3.847.725 6.502-.926 1.505 1.672 3.083 2.74 4.667 3.094.084.015.287.043.332-.034.034-.06-.08-.124-.131-.149-1.408-.657-2.64-1.828-3.964-3.515 2.735-1.929 5.691-5.263 7.457-8.988 1.076.86 1.64 1.773 1.398 2.595-.336 1.131-1.615 1.84-3.403 2.185a27.697 27.697 0 0 1-1.548 1.826c4.634.16 8.08-1.22 8.458-3.565.286-1.786-1.295-3.696-4.053-5.17.696-2.139.832-4.04.346-5.588-.029-.08-.106-.27-.196-.27-.068 0-.067.13-.063.187.135 1.547-.263 3.2-1.062 5.19zm-8.533 9.869c-1.96-3.145-3.09-6.849-3.082-10.594 3.702-.124 7.474.748 10.714 2.627-1.743 3.269-4.385 6.1-7.633 7.966h.001z',
        other: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.3 7 12 12l8.7-5 M12 22V12',
    };

    const deliveryPlatformAliases = {
        steam: 'steam', steamkey: 'steam',
        blizzard: 'battlenet', battlenet: 'battlenet',
        epic: 'epic', epicgames: 'epic', epicgamesstore: 'epic',
        gog: 'gog', gogcom: 'gog',
        uplay: 'ubisoft', ubisoft: 'ubisoft', ubisoftconnect: 'ubisoft',
        origin: 'ea', ea: 'ea', eaapp: 'ea',
        itch: 'itch', itchio: 'itch',
        rockstar: 'rockstar', rockstargames: 'rockstar', rockstarsocialclub: 'rockstar',
        oculus: 'meta', metaquest: 'meta',
        drmfree: 'download', download: 'download', directdownload: 'download',
        externalkey: 'external', external: 'external',
    };
    const deliveryPlatformLabels = {
        battlenet: ['Battle.net', 'battledotnet'], epic: ['Epic Games', 'epicgames'],
        gog: ['GOG', 'gogdotcom'], ubisoft: ['Ubisoft Connect', 'other'],
        ea: ['EA app', 'other'], itch: ['itch.io', 'other'],
        rockstar: ['Rockstar Games', 'other'], meta: ['Meta Quest', 'other'],
    };

    function normalizeDeliveryMethod(value) {
        return typeof value === 'string'
            ? value.trim().toLowerCase().replace(/^hb[-_]/, '').replace(/[^a-z0-9]/g, '')
            : '';
    }

    function getNonSteamPlatformBadges({item, title, tile}) {
        const type = item?.bundleType || item?.cta_badge?.badge || '';
        if (/^coupons?$/i.test(type) || item?.cta_badge?.badge === 'coupon') {
            return [{id: 'coupon', label: t('couponItem'), icon: 'other'}];
        }
        if (/^(misc|miscellaneous|extras?)$/i.test(type)) {
            return [{id: 'misc', label: t('miscellaneousItem'), icon: 'other'}];
        }
        const methods = [
            ...(Array.isArray(item?.deliveryMethods) ? item.deliveryMethods : []),
            ...Object.entries(item?.availability_icons?.delivery_to_platform || {})
                .filter(([, available]) => available).map(([method]) => method),
            ...(Array.isArray(item?.tpkds) ? item.tpkds.map(key => key.key_type || key.key_type_human_name) : []),
            ...Array.from(tile.querySelectorAll('[data-testid="platform-icons"] [aria-label]'))
                .map(icon => icon.getAttribute('aria-label'))
                .filter(label => deliveryPlatformAliases[normalizeDeliveryMethod(label)]),
        ].flatMap(method => {
            const normalized = normalizeDeliveryMethod(method);
            if (!normalized || /^(windows|mac|macos|osx|linux|android|ios)$/.test(normalized)) return [];
            return [{id: deliveryPlatformAliases[normalized] || normalized, label: method.trim()}];
        });
        const subscription = /^subscriptions?$/i.test(type);
        if (!subscription && methods.some(method => method.id === 'steam')) return [];
        if (subscription || (methods.length && /\bIGN\s*(?:Plus|Subscription)\b/i.test(title))) {
            return /\bIGN\b/i.test(title)
                ? [{id: 'ign', label: `IGN Plus · ${t('subscriptionItem')}`, icon: 'ign'}]
                : [{id: 'subscription', label: t('subscriptionItem'), icon: 'other'}];
        }
        return [...new Map(methods.map(method => {
            const [label, icon] = deliveryPlatformLabels[method.id]
                || [method.id === 'download' ? t('drmFreeItem')
                    : method.id === 'external' ? t('otherRedemption') : method.label, 'other'];
            return [method.id, {id: method.id, label, icon}];
        })).values()];
    }

    function getLegacyChoicePlatformRecords() {
        if (!isChoicePage()) return [];
        return choiceRegionSourceIds.flatMap(id => {
            const source = document.getElementById(id);
            if (!source) return [];
            let data;
            try {
                data = JSON.parse(source.textContent)?.contentChoiceOptions?.contentChoiceData?.game_data;
            } catch (_) {
                return [];
            }
            if (!data || typeof data !== 'object') return [];
            return (Array.isArray(data) ? data.map(game => [null, game])
                : Array.isArray(data.tpkds) ? [[null, data]] : Object.entries(data))
                .filter(([, game]) => game && typeof game === 'object');
        });
    }

    function getNonSteamGameEntries() {
        const items = getBundleItemsByTitle();
        const choiceRecords = getLegacyChoicePlatformRecords();
        const legacy = Array.from(document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal'))
            .flatMap(tile => {
                const heading = tile.querySelector('.item-title, .content-choice-title, .human-name-title');
                const title = heading ? normalizedText(heading) : '';
                if (!title) return [];
                let item = items?.get(normalizeSteamTitle(title));
                if (isChoicePage()) {
                    const id = getChoiceTileId(tile).split(':').slice(1).join(':');
                    const matches = choiceRecords.filter(([identifier, game]) => identifier === id
                        || game.display_item_machine_name === id
                        || normalizeSteamTitle(game.human_name || game.title || '') === normalizeSteamTitle(title));
                    const unique = new Map(matches.map(([, game]) => [JSON.stringify([
                        game.display_item_machine_name, game.deliveryMethods, game.availability_icons,
                        game.tpkds?.map(key => key.key_type || key.key_type_human_name),
                    ]), game]));
                    if (unique.size === 1) item = unique.values().next().value;
                }
                return [{tile, title, item, heading, titleHost: heading}];
            });
        return [...getModernGameEntries().map(entry => {
            const memberRow = entry.tile.querySelector('[data-testid="product-card-footer"] [class~="group/product-title"]');
            const bundleTitle = entry.tile.querySelector('.line-clamp-2');
            return {...entry, titleHost: entry.titleHost || memberRow || bundleTitle?.parentElement};
        }), ...legacy];
    }

    function getVisibleOtherPlatformItems() {
        const items = new Map();
        for (const entry of getNonSteamGameEntries()) {
            if (entry.tile.getClientRects().length === 0) continue;
            const badges = getNonSteamPlatformBadges(entry);
            if (!badges.length) continue;
            const key = normalizeSteamTitle(entry.title);
            if (!items.has(key)) items.set(key, {title: entry.title, platforms: new Map()});
            const item = items.get(key);
            for (const badge of badges) item.platforms.set(badge.id, badge.label);
        }
        return Array.from(items.values(), item => ({
            title: item.title, platforms: [...item.platforms.values()],
        }));
    }

    function createPlatformBadges(badges) {
        const group = document.createElement('span');
        group.className = 'hb-helper-platform-badges';
        group.dataset.hbHelperPlatforms = JSON.stringify(badges);
        for (const {label, icon} of badges) {
            const badge = document.createElement('span');
            badge.className = 'hb-helper-platform-badge';
            badge.title = label;
            badge.setAttribute('role', 'img');
            badge.setAttribute('aria-label', label);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', platformIconPaths[icon]);
            if (icon === 'other') {
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'currentColor');
                path.setAttribute('stroke-width', '1.8');
                path.setAttribute('stroke-linejoin', 'round');
            }
            svg.appendChild(path);
            badge.appendChild(svg);
            group.appendChild(badge);
        }
        return group;
    }

    function refreshNonSteamGameMarkers() {
        const entries = isPriceTotalsPage() || getLibraryView().kind === 'purchased'
            ? getNonSteamGameEntries() : [];
        const markedTiles = new Set();
        const desiredBadges = new Map();
        for (const entry of entries) {
            const badges = getNonSteamPlatformBadges(entry);
            if (!badges.length) continue;
            markedTiles.add(entry.tile);
            if (canModifyHelperTarget(entry.tile)) {
                if (!entry.tile.classList.contains('hb-helper-non-steam')) entry.tile.classList.add('hb-helper-non-steam');
                if (entry.tile.classList.contains('owned')) entry.tile.classList.remove('owned');
                if (entry.tile.classList.contains('wishlist')) entry.tile.classList.remove('wishlist');
            }
            if (entry.titleHost) desiredBadges.set(entry.titleHost, {badges, details: Boolean(entry.library)});
            const section = entry.tile.closest('section[aria-label="Media carousel"]');
            if (!section) continue;
            const headings = Array.from(section.parentElement.querySelectorAll('h3'))
                .filter(heading => !section.contains(heading) && normalizedText(heading) === entry.title);
            if (headings.length === 1 && entries.filter(other => other.title === entry.title).length === 1) {
                desiredBadges.set(headings[0].parentElement, {badges, details: true});
            }
        }
        document.querySelectorAll('.hb-helper-non-steam').forEach(tile => {
            if (!markedTiles.has(tile) && canModifyHelperTarget(tile)) tile.classList.remove('hb-helper-non-steam');
        });
        document.querySelectorAll('.hb-helper-platform-badges').forEach(group => {
            const host = group.parentElement;
            if (desiredBadges.has(host) || !canModifyHelperTarget(host)) return;
            group.remove();
            host.classList.remove('hb-helper-platform-title-row', 'hb-helper-platform-title-details');
        });
        for (const [host, {badges, details}] of desiredBadges) {
            if (!canModifyHelperTarget(host)) continue;
            const previous = Array.from(host.children).find(child => child.classList.contains('hb-helper-platform-badges'));
            const className = details ? 'hb-helper-platform-title-details' : 'hb-helper-platform-title-row';
            if (!host.classList.contains(className)) host.classList.add(className);
            if (previous?.dataset.hbHelperPlatforms === JSON.stringify(badges)) continue;
            previous?.remove();
            host.appendChild(createPlatformBadges(badges));
        }
    }

    function getBundleItemsByTitle() {
        if (!isGamesBundlePage()) return null;
        const dataElement = document.getElementById('webpack-bundle-page-data');
        if (dataElement) {
            const itemData = JSON.parse(dataElement.textContent).bundleData?.tier_item_data;
            if (itemData) return new Map(Object.values(itemData)
                .filter(item => item.human_name)
                .map(item => [normalizeSteamTitle(item.human_name), item]));
        }
        const bundlePage = getNextPageData('bundlePage').find(page =>
            page?.slug && `/games/${page.slug}` === getCurrentPath()
        );
        if (!bundlePage) return null;
        return new Map((bundlePage.tiers || []).flatMap(tier => tier.bundleItems || [])
            .filter(item => item?.title)
            .map(item => [normalizeSteamTitle(item.title), item]));
    }

    function isSteamBundleItem(item) {
        if (/^(coupons?|subscriptions?|misc|miscellaneous|extras?)$/i.test(item.bundleType || '')
            || item.cta_badge?.badge === 'coupon') return false;
        if (Array.isArray(item.deliveryMethods)) {
            return item.deliveryMethods.includes('steam');
        }
        return Boolean(item.availability_icons?.delivery_to_platform?.['hb-steam']);
    }

    function shouldMatchSteamTitle(title) {
        const item = getBundleItemsByTitle()?.get(normalizeSteamTitle(title));
        return !item || isSteamBundleItem(item);
    }

    function getLibraryGameEntries() {
        return getLibraryDomEntries().map(entry => {
            const methods = [...new Set(entry.platformLabels.map(label =>
                deliveryPlatformAliases[normalizeDeliveryMethod(label)]).filter(Boolean))];
            // Steam plus another delivery option does not prove Steam was selected.
            const deliveryMethods = methods.includes('steam') && methods.length > 1 ? [] : methods;
            return {...entry, tile: entry.element, item: {deliveryMethods},
                titleHost: entry.titleElement.parentElement, library: true};
        });
    }

    function getModernGameEntries() {
        if (getLibraryView().kind !== 'unsupported') return getLibraryGameEntries();
        if (isChoicePage()) return getModernChoiceGameEntries();
        if (!isGamesBundlePage()) return [];
        const items = getBundleItemsByTitle();
        return Array.from(document.querySelectorAll('[data-testid="bundle-item-card"]'))
            .map(tile => {
                const title = tile.querySelector('[data-testid="bundle-item-native-image"] img')
                    ?.getAttribute('alt')?.trim() || '';
                const item = items?.get(normalizeSteamTitle(title)) || {
                    bundleType: tile.getAttribute('data-bundle-type'),
                    deliveryMethods: tile.querySelector('[data-testid="platform-icons"] [aria-label="Steam"]')
                        ? ['steam'] : [],
                };
                return {tile, title, item};
            }).filter(entry => entry.title);
    }

    function getVisibleGameTitles() {
        const legacyTitles = Array.from(document.querySelectorAll(
            '.tier-item-view .item-title, '
            + '.choice-content.js-open-choice-modal .content-choice-title'
        ))
            .filter(title => title.getClientRects().length > 0 && !title.closest?.('.hb-helper-non-steam'))
            .map(title => title.textContent.trim())
            .filter(title => title && shouldMatchSteamTitle(title));
        const modernTitles = getModernGameEntries()
            .filter(({tile, item}) => tile.getClientRects().length > 0 && isSteamBundleItem(item))
            .map(({title}) => title);
        return [...legacyTitles, ...modernTitles];
    }

    function formatPrice(value, currencyCode) {
        return new Intl.NumberFormat(currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(value);
    }

    function createHelperDisclosure(summaryText, contentNodes, {className, open} = {}) {
        const details = document.createElement('details');
        details.className = ['hb-helper-disclosure', className].filter(Boolean).join(' ');
        details.open = Boolean(open);
        const summary = document.createElement('summary');
        summary.textContent = summaryText;
        details.append(summary, ...contentNodes);
        return details;
    }

    function appendMatchDetails(summary, unmatchedGames, unpricedGames, open) {
        const groups = [
            [t('steamItemNotFound'), unmatchedGames],
            [t('regionalPriceUnavailable'), unpricedGames],
        ].filter(([, games]) => games.length > 0);
        if (groups.length === 0) return;

        const missingCount = groups.reduce((total, [, games]) => total + games.length, 0);
        const contentNodes = groups.map(([label, games]) => {
            const group = document.createElement('div');
            group.className = 'hb-helper-match-group';
            const heading = document.createElement('strong');
            heading.textContent = `${label} (${games.length})`;
            const list = document.createElement('ul');
            for (const game of games) {
                const item = document.createElement('li');
                item.textContent = game.title;
                list.appendChild(item);
            }
            group.append(heading, list);
            return group;
        });
        summary.appendChild(createHelperDisclosure(
            t('showUnpricedItems', {count: missingCount}),
            contentNodes,
            {className: 'hb-helper-match-details', open}
        ));
    }

    function appendOtherPlatformDetails(summary, items, open) {
        if (!items.length) return;
        const group = document.createElement('div');
        group.className = 'hb-helper-match-group';
        const list = document.createElement('ul');
        for (const {title, platforms} of items) {
            const item = document.createElement('li');
            item.textContent = `${title} — ${platforms.join(' / ')}`;
            list.appendChild(item);
        }
        group.appendChild(list);
        summary.appendChild(createHelperDisclosure(
            t('otherPlatformItems', {count: items.length}), [group],
            {className: 'hb-helper-other-platform-details', open}
        ));
    }

    function createPriceTotalsContent(result, detailsOpen, otherPlatformsOpen, staleVisible) {
        const content = document.createElement('div');

        const {
            region, currencyCode, humbleCurrencyCode, exchangeRate, games, otherPlatformItems = []
        } = result;
        const canFilterOwned = ownedApps && hasSteamAccountData();
        if (!canFilterOwned) priceScope = 'all';
        const selectedGames = priceScope === 'unowned'
            ? games.filter(game => !game.appId || !ownedApps.has(game.appId))
            : games;
        const allItemsOwned = priceScope === 'unowned' && games.length > 0 && selectedGames.length === 0;
        const bodyGames = allItemsOwned ? games : selectedGames;
        const matchedGames = bodyGames.filter(game => game.appId);
        const pricedGames = bodyGames.filter(game => game.price);
        const unmatchedGames = bodyGames.filter(game => !game.appId);
        const unpricedGames = matchedGames.filter(game => !game.price);
        const totals = pricedGames.reduce((total, game) => ({
            current: total.current + game.price.current,
            original: total.original + game.price.original,
            lowest: total.lowest + game.price.lowest,
        }), {current: 0, original: 0, lowest: 0});
        const formatTotal = value => {
            if (!currencyCode || pricedGames.length === 0) return t('unavailable');
            const steamPrice = formatPrice(value, currencyCode);
            if (!humbleCurrencyCode || !exchangeRate) return steamPrice;
            return `${steamPrice} (${t('hbPrice', {
                price: formatPrice(value * exchangeRate, humbleCurrencyCode),
            })})`;
        };
        const scopeLabel = priceScope === 'all' ? t('showUnowned') : t('showAll');
        const scopeDescription = canFilterOwned
            ? t('togglePriceScope')
            : t('loginFilterOwned');
        const priceRegion = currencyCode ? `${region}, ${currencyCode}` : region;
        const scope = priceScope === 'all' ? t('allItems') : t('unownedItems');

        const header = document.createElement('div');
        header.className = 'hb-helper-price-header';
        const title = document.createElement('div');
        title.className = 'hb-helper-price-title';
        title.textContent = t('priceTotalsTitle', {priceRegion});
        const staleMarker = document.createElement('span');
        staleMarker.className = 'hb-helper-price-stale';
        staleMarker.textContent = t('stalePriceTotals');
        staleMarker.style.visibility = staleVisible ? 'visible' : 'hidden';
        if (!staleVisible) staleMarker.setAttribute('aria-hidden', 'true');
        const scopeControls = document.createElement('div');
        scopeControls.className = 'hb-helper-price-scope-controls';
        const currentScope = document.createElement('span');
        currentScope.className = 'hb-helper-price-scope-label';
        currentScope.textContent = t('showingPriceScope', {scope});
        const scopeButton = document.createElement('button');
        scopeButton.id = 'hb-helper-price-scope';
        scopeButton.type = 'button';
        scopeButton.title = scopeDescription;
        scopeButton.disabled = !canFilterOwned;
        scopeButton.textContent = scopeLabel;
        scopeControls.append(currentScope, scopeButton);
        header.append(title, staleMarker, scopeControls);
        content.appendChild(header);

        scopeButton.addEventListener('click', () => {
            priceScope = priceScope === 'all' ? 'unowned' : 'all';
            renderPriceTotals();
        });
        const body = allItemsOwned ? document.createElement('div') : content;
        const addPriceLine = (label, value) => {
            const row = document.createElement('div');
            const price = document.createElement('span');
            price.className = 'hb-helper-price-value';
            price.textContent = value;
            row.append(`${label}: `, price);
            body.appendChild(row);
        };
        addPriceLine(t('currentPrice'), formatTotal(totals.current));
        addPriceLine(t('originalPrice'), formatTotal(totals.original));
        addPriceLine(t('historicalLow'), formatTotal(totals.lowest));

        const matchedLine = document.createElement('div');
        matchedLine.textContent = t('matchedItems', {
            matched: matchedGames.length,
            selected: bodyGames.length,
            scope: allItemsOwned ? t('allItems') : scope,
        });
        const pricedLine = document.createElement('div');
        pricedLine.textContent = t('pricedItems', {
            priced: pricedGames.length,
            matched: matchedGames.length,
        });
        body.append(matchedLine, pricedLine);
        appendMatchDetails(body, unmatchedGames, unpricedGames, detailsOpen);
        if (allItemsOwned) {
            const state = document.createElement('div');
            state.className = 'hb-helper-all-owned-state';
            body.className = 'hb-helper-all-owned-sizing';
            body.setAttribute('aria-hidden', 'true');
            body.setAttribute('inert', '');
            const notice = document.createElement('div');
            notice.className = 'hb-helper-all-owned';
            notice.textContent = t('allSteamItemsOwned');
            state.append(body, notice);
            content.appendChild(state);
        }
        appendOtherPlatformDetails(content, otherPlatformItems, otherPlatformsOpen);
        return content;
    }

    function renderPriceTotals(result = lastPriceResult, expectedRunId) {
        if (!result) return;
        const summary = document.getElementById('hb-helper-price-summary');
        if (!summary) return;
        const detailsOpen = Boolean(summary.querySelector('.hb-helper-match-details')?.open);
        const otherPlatformsOpen = Boolean(summary.querySelector('.hb-helper-other-platform-details')?.open);
        const staleVisible = expectedRunId === undefined
            && summary.querySelector('.hb-helper-price-stale')?.style.visibility === 'visible';
        const content = createPriceTotalsContent(result, detailsOpen, otherPlatformsOpen, staleVisible);
        if (expectedRunId !== undefined && expectedRunId !== priceTotalsRunId) return;
        lastPriceResult = result;
        summary.replaceChildren(...content.children);
    }

    function showStalePriceTotals(summary) {
        const marker = summary?.querySelector('.hb-helper-price-stale');
        if (!marker) return;
        marker.style.visibility = 'visible';
        marker.removeAttribute('aria-hidden');
    }

    function getPriceResultContextKey() {
        const account = steamSessionState.account;
        return JSON.stringify([
            getCurrentPath(),
            account?.countryCode || null,
            account?.sessionId || null,
        ]);
    }

    function schedulePriceTotalsReload(force = false) {
        if (!hasSteamAccountData()) return;
        const titles = [...new Set(getVisibleGameTitles())];
        const titlesKey = [...titles].sort().join('\n');
        const otherPlatformItems = getVisibleOtherPlatformItems();
        const contextKey = getPriceResultContextKey();
        const inputKey = JSON.stringify([contextKey, titlesKey, otherPlatformItems]);
        if (!force && inputKey === lastPriceInputKey) return;
        lastPriceInputKey = inputKey;
        if (!force && lastPriceResult?.titlesKey === titlesKey
            && lastPriceResult.contextKey === contextKey
            && lastPriceResult.runId === priceTotalsRunId) {
            renderPriceTotals({...lastPriceResult, otherPlatformItems});
            return;
        }
        loadPriceTotals(titles);
    }

    async function loadPriceTotals(titles, dependencies = {}) {
        if (!hasSteamAccountData()) return;
        const runId = ++priceTotalsRunId;
        const summary = document.getElementById('hb-helper-price-summary');
        const contextKey = getPriceResultContextKey();
        const otherPlatformItems = getVisibleOtherPlatformItems();
        const titlesKey = [...titles].sort().join('\n');
        const previousResult = lastPriceResult?.contextKey === contextKey
            ? lastPriceResult
            : undefined;
        if (!previousResult) {
            lastPriceResult = undefined;
            if (summary) summary.textContent = t('loadingPriceTotals');
        }
        const findApp = dependencies.findSteamApp || findSteamApp;
        const resolveCurrency = dependencies.resolveHumbleCurrencyCode
            || resolveHumbleCurrencyCode;
        const fetchPriceHistory = dependencies.fetchXiaoheihePriceHistory
            || fetchXiaoheihePriceHistory;
        const fetchRate = dependencies.fetchExchangeRate || fetchExchangeRate;

        try {
            const humbleCurrencyCodePromise = titles.length ? resolveCurrency() : Promise.resolve(null);
            const resolvedGames = await Promise.all(titles.map(async title => {
                const app = await findApp(title);
                return {title, appId: app?.appid || null};
            }));
            const games = resolvedGames.filter((game, index) =>
                !game.appId
                || resolvedGames.findIndex(other => other.appId === game.appId) === index
            );
            const steamCountryCode = getSteamCountryCode();
            const appIds = games.map(game => game.appId).filter(Boolean);
            const pricesByAppId = new Map();
            for (const appId of appIds) {
                try {
                    pricesByAppId.set(
                        appId,
                        await fetchPriceHistory(appId, steamCountryCode)
                    );
                } catch (error) {
                    console.warn('[HB-Helper] Fetch price failed:', error);
                }
            }
            if (runId !== priceTotalsRunId) return;

            const currencyCode = pricesByAppId.values().next().value?.currency || null;
            const humbleCurrencyCode = await humbleCurrencyCodePromise;
            if (runId !== priceTotalsRunId) return;

            let exchangeRate;
            if (currencyCode && humbleCurrencyCode && humbleCurrencyCode !== currencyCode) {
                try {
                    exchangeRate = await fetchRate(currencyCode, humbleCurrencyCode);
                } catch (error) {
                    console.warn('[HB-Helper] Fetch exchange rate failed:', error);
                }
            }
            if (runId !== priceTotalsRunId) return;

            const nextResult = {
                contextKey,
                titlesKey,
                runId,
                otherPlatformItems,
                region: steamCountryCode,
                currencyCode,
                humbleCurrencyCode,
                exchangeRate,
                games: games.map(game => ({
                    ...game,
                    price: pricesByAppId.get(game.appId) || null,
                })),
            };
            renderPriceTotals(nextResult, runId);
        } catch (error) {
            if (runId !== priceTotalsRunId) return;
            console.warn('[HB-Helper] Load bundle price totals failed:', error);
            if (previousResult) showStalePriceTotals(summary);
            else if (summary) summary.textContent = error.message;
        }
    }

    async function markGame(viewEl, appSet, className, findApp = findSteamApp) {
        if (!canModifyHelperTarget(viewEl)) return;
        if (viewEl.classList.contains('hb-helper-non-steam')) {
            if (viewEl.classList.contains(className)) viewEl.classList.toggle(className, false);
            return;
        }
        const titleEl = viewEl.querySelector('.item-title, .content-choice-title');
        const modernEntry = titleEl ? null : getModernGameEntries().find(entry => entry.tile === viewEl);
        const title = titleEl?.textContent.trim() || modernEntry?.title;
        if (!title) {
            if (viewEl.classList.contains(className)) viewEl.classList.toggle(className, false);
            return;
        }
        if (modernEntry ? !isSteamBundleItem(modernEntry.item) : !shouldMatchSteamTitle(title)) {
            if (viewEl.classList.contains(className)) viewEl.classList.toggle(className, false);
            return;
        }
        const app = await findApp(title);
        if (!canModifyHelperTarget(viewEl)) return;
        if (viewEl.classList.contains('hb-helper-non-steam')) return;
        if (modernEntry && !getModernGameEntries().some(entry =>
            entry.tile === viewEl && entry.title === title && isSteamBundleItem(entry.item))) return;
        const marked = Boolean(app && appSet.has(app.appid));
        if (viewEl.classList.contains(className) !== marked) viewEl.classList.toggle(className, marked);
    }

    // Owned Games Check: Check a single game element and mark it as owned if it matches the user's owned app set
    function markOne(viewEl, ownedSet) {
        return markGame(viewEl, ownedSet, 'owned');
    }

    function markWishlistOne(viewEl, wishlistSet) {
        return markGame(viewEl, wishlistSet, 'wishlist');
    }

    function getCountryListMetadata(tpkd, property) {
        if (!Object.prototype.hasOwnProperty.call(tpkd, property)) {
            return {kind: 'absent', countries: []};
        }
        const value = tpkd[property];
        if (!Array.isArray(value)) return {kind: 'invalid', countries: []};
        const countries = [];
        for (const country of value) {
            if (typeof country !== 'string' || !/^[A-Za-z]{2}$/.test(country)) {
                return {kind: 'invalid', countries: []};
            }
            const normalized = country.toUpperCase();
            if (!countries.includes(normalized)) countries.push(normalized);
        }
        return {kind: countries.length ? 'non-empty' : 'empty', countries};
    }

    function normalizeRegionRestrictions(tpkd) {
        if (!tpkd || typeof tpkd !== 'object' || Array.isArray(tpkd)) {
            return {status: 'unavailable', exclusiveCountries: [], disallowedCountries: []};
        }
        const exclusive = getCountryListMetadata(tpkd, 'exclusive_countries');
        const disallowed = getCountryListMetadata(tpkd, 'disallowed_countries');
        if (exclusive.kind === 'invalid' || disallowed.kind === 'invalid'
            || (exclusive.kind === 'absent' && disallowed.kind === 'absent')
            || (exclusive.kind === 'absent' && disallowed.kind === 'empty')
            || (exclusive.kind === 'empty' && disallowed.kind === 'absent')) {
            return {status: 'unavailable', exclusiveCountries: [], disallowedCountries: []};
        }
        if (exclusive.kind === 'empty' && disallowed.kind === 'empty') {
            return {status: 'unmarked', exclusiveCountries: [], disallowedCountries: []};
        }
        return {
            status: 'restricted-metadata',
            exclusiveCountries: exclusive.countries,
            disallowedCountries: disallowed.countries,
        };
    }

    function getRegionRestrictionVerdict(restrictions, steamCountryCode) {
        if (restrictions.status === 'unavailable') return {status: 'unavailable'};
        if (restrictions.status === 'unmarked') return {status: 'unmarked'};
        const country = typeof steamCountryCode === 'string'
            && /^[A-Za-z]{2}$/.test(steamCountryCode)
            ? steamCountryCode.toUpperCase()
            : null;
        if (!country) return {status: 'unknown-country'};
        const restricted = restrictions.exclusiveCountries.length > 0
            ? !restrictions.exclusiveCountries.includes(country)
            : restrictions.disallowedCountries.includes(country);
        return {status: restricted ? 'restricted' : 'allowed', country};
    }

    function appendRegionCountryList(panel, label, countries) {
        if (!countries.length) return;
        const list = document.createElement('div');
        list.className = 'hb-helper-region-restrictions__list';
        if (countries.length > 12) {
            const values = document.createElement('div');
            values.className = 'hb-helper-region-restrictions__countries';
            values.textContent = `${label} ${countries.join(', ')}`;
            list.appendChild(createHelperDisclosure(
                t('regionCountryList', {count: countries.length}),
                [values],
                {className: 'hb-helper-region-restrictions__details', open: false}
            ));
        } else {
            list.textContent = `${label} ${countries.join(', ')}`;
        }
        panel.appendChild(list);
    }

    function createRegionRestrictionPanel(tpkd, steamCountryCode) {
        const restrictions = normalizeRegionRestrictions(tpkd);
        if (restrictions.status === 'unavailable') return null;
        const verdict = getRegionRestrictionVerdict(restrictions, steamCountryCode);
        const panel = document.createElement('section');
        panel.className = `hb-helper-region-restrictions hb-helper-region-restrictions--${verdict.status}`;
        const status = document.createElement('span');
        status.className = 'hb-helper-region-restrictions__status';
        if (verdict.status === 'unmarked') status.textContent = t('regionUnmarked');
        else if (verdict.status === 'unknown-country') status.textContent = t('regionCountryUnavailable');
        else if (verdict.status === 'restricted') status.textContent = t('regionRestricted', {country: verdict.country});
        else status.textContent = t('regionAllowed', {country: verdict.country});
        panel.appendChild(status);
        if (restrictions.exclusiveCountries.length) {
            appendRegionCountryList(panel, t('regionExclusiveCountries', {countries: ''}).trim(), restrictions.exclusiveCountries);
        } else {
            appendRegionCountryList(panel, t('regionDisallowedCountries', {countries: ''}).trim(), restrictions.disallowedCountries);
        }
        return panel;
    }

    const choiceRegionSourceIds = [
        'webpack-subscriber-hub-data',
        'webpack-monthly-product-data',
    ];
    let choiceRegionSourceState;
    let choiceRegionFallbackWarningShown = false;
    let choiceRegionDisclosureState;

    function getChoiceRegionGameSignature(game) {
        const canonicalCountries = countries => [...countries].sort();
        return JSON.stringify([
            game.choiceIdentifier,
            game.display_item_machine_name,
            game.tpkds.map(tpkd => [
                canonicalCountries(tpkd.exclusive_countries),
                canonicalCountries(tpkd.disallowed_countries),
            ]),
        ]);
    }

    function addChoiceRegionCatalogRecord(index, identifier, game, signature) {
        if (typeof identifier !== 'string' || identifier.length === 0) return;
        if (index.has(identifier)) {
            index.set(identifier, {status: 'ambiguous'});
            return;
        }
        index.set(identifier, {status: 'found', game, signature});
    }

    function projectChoiceRegionGame(choiceIdentifier, game) {
        if (!game || typeof game !== 'object' || Array.isArray(game)
            || !Array.isArray(game.tpkds) || !game.tpkds.length) {
            return null;
        }
        const normalizedChoiceIdentifier = typeof choiceIdentifier === 'string'
            && choiceIdentifier.length > 0
            ? choiceIdentifier
            : null;
        const displayMachineName = typeof game.display_item_machine_name === 'string'
            && game.display_item_machine_name.length > 0
            ? game.display_item_machine_name
            : null;
        if (!normalizedChoiceIdentifier && !displayMachineName) return null;
        const tpkds = [];
        for (const tpkd of game.tpkds) {
            const restrictions = normalizeRegionRestrictions(tpkd);
            if (restrictions.status === 'unavailable') return null;
            tpkds.push({
                exclusive_countries: restrictions.exclusiveCountries,
                disallowed_countries: restrictions.disallowedCountries,
            });
        }
        return {
            choiceIdentifier: normalizedChoiceIdentifier,
            display_item_machine_name: displayMachineName,
            tpkds,
        };
    }

    function parseChoiceRegionCatalog(dataText) {
        let parsed;
        try {
            parsed = JSON.parse(dataText);
        } catch (_) {
            return null;
        }
        const gameData = parsed?.contentChoiceOptions?.contentChoiceData?.game_data;
        if (!gameData || typeof gameData !== 'object') return null;
        const catalog = {
            byDisplayMachineName: new Map(),
            byChoiceIdentifier: new Map(),
        };
        const entries = Array.isArray(gameData)
            ? gameData.map(entry => [null, entry])
            : Array.isArray(gameData.tpkds)
                ? [[null, gameData]]
                : Object.entries(gameData);
        for (const [key, game] of entries) {
            const record = projectChoiceRegionGame(key, game);
            if (!record) continue;
            const signature = getChoiceRegionGameSignature(record);
            addChoiceRegionCatalogRecord(
                catalog.byDisplayMachineName,
                record.display_item_machine_name,
                record,
                signature
            );
            addChoiceRegionCatalogRecord(
                catalog.byChoiceIdentifier,
                record.choiceIdentifier,
                record,
                signature
            );
        }
        return catalog.byDisplayMachineName.size || catalog.byChoiceIdentifier.size
            ? catalog
            : null;
    }

    function getChoiceRegionCatalog(source) {
        if (!source || typeof source.textContent !== 'string') return null;
        const type = source.type || source.getAttribute?.('type');
        const mediaType = String(type || '').split(';')[0].trim().toLowerCase();
        if (source.tagName?.toLowerCase() !== 'script' || mediaType !== 'application/json') {
            return null;
        }
        return parseChoiceRegionCatalog(source.textContent);
    }

    function findChoiceRegionGame(catalogs, channel, identifier) {
        if (typeof identifier !== 'string' || identifier.length === 0) return {status: 'missing'};
        let found = null;
        for (const catalog of catalogs) {
            const match = catalog?.[channel]?.get(identifier);
            if (!match) continue;
            if (match.status === 'ambiguous') return match;
            if (!found) {
                found = match;
            } else if (found.signature !== match.signature) {
                return {status: 'ambiguous'};
            }
        }
        return found || {status: 'missing'};
    }

    function validateChoiceRegionGameMatch(catalogs, match) {
        if (match.status !== 'found') return match;
        const identities = [
            ['byChoiceIdentifier', match.game.choiceIdentifier],
            ['byDisplayMachineName', match.game.display_item_machine_name],
        ];
        const conflicts = identities.some(([channel, identifier]) => {
            if (typeof identifier !== 'string' || identifier.length === 0) return false;
            const identityMatch = findChoiceRegionGame(catalogs, channel, identifier);
            return identityMatch.status !== 'found'
                || identityMatch.signature !== match.signature;
        });
        return conflicts ? {status: 'ambiguous'} : match;
    }

    function getChoiceRegionCatalogsFromDocument(documentLike) {
        const sources = new Set();
        const catalogs = [];
        for (const id of choiceRegionSourceIds) {
            const source = documentLike?.getElementById?.(id);
            if (!source || sources.has(source)) continue;
            sources.add(source);
            const catalog = getChoiceRegionCatalog(source);
            if (catalog) catalogs.push(catalog);
        }
        if (catalogs.length) return catalogs;

        for (const source of documentLike?.scripts || []) {
            if (sources.has(source)) continue;
            sources.add(source);
            const catalog = getChoiceRegionCatalog(source);
            if (catalog) catalogs.push(catalog);
        }
        return catalogs;
    }

    function getLiveChoiceRegionCatalogs() {
        return getChoiceRegionCatalogsFromDocument(document);
    }

    function getChoiceRegionSourceRouteKey() {
        return `${getHelperRouteFingerprint()}\n${helperRouteTransitionGeneration}`;
    }

    function isVisibleChoiceRegionElement(element) {
        return Boolean(element) && (!element.getClientRects || element.getClientRects().length > 0);
    }

    function isChoiceRegionElementWithin(element, view) {
        for (let current = element; current; current = current.parentNode) {
            if (current === view) return true;
        }
        return false;
    }

    function clearChoiceRegionRestrictionPanels() {
        document.querySelectorAll?.('.hb-helper-region-restrictions--choice')
            .forEach(panel => panel.remove());
    }

    function isChoiceRegionRedeemedView(element) {
        const classes = String(element?.className || '').split(/\s+/);
        return classes.includes('js-select-choice') && classes.includes('select-choice');
    }

    function getChoiceRegionRedeemedViewForContainer(container) {
        for (let current = container; current; current = current.parentNode) {
            if (isChoiceRegionRedeemedView(current)) return current;
        }
        return null;
    }

    function getActiveChoiceRegionView() {
        const activeModal = getActiveChoiceModal();
        if (activeModal) {
            const choiceModals = Array.from(activeModal.querySelectorAll?.('.choice-modal') || [])
                .filter(isVisibleChoiceRegionElement);
            return choiceModals.length === 1 ? choiceModals[0] : null;
        }
        const containers = Array.from(document.querySelectorAll?.('.key-redeemer-container') || [])
            .filter(isVisibleChoiceRegionElement);
        if (!containers.length) return null;
        const views = containers.map(getChoiceRegionRedeemedViewForContainer);
        const [view] = views;
        return view && isVisibleChoiceRegionElement(view)
            && views.every(candidate => candidate === view)
            ? view
            : null;
    }

    function getChoiceModalIdentifier(view) {
        const titles = Array.from(view?.querySelectorAll?.('h2.title[data-machine-name]') || []);
        if (titles.length !== 1) return titles.length ? {status: 'ambiguous'} : {status: 'missing'};
        const title = titles[0];
        const machineName = title?.dataset?.machineName || title?.getAttribute?.('data-machine-name');
        return typeof machineName === 'string' && machineName.length > 0
            ? {status: 'found', machineName}
            : {status: 'ambiguous'};
    }

    function getChoiceDisplayIdentity(view) {
        const identities = Array.from(view?.querySelectorAll?.(
            '[data-entity-kind="display_item"][data-machine-name]'
        ) || []);
        if (identities.length !== 1) return identities.length ? {status: 'ambiguous'} : {status: 'missing'};
        const machineName = identities[0].dataset?.machineName
            || identities[0].getAttribute?.('data-machine-name');
        return typeof machineName === 'string' && machineName.length > 0
            ? {status: 'found', machineName}
            : {status: 'ambiguous'};
    }

    function getChoiceHashIdentifier() {
        const hash = typeof location.hash === 'string' ? location.hash.slice(1) : '';
        try {
            const segments = decodeURIComponent(hash).split('?')[0].split('/').filter(Boolean);
            return segments.at(-1) || null;
        } catch (_) {
            return null;
        }
    }

    function createChoiceRegionRestrictionPanel(tpkd, steamCountryCode, current, total) {
        const panel = createRegionRestrictionPanel(tpkd, steamCountryCode);
        if (!panel) return null;
        panel.className += ' hb-helper-region-restrictions--choice';
        panel.dataset.regionRestrictionOwner = 'choice';
        if (total > 1) {
            const keyLabel = document.createElement('span');
            keyLabel.className = 'hb-helper-region-restrictions__key-label';
            keyLabel.textContent = t('regionKeyLabel', {current, total});
            panel.prepend(keyLabel);
        }
        return panel;
    }

    function getChoiceRegionViewDescriptor() {
        const view = getActiveChoiceRegionView();
        if (!view) return null;
        const titleIdentity = getChoiceModalIdentifier(view);
        const displayIdentity = getChoiceDisplayIdentity(view);
        if (titleIdentity.status === 'ambiguous'
            || displayIdentity.status === 'ambiguous'
            || (titleIdentity.status === 'found' && displayIdentity.status === 'found'
                && titleIdentity.machineName !== displayIdentity.machineName)) {
            return null;
        }
        const identifier = displayIdentity.status === 'found'
            ? displayIdentity.machineName
            : titleIdentity.status === 'found' ? titleIdentity.machineName : null;
        const rows = Array.from(view.querySelectorAll?.('.key-redeemer') || []);
        const containers = rows.map(row => row.closest?.('.key-redeemer-container'));
        if (!rows.length
            || rows.some(row => !isVisibleChoiceRegionElement(row)
                || !isChoiceRegionElementWithin(row, view))
            || containers.some(container => !isVisibleChoiceRegionElement(container)
                || !isChoiceRegionElementWithin(container, view))) {
            return null;
        }
        return {view, identifier, rows, containers};
    }

    function resolveChoiceRegionRestrictionTarget(catalogs) {
        const descriptor = getChoiceRegionViewDescriptor();
        if (!descriptor) return null;
        const {identifier, rows, containers} = descriptor;
        const hashIdentifier = getChoiceHashIdentifier();
        const titleMatch = identifier
            ? findChoiceRegionGame(catalogs, 'byDisplayMachineName', identifier)
            : {status: 'missing'};
        const hashMatch = hashIdentifier
            ? findChoiceRegionGame(catalogs, 'byChoiceIdentifier', hashIdentifier)
            : {status: 'missing'};
        let match = titleMatch;
        if (titleMatch.status === 'missing') {
            match = hashMatch;
        } else if (titleMatch.status === 'found'
            && (hashMatch.status === 'ambiguous'
                || (hashMatch.status === 'found'
                    && titleMatch.signature !== hashMatch.signature))) {
            match = {status: 'ambiguous'};
        }
        match = validateChoiceRegionGameMatch(catalogs, match);
        const game = match.status === 'found' ? match.game : null;
        if (!game || !Array.isArray(game.tpkds)
            || game.tpkds.length !== rows.length
            || game.tpkds.some(tpkd =>
                normalizeRegionRestrictions(tpkd).status === 'unavailable')) {
            return null;
        }
        const fullIdentity = isNonEmptyString(game.choiceIdentifier)
            && isNonEmptyString(game.display_item_machine_name)
            ? JSON.stringify([
                game.choiceIdentifier,
                game.display_item_machine_name,
                game.tpkds.length,
            ])
            : null;
        return {
            game,
            containers,
            context: {
                routeKey: getChoiceRegionSourceRouteKey(),
                hashIdentifier,
                viewMachineName: identifier,
                fullIdentity,
                tpkdCount: game.tpkds.length,
            },
        };
    }

    function captureChoiceRegionDisclosureState() {
        if (!choiceRegionDisclosureState) return null;
        return {
            routeKey: choiceRegionDisclosureState.routeKey,
            hashIdentifier: choiceRegionDisclosureState.hashIdentifier,
            viewMachineName: choiceRegionDisclosureState.viewMachineName,
            fullIdentity: choiceRegionDisclosureState.fullIdentity,
            tpkdCount: choiceRegionDisclosureState.tpkdCount,
            openIndexes: new Set(choiceRegionDisclosureState.disclosures
                .flatMap((disclosure, index) => disclosure?.open ? [index] : [])),
        };
    }

    function hasSameChoiceRegionDisclosureContext(previous, next) {
        return Boolean(previous)
            && Boolean(next.fullIdentity)
            && previous.routeKey === next.routeKey
            && previous.hashIdentifier === next.hashIdentifier
            && previous.viewMachineName === next.viewMachineName
            && previous.fullIdentity === next.fullIdentity
            && previous.tpkdCount === next.tpkdCount;
    }

    function renderChoiceRegionRestrictions(catalogs = []) {
        const previous = captureChoiceRegionDisclosureState();
        const target = resolveChoiceRegionRestrictionTarget(catalogs);
        clearChoiceRegionRestrictionPanels();
        if (!target) {
            choiceRegionDisclosureState = undefined;
            return;
        }
        const {game, containers, context} = target;
        const steamCountryCode = steamSessionState.account?.countryCode || null;
        const panels = game.tpkds.map((tpkd, index) =>
            createChoiceRegionRestrictionPanel(
                tpkd,
                steamCountryCode,
                index + 1,
                game.tpkds.length
            )
        );
        if (panels.some(panel => !panel)) {
            choiceRegionDisclosureState = undefined;
            return;
        }
        const restore = hasSameChoiceRegionDisclosureContext(previous, context);
        const disclosures = panels.map((panel, index) => {
            const disclosure = panel.querySelector?.(
                '.hb-helper-region-restrictions__details'
            );
            if (disclosure) disclosure.open = restore && previous.openIndexes.has(index);
            containers[index].appendChild(panel);
            return disclosure || null;
        });
        choiceRegionDisclosureState = context.fullIdentity ? {
            ...context,
            disclosures,
        } : undefined;
    }

    function invalidateChoiceRegionDisclosureStateForCurrentView() {
        if (!choiceRegionDisclosureState) return;
        const descriptor = getChoiceRegionViewDescriptor();
        if (!descriptor
            || choiceRegionDisclosureState.routeKey !== getChoiceRegionSourceRouteKey()
            || choiceRegionDisclosureState.hashIdentifier !== getChoiceHashIdentifier()
            || choiceRegionDisclosureState.viewMachineName !== descriptor.identifier
            || choiceRegionDisclosureState.tpkdCount !== descriptor.rows.length) {
            choiceRegionDisclosureState = undefined;
        }
    }

    function isCurrentChoiceRegionSourceState(state) {
        return choiceRegionSourceState === state
            && state.routeKey === getChoiceRegionSourceRouteKey();
    }

    function getChoiceRegionCatalogsFromHtml(html) {
        const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
        return getChoiceRegionCatalogsFromDocument(parsedDocument);
    }

    async function loadChoiceRegionCatalogs(state) {
        const requestOrigin = location.origin;
        const requestPathname = location.pathname;
        const requestSearch = location.search || '';
        const requestTarget = `${requestPathname}${requestSearch}`;
        try {
            const response = await fetch(
                requestTarget,
                {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    },
                }
            );
            const contentType = response.headers?.get?.('content-type');
            let responseUrl;
            try {
                responseUrl = new URL(response.url);
            } catch (_) {
                throw new Error('invalid response URL');
            }
            if (!response.ok
                || response.status !== 200
                || response.redirected
                || String(contentType || '').split(';')[0].trim().toLowerCase() !== 'text/html'
                || responseUrl.origin !== requestOrigin
                || responseUrl.pathname !== requestPathname
                || responseUrl.search !== requestSearch
                || !isChoicePathname(responseUrl.pathname)) {
                throw new Error('invalid response');
            }
            const catalogs = getChoiceRegionCatalogsFromHtml(await response.text());
            if (!catalogs.length) throw new Error('missing metadata');
            if (!isCurrentChoiceRegionSourceState(state)) return;
            state.status = 'ready';
            state.catalogs = catalogs;
            ensureChoiceRegionRestrictions();
        } catch (_) {
            if (!isCurrentChoiceRegionSourceState(state)) return;
            state.status = 'failed';
            state.catalogs = [];
            renderChoiceRegionRestrictions(getLiveChoiceRegionCatalogs());
            if (!choiceRegionFallbackWarningShown) {
                choiceRegionFallbackWarningShown = true;
                console.warn('[HB-Helper] Choice restriction metadata unavailable.');
            }
        }
    }

    function ensureChoiceRegionRestrictions() {
        if (!isChoicePage()) {
            renderChoiceRegionRestrictions();
            return undefined;
        }
        if (!getActiveChoiceRegionView()) {
            renderChoiceRegionRestrictions();
            return undefined;
        }

        const routeKey = getChoiceRegionSourceRouteKey();
        const liveCatalogs = getLiveChoiceRegionCatalogs();
        if (liveCatalogs.length) {
            renderChoiceRegionRestrictions(liveCatalogs);
            return undefined;
        }

        if (choiceRegionSourceState?.routeKey === routeKey) {
            if (choiceRegionSourceState.status === 'ready') {
                renderChoiceRegionRestrictions(choiceRegionSourceState.catalogs);
            } else {
                renderChoiceRegionRestrictions();
            }
            return choiceRegionSourceState.promise;
        }

        renderChoiceRegionRestrictions();
        const state = {routeKey, status: 'pending', catalogs: [], promise: null};
        choiceRegionSourceState = state;
        state.promise = loadChoiceRegionCatalogs(state);
        return state.promise;
    }

    function serializeChoiceRegionCatalog(catalog) {
        const serializeGame = game => ({
            choiceIdentifier: game.choiceIdentifier,
            display_item_machine_name: game.display_item_machine_name,
            tpkds: game.tpkds.map(tpkd => ({
                exclusive_countries: [...tpkd.exclusive_countries],
                disallowed_countries: [...tpkd.disallowed_countries],
            })),
        });
        const serializeIndex = index => Object.fromEntries(
            [...index].map(([identifier, match]) => [
                identifier,
                match.status === 'found' ? serializeGame(match.game) : null,
            ])
        );
        return {
            byChoiceIdentifier: serializeIndex(catalog.byChoiceIdentifier),
            byDisplayMachineName: serializeIndex(catalog.byDisplayMachineName),
        };
    }

    function parseChoiceRegionCatalogForTest(dataText) {
        const catalog = parseChoiceRegionCatalog(dataText);
        return catalog ? serializeChoiceRegionCatalog(catalog) : null;
    }

    function getChoiceRegionSourceStateForTest() {
        return choiceRegionSourceState ? {
            routeKey: choiceRegionSourceState.routeKey,
            status: choiceRegionSourceState.status,
            catalogs: choiceRegionSourceState.catalogs.map(serializeChoiceRegionCatalog),
        } : null;
    }

    if (globalThis.__HB_HELPER_TEST__) {
        function setSteamDerivedStateForTest(account) {
            steamSessionState = {status: 'authenticated', account, error: null};
            ownedApps = new Set(account.ownedApps);
            wishlistApps = new Set(account.wishlistApps);
            priceScope = 'unowned';
            lastPriceResult = {region: account.countryCode};
            choiceSelectionMode = true;
            selectedChoiceGameIds.add('id:choice-1');
            document.documentElement.classList.add('hb-helper-choice-select-mode');
        }

        function getSteamDerivedStateForTest() {
            return {
                countryCode: steamSessionState.account?.countryCode || null,
                ownedApps: [...(ownedApps || [])],
                wishlistApps: [...(wishlistApps || [])],
                priceScope,
                hasPriceResult: Boolean(lastPriceResult),
                choiceSelectionMode,
                choiceModeClass: document.documentElement.classList.contains(
                    'hb-helper-choice-select-mode'
                ),
            };
        }

        function setSteamSessionStateForTest(state) {
            steamSessionState = state;
        }

        function setChoiceActivationBatchForTest(batch) {
            GM_setValue(steamActivationBatchKey, batch);
        }

        function setDownloadOrderStateForTest(scope, order, mapping) {
            downloadOrderRouteKey = getDownloadsOrderKey();
            downloadOrderScope = scope;
            downloadOrderData = order;
            downloadOrderMapping = mapping;
        }

        globalThis.__HB_HELPER_TEST_API__ = {
            loadNextPageDataFromSource,
            getNextPageData,
            findHelperInsertionPoint,
            getVisibleGameTitles,
            getSteamStoreLinkTargets,
            ensureSteamStoreLink,
            ensureSteamStoreLinks,
            getBundleItemsByTitle,
            shouldMatchSteamTitle,
            markGame,
            refreshNonSteamGameMarkersForTest: refreshNonSteamGameMarkers,
            ensureHelperControls,
            getDownloadsOrderKey,
            isDownloadsPage,
            getLibraryView,
            getLibraryDomEntries,
            getLibraryGameEntries,
            getLibraryEntitlement,
            getLibraryReactProps,
            getLibraryRecord,
            getHelperPageMode,
            isPriceTotalsPageForTest: isPriceTotalsPage,
            validateDownloadOrder,
            loadDownloadOrder,
            invalidateDownloadOrder,
            hashDownloadOrderKey,
            getDownloadActivationItemId,
            parseDownloadActivationItemId,
            isEligibleDownloadTpkd,
            getDownloadSelectionStorageKeyForTest: getDownloadSelectionStorageKey,
            getDownloadSelection,
            observeDownloadSelection,
            updateDownloadSelection,
            mapDownloadOrderRows,
            upsertDownloadRegionWarnings,
            revealDownloadSteamKey,
            postHumbleDownloadKey,
            encodeLibraryActivationItemId,
            parseLibraryActivationItemId,
            inferActivationBatchScope,
            getActivationBatchPresentation,
            reconcileActivationSelectionStorageFromBatch,
            collectSingleKeyActivationBatchForTest: collectSingleKeyActivationBatch,
            collectChoiceActivationBatchForTest: collectChoiceActivationBatch,
            runChoiceCollectionWorkForTest: runChoiceCollectionWork,
            mountDownloadActivationControlsForTest: mountDownloadActivationControls,
            setDownloadOrderStateForTest,
            getDownloadOrderMappingForTest: () => downloadOrderMapping,
            renderDownloadSelectionStateForTest: renderDownloadSelectionState,
            setDownloadSelectionModeForTest: setDownloadSelectionMode,
            handleDownloadSelectionEventForTest: handleDownloadSelectionEvent,
            selectUnownedDownloadRowsForTest: selectUnownedDownloadRows,
            refreshDownloadOrderPageForTest: refreshDownloadOrderPage,
            initializeDownloadOrderPageForTest: initializeDownloadOrderPage,
            installHelperRouteLifecycleForTest: installHelperRouteLifecycle,
            waitForHelperRouteForTest: () => helperRouteTransitionPromise,
            waitForPageRefreshForTest: () => pageRefreshPromise,
            getPriceTotalsRunIdForTest: () => priceTotalsRunId,
            loadPriceTotalsForTest: loadPriceTotals,
            schedulePriceTotalsReloadForTest: schedulePriceTotalsReload,
            getSelectedChoiceGameIdsForTest: getSelectedChoiceGameIds,
            renderChoiceActivationResultsForTest: renderChoiceActivationResults,
            shouldRefreshForPageMutationsForTest: shouldRefreshForPageMutations,
            getStyleTextForTest: () => style.textContent,
            resetHelperHydrationForTest: resetHelperHydration,
            getHelperHydrationStateForTest: () => ({
                retryPending: Boolean(hydrationRetryTimer), deadline: hydrationRetryDeadline,
            }),
            renderSteamSessionReminderForTest: renderSteamSessionReminder,
            getLandingSortMode,
            getLandingSortStateForTest: getLandingSortState,
            refreshLandingSortPageForTest: refreshLandingSortPage,
            applyLandingSortForTest: applyLandingSort,
            ensureLandingSortControls,
            parseSteamSession,
            refreshSteamSession,
            normalizeRegionRestrictions,
            getRegionRestrictionVerdict,
            createRegionRestrictionPanel,
            isHelperUiMutation,
            ensureChoiceRegionRestrictionsForTest: ensureChoiceRegionRestrictions,
            parseChoiceRegionCatalogForTest,
            getChoiceRegionSourceStateForTest,
            createSteamSessionSynchronizer,
            createSteamSessionSyncTrigger,
            getLiveSteamAccount,
            getSteamCountryCode,
            findHumbleAccountCurrencyCode,
            resolveHumbleCurrencyCode,
            applySteamSessionState,
            clearSteamAccountDerivedState,
            getSteamDerivedStateForTest,
            setSteamDerivedStateForTest,
            setSteamSessionStateForTest,
            isChoiceActivationUiAvailable,
            encodeChoiceActivationItemId,
            decodeChoiceActivationItemId,
            revealChoiceSteamKeys,
            runChoiceCollectionWork,
            getChoiceActivationDisplayLabelForTest: getChoiceActivationDisplayLabel,
            renderChoiceActivationResultsForTest: renderChoiceActivationResults,
            getChoiceActivationResultsSignatureForTest: getChoiceActivationResultsSignature,
            copySteamFailedKeyForTest: copySteamFailedKey,
            reconcileChoiceSelectionFromBatchForTest: reconcileChoiceSelectionFromBatch,
            renderChoiceSelectionStateForTest: renderChoiceSelectionState,
            getTestDocument: () => document,
            runDirectChoiceActivation,
            startChoiceActivationForTest: startChoiceActivation,
            startDownloadActivationForTest: startDownloadActivation,
            rememberDownloadRevealReloadForTest: options =>
                rememberDownloadRevealReload({
                    ...options,
                    context: captureDownloadActivationUiContext(),
                }),
            postSteamActivationKey,
            processSteamActivationBatch,
            runSteamActivationWork,
            fetchFreshSteamAccountAfterActivation,
            satisfyDeferredChoiceOwnershipRefreshForTest:
                satisfyDeferredChoiceOwnershipRefresh,
            setChoiceActivationBatchForTest,
            getChoiceActivationBatchForTest: getChoiceActivationBatch,
            getModernChoiceMemberGrid,
            getModernChoiceGameEntries,
            getModernChoiceSteamLinkTargets,
            reconcileChoiceActivationBatch,
        };
    }

    // Start after every page-state binding has been initialized.
    if (!globalThis.__HB_HELPER_TEST__) startHelper();

})();
