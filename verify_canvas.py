import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:3000/circuit-simulator/index.html')

        # Wait for the app.js script to run and populate the palette
        await page.wait_for_timeout(1000)

        # Forcefully remove the cookie banner from the DOM to prevent it from intercepting clicks
        await page.evaluate('''() => {
            const cc = document.getElementById('cc-main');
            if (cc) cc.remove();

            // Also remove anything that looks like a modal backdrop or banner
            document.querySelectorAll('[id*="cc-"]').forEach(el => el.remove());
        }''')
        await page.wait_for_timeout(500)

        # The class is `palette-item`
        bulb = page.locator('.palette-item', has_text='Light Bulb')
        canvas = page.locator('svg#circuit-canvas')

        box = await canvas.bounding_box()
        if not box:
            print("Canvas not found!")
            await browser.close()
            return

        # Click the palette item to enter "place" mode
        await bulb.click(force=True)
        await page.wait_for_timeout(500)
        # Click the canvas to place it
        await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
        await page.wait_for_timeout(500)

        # Capacitor
        cap = page.locator('.palette-item', has_text='Capacitor')
        await cap.click(force=True)
        await page.wait_for_timeout(500)
        await page.mouse.click(box['x'] + box['width']/2 - 100, box['y'] + box['height']/2)
        await page.wait_for_timeout(500)

        # Inductor
        ind = page.locator('.palette-item', has_text='Inductor')
        await ind.click(force=True)
        await page.wait_for_timeout(500)
        await page.mouse.click(box['x'] + box['width']/2 + 100, box['y'] + box['height']/2)
        await page.wait_for_timeout(500)

        # Transformer
        trans = page.locator('.palette-item', has_text='Transformer')
        await trans.click(force=True)
        await page.wait_for_timeout(500)
        await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2 + 100)
        await page.wait_for_timeout(500)

        # Voltmeter
        volt = page.locator('.palette-item', has_text='Voltmeter')
        await volt.click(force=True)
        await page.wait_for_timeout(500)
        await page.mouse.click(box['x'] + box['width']/2 - 100, box['y'] + box['height']/2 + 100)
        await page.wait_for_timeout(500)

        # Switch
        switch = page.locator('.palette-item', has_text='Switch')
        await switch.click(force=True)
        await page.wait_for_timeout(500)
        await page.mouse.click(box['x'] + box['width']/2 + 100, box['y'] + box['height']/2 + 100)
        await page.wait_for_timeout(500)

        # Now use middle mouse button to drag/pan the canvas!
        await page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
        await page.mouse.down(button="middle")
        await page.mouse.move(box['x'] + box['width']/2 + 50, box['y'] + box['height']/2 + 50)
        await page.mouse.up(button="middle")
        await page.wait_for_timeout(500)

        # Take a screenshot of the whole page to verify everything
        await page.screenshot(path='/home/jules/verification/screenshots/full_page_success.png', full_page=True)
        await browser.close()

asyncio.run(main())
