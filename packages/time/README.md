<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Time - @rip-lang/time

> **Tiny, immutable, US-English date/time library with full US timezone support and first-class durations — zero dependencies**

A pure-Rip date/time toolkit inspired by [dayjs](https://day.js.org/), scoped
down to US English and expanded to bake in the most useful pieces (UTC mode,
arbitrary IANA timezones with DST, custom parse formats, relative time,
calendar, durations) so you never reach for an `.extend()` plugin. ~1050 lines
of Rip, zero dependencies.

## Quick Start

```bash
bun add @rip-lang/time
```

```coffee
import time from '@rip-lang/time'

# Construction
now = time()
d = time('2026-04-19')
d = time('04/19/2026')             # US format
d = time('04/19/2026 3:45 PM')     # US datetime
d = time.utc('2026-04-19T12:00:00Z')
d = time.unix(1760000000)
d = time.parse('Apr 19, 2026', 'MMM D, YYYY')
```

## Features

- Immutable — every mutator returns a new instance
- Pure Rip, zero runtime deps
- Parses ISO, US `MM/DD/YYYY`, timestamps, `Date` objects, and other `time` instances
- Full formatting tokens (`YYYY`, `MMM`, `Do`, `h:mm A`, `z`, `zzz`, `[literal]`, etc.)
- `add` / `subtract` / `startOf` / `endOf` / `diff` (symbol or string units)
- `isSame` / `isBefore` / `isAfter` / `isSameOrBefore` / `isSameOrAfter` / `isBetween`
- `isToday` / `isYesterday` / `isTomorrow` / `isValid` / `isLeapYear`
- `fromNow` / `from` / `to` / `toNow` / `calendar` — English hard-coded
- `weekday()` getter and setter (Sunday-start US)
- `utc()` / `local()` / `isUTC()` / `utcOffset()`
- `.tz('HT')` / `.tz('Pacific/Honolulu')` — arbitrary IANA zones with DST-aware offsets (backed by `Intl`)
- Short aliases for every US zone: `ET CT MT PT AKT HT AZ AST ChST SST`
- `daysInMonth` / `isLeapYear` / `quarter` / `dayOfYear` / `weekOfYear`
- `time.parse(input, format)` — explicit format parsing built in
- `time.min(...)` / `time.max(...)`
- `time.duration(input, unit?)` — first-class `Duration` with ISO-8601 parse/format, `as*()` / `humanize()` / `format()`; usable directly in `.add()` / `.subtract()`

## Usage

```coffee
import time from '@rip-lang/time'

# Accessors
d.year()          # 2026
d.month()         # 0..11
d.date()          # 1..31
d.day()           # 0..6 (Sunday=0)
d.hour()
d.minute()
d.second()
d.millisecond()
d.quarter()       # 1..4
d.dayOfYear()
d.weekOfYear()
d.daysInMonth()
d.isLeapYear()
d.isValid()

# Generic get / set with symbols or strings
d.get(:year)
d.set(:year, 2027)
d.get('month')
d.set('month', 5)

# Math (returns new instance)
d.add(1, :day)
d.subtract(2, :week)
d.add(3, 'months')
d.startOf(:month)
d.endOf(:week)

# Comparison
a.isBefore(b)
a.isAfter(b)
a.isSame(b)
a.isSame(b, :day)             # same calendar day, ignoring time
a.isSameOrBefore(b)
a.isSameOrAfter(b, :day)
a.isBetween(from, to)         # default exclusive
a.isBetween(from, to, :day, '[]')   # inclusive on both ends
a.isToday()
a.isYesterday()
a.isTomorrow()

# Weekday (Sunday-start, US)
a.weekday()                   # 0..6, same as .day()
a.weekday(1)                  # new instance at Monday of same week

# Calendar (English)
a.calendar()                  # "Today at 3:45 PM", "Yesterday at 10:00 AM",
                              # "Last Wednesday at 2:15 PM", or "04/19/2026"
a.calendar(null, { sameDay: '[Today!]' })   # override any bucket

# Diff
a.diff(b)                     # milliseconds
a.diff(b, :day)               # integer days
a.diff(b, :hour, true)        # floating-point hours

# Format
d.format()                                # ISO
d.format('YYYY-MM-DD')
d.format('MM/DD/YYYY')
d.format('MMM D, YYYY')
d.format('dddd, MMMM Do YYYY, h:mm:ss A')
d.format('[Year:] YYYY')

# Relative time (English, fixed thresholds)
a.fromNow()                   # "2 hours ago"
a.from(b)                     # "a day ago"
a.to(b)                       # "in 3 minutes"

# UTC / local
d.utc()                       # convert to UTC mode
d.local()                     # convert to local mode
d.isUTC()
d.utcOffset()                 # minutes from UTC

# Arbitrary timezones — short aliases or IANA names
result = time.utc('2026-04-19T18:30:00Z')
result.tz('HT').format('ddd h:mm A z')        # Sun 8:30 AM HST
result.tz('ET').format('ddd h:mm A z')        # Sun 2:30 PM EDT
result.tz('AZ').format('ddd h:mm A z')        # Sun 11:30 AM MST (AZ never switches)
result.tz('AKT').format('zzz')                # Alaska Daylight Time

# Parse a wall-clock time *as if* in a given zone
time.tz('2026-04-20 09:00', 'HT')             # Hawaii 9 AM → UTC 19:00
time.tz.guess()                               # 'America/Denver' (runtime zone)
time.tz.aliases                               # { ET, CT, MT, PT, HT, ... } table

# Output
d.toDate()                    # native Date
d.toISOString()
d.toJSON()
d.toString()                  # UTC string
d.unix()                      # seconds
d.valueOf()                   # milliseconds

# Statics
time.isTime(x)
time.min(a, b, c)
time.max([a, b, c])

# Duration
time.duration(5000)                       # 5 seconds
time.duration(90, :minute)
time.duration({ hours: 1, minutes: 30 })
time.duration('PT1H30M')                  # ISO-8601
time.duration('P7Y')                      # 7 years

d = time.duration(reported.diff(ordered))
d.asHours()                               # 6.58 (total)
d.hours()                                 # 6 (component)
d.format('H [hr] m [min]')                # "6 hr 35 min"
d.toISOString()                           # "PT6H35M"
d.humanize()                              # "7 hours"
d.humanize(true)                          # "in 7 hours" / "7 hours ago"

later   = ordered.add(time.duration({ hours: 2, minutes: 30 }))
expires = reported.add(time.duration('P7Y'))   # HIPAA retention

time.isDuration(d)
```

## Format tokens

| Token | Output | Example |
| --- | --- | --- |
| `YYYY` | 4-digit year | `2026` |
| `YY` | 2-digit year | `26` |
| `M` / `MM` | month 1–12 | `4` / `04` |
| `MMM` / `MMMM` | month name | `Apr` / `April` |
| `D` / `DD` | day of month | `9` / `09` |
| `Do` | day with ordinal | `19th` |
| `d` / `dd` / `ddd` / `dddd` | weekday | `0` / `Su` / `Sun` / `Sunday` |
| `H` / `HH` | hour 0–23 | `7` / `07` |
| `h` / `hh` | hour 1–12 | `3` / `03` |
| `a` / `A` | am / pm | `am` / `AM` |
| `m` / `mm` | minute | `5` / `05` |
| `s` / `ss` | second | `9` / `09` |
| `SSS` | millisecond | `042` |
| `Q` | quarter | `2` |
| `Z` / `ZZ` | offset | `-07:00` / `-0700` |
| `z` | short zone name | `HST`, `EDT`, `MST` |
| `zzz` | long zone name | `Eastern Daylight Time` |
| `[xyz]` | literal | `xyz` |

## Accepted units

Any of these resolve to the same unit — use whichever reads best:

| Canonical | Aliases |
| --- | --- |
| `:year` | `'year'`, `'years'`, `'y'`, `'yr'`, `'yrs'` |
| `:quarter` | `'quarter'`, `'quarters'`, `'Q'`, `'q'` |
| `:month` | `'month'`, `'months'`, `'M'`, `'mo'` |
| `:week` | `'week'`, `'weeks'`, `'w'`, `'wk'` |
| `:day` | `'day'`, `'days'`, `'d'` |
| `:date` | `'date'`, `'dates'`, `'D'`, `'dt'` |
| `:hour` | `'hour'`, `'hours'`, `'h'`, `'hr'` |
| `:minute` | `'minute'`, `'minutes'`, `'m'`, `'min'` |
| `:second` | `'second'`, `'seconds'`, `'s'`, `'sec'` |
| `:millisecond` | `'millisecond'`, `'milliseconds'`, `'ms'`, `'msec'` |

## US timezone aliases

Pass any of these short names to `.tz(zone)` or `time.tz(input, zone)`; raw
IANA names (anything containing a `/`) are passed through as-is.

| Alias | IANA | Notes |
| --- | --- | --- |
| `ET` / `EST` / `EDT` | `America/New_York` | Eastern (observes DST) |
| `CT` / `CST` / `CDT` | `America/Chicago` | Central |
| `MT` / `MST` / `MDT` | `America/Denver` | Mountain (observes DST) |
| `PT` / `PST` / `PDT` | `America/Los_Angeles` | Pacific |
| `AKT` / `AKST` / `AKDT` | `America/Anchorage` | Alaska |
| `HT` / `HST` / `HAST` | `Pacific/Honolulu` | Hawaii-Aleutian (no DST) |
| `HADT` | `America/Adak` | Western Aleutians only (observes DST) |
| `AZ` | `America/Phoenix` | Arizona (Mountain zone, no DST) |
| `AST` | `America/Puerto_Rico` | Atlantic (PR, USVI — no DST) |
| `ChST` | `Pacific/Guam` | Chamorro (Guam, CNMI) |
| `SST` | `Pacific/Pago_Pago` | Samoa |

DST is handled automatically via the runtime's built-in IANA zone data —
no tzdata bundling, no manual transitions. `Pacific/Honolulu`, `America/Phoenix`,
`America/Puerto_Rico`, `Pacific/Guam`, and `Pacific/Pago_Pago` never switch;
everything else transitions on the standard US DST dates.

```coffee
# The same instant rendered everywhere, all at once
result = time.utc('2026-04-19T18:30:00Z')
for zone in ['HT', 'PT', 'MT', 'AZ', 'CT', 'ET', 'AKT']
  console.log "#{zone}: #{result.tz(zone).format('ddd h:mm A z')}"

# HT:  Sun 8:30 AM HST
# PT:  Sun 11:30 AM PDT
# MT:  Sun 12:30 PM MDT
# AZ:  Sun 11:30 AM MST
# CT:  Sun 1:30 PM CDT
# ET:  Sun 2:30 PM EDT
# AKT: Sun 10:30 AM AKDT
```

## Design notes

This is a deliberate US/English port — not a drop-in `dayjs` replacement:

- **No locale registry.** English names are baked in. Ordinals, meridiem,
  and relative-time strings are hardcoded.
- **No plugin system.** The features most people reach for (UTC mode,
  arbitrary-zone conversion, custom parse formats, relative time, ordinals,
  `isBetween`, `weekOfYear`, `quarter`, `isLeapYear`, `dayOfYear`,
  `calendar`, `duration`) are built into the core.
- **Symbol units preferred.** String aliases still work for familiarity.
- **Immutable.** Every mutator clones first.
- **Normalized duration components.** `time.duration({hours: 25}).hours()`
  returns `1` (with `days() === 1`), not `25`. Totals via `.as*()` are
  unchanged. This gives sensible `format()`, `humanize()`, and
  `toISOString()` output without callers having to normalize manually.

If you need multi-locale support, use the upstream `dayjs` package.

## Tests

```bash
cd packages/time
bun install
bun run test
```

The test suite compares output against upstream `dayjs` for 280+ cases
covering construction, formatting, arithmetic, `startOf`/`endOf`, `diff`,
comparisons, relative time, calendar, timezones, and durations.

## License

MIT
