# Card dumps

This folder holds the Korg A2 card dumps shown in the app's **Original card library**.
They are **not included in the repository**: the factory cards are copyrighted by Korg
and the community cards have no redistribution license.

## Import

1. Download **Korg A2 Complete files** from [korgaseries.info](https://korgaseries.info/user_cards.php) and extract it.
2. From the project folder run:

   ```bash
   npm run import-cards -- "/path/to/Korg_A2_Complete_files"
   ```

The script recognises each card by its file name, checks that it is a full A2 dump
(16,684 bytes, header `F0 42 3n 2D 4C`), copies it here under the expected name and makes it
read-only. Existing files are kept. Reload the app afterwards.

| File | Card | From |
|---|---|---|
| `GUIT1.SYX` | Guitar I (SPC-01) | `1 -Guitar SPC01.syx` |
| `STUDIO.SYX` | Studio (SPC-02) | `2-Studio SPC02.syx` |
| `GPURP.SYX` | General Purpose (SPC-03) | `3-GenPurpose03.syx` |
| `GUIT2.SYX` | Guitar II (SPC-04) | `4-Guitar SPC04.syx` |
| `KEYBD.SYX` | Keyboard (SPC-05) | `5-Keyboard SPC05.syx` |
| `NYC.SYX` | New York City (SPC-06) | `6-NYC SPC06.syx` |
| `NASHVI.SYX` | Nashville (SPC-07) | `7-Nashville SPC07.syx` |
| `SHOWE.SYX` | Steve Howe (SPC-08) | `8-Steve Howe SPC08.syx` |
| `EASTON.SYX` | Elliot Easton (SPC-09) | `9-Elliot EastonSPC09.syx` |
| `GHERO.SYX` | Guitar Heroes | `10-Guitar Heroes.syx` |
| `ORIGA3.SYX` | A3 Original Programs | `0 -KorgA3patches.syx.syx` |
| `DISTORCHAINS.SYX` | A2 Distortion Chains | `11- A2 Distor Chain Group.syx` |
| `NATURALCHAINS.SYX` | A2 Natural Chains | `12- Korg A2 Natural Chains.syx` |
| `A3PATCHBOOK.SYX` | A3 Patchbook | `13 - A3 Patchbook for a2.syx` |
| `NOI5E.SYX` | Noi5e Maker Live Card | `15 -Noi5e Maker Patches 260604.syx` |
| `STOREDEMO.SYX` | Store Demo | `16 - A3 Music Store demo for A2.syx` |
| `INTERN.SYX` | A2 Internal Programs | a full dump of the A2's internal programs (not in the collection) |

Files already named as in the first column are accepted too. Any other full A2 dump can be
copied here by hand: it appears in the **Custom** filter under its file name.
