// 12-intrinsics.tsx — Intrinsic element typing
//
// TSX equivalent of 12-intrinsics.rip: tag validation, attribute types,
// event handlers, and global attributes.

import React, { useState } from 'react'

// ── Valid HTML/SVG tags ──

function ValidTags() {
  return (
    <div>
      <h1>Title</h1>
      <p>Paragraph</p>
      <span>Inline</span>
      <button>Click me</button>
      <input type='text' />
      <form>
        <fieldset>
          <label>Name</label>
          <input type='text' placeholder='Enter name' />
        </fieldset>
        <button type='submit'>Submit</button>
      </form>
    </div>
  )
}

function SvgTags() {
  return (
    <svg>
      <circle />
      <rect />
      <path />
      <g>
        <line />
      </g>
    </svg>
  )
}

// ── Attribute type checking ──

function ValidAttrs() {
  return (
    <div>
      <input type='email' placeholder='jane@example.com' disabled={false} />
      <button type='submit' disabled={true}>Submit</button>
      <a href='https://example.com'>Link</a>
      <img src='/logo.png' alt='Logo' width={100} height={50} />
      <textarea rows={5} cols={40} />
      <select multiple={true}>
        <option value='a'>Option A</option>
      </select>
    </div>
  )
}

function InvalidAttrs() {
  return (
    <div>
      {/* @ts-expect-error — disabled expects boolean, not string */}
      <button disabled={'yes' as any as boolean}>Submit</button>
      {/* @ts-expect-error — type must be a valid button type */}
      <button type={42 as any}>Submit</button>
    </div>
  )
}

// ── Event handler typing ──

function EventHandlers() {
  const [email, setEmail] = useState('')

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input type='email' onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      <button type='submit' onClick={(e) => console.log('clicked')}>
        Submit
      </button>
    </form>
  )
}

// ── Global attributes (class, style, data-*, aria-*) ──

function GlobalAttrs() {
  return (
    <div id='main' className='container'>
      <h1 className='title' style={{ color: 'blue' }}>
        Hello
      </h1>
      <button id='btn' title='Click me' tabIndex={0} hidden={false}>
        OK
      </button>
      <input aria-label='Email' data-testid='email-input' type='email' />
    </div>
  )
}
