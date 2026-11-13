# -*- coding: utf-8 -*-
"""
測試 TopWarlords 名將點將錄 (armory.html)
驗證：
1. 初始渲染 125 位名將
2. 五大兵團分類篩選 (各 25 位)
3. 國別篩選 (🇨🇳 78, 🇯🇵 36, 🇰🇷 11)
4. 點擊名將卡片展開全息模態窗
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        await page.goto((ROOT / "armory.html").as_uri())
        await page.wait_for_selector(".unit-card", timeout=10000)

        # 1. 初始總數
        cards = await page.locator(".unit-card").count()
        filtered_text = await page.locator("#filteredCount").inner_text()
        print(f"[TEST 1] 初始名將卡片渲染數量: {cards} 張，計數標籤: {filtered_text}")
        assert cards == 125, f"預期 125 張卡片，實際得到 {cards}"

        image_refs = await page.evaluate("""() => UNITS.map(({ id, img }) => ({ id, img }))""")
        empty_images = [unit["id"] for unit in image_refs if not unit["img"]]
        broken_images = [
            unit["id"]
            for unit in image_refs
            if unit["img"] and not (ROOT / unit["img"].split("?")[0]).is_file()
        ]
        print(f"[TEST 1-1] 空白肖像待補: {empty_images}")
        assert empty_images == [], f"仍有名將缺少肖像: {empty_images}"
        assert not broken_images, f"肖像檔案不存在: {broken_images}"

        # 2. 兵團篩選 (奔雷突騎)
        await page.locator("button[data-cat='air']").click()
        await page.wait_for_timeout(300)
        air_cards = await page.locator(".unit-card").count()
        print(f"[TEST 2] 篩選奔雷突騎 (air) 數量: {air_cards} 張")
        assert air_cards == 25, f"預期 25 位奔雷突騎，實際得到 {air_cards}"

        # 切回全部
        await page.locator("button[data-cat='all']").click()
        await page.wait_for_timeout(200)
        for cat in ["armor", "air_defense", "naval", "support"]:
            await page.locator(f"button[data-cat='{cat}']").click()
            await page.wait_for_timeout(200)
            assert await page.locator(".unit-card").count() == 25, f"{cat} 不為 25 位"
        await page.locator("button[data-cat='all']").click()
        await page.wait_for_timeout(200)

        # 3. 國別篩選
        # 🇨🇳 中國
        await page.locator("button[data-nat='🇨🇳']").click()
        await page.wait_for_timeout(300)
        cn_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-1] 篩選 🇨🇳 中國名將數量: {cn_cards} 張")
        assert cn_cards == 77, f"預期 77 位中國名將，實際得到 {cn_cards}"

        # 🇯🇵 日本
        await page.locator("button[data-nat='🇯🇵']").click()
        await page.wait_for_timeout(300)
        jp_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-2] 篩選 🇯🇵 日本名將數量: {jp_cards} 張")
        assert jp_cards == 37, f"預期 37 位日本名將，實際得到 {jp_cards}"

        # 🇰🇷 韓國
        await page.locator("button[data-nat='🇰🇷']").click()
        await page.wait_for_timeout(300)
        kr_cards = await page.locator(".unit-card").count()
        print(f"[TEST 3-3] 篩選 🇰🇷 韓國名將數量: {kr_cards} 張")
        assert kr_cards == 11, f"預期 11 位韓國名將，實際得到 {kr_cards}"

        # 切回全部國籍
        await page.locator("button[data-nat='all']").click()
        await page.wait_for_timeout(200)

        for unit_id, name in [
            ("TOYOTOMI", "豐臣秀吉"),
            ("HOJO_UJIYASU", "北條氏康"),
            ("SHIMAZU_YOSHIHISA", "島津義久"),
            ("CAOCAO", "曹操"),
            ("XIAHOU_DUN", "夏侯惇"),
            ("SUNCE", "孫策"),
            ("SUNJIAN", "孫堅"),
            ("YAMAMOTO", "山本勘助"),
            ("JIAXU", "賈詡"),
            ("LIUBOWEN", "劉伯溫"),
        ]:
            await page.locator("#searchInput").fill(name)
            await page.wait_for_timeout(200)
            assert await page.locator(f".unit-card[data-unit-id='{unit_id}']").count() == 1, f"未找到新增名將：{name}"

        for unit_id, name in (
            ("SUNCE", "孫策"),
            ("SUNJIAN", "孫堅"),
            ("YAMAMOTO", "山本勘助"),
            ("HOJO_UJIYASU", "北條氏康"),
            ("SHIMAZU_YOSHIHISA", "島津義久"),
            ("XIAHOU_DUN", "夏侯惇"),
            ("CAOCAO", "曹操"),
            ("JIAXU", "賈詡"),
        ):
            await page.locator("#searchInput").fill(name)
            await page.wait_for_timeout(200)
            image = page.locator(f".unit-card[data-unit-id='{unit_id}'] img.card-img")
            await image.evaluate("(img) => { img.loading = 'eager'; }")
            await image.evaluate("(img) => img.decode()")
            assert await image.evaluate("(img) => img.naturalWidth > 0"), f"{unit_id} 立繪載入失敗"

        roster_categories = await page.evaluate("""() => ({
            SUNCE: UNIT_MAP.SUNCE?.cat,
            SUNJIAN: UNIT_MAP.SUNJIAN?.cat,
            LIUBOWEN: UNIT_MAP.LIUBOWEN?.cat,
            ZHOUYU: UNIT_MAP.ZHOUYU?.cat,
            YAMAMOTO: UNIT_MAP.YAMAMOTO?.cat,
            TIANDAN: UNIT_MAP.TIANDAN?.cat
        })""")
        assert roster_categories == {
            "SUNCE": "air",
            "SUNJIAN": "armor",
            "LIUBOWEN": "support",
            "ZHOUYU": "support",
            "YAMAMOTO": "support",
            "TIANDAN": "naval",
        }, f"名將錄分類未與最新名單同步：{roster_categories}"

        # 4. 關鍵字搜尋 (諸葛亮)
        await page.locator("#searchInput").fill("諸葛亮")
        await page.wait_for_timeout(300)
        search_cards = await page.locator(".unit-card").count()
        print(f"[TEST 4] 搜尋『諸葛亮』結果卡片數: {search_cards} 張")
        assert search_cards >= 1, "未找到諸葛亮卡片"

        # 5. 點擊卡片展開全息模態窗
        await page.locator(".unit-card[data-unit-id='ZHUGELIANG']").click()
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
