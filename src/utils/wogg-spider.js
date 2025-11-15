// src/utils/wogg-spider.js (严格翻译版)

import { universalFetch } from './api.js';


// ---------------------------------------------------------------------------
// 基础配置和工具函数 (与之前版本相同)
// ---------------------------------------------------------------------------

const siteUrl = "https://www.wogg.one";

async function fetchHtml(url, options = {}) {
  // ... (这部分代码保持不变)
  try {
    const response = await universalFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers,
      },
      timeout: 15000,
    });
    if (!response.ok) throw new Error(`请求失败，状态码: ${response.status}`);
    return response.text();
  } catch (error) {
    console.error(`Fetch a ${url} 失败:`, error);
    throw error;
  }
}

function completeUrl(baseUrl, relativeUrl) {
  if (!relativeUrl || relativeUrl.startsWith('http')) return relativeUrl;
  return new URL(relativeUrl, baseUrl).href;
}

// ---------------------------------------------------------------------------
// Wogg 爬虫实现 (严格翻译)
// ---------------------------------------------------------------------------

/**
 * 搜索功能 (与之前版本相同)
 */
export async function searchContent(keyword, pg = '1') {
  // ... (这部分代码保持不变，因为不涉及 super 调用)
  const searchURL = `${siteUrl}/index.php/vodsearch/${encodeURIComponent(keyword)}----------${pg}---.html`;
  // const searchURL = `${siteUrl}`;
  const html = await fetchHtml(searchURL);
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = doc.querySelectorAll(".module-search-item");
  const vodList = [];

  items.forEach(item => {
    const vodId = item.querySelector(".video-serial")?.getAttribute('href') || '';
    const name = item.querySelector(".video-serial")?.getAttribute('title') || '';
    let pic = item.querySelector(".module-item-pic > img")?.getAttribute('data-src') || '';
    const remark = item.querySelector(".video-tag-icon")?.textContent.trim() || '';
    
    pic = completeUrl(siteUrl, pic);

    if (vodId && name) {
      vodList.push({
        vod_id: vodId,
        vod_name: name,
        vod_pic: pic,
        vod_remarks: remark,
      });
    }
  });

  return { list: vodList };
}


/**
 * 详情页功能 (严格翻译版)
 */
export async function detailContent(ids) {
  const vodId = ids[0];
  if (!vodId) throw new Error("无效的视频 ID");

  const detailUrl = completeUrl(siteUrl, vodId);
  const html = await fetchHtml(detailUrl);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const vod = {
    vod_id: vodId,
    vod_name: doc.querySelector(".video-info-header > .page-title")?.textContent.trim() || '',
    vod_pic: doc.querySelector(".module-item-pic img")?.getAttribute('data-src') || '',
    vod_area: doc.querySelector(".video-info-header a.tag-link:last-child")?.textContent.trim() || '',
    type_name: Array.from(doc.querySelectorAll(".video-info-header div.tag-link a")).map(a => a.textContent.trim()).join(','),
  };

  // 1. 精确地从 HTML 中提取分享链接
  const shareLinks = Array.from(doc.querySelectorAll(".module-row-text"))
    .map(el => el.getAttribute('data-clipboard-text')?.trim())
    .filter(Boolean); // 过滤掉空值

  // 2. 调用 Cloud 对象的模拟方法，保留原始逻辑
  vod.vod_play_url = shareLinks;
  // vod.vod_play_url = await Cloud.detailContentVodPlayUrl(shareLinks);
  // vod.vod_play_from = Cloud.detailContentVodPlayFrom(shareLinks);

  // 3. 解析其他详细信息 (与之前相同)
  const infoItems = doc.querySelectorAll(".video-info-item");
  infoItems.forEach(item => {
    const title = item.previousElementSibling?.textContent || '';
    if (title.includes("导演")) {
      vod.vod_director = Array.from(item.querySelectorAll("a")).map(a => a.textContent.trim()).join(',');
    } else if (title.includes("主演")) {
      vod.vod_actor = Array.from(item.querySelectorAll("a")).map(a => a.textContent.trim()).join(',');
    } else if (title.includes("年代")) {
      vod.vod_year = item.querySelector("a")?.textContent.trim() || '';
    } else if (title.includes("备注")) {
      vod.vod_remarks = item.textContent.trim();
    } else if (title.includes("剧情")) {
      vod.vod_content = item.querySelector(".sqjj_a")?.textContent.replace("[收起部分]", "").trim() || '';
    }
  });

  return { list: [vod] };
}