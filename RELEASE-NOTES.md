# Homebridge Weather Switches ZEPRA — version 0.6.5

Repository: [ZEPRA-SW/homebridge-weather-switches](https://github.com/ZEPRA-SW/homebridge-weather-switches) · Package: [homebridge-weather-switches](https://www.npmjs.com/package/homebridge-weather-switches)

## GitHub repository description

Homebridge Weather Switches ZEPRA: virtual HomeKit switches using Open-Meteo, DWD forecasts and optional local Shelly WS90 measurements.

## npm package description

Homebridge Weather Switches ZEPRA: virtual HomeKit switches with Open-Meteo, DWD observations and forecasts, and optional local Shelly WS90 measurements.

## Suggested repository topics

`homebridge` · `homebridge-plugin` · `homekit` · `weather` · `weather-station` · `open-meteo` · `dwd` · `shelly` · `bthome` · `ws90`

## GitHub release title

Homebridge Weather Switches ZEPRA v0.6.5 — English defaults and configurable time zone

## GitHub release body

Homebridge Weather Switches ZEPRA turns current weather, hourly forecasts and optional local weather-station measurements into virtual HomeKit switches. Use those switches as triggers for your own HomeKit automations.

### New in this version

- English is the default interface language when no language has been configured. Existing explicit choices of German, English, French or Spanish remain unchanged.
- Public display name: **Homebridge Weather Switches ZEPRA**. The technical npm package identifier stays `homebridge-weather-switches` for existing-installation compatibility.
- New setups start with editable Berlin, Germany coordinates (`52.52`, `13.405`); existing configured coordinates remain unchanged.
- Configurable IANA display time zone, defaulting to `Europe/Berlin`. Status and chart labels use the selected zone; stored timestamps and CSV timestamp columns remain UTC.
- English README, forecast guide, validation report, package description and release notes.
- Documentation covers source selection, forecast intervals, hourly precipitation, local fallback, missing-data behavior and service access requirements.

### Included capabilities

- Open-Meteo current model values and hourly forecasts, or DWD station observations and MOSMIX forecasts.
- Optional Shelly WS90 measurements through an existing BTHome-capable Shelly host.
- Weather-service, local-only and local-preferred inputs for each current condition. Local-preferred conditions use a valid weather-service value when the corresponding local measurement is unavailable.
- AND/OR rules, activation/release thresholds, hysteresis, stabilization time and configurable failure states.
- Optional HomeKit temperature/humidity displays and estimated daylight with Open-Meteo.
- Live status, optional SQLite history, selectable line/bar charts and CSV export.
- Light and dark appearance for settings, status and charts.
- Fresh WS90 readings remain valid when Shelly reports the BTHome device as unpaired; timestamp and fault checks remain active.

### Verification preparation

A GitHub Actions matrix covers Node.js 22, 24 and 26 with Homebridge 1 and 2. An English bug-report form and verification guide are included. Homebridge verification has not been granted or requested by this release.

### Compatibility

Node.js 22.13+ in the 22.x line, Node.js 24.x or Node.js 26.x; Homebridge 1.8+ in the 1.x line or Homebridge 2.x. A Homebridge UI with custom plugin-interface support is required for the configuration/status interface.

### Validation

All 172 automated tests passed with Homebridge 1.11.1 and 2.5.0 on both Node.js 24.22.3 and 26.13.0. The English interface and location/time-zone fields were also checked in a local browser preview.

### Setup and update notes

1. Install `homebridge-weather-switches` from the Homebridge UI, or use the supplied release archive with your installation's plugin-management workflow.
2. Open the plugin settings, choose a source, location and display time zone, and configure switches and failure behavior.
3. Save and restart Homebridge. Fully reload the browser page after updating.

The free Open-Meteo endpoint supported by this plugin requires explicit consent for private, non-commercial use. Commercial customer endpoints are not supported. DWD does not require that Open-Meteo consent.

The plugin reports automatic rule states; it does not directly operate actuators. All selected inputs must be valid even in an OR rule. Local observations do not provide forecasts, and the WS90 raw precipitation counter is not treated as an hourly amount. Optional history is disabled by default.

Read the README for configuration examples, data attribution and practical limits. Automated validation does not replace checking your local sensor mapping and HomeKit automations with actual devices.

### Support

[Report an issue](https://github.com/ZEPRA-SW/homebridge-weather-switches/issues) or contact [pm@zepra-app.de](mailto:pm@zepra-app.de).
