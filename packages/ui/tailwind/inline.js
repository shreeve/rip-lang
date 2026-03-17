import { compile } from './engine.js'
import { generate, walk } from 'css-tree'

const tailwindRoots = []

function isFragmentNode(node) {
  return node && Array.isArray(node.childNodes) && !node.tag && !node.attributes
}

function isElementNode(node) {
  return node && node.tag && node.attributes && node.style
}

function collectClasses(node, out = new Set()) {
  if (isFragmentNode(node) || isElementNode(node)) {
    if (isElementNode(node) && node.className) {
      for (const cls of node.className.split(/\s+/)) {
        if (cls) out.add(cls)
      }
    }
    for (const child of node.childNodes) collectClasses(child, out)
  }
  return out
}

function getCustomProperties(styleSheet) {
  const customProperties = new Map()
  walk(styleSheet, {
    visit: 'Atrule',
    enter(atrule) {
      if (atrule.name !== 'property' || !atrule.prelude) return
      const name = generate(atrule.prelude)
      if (!name.startsWith('--')) return
      let initialValue
      walk(atrule, {
        visit: 'Declaration',
        enter(decl) {
          if (decl.property === 'initial-value') initialValue = decl
        },
      })
      customProperties.set(name, { initialValue })
    },
  })
  return customProperties
}

function extractRuleMaps(styleSheet, classes) {
  const classSet = new Set(classes)
  const inlineable = new Map()
  const supported = new Set()
  const residual = []

  walk(styleSheet, {
    visit: 'Rule',
    enter(rule, _item, list) {
      const selectorClasses = []
      walk(rule, {
        visit: 'ClassSelector',
        enter(classSelector) {
          selectorClasses.push(classSelector.name.replace(/\\/g, ''))
        },
      })
      const matched = selectorClasses.filter((cls) => classSet.has(cls))
      if (matched.length === 0) return
      matched.forEach((cls) => supported.add(cls))

      const selectorText = generate(rule.prelude).trim()
      const inlineableRule = selectorText
        .split(',')
        .map((s) => s.trim())
        .every((s) => s.startsWith('.') && !/[\s>+~:#\[]/.test(s.slice(1)))

      if (inlineableRule) {
        matched.forEach((cls) => {
          inlineable.set(cls, rule)
        })
      } else {
        residual.push(rule)
      }
    },
  })

  walk(styleSheet, {
    visit: 'Atrule',
    enter(atrule) {
      if (atrule.name === 'theme') residual.push(atrule)
      if (atrule.name === 'layer' && generate(atrule.prelude).includes('base')) residual.push(atrule)
      if (atrule.name === 'media') residual.push(atrule)
    },
  })

  return { inlineable, supported, residual }
}

function makeInlineStylesFor(rules, customProperties) {
  const styles = {}
  const locals = new Map()

  for (const rule of rules) {
    walk(rule, {
      visit: 'Declaration',
      enter(decl) {
        if (decl.property.startsWith('--')) locals.set(decl.property, decl)
      },
    })
  }

  for (const rule of rules) {
    walk(rule, {
      visit: 'Function',
      enter(fn, item) {
        if (fn.name !== 'var') return
        let variableName
        walk(fn, {
          visit: 'Identifier',
          enter(identifier) {
            variableName = identifier.name
            return this.break
          },
        })
        if (!variableName) return
        const local = locals.get(variableName)
        if (local) {
          item.data = local.value
          return
        }
        const custom = customProperties.get(variableName)
        if (custom?.initialValue) item.data = custom.initialValue.value
      },
    })

    walk(rule, {
      visit: 'Declaration',
      enter(decl) {
        if (decl.property.startsWith('--')) return
        const camel = decl.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        styles[camel] = generate(decl.value) + (decl.important ? '!important' : '')
      },
    })
  }

  return styles
}

function applyInlineTree(node, inlineable, customProperties, unsupported = []) {
  if (isFragmentNode(node)) {
    for (const child of node.childNodes) applyInlineTree(child, inlineable, customProperties, unsupported)
    return unsupported
  }
  if (!isElementNode(node)) return unsupported

  if (node.className) {
    const residualClasses = []
    for (const cls of node.className.split(/\s+/)) {
      if (!cls) continue
      const rule = inlineable.get(cls)
      if (rule) {
        Object.assign(node.style, makeInlineStylesFor([rule], customProperties))
      } else {
        residualClasses.push(cls)
        if (!unsupported.includes(cls)) unsupported.push(cls)
      }
    }
    if (residualClasses.length) node.className = residualClasses.join(' ')
    else node.removeAttribute('class')
  }

  for (const child of node.childNodes) applyInlineTree(child, inlineable, customProperties, unsupported)
  return unsupported
}

function findFirstTag(node, tag) {
  if (isElementNode(node) && node.tag === tag) return node
  if (isElementNode(node) || isFragmentNode(node)) {
    for (const child of node.childNodes) {
      const found = findFirstTag(child, tag)
      if (found) return found
    }
  }
  return null
}

export function inlineEmailTree(rootNode, config = {}) {
  const classes = [...collectClasses(rootNode)]
  if (classes.length === 0) return { unsupported: [], headCss: '' }

  const { css, styleSheet } = compile(classes, config)
  const customProperties = getCustomProperties(styleSheet)
  const { inlineable, supported, residual } = extractRuleMaps(styleSheet, classes)
  const unsupported = applyInlineTree(rootNode, inlineable, customProperties, [])
  const headCss = residual.map((node) => generate(node)).join('\n')

  if (headCss) {
    const head = findFirstTag(rootNode, 'head')
    if (head) {
      const styleNode = new head.constructor('style')
      styleNode.innerHTML = headCss
      head.appendChild(styleNode)
    }
  }

  const trulyUnsupported = unsupported.filter((cls) => !supported.has(cls))
  return { unsupported: trulyUnsupported, headCss }
}

export function registerEmailTailwindRoot(component, config) {
  const root = component?._root ?? component
  if (root) tailwindRoots.push({ root, config })
}

export function takeEmailTailwindRoots() {
  const roots = tailwindRoots.slice()
  tailwindRoots.length = 0
  return roots
}
