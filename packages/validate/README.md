# @rip-lang/validate

**The validation and normalization vocabulary for Rip — one table of pure
normalizers that powers both `read()` in route handlers and `~:name`
coercion in Rip Schema fields, on the server and in the browser.**

```coffee
import { check } from '@rip-lang/validate'

check '$1,234.50', 'money'      # 1234.5
check '123-45-6789', 'ssn'      # "123456789"
check '8016542000', 'phone'     # "(801) 654-2000"
check 'not-a-date', 'date'      # null — miss contract is always null
```

Zero dependencies, no `node:*`, no `Bun.*` — every validator is a pure
string/regex function, so the package is browser-safe (`rip.browser: true`)
and ships into app bundles via `@rip-lang/server`'s `serve()` middleware
like any other browser-flagged package.

## One vocabulary, two call sites

The same table backs two surfaces:

```coffee
# Server route handler — @rip-lang/server's read()
dob = read 'dob', 'date'

# Schema field — Rip Schema's ~:name coercion slot
Patient = schema :model
  dob? ~:date
```

`@rip-lang/server` depends on this package and re-exports its surface
(`validators`, `registerValidator`, `getValidator`, `check`, `isBlank`,
`toName`, `toPhone`), so server code keeps importing from
`@rip-lang/server` as always.

## Browser usage

Importing the package registers every validator as a named schema coercer.
That's the whole client-side story:

```coffee
import '@rip-lang/validate'     # side-effect import — registers ~:ssn et al.

Patient = schema
  ssn?   ~:ssn
  phone? ~:phone

Patient.parse {ssn: '123-45-6789', phone: '8016542000'}
# → {ssn: "123456789", phone: "(801) 654-2000"} — identical on both sides
```

Without the import, a schema using `~:name` throws a loud config error
(never a quiet validation failure) telling you what to import.

## The validators

| Family      | Names                                                        |
| ----------- | ------------------------------------------------------------ |
| Numbers     | `id`, `int`, `whole`, `float`, `money`, `money_even`, `cents`, `cents_even` |
| Strings     | `string`, `text`, `name`, `address`, `slug`                  |
| Date & time | `date`, `time`, `time12`                                     |
| Booleans    | `truthy`, `falsy`, `bool`                                    |
| Identity    | `email`, `state`, `zip`, `zipplus4`, `ssn`, `sex`, `phone`, `username` |
| Technical   | `ip`, `mac`, `url`, `color`, `uuid`, `semver`                |
| Structured  | `array`, `hash`, `json`, `ids`                               |

Contract: input is stringified (except the raw set `array`/`hash`/`json`),
the validator returns the normalized value, or `null` on miss.

## Custom validators

```coffee
import { registerValidator } from '@rip-lang/validate'

registerValidator 'npi', (v) -> v =~ /^(\d{10})$/ and _[1]
```

One call extends both vocabularies: `read 'npi', 'npi'` in handlers and
`npi! ~:npi` in schema fields.

## Exports

- **`validators`** — the name → fn table
- **`registerValidator(name, fn)`** — add to the table and the schema-coercer registry
- **`getValidator(name)`** — table lookup
- **`check(value, type)`** — apply a validator to a value you already have (session fields, env vars, config); same null-on-miss contract as `read()`
- **`isBlank(obj)`** — true for `null`/`false`/whitespace strings/empty arrays/empty objects
- **`toName(str, ...type)`** — US-English name/address title-casing engine
- **`toPhone(str)`** — US phone normalizer with extension handling

## License

MIT
