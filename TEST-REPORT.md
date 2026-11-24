# Validation report — 0.6.5

This report describes automated and manual validation of `homebridge-weather-switches`. It distinguishes controlled tests from observations on live services and hardware. Publication is not implied by this report.

## Local validation

Version 0.6.5 passed **172 tests in each of four combinations**:

| Node.js | Homebridge | Result |
| --- | --- | --- |
| 24.22.3 | 1.11.1 | 172 passed |
| 24.22.3 | 2.5.0 | 172 passed |
| 26.13.0 | 1.11.1 | 172 passed |
| 26.13.0 | 2.5.0 | 172 passed |

These Windows runs used the actual Homebridge/HAP libraries without starting a bridge server. They include 63 UI DOM tests, four appearance tests and five time-zone tests. New checks cover English defaults, preservation of selected languages and existing coordinates, editable Berlin defaults, IANA validation, Berlin daylight-saving changes, New York display times, and UTC CSV/sample timestamps. An explicitly cleared coordinate remains invalid rather than reverting silently to Berlin.

Supported engine declarations are Node.js 22 from 22.13, Node.js 24 and Node.js 26, with Homebridge 1.8+ or 2.x. Node.js 22 was not executed in the recorded release matrix. Supporting a declared major version is not a claim that every version and operating system combination was exercised.

## Rule and HomeKit coverage

- Threshold equality, activation/release thresholds, per-condition hysteresis, AND/OR, inverted matching states, stabilization and failure recovery.
- Required-input availability, including the existing policy that all configured inputs must be valid even for OR conditions.
- HomeKit notifications, rejection of manual switch writes, temperature/humidity and optional light services, negative values and missing-data errors.
- Stable accessory UUIDs, cache reattachment, renaming, disabled-service removal and invalid configuration behavior.
- HomeKit-compatible Unicode names and UTF-8 length limits, with identities retained during cache migration.
- Separate current and forecast inputs, forecast-only operation during observation outages, and current-only operation during forecast outages.

## Provider and transport coverage

- DWD POI timestamps, dates, decimal formatting, missing cells and sentinel values, units, station identity and distance; missing values are not borrowed from older reports.
- MOSMIX point identity/coordinates, issue and validity times, unit conversions, total cloud cover `N`, derived humidity and hourly precipitation `RR1c`.
- Bounded KMZ/XML parsing, one accepted KML document, rejection of DTD/entities, malformed responses and incomplete arrays.
- Open-Meteo hourly fields and units, complete time grids, model source identification and separate current/forecast validity.
- Completed-hour precipitation validity while general weather responses remain fresh, including 24-hour and multi-hour regression scenarios; real outages, missing intervals and stale/future values still fail.
- Forecast maximum/minimum/mean/target-time selection, precipitation-only sums, complete windows, actual interval boundaries and the 72-hour limit.
- Bounded retry of eligible Open-Meteo failures, retry delay, `Retry-After`, non-retryable responses, cancellation and consent checks before a retry.
- No Open-Meteo request without valid startup and saved consent; obsolete consent, unreadable configuration and saved withdrawal block access. Automated provider tests use controlled responses rather than silently granting consent for live requests.

## Shelly WS90 coverage

- Hardware identity is checked before reading components. RPC access is restricted to reads, pagination and response sizes are bounded, and shutdown aborts pending requests.
- SHA-256 Digest authentication, host-address validation, nonconsecutive component IDs, device address/object/index matching and explicit sensor selection.
- Correct decoded units, m/s conversion, genuine zero values, binary rain state, invalid/out-of-range data and per-sensor freshness.
- Rejection of other Bluetooth devices, host-internal sensors, ambiguous mappings and device/sensor errors.
- Local values, provider values and local-preferred fallback remain separate. A source change can be recorded without a switch-state change.
- A `paired: false` flag does not reject fresh advertisements. Regression tests retain original values/timestamps while preserving stale-data and error rejection; a simulated full RPC response reaches rule evaluation and later switches to provider backup as local data ages.
- Local weather is polled independently from external providers and stored in a separate history namespace. Raw local precipitation is not treated as an hourly amount.

The automated transport tests use controlled Shelly responses. Successful data delivery from a real WS90 has been reported during use, but this is not a recorded automated hardware qualification or a guarantee for every Shelly firmware/model combination.

## Persistence, IPC and CSV

- Real temporary SQLite databases retain observations and events across reopen/restart without treating archived values as live inputs.
- Additive schema migration preserves existing data; recording-off behavior does not modify old history files.
- Raw retention, older hourly means/minima/maxima/counts, namespace separation and row limits are tested with synthetic timestamps and large synthetic event sets.
- Forecast evaluations remain separate by condition, metric, aggregation, window and source, with contemporaneous event context.
- History deletion clears recorded data, leaves configuration intact and allows recording to resume; read-only access and database compaction are covered.
- Local IPC connections and the actual custom-UI server child process are tested without adding a public HTTP listener.
- CSV handles units, UTC timestamps, attribution, quotes, line breaks, negative values and formula-like user names. Current/local/forecast/mixed records retain source and validity context.

A year of retention is simulated with timestamps, not established by a year of continuous operation.

## Interface and appearance

The DOM tests load the actual HTML, schema and interface scripts. They cover configuration validation/staging/reloading; adding, copying, sorting and removing switches; source controls; forecast settings; consent; hidden internal Homebridge fields; status; recording controls; CSV and confirmed history deletion.

Language flows cover English, German, French and Spanish, including placeholders, labels, validation errors, provider independence and preservation of user-defined names. Secure-context-only `crypto.randomUUID` is disabled in tests to exercise HTTP LAN operation through `crypto.getRandomValues`.

History tests cover metric checkboxes, compatible unit groups, distinct forecast windows, line/bar selection, genuine zero precipitation, negative temperatures and line breaks at missing data or large time gaps. Display choices do not change the CSV data set.

Appearance checks cover system preference, explicit Homebridge lighting that differs from the system, delayed initialization, older-host fallback and a stale initial dark-mode class after switching to light. Existing SVG lines, bars, points and legends use adaptive colors without replacing selected history series.

The declared palettes were checked for text contrast of at least 4.5:1 on their corresponding surfaces and chart/timeline strokes of at least 3:1 against chart panels. This is a limited palette check, not a full accessibility certification.

A real local browser preview with simulated Homebridge responses was visually inspected for light settings and inputs, current weather, switch timelines and temperature charts in both light and dark modes. The 0.6.5 English interface, ZEPRA branding and editable Berlin/time-zone fields were also visually checked in the local preview. This does not establish appearance in every browser, mobile viewport or deployed Homebridge version.

## Live-service checks

Earlier development checks retrieved public DWD POI reports, station metadata and a MOSMIX_L point for generic Berlin example coordinates. They confirmed observation/forecast parsing and the distinction between station and forecast-point locations. An earlier Open-Meteo check returned current fields, including radiation. These were point-in-time checks, not a continuous availability test. Later automated regression runs did not require live weather service access.

DWD radiation was absent in a checked observation. The absence is handled explicitly; no DWD HomeKit light service is offered. Open-Meteo illuminance remains an approximation based on model radiation, distinct from a local illuminance sensor.

## Package checks and remaining limits

Previous release packages were created locally, installed in isolated directories with production dependencies only, loaded and checked for platform registration, custom-UI loading and valid example configurations. The 0.6.5 archive was also installed in an isolated directory with production dependencies, then checked for platform registration, custom-UI loading, example validation and the presence of the English publication documents.

The tests do not establish Apple Home pairing, behavior on a real home hub, operation of connected actuators, long-term reliability or every target-platform combination. Automated HomeKit checks exercise library objects rather than a paired live bridge. Local browser previews use simulated data, and controlled Shelly responses are not a replacement for firmware/hardware testing.

Weather-dependent switch states are inputs to automations. Their practical behavior, failure states and timing need to be checked at the installation site.

The declared development dependencies were also installed from the committed lockfile without sibling-project dependencies. All 172 tests then passed with each Homebridge development version on Node 26.13.0. The hosted Linux Node 22/24/26 matrix is tracked separately by GitHub Actions.
