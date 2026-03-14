import { test, expect } from 'playwright/test'

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

    await trigger.click()
    await expectPopoverOpen(content, true)
    await page.locator('body').click({ position: { x: 8, y: 8 } })
    await expectPopoverOpen(content, false)
  })

  test('dialog closes on Escape and restores closed state', async ({ page }) => {
    await page.goto('/#dialog')

    await page.locator('#dialog button:has-text("Open Dialog")').click()
    const dialog = page.locator('#dialog dialog')
    await expect(dialog).toHaveAttribute('open', '')

    await page.keyboard.press('Escape')
    await expect(dialog).not.toHaveAttribute('open', '')
    await expect(page.locator('#dialog .status')).toContainText('open: false')
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

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    await expect(trigger).toHaveAttribute('aria-expanded', /false/)
    await expect(page.locator('#select .status').first()).not.toContainText('none')
  })

  test('tooltip appears on hover with role=tooltip', async ({ page }) => {
    await page.goto('/#tooltip')

    const target = page.locator('#tooltip button:has-text("Save (top)")')
    await target.hover()

    const tip = page.locator('[role="tooltip"]').first()
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Save your changes')
  })
})
