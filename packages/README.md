<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip Packages

Optional packages that extend the Rip language ecosystem. Install only what you need.

```bash
npm install rip-lang                 # Core language (required)
npm install @rip-lang/{package}      # Individual packages (optional)
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| **api** | Backend API toolkit | Early |
| **data** | Database ORM | Early |
| **parser** | Parser generator | Early |
| **schema** | Unified schema system | Active |
| **server** | App server | Early |
| **ui** | Application framework | Early |

---

### [@rip-lang/api](api/)

Backend API toolkit combining the simplicity of Sinatra with the power of Express. Provides elegant request handling, data validation, and routing for RESTful services.

### [@rip-lang/data](data/)

Database ORM layer currently built around DuckDB, enabling it to serve as both a transactional and analytical store for web applications. Future versions may support MySQL and SQLite.

### [@rip-lang/parser](parser/)

Solar - an SLR(1) parser generator written in Rip. Used internally by Rip for grammar parsing, but designed to be a standalone tool for building custom parsers and DSLs.

### [@rip-lang/schema](schema/)

Unified schema language replacing TypeScript interfaces, Zod validation, Prisma models, and form definitions with a single declarative syntax. Define once, generate validation, database schemas, and type definitions.

### [@rip-lang/server](server/)

Production-ready app server inspired by Unicorn + Nginx. Multi-process architecture with a manager distributing load across auto-reloading workers. Built for Bun.

### [@rip-lang/ui](ui/)

High-level application framework for building mission-critical systems (healthcare, enterprise). Works at the component level (medication lists, patient summaries) rather than low-level DOM elements.

---

**Note:** Most packages are in early development. See individual package READMEs for current status.
