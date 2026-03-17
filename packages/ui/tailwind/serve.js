import { compile } from './engine.js'

export function generateBrowserCss(classes = [], config = {}) {
  const { css } = compile(classes, config)
  return css
}
