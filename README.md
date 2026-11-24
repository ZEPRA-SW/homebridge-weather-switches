# Homebridge Weather Switches ZEPRA

**Homebridge Weather Switches ZEPRA** turns weather conditions into virtual HomeKit switches for your automations. Combine current conditions, hourly forecasts and an optional local Shelly WS90 weather station, then choose how each switch behaves when data is unavailable.

**Version 0.6.5** · [GitHub](https://github.com/ZEPRA-SW/homebridge-weather-switches) · [npm](https://www.npmjs.com/package/homebridge-weather-switches)

## Features

- Individual switches for wind, gusts, temperature, relative humidity, cloud cover and hourly precipitation.
- Current weather from Open-Meteo model data or DWD station observations; hourly forecasts from Open-Meteo or DWD MOSMIX.
- Optional local WS90 measurements through a Shelly host's BTHome components, including measured illuminance and rain detection.
- Per-condition selection of weather-service data, local measurements, or local measurements with a weather-service fallback.
- AND/OR conditions, separate activation and release thresholds, inverted switch states and a configurable stabilization time.
- Explicit behavior for missing or stale data: hold the last state, turn on, or turn off.
- Live status, optional local history, selectable line/bar charts and CSV export.
- English by default, with German, French and Spanish available in the settings.
- Editable location and display time zone, starting with Berlin, Germany (`52.52`, `13.405`) and `Europe/Berlin`.
- Light and dark appearance following Homebridge's selected mode, with browser preference as a fallback.

The plugin exposes rule states to HomeKit. Create the corresponding device actions in your HomeKit automation app; this plugin does not operate blinds, covers or other actuators directly.

## Requirements

| Component | Supported versions |
| --- | --- |
| Node.js | 22.13 or later in the 22.x line, 24.x, or 26.x |
| Homebridge | 1.8 or later in the 1.x line, or 2.x |
| Homebridge UI | A version supporting custom plugin interfaces |

History uses Node.js' built-in SQLite module. No separate native database build is required. Package installation needs access to the npm registry for dependencies. Weather-service access requires an internet connection; local station reads use your local network.

## Installation and first setup

The public display name is **Homebridge Weather Switches ZEPRA**. Its technical npm package name remains **`homebridge-weather-switches`**, preserving compatibility with existing installations. Search for that package in the Homebridge UI's **Plugins** page and install it. Open its settings, save your configuration and restart Homebridge.

For a downloaded release archive, install the supplied `.tgz` using your Homebridge installation's plugin-management workflow. Keep local package archives in a persistent directory if your npm setup retains file references to them.

1. Enter a location name and coordinates in decimal degrees. New setups start with Berlin, Germany: latitude `52.52`, longitude `13.405`. Both values are freely editable; existing configured coordinates are preserved. North and east are positive; south and west are negative. Each platform instance describes one location.
2. Set the display time zone using an IANA identifier, such as `Europe/Berlin` (the default), `Europe/London` or `America/New_York`. Select a weather service. New setups use DWD by default. Choose Open-Meteo when worldwide model coverage is appropriate and you accept its supported usage conditions.
3. For DWD, use automatic station selection or enter a supported five-digit POI/WMO station identifier. Set the maximum allowed station distance.
4. Add a switch and at least one condition. Set the measurement, threshold, release threshold and desired failure behavior.
5. Optionally enable HomeKit sensor displays, local station access or history recording.
6. Save with Homebridge's save button and restart Homebridge. Reopen the settings or fully reload the page after an update.

Keep switch IDs unchanged after creating HomeKit automations. Names and display order can be changed without changing an accessory's identity. Removing a switch or disabling a sensor removes that accessory or service on the next start and can affect automations using it.

The interface language is independent of the weather service. Existing explicit language choices and user-defined names are preserved. The location and time zone are defaults rather than fixed requirements: choose coordinates and a zone that match your installation.

## Weather sources

| Source | Data | Important details |
| --- | --- | --- |
| Open-Meteo | Worldwide current model values and hourly forecasts | Model data, not measurements from a selected nearby station. The supported free endpoint requires explicit consent for private, non-commercial use. |
| DWD observations | Actual station reports from the DWD POI product in Germany | Hourly reports. Wind is a recent 10-minute mean; gusts are the maximum over the last hour. The default maximum data age is 7,200 seconds. |
| DWD MOSMIX | Hourly forecasts for the selected forecast point | Forecasts are separate from station observations. Rules support a horizon of up to 72 hours. |
| Local WS90 | Current measurements read through a configured Shelly BTHome host | Independent of the weather-service poll. No local forecast is generated. |

DWD station selection uses a bundled catalogue dated **2 November 2026**, containing 199 supported POI stations. The nearest supported station within the distance limit is selected unless a station ID is specified. The same distance limit applies to a manually selected station. A POI/WMO identifier is different from a CDC station ID.

The settings include links to the official station map and station directory. The selected station name, distance and available measurement heights are shown. A station's inclusion does not guarantee that every measurement is present in its current report. The selected station remains selected during an outage; the plugin does not silently switch weather services or substitute older missing observations.

DWD forecasts normally use the observation station's identifier, with a separate MOSMIX identifier available when needed. Observation and forecast coordinates, timestamps and sources remain distinct in the status view.

## Rules, thresholds and failure behavior

`above` activates at **greater than or equal to** the activation threshold. It releases only below its release threshold. For example, wind activates at 30 km/h and releases below 25 km/h; exactly 25 km/h keeps an active condition active.

`below` activates at **less than or equal to** the threshold and releases only above its release threshold. A frost rule can activate at 0 °C and release above 2 °C. Equal activation and release thresholds are allowed.

Each condition has its own hysteresis. `mode: "all"` combines conditions with AND; `mode: "any"` combines them with OR. **All selected condition inputs must be valid, including for OR rules.** A missing input invokes the switch's failure behavior rather than treating the remaining inputs as a complete valid rule. Use an explicit local fallback when an individual source outage should be bridged.

`matchedState: true` turns the switch on when its combined rule matches. `false` reverses the result. `stableForSeconds` delays a normal state change until the new target state has remained valid for the configured time. Invalid input or a change back resets the pending transition.

When required data is unavailable, `failureState` applies:

| Value | Behavior |
| --- | --- |
| `hold` | Keep the last state in the current process and report a communication error to HomeKit. The initial internal state after a restart is off; previous states are not restored from history. |
| `on` | Immediately turn on, independently of stabilization time. |
| `off` | Immediately turn off, independently of stabilization time. |

Receiving an old value again does not refresh its measurement timestamp. Last valid values are usable only within their age limits. A failure-state switch turning on is not evidence that a weather threshold was exceeded.

### Units and forecasts

| Measurement | Unit | Availability |
| --- | --- | --- |
| Temperature | °C | Weather service, forecast, local WS90 |
| Relative humidity | % | Weather service, forecast, local WS90 |
| Wind and gusts | km/h | Weather service, forecast, local WS90 |
| Total cloud cover | % | Weather service and forecast |
| Precipitation | mm per hourly interval | Weather service and forecast |
| Illuminance | lux | Measured local WS90 or estimated current Open-Meteo input; optional Open-Meteo HomeKit display |
| Rain detection | 0 = dry, 1 = raining | Local WS90 |

Forecast conditions support maximum, minimum, arithmetic mean and the hourly value at a target time. Precipitation additionally supports a sum over the selected forecast window. Start/end offsets are whole hours, with an end of up to 72 hours. Every required hourly value must be available; missing values are not replaced with zero or adjacent hours.

Windows use provider UTC hours rather than interpolated minutes. The target-time option selects the first full UTC hour at or after the target. Precipitation amounts belong to the hour ending at each timestamp: at 06:15, a 0–6 hour window can cover the intervals from 06:00 to 12:00. That includes up to almost an hour before the evaluation time. Status and exports show the actual interval boundaries.

Current precipitation means the **last completed hourly amount**, not rain probability or instantaneous rain detection. Open-Meteo's hourly amount remains valid while it belongs to the still-fresh current weather response; its older hourly timestamp alone does not cause an artificial half-hour outage. The plugin does not turn the WS90's raw precipitation counter into an hourly amount because its interval/counter semantics have not been confirmed.

The detailed forecast guide is available in [FORECAST.md](FORECAST.md).

## Local WS90 through Shelly/BTHome

The optional **Local Shelly weather station** section is placed between location settings and switches. It is disabled by default.

The WS90 must already be configured as a BTHome device with its sensors on a compatible Shelly host. This plugin reads existing components; it does not pair devices, install scripts or change Shelly settings.

Configure:

- The Shelly host IP address or hostname, with an optional HTTP/HTTPS scheme and port.
- The expected Shelly hardware ID. It is verified before reading components.
- The BTHome device component, for example `200` or `bthomedevice:200`.
- The Shelly password if required. HTTP Digest SHA-256 authentication as `admin` is supported. The password is stored in the Homebridge configuration and is excluded from status/history output.
- Optional individual sensor component IDs when automatic matching is ambiguous.

Sensor IDs need not be consecutive. Automatic matching uses the selected Bluetooth device's address, BTHome object type and index. Wind and gusts share an object type but have different indices; verify their mapping against the Shelly interface. Internal host measurements and other Bluetooth devices are excluded.

The defaults are a 15-second local poll and a 120-second maximum age per sensor. Local reads run independently of weather-service reads. Fresh sensor values remain usable when Shelly reports the BTHome device as **unpaired**; actual device/sensor errors and stale timestamps are still checked.

### Source selection per condition

| Selection | Behavior |
| --- | --- |
| Weather service (`weather`) | Use only a valid current value from the selected external service. |
| Local station (`local`) | Use only the corresponding valid local measurement. |
| Prefer local, weather service as fallback (`prefer-local`) | Use a fresh local value; otherwise use the corresponding valid external value. Automatically return to local measurements when they become valid again. |

A fallback exists only when the external service supplies that measurement. Local rain detection, for example, has no equivalent external binary rain input. The plugin does not average the two sources. To compare both, create separate conditions and combine them with AND or OR, subject to the validity rule above.

Local measurements include temperature, humidity, wind, gusts, actual illuminance and rain detection. For a binary rain switch using `above`, set both thresholds to `0.5` so that 1 activates and 0 releases. Local cloud cover and confirmed hourly precipitation are unavailable. The raw precipitation value is displayed separately with its timestamp and an unconfirmed interval label.

The existing HomeKit temperature/humidity and optional light display remain associated with the selected weather service. The local station adds rule inputs, status and separate history; it does not create a second set of native HomeKit weather sensors.

Local history uses original sensor times. Its series is separated by location, Shelly hardware ID and BTHome device component. Changing the external weather service does not merge or replace that series. Use a new component assignment when a replacement station should start a separate history.

See [example.local.config.json](example.local.config.json). Its example host and hardware ID must be replaced, and local access must be enabled explicitly.

## HomeKit sensors and automations

Each rule switch reports automatic state changes and can serve as a HomeKit automation trigger. Configure the device action and any reverse action in your HomeKit app. Trigger support depends on the app and your HomeKit setup.

Switches are read-only. Tapping a tile may be rejected by HomeKit; there is no manual override mode. Optional native temperature and humidity sensors are enabled together. Missing or stale inputs produce communication errors rather than fabricated values, although a HomeKit app may continue to display a cached last reading.

The optional light sensor is available only with Open-Meteo. It estimates daylight from modelled shortwave radiation using approximately **lux = W/m² × 105**, capped to HomeKit's 0.0001–100,000 lux range. This is a rough horizontal daylight estimate, not a local lux measurement; building shade, indoor lighting, orientation and night lighting are not represented. DWD does not expose a HomeKit light sensor. Actual local WS90 illuminance can be used for local rules and local history; estimated current Open-Meteo illuminance can also be selected as a weather-service rule input.

Weather reports, forecasts and internet polling are not a replacement for a required local wind guard or other protective system. Check device automations and failure-state choices against your installation.

## Status, history and CSV

The **Status** tab shows the running configuration, current values, source, measurement time, age, local station inputs and active fallback sources. Unsaved settings are not presented as live runtime data. Missing or stale values are marked; a disconnected runtime is shown as unknown.

**History recording is off by default.** Live status works without recording and without creating a history database. With recording enabled, data is stored under:

```text
<Homebridge storage directory>/weather-switches/history.sqlite
```

The status connection uses a local socket or named pipe; it does not add a public HTTP listener. The charts reuse the normal weather polls instead of making extra weather-service requests.

- Retention is configurable from 1 to 366 days, with 365 days as the default.
- Day/week views use individual weather timestamps, retained for up to seven days. Month/year views use hourly averages with minimum, maximum and sample count.
- Switch transitions and availability changes have a separate timeline. Runtime gaps remain unknown rather than being extended as confirmed activity.
- Weather-service measurements, local station readings and evaluated forecast inputs stay separate.
- Select measurements with checkboxes. Compatible units share charts: wind/gusts and humidity/cloud cover. Other units have separate charts.
- Choose automatic, line or bar charts. Automatic uses bars for precipitation. Missing values and large gaps break lines; true zero precipitation is marked at the baseline.
- Selection changes only the display, not what is recorded or exported.

Long-period precipitation charts contain averages of recorded hourly amounts, **not daily or monthly accumulated rainfall**. Forecast history records rule evaluations on the evaluation-time axis, not future measurements on a future-time axis.

CSV exports the selected period independently of chart checkboxes. It includes UTC timestamps, sources, units, quality, aggregation and available rule context. Status and chart time labels use the configured IANA time zone, defaulting to `Europe/Berlin`. Storage and CSV timestamp columns remain UTC; selecting a display zone does not shift the observations or forecast intervals. Exports use UTF-8 with a BOM and semicolon-separated fields.

Fixed record limits also bound storage use and may shorten retained history under heavy activity. The status view reports when a limit applies. Turning recording off stops new writes but does not delete existing history. **Clear history** requires confirmation and removes this plugin's recorded observations, aggregates, forecast evaluations, events and sessions across its saved locations. Configuration and HomeKit identities remain intact.

## Configuration example

This is a platform block for the `platforms` array in Homebridge's `config.json`. Adjust the coordinates, thresholds and failure behavior to your setup.

```json
{
  "platform": "WeatherSwitches",
  "name": "Weather",
  "language": "en",
  "timeZone": "Europe/Berlin",
  "provider": "dwd",
  "latitude": 52.52,
  "longitude": 13.405,
  "pollInterval": 300,
  "staleAfter": 7200,
  "showSensors": true,
  "showLightSensor": false,
  "enableHistory": false,
  "switches": [
    {
      "id": "wind-warning",
      "name": "Wind warning",
      "mode": "any",
      "matchedState": true,
      "stableForSeconds": 0,
      "failureState": "on",
      "conditions": [
        {"metric": "windSpeed", "operator": "above", "threshold": 30, "releaseThreshold": 25},
        {"metric": "windGusts", "operator": "above", "threshold": 50, "releaseThreshold": 40}
      ]
    }
  ]
}
```

Additional examples:

- [Current conditions](example.config.json)
- [Current and forecast conditions](example.forecast.config.json)
- [Local station with external fallback](example.local.config.json)

## Service access, attribution and privacy

The supported free Open-Meteo access is restricted in this plugin to **private, non-commercial use**. The consent checkbox is unchecked by default. Select it only when the terms apply to your use, then save and restart Homebridge. Missing, revoked or outdated consent blocks Open-Meteo requests. A saved withdrawal is checked before subsequent requests, including retries. Commercial customer endpoints are not supported in this version.

Open-Meteo receives the configured coordinates. DWD station selection occurs locally; requests retrieve the selected station/forecast product. Local station credentials remain in the Homebridge configuration and local station reads go directly to the configured host.

Weather data and derived outputs carry separate attribution from the plugin's software licence:

- [Open-Meteo](https://open-meteo.com/): [API documentation](https://open-meteo.com/en/docs), [terms](https://open-meteo.com/en/terms) and [data licence](https://open-meteo.com/en/licence).
- [Deutscher Wetterdienst](https://www.dwd.de/): [POI observations](https://opendata.dwd.de/weather/weather_reports/poi/), [MOSMIX forecasts](https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/), [copyright information](https://www.dwd.de/copyright) and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Local station readings are labelled as local measurements rather than attributed to DWD or Open-Meteo.

Unit conversion, estimated illuminance, derived forecast humidity, rule states and history aggregation are processing performed by the plugin. Source and processing information are included in status/export where applicable. Provider availability and data accuracy are outside the plugin's control.

Software licence: [MIT](LICENSE). Provider terms and weather-data licences apply separately.

## Development and validation

Install development dependencies in the project directory, then run:

```bash
npm install
npm test
npm run check
```

To run the same tests with the Homebridge 2 development dependency:

```bash
WEATHER_HOMEBRIDGE_VERSION=2 npm test
```

The automated tests use real Homebridge/HAP library objects and controlled weather/Shelly responses. They do not start a live Homebridge server or operate physical actuators. Light and dark UI layouts have been inspected in a local browser preview with simulated runtime data. Validate sensor mapping, timestamps and automation behavior with your actual hardware.

See [TEST-REPORT.md](TEST-REPORT.md) for detailed validation records, and [RELEASE-NOTES.md](RELEASE-NOTES.md) for release details.

## Support

Report reproducible problems or request features through [GitHub Issues](https://github.com/ZEPRA-SW/homebridge-weather-switches/issues). Include the plugin, Node.js and Homebridge versions, the selected data source and a sanitized error description.

Contact: [pm@zepra-app.de](mailto:pm@zepra-app.de).

## Homebridge verification

Verification preparation and the remaining review steps are documented in [VERIFICATION.md](VERIFICATION.md). This plugin does not yet claim Homebridge verification.
