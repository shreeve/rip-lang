/**
 * Zod Schema Generator for rip-schema
 *
 * Generates Zod validation schemas from our DSL
 */

export class ZodGenerator {
  private imports = new Set<string>()
  private schemas: string[] = []

  generateField(name: string, type: string, options: any): string {
    const required = name.endsWith('!')
    const fieldName = required ? name.slice(0, -1) : name

    let zodChain = ''

    // Base type
    switch (type) {
      case 'string':
        zodChain = 'z.string()'
        if (options.size) zodChain += `.max(${options.size})`
        if (options.min) zodChain += `.min(${options.min})`
        break

      case 'email':
        zodChain = 'z.string().email()'
        break

      case 'text':
        zodChain = 'z.string()'
        break

      case 'integer':
        zodChain = 'z.number().int()'
        if (options.min !== undefined) zodChain += `.min(${options.min})`
        if (options.max !== undefined) zodChain += `.max(${options.max})`
        break

      case 'bigint':
        zodChain = 'z.bigint()'
        break

      case 'decimal':
      case 'float':
      case 'double':
        zodChain = 'z.number()'
        if (options.min !== undefined) zodChain += `.min(${options.min})`
        if (options.max !== undefined) zodChain += `.max(${options.max})`
        break

      case 'boolean':
        zodChain = 'z.boolean()'
        break

      case 'date':
      case 'datetime':
      case 'timestamp':
        zodChain = 'z.date()'
        break

      case 'json':
        zodChain = 'z.record(z.unknown())'
        break

      case 'enum':
        if (options.values) {
          const values = options.values.map((v: string) => `'${v}'`).join(', ')
          zodChain = `z.enum([${values}])`
        }
        break
    }

    // Add default
    if (options.default !== undefined) {
      const defaultVal =
        typeof options.default === 'string'
          ? `'${options.default}'`
          : JSON.stringify(options.default)
      zodChain += `.default(${defaultVal})`
    }

    // Add optional (if not required and no default)
    if (!required && options.default === undefined) {
      zodChain += '.optional()'
    }

    return `  ${fieldName}: ${zodChain}`
  }

  generateModel(name: string, fields: any[]): string {
    const fieldDefs = fields
      .map(field => this.generateField(field.name, field.type, field.options))
      .join(',\n')

    return `
export const ${name}Schema = z.object({
${fieldDefs}
})

export type ${name} = z.infer<typeof ${name}Schema>
`
  }

  generate(models: any[]): string {
    const imports = `import { z } from 'zod'\n`
    const schemas = models
      .map(model => this.generateModel(model.name, model.fields))
      .join('\n')

    return imports + schemas
  }
}
