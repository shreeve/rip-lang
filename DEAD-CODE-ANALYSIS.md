# Dead Code Analysis - solar.rip

## The Situation

The comment at line 938 says:
> TODO: Remove this section in deep refactor (lines 935-2856, ~1900 lines)

**This is MISLEADING!** That section contains BOTH dead AND active code mixed together.

## Actually Active (DO NOT DELETE)

These functions ARE being called:
- `detectLeftRecursion` (line 1483) - Called from constructor:104
- `detectIndirectLeftRecursion` (line 1506) - Called from constructor:105  
- `_compileAction` (line 1197) - Used in generation
- `_generateSwitchFunction` (line 1032) - Called from line 926
- `_generateWithInlining` (line 1573) - Called from line 920
- `_generateIterativeParser` (line 2413) - Called from line 923
- `_generateInlinedPrefixCase` (line 1921) - Used in inlining
- `_generateInlinedPostfixCase` (line 1956) - Used in inlining
- `_generateStandardCase` (line 2339) - Used in generation
- `_generateLookaheadCase` (line 2281) - Used in generation
- `_generateTryBacktrackCase` (line 2217) - Used in generation
- `_generateNestedBranches` (line 2116) - Used in generation
- `_getSymbolConstName` (line 1431) - Used everywhere
- `_normalizeActionForPRD` (line 1910) - Used in many places
- Plus many helper functions

## Actually Dead (CAN DELETE)

These are experimental functions that are never called:
- `_generateParseFunction` (line 943)
- `_generateLeftRecursiveFunction` (line 954)
- `_analyzeNonterminal` (line 2626)
- `_generateOptimizedFunction` (line 2742)
- `_generateLeftRecursiveOptimized` (line 2919)
- `_canDerive` (line 2690)
- `_getFirstTokensForRule` (line 2709) - maybe?
- `_getDisambiguationInfo` (line 2728)
- `_generateDisambiguationCode` (line 2846)
- `_getLookaheadCondition` (line 2862)
- `_compilePartialAction` (line 2880)
- `_getMaxTokensNeeded` (line 2823)
- `_findReferencedPositions` (line 1238)
- `_generateCaptureStatement` (line 1274)
- `_generateMatchStatement` (line 1286)
- `_compileMultiSymbolAction` (line 1298)
- `_compileActionExpression` (line 1329)
- `_compileSimpleAction` (line 1447)
- `_compileActionString` (line 1472)
- `_expandThroughSkippedNonterminal` (line 1375)
- `_generateSymbolRef` (line 1418)
- `_mergePostfixCases` (line 2028)
- `_findCommonPrefixLength` (line 2077)

## Recommended Action

**Surgical removal needed**, not bulk deletion. Each dead function should be:
1. Verified as truly unused (no calls outside dead section)
2. Removed individually
3. Tested after each removal

**Estimated cleanup:** ~800-1200 lines can be safely removed  
**Time required:** 1-2 hours of careful work  
**Risk:** Medium (must not break active functions)

## For Next AI

If you want to do this cleanup:
1. Start with obviously dead functions (_generateParseFunction, _analyzeNonterminal)
2. Search for calls outside dead section: `grep -n "@functionName" solar.rip`
3. Delete function by function, test after each
4. Don't rush - one mistake breaks everything

**Better timing:** After reaching 80-90% tests (less risk of needing rollback)

---

**Current priority:** Operator associativity (+150 tests) is more important than code cleanup.
