" Vim syntax file for Rip
" Language: Rip
" Maintainer: Steve Shreeve

if exists('b:current_syntax')
  finish
endif

" --- Comments ---------------------------------------------------------------

syn match  ripComment      /#\%({\)\@!.*$/                       contains=ripTodo
syn region ripBlockComment  start=/###\%(#\)\@!/  end=/###/      contains=ripTodo
syn keyword ripTodo         TODO FIXME XXX NOTE HACK BUG WARN    contained

" --- Strings ----------------------------------------------------------------

" Single-quoted (no interpolation)
syn region ripStringSingle  start=/'/   skip=/\\'/  end=/'/      contains=ripEscape
syn region ripHeredocSingle start=/'''/             end=/'''/    contains=ripEscape

" Double-quoted (with interpolation)
syn region ripStringDouble  start=/"/   skip=/\\"/  end=/"/      contains=ripEscape,ripInterpolation
syn region ripHeredocDouble start=/"""/             end=/"""/    contains=ripEscape,ripInterpolation

" Escape sequences
syn match  ripEscape        /\\./                                contained

" String interpolation #{...} and ${...} with nested brace support
syn region ripInterpolation matchgroup=ripInterpDelim start=/#{/ start=/\${/ end=/}/ contained contains=TOP,ripInterpBraces
syn region ripInterpBraces  start=/{/ end=/}/ transparent contained contains=TOP,ripInterpBraces

" --- Inline JavaScript ------------------------------------------------------

syn region ripInlineJS      start=/`/  end=/`/  oneline

" --- Regular Expressions ----------------------------------------------------

syn region ripHeregex       start=/\/\/\//  end=/\/\/\/[gimsuy]*/  contains=ripInterpolation,ripComment,ripEscape
syn region ripRegex         matchgroup=ripRegexDelim start=+\%(^\s*\|[=(:,;\[!&|?{]\s*\)\@<=/\%([/*]\)\@!+ skip=+\\/+ end=+/[gimsuy]*+ oneline contains=ripEscape

" --- Numbers ----------------------------------------------------------------

syn match  ripNumber        /\<0x[0-9a-fA-F]\%(_\?[0-9a-fA-F]\)*n\?\>/
syn match  ripNumber        /\<0o[0-7]\%(_\?[0-7]\)*n\?\>/
syn match  ripNumber        /\<0b[01]\%(_\?[01]\)*n\?\>/
syn match  ripNumber        /\<\d[\d_]*\%(\.\d[\d_]*\)\?\%([eE][+-]\?\d\+\)\?n\?\>/

" --- Keywords ---------------------------------------------------------------

syn keyword ripKeyword      if else unless then switch when
syn keyword ripKeyword      for while until loop do
syn keyword ripKeyword      return break continue throw
syn keyword ripKeyword      try catch finally
syn keyword ripKeyword      yield await
syn keyword ripKeyword      import export from default
syn keyword ripKeyword      delete typeof instanceof new super
syn keyword ripKeyword      debugger use own extends
syn keyword ripKeyword      in of by as
syn keyword ripKeyword      class def enum interface component render
syn keyword ripKeyword      and or not is isnt

" --- Booleans ---------------------------------------------------------------

syn keyword ripBoolean      true false yes no on off

" --- Constants --------------------------------------------------------------

syn keyword ripConstant     null undefined NaN Infinity
syn keyword ripThis         this

" --- Type Keywords ----------------------------------------------------------

syn keyword ripType         number string boolean void any never unknown object symbol bigint

" --- Built-ins --------------------------------------------------------------

syn keyword ripBuiltin      console process require module exports
syn keyword ripBuiltin      setTimeout setInterval clearTimeout clearInterval
syn keyword ripBuiltin      Promise Array Object String Number Boolean
syn keyword ripBuiltin      Math Date RegExp Error JSON Map Set
syn keyword ripBuiltin      Symbol Buffer Bun

" --- Instance Variables -----------------------------------------------------

syn match  ripInstVar       /@[a-zA-Z_$][a-zA-Z0-9_$]*/

" --- Operators (shortest→longest for correct Vim priority) -----------------
"
" Vim rule: when multiple syn-match items start at the same position,
" the last-defined one wins. So define single-char first (lowest priority)
" and longest/most-specific last (highest priority).

" Single-char (lowest priority — overridden by everything below)
syn match  ripOperator      /[+\-*/%&|^~<>=!?]/

" Two-char
syn match  ripOperator      /\*\*\|\/\/\|%%\|++\|--\||>/
syn match  ripOperator      /==\|!=\|<=\|>=\|&&\|||\|<<\|>>\|=\~\|\.\./

" Three-char
syn match  ripOperator      /===\|!==\|>>>\|\.\.\./

" Compound assignment (longest alternatives first within alternation)
syn match  ripOperator      />>>=\|\*\*=\|\/\/=\|%%=\|&&=\|||=\|??=\|<<=\|>>=\|+=\|-=\|\*=\|\/=\|%=\|&=\||=\|\^=/

" Special
syn match  ripOperator      /!?\|??\|?\./

" Arrow functions
syn match  ripArrow         /[=-]>/

" Reactive (high priority)
syn match  ripReactive      /<=>\|:=\|\~=\|\~>\|=!/

" Type annotations (highest operator priority)
syn match  ripTypeOp        /::=/
syn match  ripTypeOp        /::\%(=\)\@!/

" --- Object Keys ------------------------------------------------------------

" Object keys: name: or name?: (but not :: or :=)
syn match  ripObjKey        /\<[a-zA-Z_$][a-zA-Z0-9_$]*?\?:\%([=:]\)\@!/

" --- Function / Method Calls ------------------------------------------------

" Function calls: name(
syn match  ripFuncCall      /\<[a-zA-Z_$][a-zA-Z0-9_$]*\ze\s*(/

" Method calls: .name(
syn match  ripMethodCall    /\.\zs[a-zA-Z_$][a-zA-Z0-9_$]*\ze\s*(/

" Dammit calls: name! (await shorthand)
syn match  ripDammitCall    /\<[a-zA-Z_$][a-zA-Z0-9_$]*\ze!/

" --- Assignments ------------------------------------------------------------

" Variable assignment: name = (but not ==, =>, =~, =!)
syn match  ripAssignment    /\<[a-zA-Z_$][a-zA-Z0-9_$]*\ze\s*=\%([>=~!]\)\@!/

" --- Function Definitions ---------------------------------------------------

" def name or def name!
syn match  ripFuncDef       /\<def\s\+[a-zA-Z_$][a-zA-Z0-9_$]*[!?]\?/ contains=ripFuncKeyword,ripFuncName
syn match  ripFuncKeyword   /\<def\>/                            contained
syn match  ripFuncName      /\%(\<def\s\+\)\@<=[a-zA-Z_$][a-zA-Z0-9_$]*[!?]\?/ contained

" name = (...) -> or name = ->
syn match  ripFuncAssign    /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*\%(([^)]*)\s*\)\?[=-]>/ contains=ripFuncAssignName,ripArrow
syn match  ripFuncAssignName /[a-zA-Z_$][a-zA-Z0-9_$]*/         contained

" name: (...) -> or name: -> (method in object/class)
syn match  ripFuncMethod    /[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*\%(([^)]*)\s*\)\?[=-]>/ contains=ripFuncMethodName,ripArrow
syn match  ripFuncMethodName /[a-zA-Z_$][a-zA-Z0-9_$]*/         contained

" --- Class / Enum / Interface -----------------------------------------------

syn match  ripClassDef      /\<class\s\+\w\+\%(\s\+extends\s\+\w\+\%(\.\w\+\)*\)\?/ contains=ripKeyword,ripClassName
syn match  ripEnumDef       /\<enum\s\+[A-Z]\w*/                 contains=ripKeyword,ripTypeName
syn match  ripInterfaceDef  /\<interface\s\+[A-Z]\w*\%(\s\+extends\s\+[A-Z]\w*\)\?/ contains=ripKeyword,ripTypeName

syn match  ripClassName     /\%(\<class\s\+\)\@<=\w\+/          contained
syn match  ripTypeName      /\%(\<\%(enum\|interface\)\s\+\)\@<=[A-Z]\w*/ contained

" PascalCase identifiers (type names)
syn match  ripPascalCase    /\<[A-Z]\w*/

" --- Highlight Links --------------------------------------------------------

hi def link ripComment        Comment
hi def link ripBlockComment   Comment
hi def link ripTodo           Todo

hi def link ripStringSingle   String
hi def link ripStringDouble   String
hi def link ripHeredocSingle  String
hi def link ripHeredocDouble  String
hi def link ripEscape         SpecialChar
hi def link ripInterpDelim    Special

hi def link ripInlineJS       Special

hi def link ripHeregex        String
hi def link ripRegex          String
hi def link ripRegexDelim     String

hi def link ripNumber         Number

hi def link ripKeyword        Keyword
hi def link ripBoolean        Boolean
hi def link ripConstant       Constant
hi def link ripThis           Keyword
hi def link ripType           Type
hi def link ripBuiltin        Special

hi def link ripInstVar        Identifier

hi def link ripOperator       Operator
hi def link ripArrow          Operator
hi def link ripReactive       Special
hi def link ripTypeOp         Type

hi def link ripObjKey         Identifier
hi def link ripFuncCall       Function
hi def link ripMethodCall     Function
hi def link ripDammitCall     Function
hi def link ripAssignment     Identifier

hi def link ripFuncKeyword    Keyword
hi def link ripFuncName       Function
hi def link ripFuncAssignName Function
hi def link ripFuncMethodName Function
hi def link ripClassName      Type
hi def link ripTypeName       Type
hi def link ripPascalCase     Type

let b:current_syntax = 'rip'
