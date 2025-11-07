# Extraction Status - Dispatch Table Refactoring

## Current State (Checkpoint)

**Dispatch Entries:** 42/110 (38%)  
**Extracted Methods:** 51  
**TODO Entries:** 39  
**Tests:** 931/931 passing ✅

## Completed Categories

✅ **Operators (28 entries, shared methods)**
- Binary: +, -, *, /, %, **, ==, !=, <, >, <=, >=, ??, !?, &, |, ^, <<, >>, >>>
- Logical: &&, || (with chain flattening)
- Special: %%, //, /=, .., ...
- Unary: !, ~, ++, --, typeof, delete
- Keywords: instanceof, in, of, =~, new

✅ **Assignment (17 entries, shared method)**
- All variants: =, +=, -=, *=, /=, %=, **=, //=, &&=, ||=, ?=, ??=, &=, |=, ^=, <<=, >>=, >>>=

✅ **Data Structures (3)**
- array, object, block

✅ **Property Access (9)**
- ., ?., ::, ?::, [], ?[], optindex, optcall, regex-index

✅ **Functions (4)**
- def, ->, =>, return

## Remaining to Extract (39 cases)

📋 **Control Flow - Conditionals (4)**
- if, unless, ?:, ?

📋 **Control Flow - Loops (7)**
- for-in (203 lines!), for-of (113 lines), for-from (100 lines)
- while, until, loop
- break, break-if, continue, continue-if

📋 **Control Flow - Exception (2)**
- try (74 lines), throw (61 lines)

📋 **Switch (2)**
- switch (76 lines), when

📋 **Comprehensions (2)**
- comprehension (227 lines!), object-comprehension (63 lines)

📋 **Classes (4)**
- class (205 lines!), super (26 lines), ?call, ?super

📋 **Async/Generators (3)**
- await, yield, yield-from

📋 **Modules (5)**
- import (71 lines), export (22 lines), export-default, export-all, export-from (26 lines)

📋 **Special Forms (4)**
- do-iife, regex, tagged-template (23 lines), str (344 lines!!!)

## Strategy for Completion

1. Extract simple cases first (break, continue, await, yield, etc.) ✅ DONE
2. Extract medium cases (throw, super, modules, etc.)
3. Extract complex cases (if, loops, comprehensions)
4. Extract monsters (str: 344 lines, comprehension: 227 lines, for-in: 203 lines, class: 205 lines)

## Estimated Remaining Work

- Simple (already done): 10 cases
- Medium: 15 cases (~1-2 hours)
- Complex: 10 cases (~2-3 hours)
- Monsters: 4 cases (~1-2 hours)

**Total: 4-6 hours remaining**

## Token Budget

- Used: 338K / 1M (34%)
- Remaining: 662K (66%)
- **Plenty of capacity!** ✅
