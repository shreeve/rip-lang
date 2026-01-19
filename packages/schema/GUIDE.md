<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip Schema Guide

Practical examples of what you can build with the schema runtime.

## Quick Start

```javascript
import { parse, Schema } from '@rip-lang/schema'

// Define your schema
const ast = parse(`
  @enum Role: admin, user, guest

  @model User
    name!: string, [1, 100]
    email!#: email
    role: Role, [user]
    active: boolean, [true]

    @timestamps
`)

// Create runtime
const schema = new Schema()
schema.register(ast)

// Create validated instances
const user = schema.create('User', {
  name: 'John Doe',
  email: 'john@example.com',
})

// Validate
const errors = user.$validate()  // null = valid
```

## Use Cases

### 1. API Request Validation

```javascript
// Before: Manual validation everywhere
app.post('/users', (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'name required' })
  if (!req.body.email) return res.status(400).json({ error: 'email required' })
  if (!isValidEmail(req.body.email)) return res.status(400).json({ error: 'invalid email' })
  // ... 50 more lines of validation
})

// NOW: One line
app.post('/users', (req, res) => {
  const user = schema.create('User', req.body)
  const errors = user.$validate()
  if (errors) return res.status(400).json({ errors })
  // Save user...
})
```

### 2. Form Validation (Frontend)

```javascript
// Validate form data before submit
function handleSubmit(formData) {
  const patient = schema.create('Patient', formData)
  const errors = patient.$validate()

  if (errors) {
    // Show errors next to fields
    errors.forEach(e => showFieldError(e.field, e.message))
    return
  }

  await api.savePatient(patient)
}
```

### 3. Test Data Factories

```javascript
// Before: Manually construct test objects
const user = { name: 'Test', email: 'test@x.com', role: 'user', active: true, ... }

// NOW: Get valid defaults automatically
const user = schema.create('User', { name: 'Test', email: 'test@x.com' })
// → { name: 'Test', email: 'test@x.com', role: 'user', active: true, createdAt: Date }

// Create 100 test users
const users = Array.from({ length: 100 }, (_, i) =>
  schema.create('User', { name: `User ${i}`, email: `user${i}@test.com` })
)
```

### 4. Config File Validation

```javascript
// Validate app configuration
const configSchema = parse(`
  @type AppConfig
    port!: integer
    host: string, ["localhost"]
    debug: boolean, [false]
    database!: DatabaseConfig

  @type DatabaseConfig
    url!: string
    pool: integer, [10]
`)

schema.register(configSchema)
const config = schema.create('AppConfig', loadConfig('./config.json'))
const errors = config.$validate()
if (errors) throw new Error(`Invalid config: ${JSON.stringify(errors)}`)
```

### 5. Data Import Validation

```javascript
// Validate CSV/JSON imports
async function importPatients(csvFile) {
  const rows = parseCSV(csvFile)
  const results = { valid: [], invalid: [] }

  for (const row of rows) {
    const patient = schema.create('Patient', row)
    const errors = patient.$validate()

    if (errors) {
      results.invalid.push({ row, errors })
    } else {
      results.valid.push(patient)
    }
  }

  console.log(`Valid: ${results.valid.length}, Invalid: ${results.invalid.length}`)
  return results
}
```

### 6. Self-Documenting APIs

```javascript
// Schema IS the documentation
const userModel = schema.getModel('User')

// Generate OpenAPI/Swagger from schema
function generateOpenAPI() {
  const models = schema.listModels()
  return models.map(name => {
    const model = schema.getModel(name)
    return {
      name,
      fields: [...model.fields.entries()].map(([k, v]) => ({
        name: k,
        type: v.type,
        required: v.required,
        constraints: v.constraints,
      }))
    }
  })
}
```

## Before vs After

| Before | Now |
|--------|-----|
| Schema files = just text | Schema files = executable validation |
| Manual validation code | Declarative validation from schema |
| Duplicate validation logic | Single source of truth |
| No default values | Automatic defaults from `[value]` |
| No type enforcement | Runtime type checking |
| Silent invalid data | Clear error messages |

## Schema-First Architecture

When you think schema-first, the UI becomes a pure renderer of valid state:

```
Schema ──► State ──► UI
  │          │        │
defines   always    just
structure  valid   renders
```

**Key insight:** If state is always schema-validated, UI components never need defensive coding:

```javascript
// No more defensive checks - state is ALWAYS valid
function PatientCard({ patient }) {
  return (
    <div>
      <h2>{patient.name}</h2>        {/* Guaranteed string, 1-100 chars */}
      <p>{patient.email}</p>         {/* Guaranteed valid email */}
      <Badge>{patient.role}</Badge>  {/* Guaranteed valid enum */}
    </div>
  )
}
```

**Mutations go through validation:**

```javascript
app.set('/currentPatient/name', 'John Doe')
// → Validates against Patient schema
// → If valid: state updates, UI re-renders
// → If invalid: rejected, state unchanged
```

**The result:**
- State is always valid
- UI just renders (no validation logic)
- Actions can't corrupt state
- Bugs from invalid data become impossible

See [SCHEMA.md](./SCHEMA.md#5-schema-first-architecture) for the full architectural overview.

## Real Example: Patient Registration

```javascript
// Define once in .schema
const medicalSchema = parse(`
  @enum Gender: male, female, other, unknown

  @type ContactInfo
    phone?: phone
    email?: email

  @model Patient
    mrn!#: string, [6, 10]
    name!: string, [1, 100]
    dob!: date
    gender!: Gender
    ssn?: string, [9, 9]
    contact?: ContactInfo
    active: boolean, [true]

    @timestamps
`)

schema.register(medicalSchema)

// Use everywhere
const patient = schema.create('Patient', {
  mrn: 'P12345',
  name: 'John Doe',
  dob: new Date('1985-03-15'),
  gender: 'male',
  contact: { phone: '555-1234', email: 'john@example.com' }
})

patient.$validate()  // null = valid!
```

## API Reference

### Schema Class

```javascript
const schema = new Schema()
```

#### `schema.register(ast)`

Register schema definitions from parsed AST.

```javascript
const ast = parse(schemaSource)
schema.register(ast)
```

#### `schema.create(modelName, data)`

Create a new instance with defaults applied.

```javascript
const user = schema.create('User', { name: 'John', email: 'j@x.com' })
// Returns: { name: 'John', email: 'j@x.com', role: 'user', active: true, ... }
```

#### `schema.validate(modelName, obj)`

Validate an object against a model schema.

```javascript
const errors = schema.validate('User', userData)
// Returns: null (valid) or [{ field, error, message }, ...]
```

#### `schema.isValid(modelName, fieldName, value)`

Check if a single value is valid for a field.

```javascript
schema.isValid('User', 'email', 'test@example.com')  // true
schema.isValid('User', 'email', 'not-an-email')      // false
```

#### `schema.getModel(name)` / `schema.getType(name)` / `schema.getEnum(name)`

Get schema definitions.

```javascript
const userModel = schema.getModel('User')
console.log(userModel.fields)  // Map of field definitions
```

#### `schema.listModels()` / `schema.listTypes()` / `schema.listEnums()`

List all registered definitions.

```javascript
schema.listModels()  // ['User', 'Patient', 'Post', ...]
```

### Instance Methods

Created instances have a `$validate()` method:

```javascript
const user = schema.create('User', data)
const errors = user.$validate()
```

## Error Format

Validation errors are returned as an array:

```javascript
[
  { field: 'email', error: 'required', message: 'email is required' },
  { field: 'name', error: 'min', message: 'name must be at least 1' },
  { field: 'role', error: 'enum', message: 'role must be one of: admin, user, guest' },
  { field: 'address', error: 'nested', errors: [...] }  // Nested type errors
]
```

Error types:
- `required` - Required field is missing
- `type` - Value doesn't match expected type
- `enum` - Value not in enum values
- `min` - Value below minimum (length or value)
- `max` - Value above maximum (length or value)
- `pattern` - Value doesn't match regex pattern
- `nested` - Nested type has validation errors

## Performance

```
10,000 create+validate cycles: ~10ms
Per operation: ~1µs
```

Validators are compiled once at registration time, making validation extremely fast.

## See Also

- [README.md](./README.md) - Implementation status and roadmap
- [SCHEMA.md](./SCHEMA.md) - Full schema specification
