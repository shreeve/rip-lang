# Rip Language Guide for AI Agents

**Purpose:** This document teaches AI assistants everything needed to write production Rip code. After reading this, you should be fully proficient in Rip for web applications, CLI tools, server-side development, and utilities.

**What is Rip:** A modern reactive language that compiles to ES2022 JavaScript. It combines CoffeeScript's elegant syntax with built-in reactivity, components, and templates. Zero dependencies, self-hosting, ~14,000 LOC.

---

## Table of Contents

1. [Installation & Running](#1-installation--running)
2. [Core Syntax](#2-core-syntax)
3. [Operators Reference](#3-operators-reference)
4. [Functions](#4-functions)
5. [Classes](#5-classes)
6. [Reactivity](#6-reactivity)
7. [Components](#7-components)
8. [Templates](#8-templates)
9. [Async Patterns](#9-async-patterns)
10. [Modules & Imports](#10-modules--imports)
11. [Regex Features](#11-regex-features)
12. [Web Applications](#12-web-applications)
13. [Server-Side Development](#13-server-side-development)
14. [CLI Tools & Scripts](#14-cli-tools--scripts)
15. [JavaScript Interop](#15-javascript-interop)
16. [Common Patterns](#16-common-patterns)
17. [Quick Reference](#17-quick-reference)

---

# 1. Installation & Running

## Install Rip

```bash
# Install Bun first (if needed)
curl -fsSL https://bun.sh/install | bash

# Install Rip globally
bun add -g rip-lang

# Verify installation
rip --version
```

## Running Rip Code

```bash
# Run a file
rip app.rip

# Compile to JavaScript (prints to stdout)
rip -c app.rip

# Compile to file
rip -o app.js app.rip

# Interactive REPL
rip

# Debug: show tokens
rip -t app.rip

# Debug: show S-expressions (AST)
rip -s app.rip

# Direct execution with Bun loader
bun app.rip
```

## File Extension

All Rip files use `.rip` extension: `app.rip`, `utils.rip`, `server.rip`

---

# 2. Core Syntax

## Variables

```coffee
# Regular assignment (compiles to let)
name = "Alice"
count = 0
items = [1, 2, 3]

# Constant assignment (compiles to const) - use =!
MAX_SIZE =! 100
API_URL =! "https://api.example.com"
# MAX_SIZE = 200  # Error! Cannot reassign const

# Destructuring
{name, age} = person
[first, second, ...rest] = items
{data: {users}} = response
```

## Data Types

```coffee
# Strings (interpolation with #{})
greeting = "Hello, #{name}!"
multiline = """
  This is a
  multi-line string
  """

# Numbers
count = 42
price = 19.99
hex = 0xFF
binary = 0b1010

# Arrays
items = [1, 2, 3]
matrix = [[1, 2], [3, 4]]

# Objects
user = {name: "Alice", age: 30}
shorthand = {name, age}  # Same as {name: name, age: age}

# Ranges
nums = [1..5]      # [1, 2, 3, 4, 5]
exclusive = [1...5]  # [1, 2, 3, 4]
```

## Control Flow

```coffee
# If/else (expression - returns value)
status = if active then "on" else "off"

# Block form
if user.admin
  showAdminPanel()
else if user.moderator
  showModPanel()
else
  showUserPanel()

# Ternary (JS-style also works!)
status = active ? "on" : "off"

# Unless
showWarning() unless saved

# Postfix conditionals
console.log "active" if user.active
return early unless valid

# Switch/when
result = switch status
  when "pending" then "Waiting..."
  when "active" then "Running"
  when "done" then "Complete"
  else "Unknown"

# Pattern matching in switch
switch value
  when 1, 2, 3
    "small"
  when 4, 5, 6
    "medium"
  else
    "large"
```

## Loops

```coffee
# For...in (arrays)
for item in items
  console.log item

# With index
for item, i in items
  console.log "#{i}: #{item}"

# For...of (objects)
for key, value of object
  console.log "#{key} = #{value}"

# For own (skip inherited)
for own key, value of object
  console.log key

# Range loops
for i in [1..10]
  console.log i

# While
while condition
  doSomething()

# Until
until done
  process()

# Loop (infinite, use break)
loop
  data = fetch()
  break if data.complete
```

## Comprehensions

```coffee
# Array comprehension (context-aware!)
squares = (x * x for x in [1..10])

# With filter
evens = (x for x in [1..10] when x % 2 is 0)

# Object comprehension
doubled = {k: v * 2 for k, v of prices}

# Statement context (no array created - just loops)
console.log item for item in items
```

## Comments

```coffee
# Single line comment

###
Block comment
Multiple lines
###
```

---

# 3. Operators Reference

## Standard Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `+` `-` `*` `/` | `a + b` | Arithmetic |
| `%` | `a % b` | Remainder (can be negative) |
| `**` | `a ** b` | Exponentiation |
| `==` `!=` | `a == b` | Equality (compiles to `===`) |
| `<` `>` `<=` `>=` | `a < b` | Comparison |
| `and` `or` `not` | `a and b` | Logical (also `&&` `\|\|` `!`) |
| `is` `isnt` | `a is b` | Identity (`===` / `!==`) |
| `in` | `x in arr` | Array membership |
| `of` | `k of obj` | Object key existence |
| `?` | `a?` | Existential (not null/undefined) |
| `?.` | `a?.b` | Optional chaining |
| `??` | `a ?? b` | Nullish coalescing |

## Rip-Specific Operators

| Operator | Name | Example | Compiles To |
|----------|------|---------|-------------|
| `//` | Floor division | `7 // 2` → `3` | `Math.floor(7 / 2)` |
| `%%` | True modulo | `-1 %% 3` → `2` | Always positive result |
| `!` | Dammit (call+await) | `fetchData!` | `await fetchData()` |
| `!?` | Otherwise | `val !? 5` | Default if undefined only |
| `=!` | Equal, dammit! | `MAX =! 100` | `const MAX = 100` |
| `:=` | Signal | `count := 0` | Reactive state |
| `~=` | Derived | `doubled ~= count * 2` | Computed value |
| `<=>` | Two-way bind | `value <=> name` | Bidirectional binding |
| `=~` | Match | `str =~ /pat/` | Ruby-style regex match |

## Assignment Operators

```coffee
x = 5        # let x = 5
x =! 5       # const x = 5 (cannot reassign)
x := 5       # Reactive signal
x ~= y * 2   # Derived (auto-updates)
x += 1       # x = x + 1
x -= 1       # x = x - 1
x *= 2       # x = x * 2
x /= 2       # x = x / 2
x //= 2      # x = Math.floor(x / 2)
x %%=3       # x = true modulo
x ?= 10      # x = x ?? 10 (nullish assignment)
x &&= val    # x = x && val
x ||= val    # x = x || val
```

## Optional Chaining (Dual Syntax)

```coffee
# ES2020 style (native)
user?.profile?.name
arr?.[0]
fn?.(arg)

# CoffeeScript soak style
user?.profile?.name
arr?[0]
fn?(arg)
obj?::method

# Mix and match
users?[0]?.profile?.name
```

---

# 4. Functions

## Function Styles

```coffee
# Named function (hoisted) - use 'def'
def greet(name)
  "Hello, #{name}!"

# Arrow function (not hoisted, unbound this)
add = (a, b) -> a + b

# Fat arrow (bound this - use in callbacks/handlers)
handler = (e) => @process(e)

# Void function (suppresses return)
def logItems!
  for item in items
    console.log item
  # Returns undefined, not last expression
```

## Parameters

```coffee
# Default parameters
def greet(name = "World")
  "Hello, #{name}!"

# Rest parameters
def sum(...nums)
  nums.reduce ((a, b) -> a + b), 0

# Destructuring parameters
def processUser({name, age})
  console.log "#{name} is #{age}"

# Constructor shorthand (in classes)
constructor: (@name, @age) ->
  # Automatically assigns this.name and this.age
```

## Implicit Returns

```coffee
# Last expression is returned automatically
def add(a, b)
  a + b  # Returns this

def getStatus(user)
  if user.active
    "active"      # Returns "active"
  else
    "inactive"    # Returns "inactive"

# Explicit return when needed
def findUser(id)
  for user in users
    return user if user.id is id
  null  # Not found
```

## Calling Functions

```coffee
# Normal calls
greet("Alice")
add(1, 2)

# Without parentheses (when unambiguous)
console.log "Hello"
greet "World"

# Chained
users.filter((u) -> u.active).map((u) -> u.name)

# Ruby-style constructor
counter = Counter.new(initial: 5)
# Same as: new Counter({initial: 5})
```

---

# 5. Classes

## Basic Class

```coffee
class Animal
  constructor: (@name) ->
    # @name automatically assigned

  speak: ->
    console.log "#{@name} makes a sound"

  # Getter
  Object.defineProperty @prototype, 'info',
    get: -> "Animal: #{@name}"
```

## Inheritance

```coffee
class Dog extends Animal
  constructor: (name, @breed) ->
    super(name)

  speak: ->
    console.log "#{@name} barks!"

  fetch: ->
    console.log "#{@name} fetches the ball"
```

## Static Members

```coffee
class Counter
  @count = 0  # Static property

  @increment: ->  # Static method
    @count += 1

  constructor: ->
    Counter.increment()
```

## Instantiation

```coffee
# Traditional JS style
dog = new Dog("Buddy", "Golden Retriever")

# Ruby-style (Rip enhancement)
dog = Dog.new("Buddy", "Golden Retriever")

# With object argument
user = User.new(name: "Alice", role: "admin")
```

---

# 6. Reactivity

Rip's reactive features are **language-level operators**, not library imports.

## Signals (`:=`)

```coffee
# Create reactive state
count := 0
name := "World"
items := []

# Read (automatic in most contexts)
console.log count      # Triggers dependency tracking
doubled = count * 2    # Tracks count

# Write (triggers updates)
count = 5              # All dependents update
name = "Rip"
items = [...items, newItem]
```

## Derived Values (`~=`)

```coffee
# Auto-updates when dependencies change
count := 0
doubled ~= count * 2
message ~= "Count is #{count}"

count = 5
# doubled is now 10
# message is now "Count is 5"

# Complex derived
items := [{price: 10}, {price: 20}]
total ~= items.reduce ((sum, i) -> sum + i.price), 0
```

## Effects

```coffee
count := 0

# Runs when dependencies change
effect ->
  console.log "Count changed to #{count}"

count = 5  # Logs: "Count changed to 5"
count = 10 # Logs: "Count changed to 10"

# With cleanup
effect ->
  interval = setInterval (-> tick()), 1000
  -> clearInterval interval  # Cleanup function
```

## Signal Methods

```coffee
count := 10

# Read without tracking (in effects that shouldn't re-run)
currentValue = count.read()

# Direct value access
val = count.value
val = +count  # Unary plus shorthand

# Lock (make readonly)
count.lock()
count = 20  # Silently ignored

# Cleanup
finalValue = count.kill()  # Returns value, cleans up
```

## When to Use What

| Need | Use | Example |
|------|-----|---------|
| Mutable state that triggers UI updates | `:=` | `count := 0` |
| Computed value from other signals | `~=` | `total ~= price * qty` |
| Side effect on change | `effect` | `effect -> save(data)` |
| Immutable constant | `=!` | `API_URL =! "..."` |
| Regular variable | `=` | `temp = calculate()` |

---

# 7. Components

Components are a **language construct** in Rip.

## Basic Component

```coffee
component HelloWorld
  render
    div "Hello, World!"
```

## Full Component Structure

```coffee
component Counter
  # Props (from parent)
  @label = "Count"      # With default
  @initial = 0          # With default
  @onChange            # Callback prop (required)
  @extra?              # Optional prop

  # Reactive state
  count := @initial

  # Derived values
  doubled ~= count * 2
  isEven ~= count % 2 is 0

  # Methods
  inc: -> count += 1
  dec: -> count -= 1

  reset: ->
    count = @initial
    @onChange?(count)

  # Lifecycle
  mounted: ->
    console.log "Counter mounted"

  unmounted: ->
    console.log "Counter unmounted"

  # Effects
  effect ->
    localStorage.setItem "count", count

  # Render
  render
    div.counter
      h2 @label
      span.value count
      span.info " (doubled: #{doubled})"
      button @click: @dec, "−"
      button @click: @inc, "+"
      button @click: @reset, "Reset"
```

## Props

```coffee
component Button
  @label               # Required
  @variant = "default" # Optional with default
  @disabled = false
  @onClick            # Callback
  @...rest            # Rest props

  render
    button.btn.(variant) disabled: @disabled, @click: @onClick, ...@rest
      @label
```

## Mounting

```coffee
# Create and mount
Counter.new(label: "Score", initial: 10).mount "#app"

# Or separately
counter = Counter.new(initial: 5)
counter.mount document.getElementById("app")

# Traditional style also works
counter = new Counter({initial: 5})
counter.mount "#app"
```

## Children / Slots

```coffee
component Card
  @title
  @children

  render
    div.card
      h2.card-title @title
      div.card-body
        @children

# Usage
Card title: "My Card"
  p "This is the content"
  p "Multiple children work"
```

## Context API

```coffee
component App
  mounted: ->
    setContext "theme", {dark: true, primary: "#3b82f6"}
    setContext "user", currentUser

  render
    div
      Header()
      Content()

component Header
  theme = getContext "theme"
  user = getContext "user"

  render
    header.("dark" if theme?.dark)
      span "Welcome, #{user?.name}"
```

---

# 8. Templates

Templates use indentation-based HTML with CSS selector syntax.

## Basic Syntax

```coffee
render
  # Tag with classes and ID
  div#main.container.active

  # Attributes
  input type: "text", placeholder: "Enter name"

  # Text content (last argument)
  span "Hello, World!"
  button "Click me"

  # Dynamic content
  span count
  span "Count: #{count}"
```

## Selectors

```coffee
render
  div                    # <div>
  div.card               # <div class="card">
  div.card.active        # <div class="card active">
  div#main               # <div id="main">
  div#main.container     # <div id="main" class="container">
```

## Dynamic Classes

```coffee
render
  # Conditional class
  div.btn.("active" if isActive)

  # Multiple dynamic classes
  div.base.("highlight", size, type)

  # Object syntax
  div.({ active: isActive, disabled: isDisabled })

  # Mixed
  div.card.("featured" if featured, size)
```

## Attributes

```coffee
render
  # Static attributes
  input type: "email", required: true

  # Dynamic attributes
  img src: user.avatar, alt: user.name

  # Boolean attributes
  button disabled: isLoading

  # Spread attributes
  div ...props
  input ...inputProps, class: "extra"
```

## Event Handlers

```coffee
render
  # Method reference
  button @click: @handleClick, "Click"

  # Inline handler
  button @click: (-> count += 1), "+"

  # With event object
  input @input: ((e) -> value = e.target.value)

  # Fat arrow for this binding
  button (@click: => @process()), "Process"
```

## Event Modifiers

```coffee
render
  # Prevent default
  form @submit.prevent: @handleSubmit

  # Stop propagation
  button @click.stop: @handle

  # Combined
  a @click.prevent.stop: @navigate

  # Once (auto-removes)
  button @click.once: @initialize

  # Key modifiers
  input @keydown.enter: @submit
  input @keydown.escape: @cancel
  input @keydown.ctrl.s: @save
```

## Two-Way Binding

```coffee
render
  # Text input
  input value <=> username

  # Number input (auto-uses valueAsNumber)
  input type: "number", value <=> count

  # Checkbox
  input type: "checkbox", checked <=> isActive

  # Select
  select value <=> selectedId
    option value: "1", "Option 1"
    option value: "2", "Option 2"
```

## Conditionals

```coffee
render
  # Block conditional
  if loading
    Spinner()
  else if error
    ErrorMessage message: error
  else
    Content data: data

  # Inline conditional
  span.badge "Admin" if user.admin
  div.warning "Unsaved" unless saved
```

## Loops

```coffee
render
  # Array iteration (always use key!)
  ul
    for item in items, key: item.id
      li item.name

  # With index
  ol
    for item, i in items, key: item.id
      li "#{i + 1}. #{item.name}"

  # Object iteration
  dl
    for key, value of data
      dt key
      dd value
```

## Refs

```coffee
component SearchBox
  inputEl = null

  mounted: ->
    inputEl.focus()

  render
    input ref: inputEl, type: "text"
```

## Fragments

```coffee
render
  <>
    Header()
    main
      @children
    Footer()
```

---

# 9. Async Patterns

## The Dammit Operator (`!`)

The `!` suffix **calls AND awaits** a function:

```coffee
# Without dammit
user = await getUser(id)
posts = await getPosts(user.id)

# With dammit (cleaner!)
user = getUser!(id)
posts = getPosts!(user.id)

# No arguments - still calls
data = fetchLatest!
# Compiles to: await fetchLatest()
```

## Auto-Async Detection

Functions containing `await` or `!` are automatically async:

```coffee
# This becomes async automatically
def loadUserData(id)
  user = getUser!(id)
  posts = getPosts!(user.id)
  friends = getFriends!(user.id)
  {user, posts, friends}

# Compiles to:
# async function loadUserData(id) { ... }
```

## Async Patterns

```coffee
# Sequential (use when order matters)
def processSequential(ids)
  for id in ids
    result = process!(id)
    console.log result

# Parallel (use for independent operations)
def processParallel(ids)
  results = await Promise.all(ids.map (id) -> process(id))
  results

# Error handling
def safeFetch(url)
  try
    response = fetch!(url)
    response.json!
  catch error
    console.error "Failed:", error
    null
```

## Async in Components

```coffee
component UserProfile
  @userId
  user := null
  loading := true
  error := null

  mounted: ->
    try
      user = Api.getUser!(@userId)
    catch e
      error = e.message
    finally
      loading = false

  render
    div
      if loading
        Spinner()
      else if error
        ErrorMessage message: error
      else
        UserCard user: user
```

---

# 10. Modules & Imports

## Importing

```coffee
# Named imports
import { readFile, writeFile } from "fs"
import { useState, useEffect } from "react"

# Default import
import express from "express"

# Namespace import
import * as path from "path"

# Mixed
import React, { useState } from "react"

# From relative paths
import { utils } from "./utils.rip"
import config from "./config.rip"
```

## Exporting

```coffee
# Named exports
export def processData(data)
  data.map (x) -> x * 2

export config = {
  timeout: 5000
  retries: 3
}

export class DataProcessor
  process: (data) -> data

# Default export
export default {
  process: processData
  config
}
```

## Module Example

```coffee
# utils.rip
export def formatDate(date)
  date.toISOString().split("T")[0]

export def formatCurrency(amount)
  "$#{amount.toFixed(2)}"

export def slugify(text)
  text.toLowerCase().replace(/\s+/g, "-")

# app.rip
import { formatDate, formatCurrency } from "./utils.rip"

console.log formatDate(new Date())
console.log formatCurrency(19.99)
```

---

# 11. Regex Features

## Match Operator (`=~`)

```coffee
# Basic matching
if text =~ /pattern/
  console.log "Matched!"

# Captures stored in _
email = "user@example.com"
if email =~ /(.+)@(.+)/
  username = _[1]  # "user"
  domain = _[2]    # "example.com"

# Phone parsing
phone = "2125551234"
if phone =~ /^(\d{3})(\d{3})(\d{4})$/
  formatted = "(#{_[1]}) #{_[2]}-#{_[3]}"
  # "(212) 555-1234"
```

## Regex Indexing

```coffee
# Extract match directly
domain = "user@example.com"[/@(.+)$/, 1]
# "example.com"

# Full match (group 0)
word = "hello world"[/\w+/]
# "hello"

# Capture group
zip = "12345-6789"[/^(\d{5})/, 1]
# "12345"
```

## Heregex (Extended Regex)

```coffee
# Multi-line with comments
pattern = ///
  ^                 # Start
  (\d{3})           # Area code
  [-.\s]?           # Optional separator
  (\d{3})           # Exchange
  [-.\s]?           # Optional separator
  (\d{4})           # Subscriber
  $                 # End
///

# With flags
emailPattern = ///
  ^
  [a-z0-9._%+-]+    # Username
  @
  [a-z0-9.-]+       # Domain
  \.
  [a-z]{2,}         # TLD
  $
///i
```

## Validator Pattern

```coffee
validators =
  email: (v) -> v[/^[^@]+@[^@]+\.[a-z]{2,}$/i] and _[0]
  phone: (v) -> v[/^(\d{10})$/] and _[1]
  zip: (v) -> v[/^(\d{5})(-\d{4})?$/] and _[1]
  ssn: (v) -> v[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}-#{_[2]}-#{_[3]}"

# Usage
if email = validators.email(input)
  console.log "Valid:", email
else
  console.log "Invalid email"
```

---

# 12. Web Applications

## Client-Side Component App

```coffee
# app.rip - A complete reactive app

component TodoApp
  todos := []
  newTodo := ""
  filter := "all"

  # Derived
  filtered ~= switch filter
    when "active" then todos.filter (t) -> not t.done
    when "completed" then todos.filter (t) -> t.done
    else todos

  remaining ~= todos.filter((t) -> not t.done).length

  # Methods
  addTodo: ->
    return unless newTodo.trim()
    todos = [...todos, {id: Date.now(), text: newTodo.trim(), done: false}]
    newTodo = ""

  toggleTodo: (todo) ->
    todo.done = not todo.done
    todos = [...todos]

  removeTodo: (todo) ->
    todos = todos.filter (t) -> t isnt todo

  # Persistence
  mounted: ->
    saved = localStorage.getItem "todos"
    todos = JSON.parse(saved) if saved

  effect ->
    localStorage.setItem "todos", JSON.stringify(todos)

  render
    section.todoapp
      header
        h1 "Todos"
        input.new-todo
          placeholder: "What needs to be done?"
          value <=> newTodo
          @keydown.enter: @addTodo

      section.main if todos.length
        ul.todo-list
          for todo in filtered, key: todo.id
            li.("completed" if todo.done)
              input.toggle type: "checkbox", checked: todo.done
                @change: -> @toggleTodo(todo)
              label todo.text
              button.destroy @click: -> @removeTodo(todo)

      footer.footer if todos.length
        span.todo-count
          strong remaining
          " items left"
        ul.filters
          li
            a.("selected" if filter is "all") @click: -> filter = "all"
              "All"
          li
            a.("selected" if filter is "active") @click: -> filter = "active"
              "Active"
          li
            a.("selected" if filter is "completed") @click: -> filter = "completed"
              "Completed"

# Mount the app
TodoApp.new().mount "#app"
```

## Browser HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Todo App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script type="text/rip">
    # Inline Rip code here, or...
  </script>
  <script src="https://shreeve.github.io/rip-lang/docs/dist/rip.browser.min.js"></script>
</body>
</html>
```

---

# 13. Server-Side Development

## HTTP Server with Bun

```coffee
# server.rip
import { serve } from "bun"

# Simple JSON API
serve
  port: 3000
  fetch: (req) ->
    url = new URL(req.url)

    switch url.pathname
      when "/"
        new Response("Hello from Rip!")

      when "/api/users"
        users = [{id: 1, name: "Alice"}, {id: 2, name: "Bob"}]
        Response.json(users)

      when "/api/time"
        Response.json({time: Date.now()})

      else
        new Response("Not Found", status: 404)

console.log "Server running on http://localhost:3000"
```

## REST API

```coffee
# api.rip
import { serve } from "bun"

# In-memory database
db = {
  users: [
    {id: 1, name: "Alice", email: "alice@example.com"}
    {id: 2, name: "Bob", email: "bob@example.com"}
  ]
  nextId: 3
}

def parseBody(req)
  try
    req.json!
  catch
    null

serve
  port: 3000
  fetch: (req) ->
    {pathname} = new URL(req.url)
    method = req.method

    # Route matching with regex
    switch "#{method} #{pathname}"
      when "GET /api/users"
        Response.json(db.users)

      when /^GET \/api\/users\/(\d+)$/
        id = parseInt(_[1])
        user = db.users.find (u) -> u.id is id
        if user
          Response.json(user)
        else
          Response.json({error: "Not found"}, status: 404)

      when "POST /api/users"
        body = parseBody!(req)
        user = {id: db.nextId++, ...body}
        db.users.push(user)
        Response.json(user, status: 201)

      when /^PUT \/api\/users\/(\d+)$/
        id = parseInt(_[1])
        body = parseBody!(req)
        index = db.users.findIndex (u) -> u.id is id
        if index >= 0
          db.users[index] = {...db.users[index], ...body}
          Response.json(db.users[index])
        else
          Response.json({error: "Not found"}, status: 404)

      when /^DELETE \/api\/users\/(\d+)$/
        id = parseInt(_[1])
        index = db.users.findIndex (u) -> u.id is id
        if index >= 0
          deleted = db.users.splice(index, 1)[0]
          Response.json(deleted)
        else
          Response.json({error: "Not found"}, status: 404)

      else
        Response.json({error: "Not found"}, status: 404)

console.log "API server running on http://localhost:3000"
```

## File Server

```coffee
# file-server.rip
import { serve, file } from "bun"
import { join } from "path"

PUBLIC_DIR =! "./public"

serve
  port: 3000
  fetch: (req) ->
    url = new URL(req.url)
    path = url.pathname

    # Serve index.html for root
    path = "/index.html" if path is "/"

    # Security: prevent directory traversal
    if path.includes("..")
      return new Response("Forbidden", status: 403)

    filepath = join(PUBLIC_DIR, path)
    f = file(filepath)

    if f.size > 0
      new Response(f)
    else
      new Response("Not Found", status: 404)

console.log "File server running on http://localhost:3000"
```

## WebSocket Server

```coffee
# websocket.rip
import { serve } from "bun"

clients = new Set()

serve
  port: 3000
  fetch: (req, server) ->
    if server.upgrade(req)
      return  # Upgraded to WebSocket

    new Response("WebSocket server")

  websocket:
    open: (ws) ->
      clients.add(ws)
      console.log "Client connected (#{clients.size} total)"

    message: (ws, message) ->
      # Broadcast to all clients
      for client in clients
        client.send(message) unless client is ws

    close: (ws) ->
      clients.delete(ws)
      console.log "Client disconnected (#{clients.size} total)"

console.log "WebSocket server running on ws://localhost:3000"
```

---

# 14. CLI Tools & Scripts

## Basic CLI Tool

```coffee
# greet.rip
import { argv } from "process"

args = argv.slice(2)

if args.length is 0
  console.log "Usage: rip greet.rip <name>"
  process.exit(1)

name = args[0]
console.log "Hello, #{name}!"
```

## With Argument Parsing

```coffee
# cli.rip
import { argv } from "process"

def parseArgs(args)
  result = {
    flags: {}
    positional: []
  }

  i = 0
  while i < args.length
    arg = args[i]
    if arg.startsWith("--")
      key = arg.slice(2)
      if args[i + 1]? and not args[i + 1].startsWith("-")
        result.flags[key] = args[++i]
      else
        result.flags[key] = true
    else if arg.startsWith("-")
      for char in arg.slice(1)
        result.flags[char] = true
    else
      result.positional.push(arg)
    i++

  result

# Parse arguments
{flags, positional} = parseArgs(argv.slice(2))

# Show help
if flags.help or flags.h
  console.log """
    Usage: rip cli.rip [options] <files...>

    Options:
      -h, --help     Show this help
      -v, --verbose  Verbose output
      --output DIR   Output directory
    """
  process.exit(0)

# Process files
for file in positional
  console.log "Processing: #{file}"
  if flags.verbose or flags.v
    console.log "  (verbose mode)"
```

## File Processing Script

```coffee
# process-files.rip
import { readFileSync, writeFileSync, readdirSync } from "fs"
import { join, extname } from "path"

INPUT_DIR =! "./input"
OUTPUT_DIR =! "./output"

def processFile(content)
  # Transform content
  content
    .split("\n")
    .filter((line) -> line.trim().length > 0)
    .map((line) -> line.toUpperCase())
    .join("\n")

# Get all .txt files
files = readdirSync(INPUT_DIR).filter (f) -> extname(f) is ".txt"

for filename in files
  inputPath = join(INPUT_DIR, filename)
  outputPath = join(OUTPUT_DIR, filename)

  content = readFileSync(inputPath, "utf-8")
  processed = processFile(content)
  writeFileSync(outputPath, processed)

  console.log "Processed: #{filename}"

console.log "Done! Processed #{files.length} files."
```

## Data Transformation Script

```coffee
# transform.rip
import { readFileSync, writeFileSync } from "fs"

# Read JSON data
data = JSON.parse(readFileSync("data.json", "utf-8"))

# Transform
transformed = for item in data.items
  {
    id: item.id
    name: item.name.trim()
    slug: item.name.toLowerCase().replace(/\s+/g, "-")
    active: item.status is "active"
    createdAt: new Date(item.created).toISOString()
  }

# Write output
writeFileSync("output.json", JSON.stringify(transformed, null, 2))
console.log "Transformed #{transformed.length} items"
```

---

# 15. JavaScript Interop

## Using npm Packages

```coffee
# Rip can import any npm package

# Express
import express from "express"
app = express()
app.get "/", (req, res) -> res.send("Hello!")
app.listen(3000)

# Lodash
import _ from "lodash"
sorted = _.sortBy(users, "name")

# Zod validation
import { z } from "zod"
UserSchema = z.object
  name: z.string()
  email: z.string().email()
  age: z.number().min(0)

# Axios
import axios from "axios"
def fetchData(url)
  response = axios.get!(url)
  response.data

# Date-fns
import { format, parseISO } from "date-fns"
formatted = format(parseISO(dateStr), "yyyy-MM-dd")
```

## Calling JavaScript from Rip

```coffee
# JavaScript functions work directly
console.log("Hello")
Math.max(1, 2, 3)
JSON.stringify({a: 1})
Object.keys(obj)
Array.isArray(items)

# DOM APIs (in browser)
document.getElementById("app")
element.addEventListener "click", handler
fetch("/api/data").then (r) -> r.json()

# Node/Bun APIs
import { readFileSync } from "fs"
import { join } from "path"
```

## Calling Rip from JavaScript

```javascript
// In JavaScript, import compiled Rip
import { processData, formatUser } from "./utils.rip";

// Or compile at runtime (browser)
import { compile } from "rip-lang";
const { code } = compile('x = 42');
eval(code);
```

---

# 16. Common Patterns

## Error Handling

```coffee
# Try/catch
try
  data = fetchData!(url)
  process(data)
catch error
  console.error "Failed:", error.message
finally
  cleanup()

# Otherwise operator for defaults
value = riskyOperation() !? "default"

# Optional chaining for safety
name = user?.profile?.name ?? "Anonymous"
```

## Configuration

```coffee
# config.rip
export default
  api:
    baseUrl: process.env.API_URL ?? "http://localhost:3000"
    timeout: parseInt(process.env.TIMEOUT) or 5000
  database:
    host: process.env.DB_HOST ?? "localhost"
    port: parseInt(process.env.DB_PORT) or 5432
  features:
    darkMode: process.env.DARK_MODE is "true"
```

## Middleware Pattern

```coffee
def createMiddleware(options = {})
  (req, res, next) ->
    start = Date.now()

    # Before
    console.log "#{req.method} #{req.url}" if options.logging

    # Call next, then after
    result = next()

    # After
    duration = Date.now() - start
    console.log "  Completed in #{duration}ms" if options.timing

    result
```

## Builder Pattern

```coffee
class QueryBuilder
  constructor: ->
    @_select = "*"
    @_from = null
    @_where = []
    @_orderBy = null
    @_limit = null

  select: (fields) ->
    @_select = fields
    @

  from: (table) ->
    @_from = table
    @

  where: (condition) ->
    @_where.push(condition)
    @

  orderBy: (field) ->
    @_orderBy = field
    @

  limit: (n) ->
    @_limit = n
    @

  build: ->
    sql = "SELECT #{@_select} FROM #{@_from}"
    sql += " WHERE #{@_where.join(' AND ')}" if @_where.length
    sql += " ORDER BY #{@_orderBy}" if @_orderBy
    sql += " LIMIT #{@_limit}" if @_limit
    sql

# Usage
query = new QueryBuilder()
  .select("id, name")
  .from("users")
  .where("active = true")
  .orderBy("name")
  .limit(10)
  .build()
```

## Event Emitter

```coffee
class EventEmitter
  constructor: ->
    @_listeners = {}

  on: (event, callback) ->
    @_listeners[event] ?= []
    @_listeners[event].push(callback)
    @

  off: (event, callback) ->
    return @ unless @_listeners[event]
    @_listeners[event] = @_listeners[event].filter (cb) -> cb isnt callback
    @

  emit: (event, ...args) ->
    return @ unless @_listeners[event]
    for callback in @_listeners[event]
      callback(...args)
    @
```

## State Machine

```coffee
class StateMachine
  constructor: (@states, @initial) ->
    @current = @initial

  transition: (event) ->
    state = @states[@current]
    return false unless state?[event]

    next = state[event]
    console.log "#{@current} -> #{next} (#{event})"
    @current = next
    true

  is: (state) -> @current is state

# Usage
machine = new StateMachine
  idle:
    start: "running"
  running:
    pause: "paused"
    stop: "idle"
  paused:
    resume: "running"
    stop: "idle"
, "idle"

machine.transition("start")  # idle -> running
machine.transition("pause")  # running -> paused
```

---

# 17. Quick Reference

## File Templates

### Web App Entry Point

```coffee
# app.rip
component App
  render
    div#app
      h1 "My App"

App.new().mount "#app"
```

### API Server

```coffee
# server.rip
import { serve } from "bun"

serve
  port: 3000
  fetch: (req) ->
    Response.json({message: "Hello!"})

console.log "Running on http://localhost:3000"
```

### CLI Script

```coffee
# script.rip
import { argv } from "process"

args = argv.slice(2)
console.log "Arguments:", args
```

### Utility Module

```coffee
# utils.rip
export def formatDate(date)
  date.toISOString().split("T")[0]

export def capitalize(str)
  str.charAt(0).toUpperCase() + str.slice(1)

export def sleep(ms)
  new Promise (resolve) -> setTimeout(resolve, ms)
```

## Syntax Cheat Sheet

```coffee
# Variables
x = 5           # let
x =! 5          # const
x := 5          # signal (reactive)
x ~= y * 2      # derived (reactive)

# Functions
def fn(a, b)    # named function
  a + b
fn = (a) -> a   # arrow (unbound this)
fn = (a) => a   # fat arrow (bound this)
def fn!         # void function

# Control
if x then a else b
x ? a : b
switch x
  when 1 then "one"
  else "other"

# Loops
for x in arr
for k, v of obj
while cond
until cond

# Classes
class X extends Y
  constructor: (@a) ->
  method: -> @a
X.new(a: 1)

# Components
component X
  @prop = default
  state := initial
  derived ~= state * 2
  render
    div state

# Operators
a!             # await a()
a !? b         # a if defined, else b
a // b         # floor divide
a %% b         # true modulo
a =~ /pat/     # regex match, captures in _
a[/pat/, 1]    # regex extract
```

## Common Commands

```bash
# Run
rip app.rip

# Compile
rip -c app.rip          # to stdout
rip -o app.js app.rip   # to file

# Debug
rip -t app.rip          # tokens
rip -s app.rip          # s-expressions

# REPL
rip

# Install
bun add -g rip-lang
```

---

## Summary

**Rip is a complete language for modern JavaScript development:**

- **Clean syntax** — CoffeeScript-inspired, readable, minimal noise
- **Built-in reactivity** — `:=` signals, `~=` derived, `effect` blocks
- **Component system** — `component` keyword, props, lifecycle, templates
- **Modern output** — ES2022, classes, optional chaining, nullish coalescing
- **JavaScript interop** — Full access to npm ecosystem
- **Multi-platform** — Bun, Node.js, Deno, browsers

**Key differentiators:**
- Reactive primitives are operators, not library imports
- Templates are language syntax, not strings or JSX
- Components are first-class language constructs
- Zero dependencies, self-hosting compiler

**Start with:**
```bash
bun add -g rip-lang
echo 'console.log "Hello, Rip!"' > hello.rip
rip hello.rip
```

---

*Version 2.5.0 — 1046/1046 tests passing — Zero dependencies — Self-hosting*
