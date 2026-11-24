# Weather data, forecasts and source selection

This guide describes the data used by `homebridge-weather-switches` 0.6.5. Current conditions, forecast values and local station measurements have different meanings and timestamps. They are kept separate throughout rule evaluation, status and history.

## Data sources

| Source | Current conditions | Forecasts |
| --- | --- | --- |
| Open-Meteo | Model values for the configured coordinates | Hourly model values from the same forecast request |
| Deutscher Wetterdienst (DWD) | POI station observation reports | MOSMIX_L forecast for the selected point |
| Shelly WS90 through a Shelly BTHome host | Local sensor measurements | Not available |

### DWD observations and MOSMIX

Current DWD data comes from public POI reports. The plugin keeps the selected station, its name, coordinates, distance and observation timestamp. A failed request does not select another station. Missing fields are not filled from older observations, and a missing value is never interpreted as zero.

Total cloud cover is accepted only as a valid percentage between 0 and 100. POI values already use percent; the plugin does not apply an unconditional conversion from eighths. Temperature and humidity commonly describe observations at 2 m, while wind commonly uses 10 m. The supplied station metadata identifies the actual measurement heights where available.

Forecast rules use the DWD **MOSMIX_L** single-point KMZ product. By default, the point identifier follows the selected POI station. A separate five-character, potentially alphanumeric MOSMIX identifier can be configured. The coordinates in the returned forecast are checked against the configured maximum distance. A missing file does not cause an automatic search for another point.

MOSMIX is a forecast, even when its point is named after an observation station. The plugin reads total cloud cover from `N`, not effective cloud cover `Neff`. It converts `TTT` from Kelvin to degrees Celsius and `FF`/`FX1` from m/s to km/h. Relative humidity is derived from temperature and dew point `Td` with the DWD Magnus approximation, using constants 17.5043 and 241.2. It is not a separate humidity observation. Missing inputs remain missing.

Observation-station coordinates and MOSMIX-point coordinates may differ. Status therefore identifies their actual sources and distances separately.

### Open-Meteo models

Open-Meteo current conditions and forecasts are model data rather than measurements from a chosen nearby station. Required forecast fields are requested together with current conditions; the plugin does not use a second forecast endpoint. When forecasts are needed, it requests a 96-hour horizon and limits rule windows to 72 hours.

The response does not supply a model issue time for the plugin to use. Status reports the retrieval time and leaves the model issue time unavailable. A recent retrieval is not proof that the underlying model run was just produced.

### Local WS90 measurements

The local station is polled independently of the selected weather provider. The plugin first verifies the Shelly host's configured hardware identity, then reads the selected BTHome device and its matching sensor components. Sensor component identifiers need not be consecutive.

Available local rule values are temperature, relative humidity, wind speed, gusts, illuminance and binary rain status. Shelly has already decoded BTHome values; wind is converted from m/s to km/h. Cloud cover is not a local station value. Raw precipitation is displayed separately because its interval or counter meaning has not been established; it is not used as hourly precipitation.

A Shelly `paired: false` status alone does not invalidate fresh sensor advertisements. Host identity, device association, each sensor's original timestamp, valid numeric ranges and device/sensor error checks still apply. The plugin does not pair devices or write settings to the Shelly host.

For current conditions, each rule can select:

- **Weather provider:** use only the selected external provider.
- **Local station:** use only the selected local sensor.
- **Prefer local, weather provider as backup:** use the local value while it is available and fresh; otherwise use a valid provider value for the same metric.

Sources are not averaged. The backup selection does not make old provider data fresh. Status and recorded rule context identify the source actually used. To require agreement between sources, create separate local and provider conditions and combine them with AND. Use OR for alternative conditions, subject to the availability policy below.

## Forecast conditions

Each condition selects current data or a forecast. Configurations without a `source` field continue to use current data. Forecasts always come from the selected external provider; the local station is not a forecast source.

| Setting | Meaning |
| --- | --- |
| Start and end | Whole hours relative to each evaluation. The default window is 0–6 hours. End must be after start and no more than 72 hours ahead. |
| Maximum (`max`) | Highest hourly value across the complete window; the default aggregation. |
| Minimum (`min`) | Lowest hourly value across the complete window. |
| Mean (`mean`) | Arithmetic mean of the hourly values, not a continuous or time-weighted measurement. |
| Value at target time (`at`) | First full UTC hour at or after the configured end/target. Start is ignored. The selected timestamp may be almost an hour later than the requested target. |
| Sum (`sum`) | Sum of complete hourly precipitation amounts. Available only for precipitation. |

A window includes full UTC hourly timestamps **after its start and up to and including its end**. The plugin does not interpolate minutes or fill missing values from adjacent hours. Every required timestamp must contain a valid value for the selected metric. Evaluation uses UTC to avoid daylight-saving ambiguities; the interface displays times in the configured IANA time zone (`timeZone`), defaulting to `Europe/Berlin`. Coordinates and time zone are editable; stored timestamps and CSV timestamp columns remain in UTC.

Wind gust `FX1` is the maximum for the hour preceding its validity timestamp, rather than an instantaneous measurement at that timestamp.

Activation and release thresholds, per-condition hysteresis, AND/OR, inverted target states and stabilization time apply to both current and forecast inputs. **Every configured input must be available, including with OR.** An unavailable required input invokes the switch's configured failure behavior instead of being silently ignored.

[The forecast example](example.forecast.config.json) combines current wind with the strongest forecast gust over the next six hours. Its `on` failure state is an example choice; configure failure behavior to suit the automations that consume the switch.

## Precipitation and hourly boundaries

`precipitation` is an amount in **mm for the hour preceding its timestamp**:

- DWD observations use `precipitation_amount_last_hour`.
- MOSMIX forecasts use `RR1c` (kg/m², equivalent to mm of precipitation).
- Open-Meteo uses the hourly `precipitation` field, including for the current completed-hour amount. The shorter current-data interval is not treated as an hourly amount.

The current Open-Meteo amount covers the latest completed hour associated with a fresh weather response. An hour ending 45 minutes ago is not automatically stale for that reason alone. Missing hourly values, an older interval or a genuinely stale weather response remain unavailable. The original observation/interval timestamps are retained.

Forecast `sum` adds only the selected complete hourly intervals. A single missing hour makes the window unavailable. `max`, `min` and `mean` still operate on individual hourly amounts; `at` selects the amount for the hour ending at its target timestamp.

For example, evaluating start 0/end 6 at 06:15 UTC selects hour endings 07:00 through 12:00, covering intervals **06:00–12:00**. This includes 15 minutes before evaluation and does not mean an exact rolling 06:15–12:15 sum. The plugin does not prorate hourly amounts. Status and exported context show the actual interval boundaries.

Historical hourly means are averages of recorded values, not accumulated rainfall totals.

## Refresh, age and failure behavior

MOSMIX is downloaded only when a forecast condition exists, and all switches share the cached forecast. The default refresh interval is **1,800 seconds**; the allowed range is 900–21,600 seconds. Current POI observations and MOSMIX forecasts are requested independently. A POI outage does not invalidate an otherwise valid forecast-only rule, and a MOSMIX outage does not invalidate fresh observations.

Forecast age is configured independently of current-data age:

| Provider | Default maximum forecast age | Age is measured from |
| --- | --- | --- |
| DWD MOSMIX | 43,200 seconds (12 hours) | The product's issue time |
| Open-Meteo | 3,600 seconds (1 hour) | Retrieval time, because no model issue time is available |

The configurable age range is 3,600–86,400 seconds and must be at least the configured forecast refresh interval. Downloading the same old MOSMIX run does not extend its validity. Future issue times and backwards-moving MOSMIX issues are not accepted as newer forecasts.

Network, HTTP, archive and XML failures, stale data and incomplete horizons make the affected inputs unavailable. Previously retrieved values remain usable only within their age limit and with complete coverage of the required window. The configured `hold`, `on` or `off` failure state applies when required data is unavailable. Historical records are not restored as live weather after restart.

Downloads and archive expansion are bounded. MOSMIX processing permits one KML document, rejects XML DTDs and custom entities, and does not extract archives to the filesystem. The weather-provider endpoints are fixed; the plugin does not automatically switch to unrelated providers.

## Status, recording and export

Status separates current provider values, local measurements and forecast rule inputs. It shows source and timestamp information even when recording is disabled. Forecasts affect virtual switches; they are not exposed as an additional native HomeKit forecast sensor.

With optional recording enabled, provider and local measurements use separate history namespaces. Forecast **rule evaluations** are stored separately by condition, metric, aggregation, window and source. Their hourly records contain the latest evaluation, minimum, maximum and valid evaluation count. Switch events include the input values and source/validity context used at that time.

In history, select current provider data, local station data or forecast evaluations. Checkboxes choose the displayed series. Compatible units can share charts; different units/windows remain separate. Precipitation defaults to bars, with line/bar display options available. Display selections do not remove recorded data.

The forecast chart's time axis is the **time of evaluation**, not the future target time. It represents how an evaluated forecast rule changed over time, not measurements of future weather.

CSV distinguishes current, local, forecast and mixed contexts and includes UTC timestamps, source attribution, forecast issue/retrieval times, validity bounds, aggregation and condition information. Event rows include the corresponding rule context. Missing data and source gaps are not presented as continuous live values.

Retention is configurable from 1–366 days, with a default of 365. Raw samples are retained for up to seven days before hourly aggregation. Fixed row limits can shorten the available history, especially with many conditions or configuration changes; the interface reports truncation. The forecast table is capped at 100,000 condition/hour rows across configurations. Clearing history removes this plugin's recorded samples, aggregates, evaluations and switch events, while leaving configuration and HomeKit identities intact.

## Open-Meteo consent and attribution

The Open-Meteo access offered by this plugin is for **private, non-commercial use**, including private home automation. This release does not implement Open-Meteo customer API access or create provider accounts. API access terms and the data's CC BY 4.0 license are separate matters. Refer to the provider's [terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing) and [data license](https://open-meteo.com/en/licence).

The consent checkbox is unchecked by default. A missing, obsolete or incorrect consent version is not treated as approval. Before every Open-Meteo request and retry, the runtime checks both its startup consent and the latest saved Homebridge configuration. An unreadable or invalid saved configuration blocks the request. An unsaved checkbox change does not enable access. After granting consent, save and restart. Saving a withdrawal blocks the next request and clears cached Open-Meteo inputs.

Saving configuration without consent remains possible so consent can be withdrawn. The blocked source is identified in settings and status; unavailable inputs then follow configured failure behavior. DWD does not require this Open-Meteo consent. A new setup opened in the custom interface starts with DWD; existing provider choices are preserved.

DWD data comes from [POI reports](https://opendata.dwd.de/weather/weather_reports/poi/) and [MOSMIX_L single points](https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/). Attribution identifies Deutscher Wetterdienst and indicates conversions, derived humidity, rule evaluation and aggregation. The [DWD attribution guidance](https://www.wettergefahren.de/vorlagen_quellenangabe.html) describes source and modification notices. Source and license information are also included in CSV exports.

## Technical references

- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [DWD MOSMIX method description](https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_verfahrenbeschreibung_gesamt.pdf?__blob=publicationFile&v=5)
- [DWD KML format description](https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/kml_formatbeschreibung.pdf?__blob=publicationFile&v=16)
- [DWD MOSMIX parameters](https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_parameteruebersicht.pdf?__blob=publicationFile&v=4)
- [Shelly BTHome device API](https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/BTHome/BTHomeDevice/)

Remote observations and forecasts can differ from conditions at a device's physical location. Weather data, connectivity failures and model updates can affect switch states. Validate automations at the installation site; these values do not constitute a dedicated local protective measurement.
