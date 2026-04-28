<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip RSX - @rip-lang/rsx

> **Rip Style XML — XML ⇄ Rip object, with security defaults that match what you want for SOAP and EDI envelopes**

RSX is a small, forgiving XML parser and serializer for the cases where you want a Rip object, not a DOM. It's the modern replacement for the legacy `csex.coffee` (XML→CSON) helper: same idea, but built around a real scanner/tokenizer instead of nested regular expressions, and with security defaults appropriate for talking to outside systems.

## What RSX gives you

- A **plain Rip object tree** where repeated child tags collapse into arrays automatically.
- **Namespace prefixes stripped by default** for ergonomic consumer code, with an opt-in mode to preserve them.
- **CDATA content preserved verbatim** — never collapses whitespace inside, never escapes characters.
- **No XXE, no entity-expansion attacks** — DOCTYPE rejected by default, only the five built-in entities decoded, custom `<!ENTITY>` declarations ignored.
- **Hard size cap** (5 MB by default) so a hostile peer can't OOM you with a giant payload.

## Quick Start

```bash
bun add @rip-lang/rsx
```

```coffee
import { parse, stringify } from '@rip-lang/rsx'

obj = parse soapXml
obj.Envelope.Body.COREEnvelopeRealTimeRequest.Payload  # → X12 string

xml = stringify 'soapenv:Envelope', responseObj,
  indent: 2
  cdata: ['Payload']
```

## API

```coffee
parse(xml, opts?)               # XML string → Rip object
stringify(rootName, obj, opts?) # Rip object → XML string
```

### parse options

| Option | Default | Notes |
|---|---|---|
| `stripNamespaces` | `true` | `'ns1:Foo'` → `'Foo'` |
| `preserveCDATA` | `true` | CDATA text is verbatim |
| `trimText` | `true` | Collapse whitespace in non-CDATA text |
| `coerceNumbers` | `false` | Never auto-coerce numbers — text stays text |
| `coerceBooleans` | `false` | Never auto-coerce booleans |
| `attrsKey` | `'@attrs'` | Grouped attribute key on each node |
| `textKey` | `'#text'` | Mixed-content text key |
| `forceArray` | `null` | Set, array, or function — force these tags to arrays |
| `preserveChildren` | `false` | Emit `@children` in document order |
| `allowDoctype` | `false` | DOCTYPE rejected by default |
| `allowProcessingInstructions` | `true` | Tolerate `<?xml ...?>` by skipping |
| `maxBytes` | `5 * 1024 * 1024` | Hard cap |

### stringify options

| Option | Default | Notes |
|---|---|---|
| `indent` | `''` | String or number of spaces |
| `newline` | implicit | Newline character (defaults based on indent) |
| `cdata` | `null` | Set or array of tag names whose content should be CDATA-wrapped |
| `attrsKey`, `textKey` | match parse defaults | |

## Object shape

```xml
<list>
  <item count="2">a</item>
  <item count="3">b</item>
</list>
```

becomes

```coffee
{
  list:
    item: [
      { '@attrs': { count: '2' }, '#text': 'a' }
      { '@attrs': { count: '3' }, '#text': 'b' }
    ]
}
```

Elements with no attributes and only text collapse to scalars (`<a>x</a>` → `{ a: 'x' }`).

## What RSX does NOT do

- Validate against a schema or DTD
- Honor `xmlns` binding semantics — namespace prefixes are opaque labels
- Round-trip mixed content (text and elements interleaved) unless you opt in via `preserveChildren: true`

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
