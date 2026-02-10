" Vim ftdetect file for Rip
" Language: Rip
" Maintainer: Steve Shreeve

autocmd BufNewFile,BufRead *.rip setfiletype rip
autocmd BufNewFile,BufRead * if getline(1) =~# '^#!.*\<rip\>' | setfiletype rip | endif
