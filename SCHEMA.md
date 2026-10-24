# Data schema notes (supplements scripts/validate.mjs, which is the authority)

## Condition: `printed` (optional)
Per-diameter values exactly as the manufacturer prints them (RPM and table feed tables, e.g. Mitsubishi solid end mills, OSG).

```json
"printed": {
  "unit": "mm",
  "byDiameter": {
    "6": { "rpm": 10600, "tableFeed": { "value": 1480, "unit": "mm/min" },
           "ap": { "value": 9, "unit": "mm" }, "ae": { "value": 0.6, "unit": "mm" } }
  }
}
```
- `unit` is the diameter key unit (`in` | `mm`). Keys pass the same per-tool-type diameter check as `feed.byDiameter`.
- `rpm` required (positive). `tableFeed.unit` is `ipm` | `mm/min`. `ap`/`ae` units: `in` | `mm` | `xD`. No other keys.
- A condition with `printed` counts as having data (sfm/feed may be null) and as a "full" record for default selection.
- App: at an exactly matching diameter (no interpolation) RPM and Feed IPM are shown as MANUFACTURER PRINTED. If the machine max RPM is lower, both are scaled by the same ratio and tagged CAPPED. SFM and chip load are shown as DERIVED.

## Condition: `altSources` (optional)
Other sources that publish the same values; each is `{ source, label?, sfm?, feed? }`, validated like the main record.

## Diameter sanity (`diaProblem`)
Limits by tool type: solid end mills/drills 2.05 in; drill 7 in; tap 4 in; mill, bore, turn and thread 14 in. A key more than 2× above or below the tool's own `diameters_in`/`diameters_mm` range is rejected as a likely lost decimal point.
