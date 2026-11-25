# Cards n’ Chains

Cards n’ Chains è un librarian ed editor locale per dump completi SysEx del Korg A2. *English version: [README.md](README.md).*

**Beta online:** https://gagarinvostok.github.io/cards-n-chains/ (senza dump delle card: apri i tuoi con “Apri dump”).

## Avvio

```bash
npm install
npm run import-cards -- "/percorso/Korg_A2_Complete_files"   # facoltativo, vedi “Card incluse”
npm run dev
```

Importa soltanto dump completi identificati dall'header `F0 42 3n 2D 4C`. L'export produce `NEWCRD.SYX`.

## Test

```bash
npm test
```

I test usano dump sintetici generati in `src/test-fixtures.ts`. Verificano inoltre il round-trip byte per byte di ogni card reale in `assets/cards/`.

## Sicurezza

L'app non comunica ancora con hardware MIDI. Non modifica il file originale: scarica un nuovo dump. Le azioni editor preservano i parametri del preset; svuotare (⌫) o spostare uno slot lo rinomina prudentemente in `INIT` e non inventano un preset vuoto.

### Chain esterne

Un preset con chain esterna (`80–89`) dipende dall'area chain della card. Copia e spostamento tra card diverse sono consentiti solo se le due aree chain sono identiche (ad esempio una “Nuova card vuota” creata dalla sorgente); altrimenti l'operazione viene bloccata. Le chain interne (`01–63`) sono sempre consentite.

## Card incluse

I dump delle card **non sono inclusi nel repository**: le card di fabbrica sono di Korg e quelle della community non hanno una licenza di ridistribuzione. Scarica *Korg A2 Complete files* da [korgaseries.info](https://korgaseries.info) e importali con `npm run import-cards -- "<cartella>"`: lo script li riconosce dal nome, verifica che siano dump A2 completi e li copia in `assets/cards/` con i nomi attesi, in sola lettura (dettagli in [assets/cards/README.md](assets/cards/README.md)). Senza card l'app funziona comunque: apri un dump con “Apri dump”.

### Dettagli card

Il tasto (i) su una card della libreria apre un pannello con i 100 programmi (effetti e parametri) e le chain. Le chain interne (01–97) e i parametri vengono dalle tabelle di `A2MIDI.TXT` (`src/a2effects.ts`). Le chain della card (C0–C9, byte `80–89`) sono lette dall'area chain del dump (`src/a2decode.ts`): il suo formato non è documentato da Korg ed è stato ricostruito dalle card originali, così come la corrispondenza tra blocchi interni ed effetti (`INTERNAL_BLOCK_GROUPS`).

## Anteprime audio

Ogni patch può avere un'anteprima in `assets/previews/<FILE CARD>/<slot>.m4a`, ad esempio `assets/previews/GUIT1/00.m4a`. Formato consigliato: AAC 256 kbps, stereo, 48 kHz, partendo da un master WAV 24-bit. Le patch con un file mostrano un tasto ▶ nello slot e nel pannello di dettaglio. L'anteprima segue il suono della patch: resta anche se la copi o la rinomini, sparisce se ne modifichi i parametri. I crediti dei file sono in `assets/previews/CREDITS.md`.

## Licenza

Codice sorgente: [MIT](LICENSE) © 2026 Gabriele Peirolo, realizzato con Claude Code. Le anteprime audio e i dump delle card non sono coperti dalla licenza MIT. Progetto indipendente, non affiliato né approvato da Korg.
