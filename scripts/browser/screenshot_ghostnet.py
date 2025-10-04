#!/usr/bin/env python3
"""Playwright helper to capture GhostNet screenshots after the workspace is ready."""

import argparse
import asyncio
from pathlib import Path
from typing import Dict

from playwright.async_api import async_playwright

DEFAULT_URL = "http://127.0.0.1:4100/ghostnet.html"
DEFAULT_VIEWPORT: Dict[str, int] = {"width": 1280, "height": 720}
DEFAULT_OUTPUT = "artifacts/ghostnet.png"


async def capture(url: str, output_path: str, viewport: Dict[str, int]) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size(viewport)
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_selector(".layout__main", state="attached")
        await page.wait_for_function(
            """
            selector => {
              const element = document.querySelector(selector);
              if (!element) { return false; }
              return window.getComputedStyle(element).opacity === '1';
            }
            """,
            arg=".layout__main",
            timeout=15000,
        )
        await page.wait_for_timeout(500)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=output_path, full_page=True)
        await browser.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"GhostNet URL to capture (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Path for the captured screenshot (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--viewport-width",
        type=int,
        default=DEFAULT_VIEWPORT["width"],
        help="Viewport width in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--viewport-height",
        type=int,
        default=DEFAULT_VIEWPORT["height"],
        help="Viewport height in pixels (default: %(default)s)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    viewport = {"width": args.viewport_width, "height": args.viewport_height}
    asyncio.run(capture(args.url, args.output, viewport))


if __name__ == "__main__":
    main()
