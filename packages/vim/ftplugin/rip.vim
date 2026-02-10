" Vim ftplugin file for Rip
" Language: Rip
" Maintainer: Steve Shreeve

if exists('b:did_ftplugin')
  finish
endif
let b:did_ftplugin = 1

setlocal commentstring=#\ %s
setlocal comments=s:###,e:###,:#
setlocal tabstop=2
setlocal softtabstop=2
setlocal shiftwidth=2
setlocal expandtab
setlocal autoindent
setlocal suffixesadd=.rip
setlocal foldmethod=indent
setlocal formatoptions-=t formatoptions+=croql

let b:undo_ftplugin = 'setlocal commentstring< comments< tabstop< softtabstop<'
      \ . ' shiftwidth< expandtab< autoindent< suffixesadd< foldmethod< formatoptions<'
