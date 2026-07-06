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

        # Place transformer and select it
        await page.get_by_text("Transformer", exact=True).click()
        await page.mouse.click(500, 300)

        # Wait a sec
        await page.wait_for_timeout(500)

        # Pan the canvas a little
        await page.mouse.move(500, 300)
        await page.mouse.down(button="middle")
        await page.mouse.move(600, 400)
        await page.mouse.up(button="middle")

        # Zoom in a tiny bit
        await page.mouse.wheel(0, -50)

        await page.wait_for_timeout(500)
        await page.screenshot(path="/home/jules/verification/screenshots/verification6.png")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
