import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            record_video_dir='/home/jules/verification/videos'
        )
        page = await context.new_page()

        await page.goto("http://localhost:3000")

        # Click the tool tile
        await page.get_by_text("Circuit Simulator").click()
        await page.wait_for_selector("#circuit-canvas")

        # Pick multiple new components
        # Resistor
        await page.get_by_text("Resistor", exact=True).click()
        await page.mouse.click(300, 300)

        # DC Voltage
        await page.get_by_text("DC Voltage", exact=True).click()
        await page.mouse.click(200, 400)

        # Ground
        await page.get_by_text("Ground", exact=True).click()
        await page.mouse.click(200, 500)

        # Transformer
        await page.get_by_text("Transformer", exact=True).click()
        await page.mouse.click(500, 300)

        # Capacitor
        await page.get_by_text("Capacitor", exact=True).click()
        await page.mouse.click(600, 400)

        # Light Bulb
        await page.get_by_text("Light Bulb", exact=True).click()
        await page.mouse.click(700, 300)

        # Voltmeter
        await page.get_by_text("Voltmeter", exact=True).click()
        await page.mouse.click(800, 300)

        # Middle click / pan
        await page.mouse.move(400, 400)
        await page.mouse.down(button="middle")
        await page.mouse.move(200, 200)
        await page.mouse.up(button="middle")

        # Zoom
        await page.mouse.wheel(0, 100) # zoom out
        await page.mouse.wheel(0, 100) # zoom out

        # Wait a sec
        await page.wait_for_timeout(500)

        await page.screenshot(path="/home/jules/verification/screenshots/verification5.png")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
