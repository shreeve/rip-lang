# Rip Type Audit

Independent test files for every Rip type system feature. Each `.rip` file has a `.ts`/`.tsx` companion with equivalent TypeScript for side-by-side comparison.

## Why Type Safety Matters

Rip has its own type annotation syntax (`::`, `type`, `interface`, etc.) but delegates the actual checking to TypeScript under the hood. When you run `rip check`, the compiler emits `.d.ts` declarations from your annotations, combines them with the compiled JavaScript, and feeds everything to the TypeScript type checker. This gives Rip access to TypeScript's full diagnostic engine without requiring developers to write TypeScript directly.

This matters because:

### 1. It moves errors from runtime to compile time

Type checking catches issues like incorrect argument types, missing properties, and invalid API usage before the program runs. Developers discover problems immediately during development instead of later during testing or in production.

### 2. Types make APIs self-documenting

Types clearly describe the shape of data and the inputs and outputs of functions. Developers can understand how to use a module or function directly from its type definitions without needing to read its implementation.

### 3. It makes refactoring safer

When code changes, the type checker highlights every place where the change breaks existing usage. Instead of relying only on tests or manual review, developers get immediate feedback about what must be updated.

### 4. It scales better for larger teams and codebases

Types act as explicit contracts between modules and teams. This reduces misunderstandings about how data structures and APIs are supposed to work, which helps prevent integration issues in large projects.

### 5. It significantly improves developer tooling

Type information enables better editor features such as autocomplete, code navigation, safe renaming, and inline documentation. This makes it easier to work in unfamiliar parts of a codebase and improves onboarding for new developers.

### An important caveat

Type checking does not eliminate most bugs. It mainly prevents issues like incorrect data types, undefined values, and misuse of APIs. It does not prevent logic errors, algorithm mistakes, or many runtime conditions.

The biggest benefit is not perfect correctness, but better maintainability and faster developer feedback.

### Summary

Types do not remove all bugs, but they provide fast feedback, clearer interfaces, and safer refactoring. These qualities make large codebases easier to maintain and evolve over time.

## Schema

```rip
schema Donkey
  name: string
  smell: 'Good' | 'Bad' | 'Ugly'
  transform: (foo) => 'bar'
```
