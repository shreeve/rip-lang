<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# @rip-lang/decimal

> **Zero-dependency, BigInt-backed arbitrary-precision exact decimals — with explicit rounding and hard resource limits.**

A `Decimal` is `coef × 10^exp` with a signed `BigInt` coefficient and an integer
exponent — the same model as Java `BigDecimal`, Python `Decimal`, and DuckDB's
`DECIMAL(p, s)`. Addition, subtraction, and multiplication are **exact**.
Division and scale changes require an **explicit rounding mode** — there is no
hidden rounding. There are **no IEEE specials** (`NaN`/`Infinity`); undefined
operations **throw**. "Arbitrary precision" is bounded by configurable resource
limits, so a pathological exponent gap (`1e1000000000 + 1`) is rejected at
preflight instead of allocating a multi-gigabyte `BigInt`.

Browser-safe and dependency-free. Design hardened in review with GPT-5.5.

## Why not just use floats or `decimal.js`?

- JS `number` is binary floating-point: `0.1 + 0.2 !== 0.3`. Unsafe for money.
- `decimal.js`/`big.js` are dependencies — Rip is zero-dependency by principle.
- `BigInt` is native and exact. A scaled `BigInt` *is* a decimal.

## Quick start

```coffee
import { Decimal, D } from '@rip-lang/decimal'

price = D"19.99"                       # tagged literal
qty   = Decimal.from(3)                # safe integers only (no floats)

subtotal = price.mul(qty)              # 59.97  (exact)
tax      = subtotal.divToScale(7n, 4, 'HALF_EVEN')   # explicit scale + mode
total    = subtotal.add(tax)

total.toFixed(2, 'HALF_EVEN')          # "65.53"
total.toCentsNumber('HALF_EVEN')       # 6553  (integer cents)
```

## Construction

| Constructor | Notes |
| --- | --- |
| `Decimal.parse(str)` | Strict decimal syntax (`+1.5`, `.5`, `5.`, `1.23e-2`); rejects whitespace, `,`, `_`, `$`, `NaN`, `Infinity` |
| `Decimal.from(v)` | `Decimal \| string \| bigint \| number` — **numbers must be safe integers** (pass a string for fractions) |
| `Decimal.fromParts(coef, exp)` | Raw `coef × 10^exp` |
| `Decimal.fromScaledInteger(units, scale)` | `units × 10^-scale`, e.g. cents → dollars: `fromScaledInteger(12345n, 2)` → `123.45` |
| `` D"19.99" `` | Tagged literal (interpolation is rejected — use `Decimal.parse` for dynamic input) |

## Arithmetic

```coffee
a.add(b)    a.sub(b)    a.mul(b)         # exact
a.neg()     a.abs()
a.divToScale(b, scale, mode)            # rounded division — explicit scale + mode
a.divExact(b)                           # exact, or throws DecimalNonTerminatingError
```

`add`/`sub` keep the smaller exponent (`1.20 + 3.4 → 4.60`); `mul` adds exponents
(`1.20 × 3.0 → 3.600`).

## Rounding

Every value-changing conversion takes an explicit `RoundingMode`:

`UP` `DOWN` `CEILING` `FLOOR` `HALF_UP` `HALF_DOWN` `HALF_EVEN` `UNNECESSARY`

`UNNECESSARY` asserts the operation is exact and throws `DecimalInexactError`
otherwise — useful for emitting a fixed-scale value without silent loss.

```coffee
d.quantizeToScale(2, 'HALF_EVEN')       # round to 2 fractional digits
d.toFixed(2, 'HALF_UP')                 # "1.24"
```

Negative ties round correctly (decided on the absolute remainder), and there is
no negative zero:

```coffee
D"-0.005".quantizeToScale(2, 'HALF_EVEN').toString()  # "0.00"   (not "-0.00")
D"-0.005".quantizeToScale(2, 'HALF_UP').toString()    # "-0.01"
```

## Comparison

```coffee
a.cmp(b)   # -1 | 0 | 1
a.eq(b)    a.lt(b)   a.lte(b)   a.gt(b)   a.gte(b)
```

Comparison is value-based — `D"1.0".eq("1.00")` is `true` — and never allocates a
giant `BigInt` on a wide exponent gap. Because `1.0` and `1.00` are equal but
distinct representations, a `Decimal` is not a reliable `Map`/`Set` key; use
`canonicalKey()` for that.

## Formatting & conversion

| Method | Result |
| --- | --- |
| `toString()` | Plain decimal, **scale preserved** (`"1.20"`) |
| `toCanonicalString()` | Value-canonical, trailing zeros stripped (`"1.2"`) |
| `canonicalKey()` | Stable value key (`1.0` and `1.00` share one) |
| `toJSON()` | String (never a lossy JS number) |
| `toFixed(scale, mode)` | Fixed fractional digits |
| `toNumber()` | Lossy, explicit; throws if not finite |
| `toScaledInteger(scale, mode)` | Unscaled `bigint` (e.g. `1.23 @ 2 → 123n`) |
| `toCentsNumber(mode)` | Integer cents as a JS number (throws if outside safe-integer range) |

`valueOf()` throws, so `+d`, `d < 3`, and `d == 1` can't silently coerce to a
float — use `.toNumber()` / `.cmp()` instead.

## Interop

**Money / `@rip-lang/validate`.** That package keeps money as integer cents
(`money` = HALF_UP, `money_even` = HALF_EVEN). `toCentsNumber(mode)` produces the
same cents for safe-range inputs, inspecting **all** discarded digits (no
double-rounding).

**DuckDB `DECIMAL(p, s)`.** Columns arrive as lossless strings. Round-trip and
validate fit:

```coffee
d = Decimal.parse(row.amount)           # exact, scale preserved
d.fitsDecimal(38, 2)                    # true if it fits DECIMAL(38, 2) losslessly
d.toFixed(2, 'UNNECESSARY')             # emit at the column scale (throws if lossy)
```

**Rip Schema `~:Decimal`.** Importing this package registers a `~:Decimal`
coercer that hydrates a wire string/number into a `Decimal`. The lowercase
`~:decimal` from `@rip-lang/validate` (which returns a string) is untouched.
Register under another name with `registerDecimalCoercer(name)`.

```coffee
Invoice = schema :input
  amount? ~:Decimal
```

## Resource limits

Defaults (browser-safe; configurable via `Decimal.config({...})`):

| Limit | Default | Guards |
| --- | --- | --- |
| `maxInputLength` | 4096 | parse input length |
| `maxDigits` | 1000 | coefficient / result digits (DuckDB caps precision at 38) |
| `maxAbsExponent` | 100000 | stored exponent magnitude |
| `maxOutputLength` | 100000 | rendered string length |

Every operation that scales a coefficient estimates the result size **before**
building the power of ten, so out-of-range inputs throw `DecimalResourceLimitError`
or `DecimalRangeError` instead of exhausting memory.

## Errors

All extend `DecimalError`: `DecimalParseError`, `DecimalDivisionByZeroError`,
`DecimalNonTerminatingError`, `DecimalInvalidOperationError`, `DecimalRangeError`,
`DecimalResourceLimitError`, `DecimalInexactError`, `DecimalUnsafeConversionError`.

## Tests

```bash
bun run --cwd packages/decimal test
```

100 assertions: the full rounding matrix, negative-tie goldens, OOM-preflight
rejection, parse strictness, exact/rounded division, DuckDB fit, and
cents-compatibility with `@rip-lang/validate`.

## License

MIT
