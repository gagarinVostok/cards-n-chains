# Cards n’ Chains

A local, offline librarian and patch editor for the **Korg A2** multi-effects processor.
It opens full SysEx card dumps, lets you move presets between cards, edit effect chains and
parameters, and export a new `.SYX` file for the unit.

**Beta online:** https://gagarinvostok.github.io/cards-n-chains/ (no card dumps included: open your own with *Open dump*).

*Versione italiana: [README.it.md](README.it.md).*

## Features

- **Two cards side by side** — a source (read-only) and a destination you build: open a dump or start from a new empty card.
- **Librarian** — copy, cut, paste, move, rename and clear presets with drag and drop or keyboard shortcuts (⌘/Ctrl + C, X, V, ⌫).
- **Card chains** — presets that use a card chain (C0–C9) can only go to a card with the same chains, so nothing breaks on the hardware.
- **Program details** — every effect of the chain with its variant and parameters in real units (ms, dB, Hz…).
- **Effect editor** (destination) — change chain, switch effects on/off, pick variants and edit parameters with sliders limited to valid values; save or revert the changes.
- **Original card library** — the Korg cards and a few community cards, with filters (A3, A2, Custom, Chains only) and a details panel. *Card dumps are not included: see below.*
- **Audio previews** — optional per-patch preview with a waveform player.
- **Italian / English** interface, detected from the browser.

## Quick start

Requires Node.js 22 or later.

```bash
npm install
npm run import-cards -- "/path/to/Korg_A2_Complete_files"   # optional, see below
npm run dev
```

Open the address printed by Vite (http://localhost:5173) in Chrome, Edge, Firefox or Safari.

## Card dumps

The library shows the dumps found in [`assets/cards/`](assets/cards/README.md). They are **not part of the
repository**, because the factory cards are copyrighted by Korg and the community cards have no
redistribution license. Download *Korg A2 Complete files* from [korgaseries.info](https://korgaseries.info), extract it, then either:

- in the app (also the online beta), click **Add cards**, accept the responsibility notice and select the `.syx` files: they are stored in your browser only (IndexedDB) and never uploaded; or
- in a local copy, run `npm run import-cards -- "/path/to/Korg_A2_Complete_files"` to add them to `assets/cards/`.

Without cards the app still works: open any full A2 dump with **Open dump**.

## Audio previews

Put an AAC file at `assets/previews/<CARD FILE>/<slot>.m4a`, e.g. `assets/previews/GUIT1/00.m4a`
(256 kbps, stereo, 48 kHz recommended). Patches with a file get a ▶ button and a waveform player. The
preview follows the patch sound: it stays when the patch is copied or renamed and is disabled once its
parameters are edited. Credits are in [`assets/previews/CREDITS.md`](assets/previews/CREDITS.md).

## Development

```bash
npm test        # Vitest: SysEx parsing, librarian rules, decoder, i18n, previews
npm run build   # type-check and production build in dist/
```

Tests use synthetic dumps; the ones on real cards run only when the dumps have been imported.

**Versioning:** every commit bumps the version by 0.1 (0.5 → 0.6 → …), shown in the footer. Enable the hook once per clone with `git config core.hooksPath .githooks`; skip it for a single commit (e.g. an amend) with `SKIP_VERSION_BUMP=1 git commit …`.

| Path | Content |
|---|---|
| `src/a2sysex.ts` | Full-dump parser/serializer, Korg 8→7 bit packing |
| `src/librarian.ts` | Copy/move/paste rules, chain protection |
| `src/a2effects.ts` | Effect groups, parameter ranges and units, internal chain table |
| `src/a2decode.ts` | Decoding of programs and card chains, effect editing |
| `src/i18n.tsx` | Italian and English strings |
| `src/main.tsx`, `src/CardPanel.tsx`, `src/WaveformPlayer.tsx` | User interface |

### Technical notes

- Format: full A2 dump `F0 42 3n 2D 4C`, 16,684 bytes — 8,192 bytes of chain data and 100 × 64-byte programs, packed 8→7 bit. Export is byte-for-byte identical when nothing changes.
- Internal chains (1–97) and parameter tables come from the Korg *A2 MIDI Implementation*.
- The **chain area** layout (card effect modules and the 10 card chains) is not documented by Korg: it was reconstructed from the factory cards. So were the meaning of some internal block ids and of the effect on/off bit (bit 3 of the variation nibble). Treat them as best effort and check on the unit.

## Safety

The app does not talk to MIDI hardware yet and never modifies the files it opens: it downloads a new
dump. The A2 overwrites its memory when it receives a dump — **always back up your unit first**.

## License and credits

Source code: [MIT](LICENSE) © 2026 Gabriele Peirolo, made using [Claude Code](https://claude.com/claude-code).
Audio previews and card dumps are not covered by the MIT license (see above).

Thanks to [korgaseries.info](https://korgaseries.info) for the card dumps and the Korg A-series documentation.
Fonts: [DSEG](https://www.keshikan.net/fonts-e.html) and [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono), both under the SIL Open Font License.

Independent project, not affiliated with or endorsed by Korg. Korg and the product names mentioned are
trademarks of their respective owners.
