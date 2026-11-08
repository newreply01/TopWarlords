# -*- coding: utf-8 -*-
"""
更新 app.js 與 style.css，實裝光榮《三國志》風格的名將頭像框 (Avatar Window)
"""
from pathlib import Path

# 1. 更新 app.js 中的 m-card 模板
p_app = Path("D:/TopWarlords/js/app.js")
text_app = p_app.read_text(encoding="utf-8")

old_template = """      return `<div class="m-card ${isEquipped ? 'sel' : ''} ${showWhy ? 'dis' : ''} ${isBanned ? 'banned' : ''}"
                   style="--c:${c}" data-id="${u.id}" data-cat="${cat}" data-cost="${u.cost}">
        ${u.img ? `<img class="m-card-photo" src="${u.img}" width="640" height="360" loading="lazy" decoding="async" alt="${esc(u.name)}" onerror="this.style.display='none'" />` : ''}
        <div class="m-top">
          <span class="m-cost">$${u.cost}</span>
          <div class="m-name-group">
            <div class="m-name" title="${esc(u.name)}"><span class="m-flag" style="margin-right:2px">${u.flag || ''}</span> ${esc(u.name)}</div>
            <div class="m-tag">${esc(u.tag)}</div>
          </div>
          <div class="m-actions">
            <button class="m-info-btn" data-info-id="${u.id}" title="查看裝備詳細情報">ℹ</button>
          </div>
        </div>"""

new_template = """      return `<div class="m-card ${isEquipped ? 'sel' : ''} ${showWhy ? 'dis' : ''} ${isBanned ? 'banned' : ''}"
                   style="--c:${c}" data-id="${u.id}" data-cat="${cat}" data-cost="${u.cost}">
        <div class="m-card-main-row">
          <div class="m-avatar-wrap">
            <img class="m-avatar-img" src="${u.img || ''}" width="48" height="48" loading="lazy" decoding="async" alt="${esc(u.name)}" onerror="this.style.display='none'" />
            <span class="m-avatar-cost">$${u.cost}</span>
          </div>
          <div class="m-card-info-col">
            <div class="m-top">
              <div class="m-name-group">
                <div class="m-name" title="${esc(u.name)}"><span class="m-flag" style="margin-right:2px">${u.flag || ''}</span> ${esc(u.name)}</div>
                <div class="m-tag">${esc(u.tag)}</div>
              </div>
              <div class="m-actions">
                <button class="m-info-btn" data-info-id="${u.id}" title="查看名將傳記與實戰數值">ℹ</button>
              </div>
            </div>
            <div class="m-weapon-strip">⚔️ ${esc((u.weapon || '').split(' ')[0])}</div>
          </div>
        </div>"""

assert old_template in text_app, "old_template not found in app.js"
text_app = text_app.replace(old_template, new_template, 1)
p_app.write_text(text_app, encoding="utf-8")
print("Successfully updated app.js card template!")

# 2. 更新 style.css 中的樣式
p_css = Path("D:/TopWarlords/style.css")
text_css = p_css.read_text(encoding="utf-8")

# 移除舊的 .m-card-photo 衝突樣式
old_photo_block = """.m-card {
  position: relative;
  overflow: hidden;
}
.m-card-photo {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  object-position: center 32%;
  opacity: 0.24;
  mask-image: linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,1) 100%);
  -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,1) 100%);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  z-index: 0;
}
.m-card:hover .m-card-photo {
  opacity: 0.62;
  transform: scale(1.04);
}
.m-card.sel .m-card-photo {
  opacity: 0.35 !important;
}
[data-theme="light"] .m-card-photo {
  opacity: 0.38;
  mask-image: linear-gradient(90deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,1) 100%);
  -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,1) 100%);
}
[data-theme="light"] .m-card:hover .m-card-photo {
  opacity: 0.68;
}
[data-theme="light"] .m-card.sel .m-card-photo {
  opacity: 0.25 !important;
  filter: saturate(1.1) contrast(1.05);
}"""

new_avatar_block = """/* ---------- 三國志風格名將肖像框與立體卡片結構 ---------- */
.m-card {
  position: relative;
  overflow: hidden;
  padding: 6px 8px !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
}
.m-card-main-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.m-avatar-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 8px;
  overflow: hidden;
  border: 1.5px solid var(--c);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  background: #0f172a;
}
.m-avatar-img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: 70% 30% !important; /* 精準聚焦在名將頭像與題名 */
  display: block;
}
.m-avatar-cost {
  position: absolute;
  bottom: 0;
  right: 0;
  font-family: var(--head);
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: rgba(15, 23, 42, 0.9);
  padding: 0 4px;
  border-top-left-radius: 4px;
  line-height: 13px;
  border-left: 1px solid var(--c);
  border-top: 1px solid var(--c);
}
.m-card-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.m-weapon-strip {
  font-size: 10px;
  color: var(--amber);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.m-card:hover .m-avatar-wrap {
  transform: scale(1.08);
  box-shadow: 0 0 12px var(--c);
  transition: all .2s ease;
}
.m-card.sel .m-avatar-wrap {
  border-color: #22d3ee !important;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6) !important;
}"""

assert old_photo_block in text_css, "old_photo_block not found in style.css"
text_css = text_css.replace(old_photo_block, new_avatar_block, 1)
p_css.write_text(text_css, encoding="utf-8")
print("Successfully updated style.css for avatar window!")

