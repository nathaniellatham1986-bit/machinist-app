# v0 plan
- Static PWA, no build step: index.html, app.js, calc.js (pure math), sw.js, manifest.json.
- data/*.json: one file per brand (drop-in; listed in data/index.json). Each tool series has
  recommendations[] keyed by ISO group, each with source{manufacturer,catalog,url,edition} and status verified|derived.
  Values stored in the units the catalog printed (unit field); app converts.
- calc.js: RPM=SFM*3.82/D, IPM=RPM*fpt*z, radial chip thinning (ae<D/2), stickout reduction (derived),
  machine RPM cap, power estimate (derived, Kc-based unit-power) vs HP cap.
- Never fill a missing manufacturer number; UI lets user type SFM/fpt when absent.
- coolant: each recommendation has coolant flood|air|dry|null (null = source didn't state). Only manufacturer-stated; never derived from flood. UI selector defaults flood; exact match preferred, else unstated record with warning.
- Materials: subgroup/material lists open-ended; brands added by listing file in data/index.json.
