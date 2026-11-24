# Homebridge verification preparation

Homebridge Weather Switches ZEPRA is being prepared for review. **Preparation is not verification.** No verification badge or endorsement is claimed, and no request has been submitted as part of this preparation.

The program is maintained in [homebridge/plugins](https://github.com/homebridge/plugins), with [current requirements](https://github.com/homebridge/plugins/wiki/Verified-Plugins). Checked on 24 November 2026.

## Evidence and remaining work

| Area | Project evidence or next action |
| --- | --- |
| Dynamic platform | `WeatherPlatform` registers and restores accessories through Homebridge's dynamic-platform API. |
| Public distribution | Verify the [npm package](https://www.npmjs.com/package/homebridge-weather-switches), [source repository](https://github.com/ZEPRA-SW/homebridge-weather-switches), enabled Issues and matching release notes after publication. |
| Supported Node.js versions | CI tests Node.js 22, 24 and 26 against Homebridge 1 and 2. Check all six jobs; do not treat an unrun matrix as a pass. |
| Configuration and installation | Settings GUI and examples are included. Invalid configuration is rejected. There are no package installation lifecycle scripts or special terminal/startup requirements. |
| Data and error handling | History and IPC use Homebridge storage; weather/Shelly requests and parsing failures are handled. There is no analytics service. Review the source and failure tests alongside the validation report. |
| Eligibility | Compare functionality with existing verified weather plugins, including `homebridge-weather-plus`. Explain the additional use case; eligibility is for Homebridge reviewers to decide. |

The [validation report](TEST-REPORT.md) records local test versions and limits. The [CI workflow](.github/workflows/ci.yml) adds a reproducible Linux matrix; hosted results become evidence only after jobs finish. Its automatic checks need no publisher credentials and cannot publish packages.

The `supports-hap` package keyword identifies the implemented HomeKit transport. It is not a verification marker. Do not add `supports-matter`: the plugin does not register Matter accessories itself. See the [official transport convention](https://github.com/homebridge/plugins#declaring-supported-transports).

## Before requesting review

1. Confirm public installation, source links, Issues and the versioned GitHub release.
2. Resolve CI failures, including any Node.js 22 compatibility issue. Check an actual Homebridge installation, cache restoration, unavailable data and shutdown behavior.
3. Document the comparison with existing verified weather plugins and retain the source/privacy review evidence.
4. Open the verification-request template in [homebridge/plugins Issues](https://github.com/homebridge/plugins/issues/new/choose), provide the package and repository links, and complete the current form accurately.
5. Address reviewer feedback. Add a verification badge only after Homebridge confirms approval.

The official [request process](https://github.com/homebridge/plugins#how-to-request-verification) is separate from publishing the package. This document does not submit a request or guarantee acceptance.
