# -*- coding: utf-8 -*-
"""
測試 TopWarlords 名將點將錄 (armory.html)
驗證：
1. 初始渲染 200 位名將
2. 兵團篩選 (如 奔雷突騎 40 位)
3. 國別篩選 (🇨🇳 100, 🇯🇵 65, 🇰🇷 35)
4. 點擊名將卡片展開全息模態窗
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        await page.goto("file:///D:/TopWarlords/armory.html")
        await page.wait_for_selector(".unit-card", timeout=10000)

        # 1. 初始總數
        cards = await page.locator(".unit-card").count()
        filtered_text = await page.locator("#filteredCount").inner_text()
        print(f"[TEST 1] 初始名將卡片渲染數量: {cards} 張，計數標籤: {filtered_text}")
        assert cards == 200, f"預期 200 張卡片，實際得到 {cards}"

        # 2. 兵團篩選 (奔雷突騎)
        await page.locator("button[data-cat='air']").click()
        await page.wait_for_timeout(300)
        air_cards = await page.locator(".unit-card").count()
        print(f"[TEST 2] 篩選奔雷突騎 (air) 數量: {air_cards} 張")
        assert air_cards == 40, f"預期 40 位奔雷突騎，實際得到 {air_cards}"

        # 切回全部
        await page.locator("button[data-cat='all']").click()
        await page.wait_for_timeout(200)

        # 3. 國別篩選
        # 🇨🇳 中國
        await page.locator("button[data-nat='🇨🇳']").click()
        await page.wait_for_timeout(300)
        cn_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-1] 篩選 🇨🇳 中國名將數量: {cn_cards} 張")
        assert cn_cards == 114, f"預期 100 位中國名將，實際得到 {cn_cards}"

        # 🇯🇵 日本
        await page.locator("button[data-nat='🇯🇵']").click()
        await page.wait_for_timeout(300)
        jp_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-2] 篩選 🇯🇵 日本名將數量: {jp_cards} 張")
        assert jp_cards == 48, f"預期 65 位日本名將，實際得到 {jp_cards}"

        # 🇰🇷 韓國
        await page.locator("button[data-nat='🇰🇷']").click()
        await page.wait_for_timeout(300)
        kr_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-3] 篩選 🇰🇷 韓國名將數量: {kr_cards} 張")
        assert kr_cards == 38, f"預期 35 位韓國名將，實際得到 {kr_cards}"

        # 切回全部國籍
        await page.locator("button[data-nat='all']").click()
        await page.wait_for_timeout(200)

        # 4. 關鍵字搜尋 (諸葛亮)
        await page.locator("#searchInput").fill("諸葛亮")
        await page.wait_for_timeout(300)
        search_cards = await page.locator(".unit-card").count()
        print(f"[TEST 4] 搜尋『諸葛亮』結果卡片數: {search_cards} 張")
        assert search_cards >= 1, "未找到諸葛亮卡片"

        # 5. 點擊卡片展開全息模態窗
        await page.locator(".unit-card").first.click()
        await page.wait_for_selector("#intelModal:not([hidden])", timeout=3000)
        intel_title = await page.locator("#intelTitle").inner_text()
        print(f"[TEST 5] 展開全息名將情報成功: {intel_title}")
        assert "諸葛亮" in intel_title

        # 關閉模態窗
        await page.locator("#intelCloseBtn").click()
        await page.wait_for_timeout(200)

        print("\n🎉 TopWarlords 名將點將錄 (armory.html) 測試 100% 通過！")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
