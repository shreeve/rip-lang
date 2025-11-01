#!/usr/bin/env coffee

# =============================================================================
# bar.coffee: HL7-like message payload processing library
#
# Author: Steve Shreeve <steve.shreeve@ariselab.com>
#  Legal: Copyright (C) 2017, Arise Lab. All rights reserved.
# =============================================================================

PDF417 = require './pdf-417'

type = (obj) -> if obj? then (obj.constructor?.name or Object::toString.call(obj)[8...-1]).toLowerCase() else String(obj)

get = (str, one, two) ->
  len = if +one > 0 then +one else if +two > 0 then +two else 0
  alt = if two >= '' then two else ''
  if str then (if len and str.length > len then str[0...len] else str) else alt

time = (len=14) ->
  str = new Date().toISOString()
  str = [str[0..3], str[5..6], str[8..9], str[11..12], str[14..15], str[17..18]].join('')
  str[0...len]

class Bar
  constructor: (obj...) ->
    obj = obj[0] if obj.length < 2
    who = type(obj)

    # delimiters
    [@fld, @rep, @com, @str] = "|~^".split('')

    # initialize (newer spec)
    # @str = """
    #   H||||^^||
    #   P|||||||||^^|||||||||||^^|||||||||^^|||||||^|||||||||^|||||||||^^^^^^^^^^^^^^|^^^^^^^|||||||||||||||||^^|^^|^^|^^||||^||||||^^|^^^^|||^||||
    #   C|||||||||||||||||||^||||||||
    #   A|||||||||||||||||||||^^|^|^||||||^^|^^^^^|||^^^||
    #   M||||||
    #   T|||||||||||||||||||||||||||||||||||||||||
    #   S|^^^^^^|
    #   G||^|||
    #   D|||
    #   L||
    #   E||
    # """

    # initialize (older spec for Edifecs)
    @str = """
      H||||^^||
      P|||||||||^^|||||||||||^^|||||||||^^|||||||^|||||||||^|||||||||^^^^^^^^^^^^^^|^^^^^^^|||||||||||||||||^^|^^|^^|^^||||^||||||^^|^^^^|||^||
      C|||||||||||||||||||^||||||||
      A|||||||||||||||||||||^^|^|^||||||^^|^^^^^|||
      M||||||
      T|||||||||||||||||||||||||||||||||||||||||
      S|^^^^^^|
      D|||
      L||
      E||
    """
    @ary = @to_a(@str)

    # load message
    if obj then switch who
      when 'string'    then @set(obj)
      when 'array'     then @data(obj)
      when 'object'    then @data(obj)
      else throw "unable to create Bar objects from #{who} objects"

  to_a: (str) -> @ary = str.trim().split(/[\r\n]+/).map((str) => str.trim().split(@fld)) # force parse
  to_s: (eol) -> @str = @ary.map((row) => row.join(@fld)).join(eol or "\r")              # force build
  scan: (rgx, str = @str or @to_s()) ->
    ary = []
    str.replace rgx, (use, arg..., idx, all) ->
      len = arg.length
      ary.push(if len > 1 then arg else if len is 1 then arg[0] else use)
      use
    ary
  make: (seg) -> [seg.toUpperCase(), '']

  # ┌──────────────┬─────┬────┬─────┬─────┬─────┬───────────────────┬───┐
  # │ seg.fld(rep) │ rgx │rep │ get │ set │ ary │ notes             │ # │
  # ╞══════════════╪═════╪════╪═════╪═════╪═════╪═══════════════════╪═══╡
  # │ seg.fld-5    │ und │ 1  │ beg │ end │     │ beg/end or append │ 1 │
  # │ seg.fld(0)-5 │ '0' │ 0  │ beg │ pre │     │ pre fld or append │ 5 │
  # │ seg.fld(+)-5 │ '+' │ +  │ end │ aft │     │ always append     │ 4 │
  # ├──────────────┼─────┼────┼─────┼─────┼─────┼───────────────────┼───┤
  # │ seg.fld(2)-5 │ '2' │ 2  │ idx │ idx │ yes │ idx or append     │ 3 │
  # │ seg.fld()-5  │ ''  │-1  │ end │ end │ yes │ last or append    │ 2 │
  # ├──────────────┼─────┼────┼─────┼─────┼─────┼───────────────────┼───┤
  # │ seg.fld(?)-5 │ '?' │ ?  │ ask │ all │ yes │ set all           │ 6 │
  # └──────────────┴─────┴────┴─────┴─────┴─────┴───────────────────┴───┘

  data: (pos, val) ->
    # console.log ["data:", arguments.length, Array.apply(null, arguments)]
    switch cnt = arguments.length
      when 0 then return @str or @to_s()
      when 1 then switch type(obj = pos)
        when 'array'  then @data(obj[i], obj[i+1]) for i in [0...obj.length] by 2; return @
        when 'object' then @data(key, val) for key, val of obj                   ; return @
        when 'string' then return @set(obj) if /\s/.test(obj)
      when 2 then if val in [undefined, null, false] then                          return @
      else
        obj = Array.apply(null, arguments)
        len = obj.length
        @data(obj[i], obj[i+1]) for i in [0...(len - 1)] by 2
        return if len % 2 then @data(obj[len - 1]) else @

    rgx = ///^            # String 'H.1(2)-3'
      ([HPCAMBKITSGDLE])  # 1: seg 'H'
      [-.]?([1-9]\d*)?    # 2: fld   '1'
      (?:\(([?+]|\d*)\))? # 3: rep     '2'
      [-.]?([1-9]\d*)?    # 4: com        '3'
      (?:\[(\d+)\])?      # 5: chr (set character position when "Y")
      (?:\=(.+))?         # 6: hcv (set hard coded value when "Y")
    $///i.exec(pos) or throw "invalid access: #{pos}"

    seg =  rgx[1]
    fld = +rgx[2] if rgx[2]?
    rep =  rgx[3]; rep and '+?'.includes(rep) or rep = +rep or if rep>='' then rep.length - 1 else if cnt is 1 then null else -1
    com = +rgx[4] if rgx[4]?
    chr = +rgx[5] if rgx[5]?
    hcv =  rgx[6]

    if cnt is 1 # get
      regx = new RegExp("^#{seg}.*", "igm")

      return '' unless out =     @scan(regx)[0      ] # get first one
      return '' unless out = out.split(@fld)[fld    ] if fld
      return '' if -1< out = out.split(@rep).length   if rep is '?'
      return '' unless out = out.split(@rep)[rep - 1] if rep or (com and (rep or= 1))
      return '' unless out = out.split(@com)[com - 1] if com
      out

    else # set
      # console.log ["data:", arguments.length, Array.apply(null, arguments)]

      @str = null # invalidate @str on set
      regx = new RegExp("^#{seg}", "i")

      # adjust arrays
      unless ~(idx = @ary.findIndex (row) -> regx.test row[0])
        idx = @ary.push(@make seg) - 1 # append
      row = @ary[idx]

      # adjust value (we could do custom transforms here)
      val = if val? then "#{val}" else ""
      yep = val.toUpperCase() is "Y" if hcv or chr
      val = hcv if hcv and yep

      unless fld? # set whole segment
        row[1..] = val.split(@fld)
      else # set field

        # allow values to span multiple fields
        [val, etc...] = val.split(@fld)

        unless (had = row[fld] or "") # no prior value
          had += @rep for [1...rep] by 1 if rep and rep > 1
          had += @com for [1...com] by 1 if com and com > 1
          val = 1 if val is ':rep' # auto-count
          val = @chr_set(chr, yep) if chr
          val = had + val
        else # existing value

          # repeat logic: fld(rep) is analogous to seg(num)
          our = had.split(@rep)
          len = our.length
          if rep in [1,0,'+']
            if rep >= 0 and len > (idx = 0)
              rep or our.unshift('') # pre fld
            else idx = our.push('') - 1 # append
          else # idx, last, '?'
            if +rep # idx, last
              rep += (len or 1) + 1 if rep < 0 # last
              our.push('') for [len...rep] by 1 if rep > len # grow
              idx = rep - 1
          if rep>=0 or rep is '+'
            val = our.length if val is ':rep' # auto-count
          else throw "setting by '?' is not yet implemented"

          # assemble value
          unless com
            val = @chr_set(chr, yep, our[idx]) if chr
            our[idx] = val
          else
            one = our[idx].split(@com)
            val = @chr_set(chr, yep, our[com - 1]) if chr
            one[com - 1] = val
            our[idx] = one.join(@com)
          val = our.join(@rep)

        # set field value(s)
        row.push('') for [row.length...fld] if fld > row.length
        row[fld..(fld+etc.length)] = [val, etc...]

      @ # return self

  chr_set: (chr, yep, val) ->
    ary = (val or '').split ''
    ary[chr - 1] = if yep then 'Y' else ' '
    val = (now or ' ' for now in ary).join('').replace(/\s+$/, '')

  set: (str) ->

    # handy regexes
    enc = [ /^\s*[A-Z]\|/im     , /^\s*([^#][^\r\n]*)/gm          ]
    tpl = [ /^\s*[A-Z][-.]\d+/im, /^\s*([^\s#]+)\s+([^\r\n]*)/igm ]

    switch
      when enc[0].test str # encoded string
        for row in @scan enc[1], str
          [seg, col...] = row.split(@fld)
          for fld, nfld in col
            for rep, nrep in fld.split(@rep)
              all = rep.split(@com)
              mas = all.length > 1
              for com, ncom in all when com # skip falsy values
                tag = "#{seg.toLowerCase()}.#{nfld + 1}"
                tag += "(#{nrep + 1})" if nrep > 0
                tag += "-#{ncom + 1}"  if mas
                # p [tag, com]
                @data(tag, com)
      when tpl[0].test str # templated string
        @data(pair...) for pair in @scan tpl[1], str when pair[1] # skip falsy values
      else throw "unable to import invalid string"

    @ # return self

  to_png: ->
    png      = new PDF417(    @inspect()).to_png()
    png.exp  = new PDF417(@exp.inspect()).to_png() if @exp
    png.over = true if @over
    png

  to_svg: ->       new PDF417(@inspect()).to_svg()

  inspect: -> @to_s().toUpperCase()

  show: ->
    pad = (new Array(9+1)).join ' '
    rgx = RegExp "[^#{@com}]"
    for [seg, row...] in @ary
      for fld, i in row when fld > '' and rgx.test fld
        all = fld.split @rep
        for rep, j in all
          tag = "#{seg.toLowerCase()}.#{i+1}"
          tag += "(#{j+1})" if all.length > 1
          console.log "#{tag}#{pad[tag.length..-1]}#{rep}"

  # ==[ Helpers ]==

  name: (person) -> [
    person.last_name
    person.first_name
    person.middle_name or ''
  ].join('^')

  address: (address) -> [
    get(address.street, 30)
    get(address.city, 25) # sometimes only 15?
    get(address.state)
    get(address.zip).replace('-', '')
  ].join('|')

module.exports = Bar

# ==[ Command line invocation ]==

if !module.parent
  fs = require 'fs'

  list = process.argv.slice 2

  for file in list
    console.log "\n==[ #{file} ]==\n"
    try
      bar = new Bar fs.readFileSync(file).toString()
      bar.show()
    catch
      console.log "Invalid\n"

###

# ==[ Testing ]==

p = -> console.log arg for arg in arguments
exit = require('process').exit

PDF417 = require './pdf-417'

do ->
  # x = ". Operators with higher precedence are evaluated first.\n\nA common example:\n\n3 + 4 * 5 // returns 23\nThe multiplication operator (\"*\") has higher precedence than the addition operator (\"+\") and thus will be evaluated first.\n\nAssociativity\nAssociativity determines the order in which operators of the same precedence are processed. For example, consider an expression:\n\na OP b OP c\nLeft-associativity (left-to-right) means that it is processed as (a OP b) OP c, while right-associativity (right-to-left) means it is interpreted as a OP (b OP c). Assignment operators are right-associative, so you can write:\n\na = b = 5;\nwith the expected result that a and b get the value 5. This is because the assignment operator returns the value that it assigned. First, b is set to 5. Then the a is also set to 5, the return value of b = 5, aka right operand of the assignment."
  # y = new PDF417(x).generate()

  x = ". Operator"
  y = new PDF417(x)
  z = await y.to_png()
  p z.toString()

p new Bar """
  H|XHR1.0|#{time(8)}|E
  P|XYZ999||||||123456|999888777|TEST^SON^|19850615|M|||||||03||TEST^DAD^||123 Main|Anytown|CA|93456||3||DOCTOR^BOB^|||334455||||^|||||||||^|||||||N||^^^^^^^^^^^^^^|^^^^^^^||||||||||||||||1407891260|||||
  C||||||||||||||||N|#{time(8)}||^|||LCM|QA09|N|0847||
  T|500918||||||||||||||||||||||||||||||||||||||||
  S|500918^A^TNG^ANT^^^This is the tongue.~500918^B^TNGBS^^^^This is the base of the tongue.~500918^C^TNGBR^^^^This is the border of the tongue.~500918^D^TNGS^D^^^This is the surface of the tongue.|
  D|F16.183^I63.10^S33.131D||
  L|680|
  E|0|
"""

# p new Bar """
#   h.1       XHR1.0
#   h.2       #{time(8)}
#   h.3       E
#   p.1       XYZ999
#   p.7       123456
#   p.8       999888777
#   p.9-1     TEST
#   p.9-2     SON
#   p.10      19850615
#   p.11      M
#   p.18      03
#   p.20-1    TEST
#   p.20-2    DAD
#   p.22      123 Main
#   p.23      Anytown
#   p.24      CA
#   p.25      93456
#   p.27      3
#   p.29-1    DOCTOR
#   p.29-2    BOB
#   p.32      334455
#   p.52      N
#   p.71      1407891260
#   c.16      N
#   c.17      #{time(8)}
#   c.22      LCM
#   c.23      QA09
#   c.24      N
#   c.25      0847
#   t.1       500918
#   s.1-1     500918
#   s.1-2     A
#   s.1-3     TNG
#   s.1-4     ANT
#   s.1-7     This is the tongue.
#   s.1(2)-1  500918
#   s.1(2)-2  B
#   s.1(2)-3  TNGBS
#   s.1(2)-7  This is the base of the tongue.
#   s.1(3)-1  500918
#   s.1(3)-2  C
#   s.1(3)-3  TNGBR
#   s.1(3)-7  This is the border of the tongue.
#   s.1(4)-1  500918
#   s.1(4)-2  D
#   s.1(4)-3  TNGS
#   s.1(4)-4  D
#   s.1(4)-7  This is the surface of the tongue.
#   d.1-1     F16.183
#   d.1-2     I63.10
#   d.1-3     S33.131D
#   l.1       680
#   e.1       0
# """

# PDF417.to_png("real.png", x.to_s("\r"))

# return png image
to_png(bar)

# "H|LCM04.06.10|20130628||^^|PA|\r"
# "P||1033|Y|N|||05330010|200975012250|TESTY^TESTER^|19800101|M|123456789|100 FAST LANE|Huntsville|AL|35806|2567211139|XI||TESTY^TESTER^|123456789|100 FAST LANE|Huntsville|AL|35806||1||PETERSON^ALAN^|1234567890||B47114||CIGNH||^||||ABCD1231234|||AARPA||^||||123456789|||N||^^^^^^^^^^^^^^|^^^^^^^|2567211139||||||||||*||190||67|1477555225|^^|^^|^^|^^|||C|17930500030^2013|1||Y||N|\r"
# "C||||||||||||||||N|20130628|500|^|||LCM|HVQ5|N|1252||"
# "A|||190|1|C|N||||X|X||20121111||||X||||22.2^20121111^22.2|22.2^22.2|Y^3|N||N|Y|N|Y^^|^^^^^|||"
# "T|X02123|010801|276024|998085|||||||||||||||||||||||||||||||||||||"
# "M||||||"
# "B|||||||||||||||||||||"
# "K|^|||||||||||||||^^^^||||||"
# "I|1^1^005|2^1^001|^^|^^|^^|^^|^^|^^|"
# "L|752|"
# "E|6|"

# "Quest: ||||||^GEBERT-PARIKH^CHRIS^^^^^^UPIN~1366608093^GEBERT-PARIKH^CHRIS^^^^^^NPI|||||||||||^^^^^^|"
# "OBR|3|0023686||^^^1759^CBC (H/H, RBC, INDICES, WBC, PLT)^MET|||20170320153400|||||||||^GEBERT-PARIKH^CHRIS^^^^^^UPIN~1366608093^GEBERT-PARIKH^CHRIS^^^^^^NPI|||||||||||^^^^^^|"
# "OBR|4|0023686||^^^10231^COMPREHENSIVE METABOLIC PANEL^MET|||20170320153400|||||||||^GEBERT-PARIKH^CHRIS^^^^^^UPIN~1366608093^GEBERT-PARIKH^CHRIS^^^^^^NPI|||||||||||^^^^^^|"
# "928289728728728272"
# "OBR|5|0023686||^^^17306^VITAMIN D, 25-HYDROXY, TOTAL, IMMUNOASSAY^MET|||20170320153400|||||||||^GEBERT-PARIKH^CHRIS^^^^^^UPIN~1366608093^GEBERT-PARIKH^CHRIS^^^^^^NPI|||||||||||^^^^^^|"
# "DG1|1|ICD|Z0000||"
# "DG1|2|ICD|Z8679||"
# "DG1|3|ICD|Z862||"
# "FTS|1041667412||

###
