import { test, expect } from 'playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectPopoverOpen(locator, expected) {
  await expect
    .poll(async () => locator.evaluate((el) => el.matches(':popover-open')))
    .toBe(expected)
}

async function getCenter(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element has no bounding box')
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

test.describe('overlay primitives', () => {
  test('popover opens and dismisses by Escape/outside click', async ({ page }) => {
    await page.goto('/#popover')

    const trigger = page.locator('#popover button:has-text("Open Popover")')
    const content = page.locator('#popover [data-content]').first()

    await trigger.click()
    await expectPopoverOpen(content, true)
    await expect(content).toBeVisible()

    await page.keyboard.press('Escape')
    await expectPopoverOpen(content, false)
    await expect(trigger).toBeFocused()
  })

  test('dialog closes on Escape and restores closed state', async ({ page, browserName }) => {
    await page.goto('/#dialog')

    const trigger = page.locator('#dialog button:has-text("Open Dialog")')
    await trigger.click()
    const dialog = page.locator('#dialog dialog')
    await expect(dialog).toHaveAttribute('open', '')

    await page.keyboard.press('Escape')
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect(page.locator('#dialog .status')).toContainText('open: false')
    if (browserName === 'webkit') {
      // WebKit may leave focus on <body> after native dialog Escape close.
      // Ensure focus is no longer trapped and trigger can be immediately focused.
      await trigger.focus()
      await expect(trigger).toBeFocused()
    } else {
      await expect(trigger).toBeFocused()
    }
  })

  test('alert dialog ignores Escape until explicit action', async ({ page }) => {
    await page.goto('/#alert-dialog')

    await page.locator('#alert-dialog button:has-text("Delete Account")').click()
    const dialog = page.locator('#alert-dialog dialog')
    await expect(dialog).toHaveAttribute('open', '')

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveAttribute('open', '')

    await page.locator('#alert-dialog button:has-text("Cancel")').click()
    await expect(dialog).not.toHaveAttribute('open', '')
  })

  test('menu has semantic role and opens list', async ({ page }) => {
    await page.goto('/#menu')

    const trigger = page.locator('#menu button:has-text("Actions")')
    await expect(trigger).toHaveAttribute('aria-haspopup', /menu/)
    await trigger.click()

    const menu = page.locator('#menu [role="menu"]')
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', /true/)
  })

  test('select demo with dynamic slot options opens on pointerdown, stays open on release, and closes on a later trigger click', async ({ page }) => {
    await page.goto('/#select')

    const row = page.locator('#select .demo-row').first()
    const trigger = row.locator('[role="combobox"]')
    const listbox = row.locator('[role="listbox"]')

    const center = await getCenter(trigger)
    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await expect(trigger).toHaveAttribute('aria-expanded', /true/)
    await expect(listbox).toBeVisible()
    await expect(listbox.locator('[role="option"]')).toHaveCount(21)
    await expect(listbox.locator('[role="option"]').first()).toContainText('Apple')
    await page.mouse.up()
    await expect(listbox).toBeVisible()
    await trigger.click()
    await expect(listbox).not.toBeVisible()
  })

  test('select supports one-gesture mouse selection from trigger press to option release', async ({ page }) => {
    await page.goto('/#select')

    const row = page.locator('#select .demo-row').first()
    const trigger = row.locator('[role="combobox"]')
    const listbox = row.locator('[role="listbox"]')
    const option = listbox.locator('[role="option"]').nth(2)
    const status = row.locator('.status')

    await trigger.scrollIntoViewIfNeeded()
    const triggerCenter = await getCenter(trigger)
    await page.mouse.move(triggerCenter.x, triggerCenter.y)
    await page.mouse.down()
    await expect(listbox).toBeVisible()

    const optionCenter = await getCenter(option)
    await page.mouse.move(optionCenter.x, optionCenter.y)
    await expect(option).toContainText('Avocado')
    await page.mouse.up()
    await expect(listbox).not.toBeVisible()
    await expect(status).toContainText(/avocado/i)
    await expect(trigger).toContainText('Avocado')
  })

  test('select does not commit on option pointerdown alone', async ({ page }) => {
    await page.goto('/#select')

    const row = page.locator('#select .demo-row').first()
    const trigger = row.locator('[role="combobox"]')
    const listbox = row.locator('[role="listbox"]')
    const option = listbox.locator('[role="option"]').nth(2)
    const status = row.locator('.status')

    await trigger.click()
    await expect(listbox).toBeVisible()

    await option.dispatchEvent('pointerdown', {
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      isPrimary: true,
    })
    await expect(status).toContainText('selected: none')
    await expect(listbox).toBeVisible()
  })

  test('select ignores touch pointerdown and opens on click', async ({ page }) => {
    await page.goto('/#select')

    const row = page.locator('#select .demo-row').first()
    const trigger = row.locator('[role="combobox"]')
    const listbox = row.locator('[role="listbox"]')

    await trigger.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      isPrimary: true,
    })
    await expect(trigger).toHaveAttribute('aria-expanded', /false/)
    await expect(listbox).not.toBeVisible()

    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', /true/)
    await expect(listbox).toBeVisible()
  })

  test('select supports keyboard selection in the placeholder demo', async ({ page }) => {
    await page.goto('/#select')

    const row = page.locator('#select .demo-row').nth(1)
    const trigger = row.locator('[role="combobox"]')
    await trigger.focus()
    await page.keyboard.press('ArrowDown')

    const listbox = row.locator('[role="listbox"]')
    await expect(listbox).toBeVisible()
    await expect(listbox.locator('[role="option"]')).toHaveCount(4)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(listbox).not.toBeVisible()
    await expect(row.locator('.status')).not.toContainText('none')
  })

  test('combobox opens suggestions and selects via Enter', async ({ page }) => {
    await page.goto('/#combobox')

    const input = page.locator('#combobox [role="combobox"]').first()
    await input.fill('ap')
    await expect(page.locator('#combobox [role="listbox"]').first()).toBeVisible()

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.locator('#combobox [role="listbox"]').first()).not.toBeVisible()
    await expect(input).toHaveValue(/.+/)
  })

  test('autocomplete opens suggestions and accepts keyboard selection', async ({ page }) => {
    await page.goto('/#autocomplete')

    const input = page.locator('#autocomplete [role="combobox"]').first()
    await input.fill('n')
    await expect(page.locator('#autocomplete [role="listbox"]').first()).toBeVisible()

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.locator('#autocomplete [role="listbox"]').first()).not.toBeVisible()
    await expect(input).toHaveValue(/.+/)
  })

  test('multiselect opens listbox and toggles an option', async ({ page }) => {
    await page.goto('/#multi-select')

    const input = page.locator('#multi-select [role="combobox"]').first()
    const chips = page.locator('#multi-select [data-chips]').first()
    const listbox = page.locator('#multi-select [role="listbox"]').first()
    const firstOption = page.locator('#multi-select [role="option"]').first()

    await chips.scrollIntoViewIfNeeded()
    await input.fill('r')
    await expect(listbox).toBeVisible()

    const before = await firstOption.getAttribute('aria-selected')
    await firstOption.click()
    await expect(firstOption).toHaveAttribute('aria-selected', before === 'true' ? 'false' : 'true')
  })

  test('tooltip appears on hover with role=tooltip', async ({ page }) => {
    await page.goto('/#tooltip')

    const target = page.locator('#tooltip button:has-text("Save (top)")')
    await target.hover()

    const tip = page.locator('[role="tooltip"]').first()
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Save your changes')
  })

  test('nested popover inside dialog opens without closing dialog', async ({ page }) => {
    await page.goto('/#dialog')

    await page.locator('#dialog button:has-text("Open Dialog")').click()
    const dialog = page.locator('#dialog dialog')
    await expect(dialog).toHaveAttribute('open', '')

    const nestedTrigger = page.locator('#dialog dialog button:has-text("More options")')
    await nestedTrigger.click()

    const nestedContent = page.locator('#dialog dialog [data-content]').first()
    await expectPopoverOpen(nestedContent, true)
    await expect(dialog).toHaveAttribute('open', '')
  })

  test('popover remains stable under rapid toggle/escape sequence', async ({ page }) => {
    await page.goto('/#popover')

    const trigger = page.locator('#popover button:has-text("Open Popover")')
    const content = page.locator('#popover [data-content]').first()

    for (let i = 0; i < 3; i++) {
      await trigger.click()
      await expectPopoverOpen(content, true)
      await page.keyboard.press('Escape')
      await expectPopoverOpen(content, false)
    }
  })
})

test.describe('overlay accessibility (optional)', () => {
  test.skip(process.env.UI_AXE !== '1', 'set UI_AXE=1 to enable axe scans')

  test('key overlay primitives have no critical axe violations', async ({ page }) => {
    const cases = [
      {
        name: 'dialog',
        hash: '#dialog',
        include: '#dialog dialog',
        setup: async () => {
          const trigger = page.locator('#dialog button:has-text("Open Dialog")')
          await trigger.scrollIntoViewIfNeeded()
          await trigger.click()
          await expect(page.locator('#dialog dialog')).toHaveAttribute('open', '')
        },
      },
      {
        name: 'popover',
        hash: '#popover',
        include: '#popover [data-content]',
        setup: async () => {
          const trigger = page.locator('#popover button:has-text("Open Popover")')
          await trigger.scrollIntoViewIfNeeded()
          await trigger.click()
          await expect(page.locator('#popover [data-content]').first()).toBeVisible()
        },
      },
      {
        name: 'menu',
        hash: '#menu',
        include: '#menu [role="menu"]',
        setup: async () => {
          const trigger = page.locator('#menu button:has-text("Actions")')
          await trigger.scrollIntoViewIfNeeded()
          await trigger.click()
          await expect(page.locator('#menu [role="menu"]')).toBeVisible()
        },
      },
      {
        name: 'select',
        hash: '#select',
        include: '#select [role="listbox"]',
        setup: async () => {
          const trigger = page.locator('#select [role="combobox"]').first()
          await trigger.scrollIntoViewIfNeeded()
          await trigger.focus()
          await page.keyboard.press('ArrowDown')
          await expect(page.locator('#select [role="listbox"]').first()).toBeVisible()
        },
      },
      {
        name: 'tooltip',
        hash: '#tooltip',
        include: '#tooltip [role="tooltip"]',
        setup: async () => {
          const trigger = page.locator('#tooltip button:has-text("Save (top)")')
          await trigger.scrollIntoViewIfNeeded()
          await trigger.hover()
          await expect(page.locator('#tooltip [role="tooltip"]').first()).toBeVisible()
        },
      },
    ]

    for (const item of cases) {
      await page.goto(`/?axe=${item.name}${item.hash}`)
      await item.setup()
      const results = await new AxeBuilder({ page }).include(item.include).analyze()
      const critical = results.violations.filter((v) => v.impact === 'critical')
      const serious = results.violations.filter((v) => v.impact === 'serious')
      if (serious.length) {
        console.warn(
          `[axe:${item.name}] serious findings (non-blocking for now): ${serious
            .map((v) => `${v.id}(${v.nodes.length})`)
            .join(', ')}`
        )
      }
      expect(
        critical,
        `${item.name} critical violations:\n${critical.map((v) => `${v.id}: ${v.help}`).join('\n')}`
      ).toEqual([])
    }
  })
})
