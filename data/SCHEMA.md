# Data schema (version 1)

Each brand file in `data/` (any `*.json` except `index.json`, `threads.json` and `materials.json`) holds manufacturer-published cutting data. Run these before every commit:

```
node scripts/validate.mjs [file ...]   # no args = every brand file
node scripts/build-index.mjs           # rewrites data/index.json and stamps the sw.js cache name
node test.mjs
```

Do not edit `data/index.json` by hand. Files whose names start with `_` are ignored.

## Rules
- Speeds and feeds come only from what a manufacturer publishes (catalog, box label, or the manufacturer's own calculator). Do not use generic or handbook values, and do not interpolate between published values.
- Store numbers in the units the source printed, and set `unit`.
- If the source gives no number, omit it (`sfm: null`, or leave `feed` out). Never fill a gap with your own number.
- Set `coolant` only from the source's own words. Use `null` when the source does not state it.
- Every condition carries its own `source`.

## File
```json
{ "schema": 1, "brand": "Iscar", "tools": [Tool, ...] }
```
Suggested name: `<brand>-<mode>[-<series>].json`, e.g. `iscar-mill.json`.

## Tool
| key | req | notes |
|---|---|---|
| mode | yes | `mill` \| `drill` \| `turn` \| `tap` (grooving, parting and threading inserts use `turn`) |
| brand | yes | manufacturer name; the word "generic" is rejected |
| series | yes | the series, insert or grade name shown in the picker and searched |
| type, coating, grade | no | free text, also searched (`type`) |
| flutes | no | number; mill tools set the default z from it |
| diameters_in / diameters_mm | no | arrays |
| notes | no* | required when `conditions` is empty, to explain the gap |
| conditions | yes | array of Condition |

## Condition
| key | req | notes |
|---|---|---|
| label | yes | the source's own row or material wording |
| iso | yes | `P` `M` `K` `N` `S` `H`, or `*` when the source gives no material |
| subgroup | no | the source's subgroup code (CMC, Iscar group number, etc.) |
| materials | no | ids from `data/materials.json`. Add one only when the source names that material. When the source lumps materials together (e.g. "austenitic stainless" or "303/304"), list every material it covers |
| sourceGroup | with materials | the source's own wording for the group, shown on the badge. Never relabel 304/316 as free-machining unless the source says so |
| status | yes | `verified` (copied from source) \| `derived` (computed from source numbers; needs `source.derivation`) \| `shop-proven` (needs `source.kind: "shop"`) |
| coolant | yes | the source's wording (string), or `null` when not stated |
| sfm | yes | Speed, or `null`. Despite the name, this holds cutting speed in either unit |
| feed | no | Feed; omit it or set it to `null` when not published (tap feed = pitch) |
| ap / ae | no | `{ "min"?, "max", "unit": "in"\|"mm" }` depth/width limits |
| apx / aex | no | depth/width as a multiple of D |
| source | yes | Source |

**Speed** `{ unit: "ft/min"|"m/min", value }`, or `{ unit, min?, max, start? }`, or `{ unit, start }`. A stated start value becomes the default. With only min and max, the app uses the midpoint and labels it MIDPOINT.

**Feed** `{ kind, unit, <one form> }`
- `kind`: `fz` (per tooth, mill only), `ipr` (per rev), or `pitch`.
- `unit`: `in` or `mm`.
- Use exactly one form:
  - `range`: same shape as Speed, without `unit`.
  - `bands`: `[[dMin, dMax, feed], ...]`, with diameters in the feed unit.
  - `byDiameter`: `{ "0.500": 0.002 | {min,max}, ... }`.

**Source**
| key | req | notes |
|---|---|---|
| kind | yes | `catalog` \| `label` (box label) \| `calculator` (the manufacturer's own) \| `shop` |
| manufacturer | yes | who published it |
| catalog | yes | document title and page or table |
| edition | yes | edition or year, or "edition not stated" |
| url | catalog and calculator | an http(s) link to the document |
| page, notes, retrieved | no | |
| derivation | when derived | how the number was computed from published values |

## Materials
`data/materials.json` lists specific materials. 303 (free-machining, sulfurized) is its own entry. 304 and 316 (standard austenitic, work-hardening) share the entry ss304. `groups` holds the plain ISO group names used by the picker. To add a material, add it to that file with its ISO group.

## Schema 1 additions (Seco merge)
- `iso: "O"` — non-ISO manufacturer groups (composites, graphite, plastics). The manufacturer code stays in `subgroup` (e.g. `SMG v2 GR1`).
- `subgroup` keeps the manufacturer's own group code (Seco SMG P1–P12, M1–M5, …). `materials[]` is added only where the source names the alloy.
- `feed.byWoc`: `{ "<ae/D 0–1>": number | {value} | {min,max} }`. The app uses only an exact WOC match and otherwise lists the published values.
- `feed.byDiameter` values may be a number, `{value}` or `{min,max}` (Garr/YG-1). Seco diameter-range keys are converted to `feed.bands`.
- `ap: {value, unit}` — a single stated depth.
- Optional condition fields: `noseRadius`/`insertWidth` `{value|label, unit}`, `leadAngle {deg, convention}`, `toolLife` (min), `woc` (the ae/D the speed is stated for), and the strings `chipbreaker`, `geometry`, `kind`, `table`, `operation`, `insert`, `grade`, `note`, `coolantNote`.
- Flat drops `{brand, family, records[]}` are converted by `scripts/convert-flat.mjs`. `scripts/merge-incoming.mjs <incoming> <brand>` validates them, writes `data/<brand>-<family>.json` (one shard per family, lazy-loaded) and moves rejects to `_rejected/<brand>/` with `.reason.txt`.

## Tool mode `bore`
Boring heads and boring bars. `feed.kind` is `fz` (per tooth / per cutting edge, as printed for boring heads) or `ipr` (where the catalog prints per rev). Diameter keys/ranges are the bore diameter. Tool `flutes` = number of effective cutting edges (default 1 in the app).
App: RPM from SFM at the bore diameter (capped by machine max); IPM = RPM × fz × edges, or RPM × ipr. Nose-radius columns go in separate conditions with `noseRadius`.
Diameter cap for bore tools: 24 in (CB206F head to 21.5 in).
