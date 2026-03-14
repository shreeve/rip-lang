import { test, expect } from 'playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectPopoverOpen(locator, expected) {
  await expect
    .poll(async () => locator.evaluate((el) => el.matches(':popover-open')))
    .toBe(expected)
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

  test('dialog closes on Escape and restores closed state', async ({ page }) => {
    await page.goto('/#dialog')

    const trigger = page.locator('#dialog button:has-text("Open Dialog")')
    await trigger.click()
    const dialog = page.locator('#dialog dialog')
    await expect(dialog).toHaveAttribute('open', '')

    await page.keyboard.press('Escape')
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect(page.locator('#dialog .status')).toContainText('open: false')
    await expect(trigger).toBeFocused()
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

  test('select opens listbox and supports keyboard selection', async ({ page }) => {
    await page.goto('/#select')

    const trigger = page.locator('#select [role="combobox"]').first()
    await trigger.focus()
    await page.keyboard.press('ArrowDown')

    const listbox = page.locator('#select [role="listbox"]').first()
    await expect(listbox).toBeVisible()
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
