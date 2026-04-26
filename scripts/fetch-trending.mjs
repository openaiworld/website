#!/usr/bin/env node

// fetch-trending.mjs
// 采集 GitHub Trending AI 项目 + AI 资讯
// 输出 JSON 到 src/data/ 供 Astro 构建时读取
//
// 用法：
//   node scripts/fetch-trending.mjs              # 采集全部
//   node scripts/fetch-trending.mjs --trending   # 仅 GitHub Trending
//   node scripts/fetch-trending.mjs --news       # 仅 AI 资讯

import { writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "src", "data")

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ── GitHub Trending ──

async function fetchGitHubTrending() {
  console.log("📡 采集 GitHub Trending (AI 相关)...")

  // 使用 GitHub Search API：过去 7 天内创建/更新的高星 AI 项目
  const topics = ["artificial-intelligence", "llm", "machine-learning", "deep-learning", "generative-ai"]
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const results = []

  for (const topic of topics) {
    try {
      const url = `https://api.github.com/search/repositories?q=topic:${topic}+pushed:>${since}&sort=stars&order=desc&per_page=5`
      const headers = { "Accept": "application/vnd.github.v3+json", "User-Agent": "OpenWorld-Bot" }
      if (process.env.GITHUB_TOKEN) headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`

      const res = await fetch(url, { headers })
      if (!res.ok) {
        console.warn(`  ⚠️  ${topic}: ${res.status} ${res.statusText}`)
        continue
      }

      const data = await res.json()
      for (const repo of (data.items || []).slice(0, 3)) {
        if (results.some(r => r.url === repo.html_url)) continue
        results.push({
          name: repo.full_name,
          description: repo.description || "",
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language || "Unknown",
          topic,
          pushed_at: repo.pushed_at?.slice(0, 10) || ""
        })
      }
      console.log(`  ✅ ${topic}: ${Math.min(3, data.items?.length || 0)} 个项目`)
    } catch (err) {
      console.warn(`  ⚠️  ${topic}: ${err.message}`)
    }
  }

  // 去重 + 按星数排序 + 取前 15
  results.sort((a, b) => b.stars - a.stars)
  const top = results.slice(0, 15)

  const output = {
    updated: new Date().toISOString(),
    count: top.length,
    items: top
  }

  writeFileSync(join(DATA_DIR, "trending.json"), JSON.stringify(output, null, 2))
  console.log(`  📁 保存: src/data/trending.json (${top.length} 个项目)\n`)
  return output
}

// ── AI 资讯（HuggingFace Daily Papers RSS） ──

async function fetchAINews() {
  console.log("📡 采集 AI 资讯...")

  const feeds = [
    { name: "HuggingFace Papers", url: "https://huggingface.co/papers/rss" },
  ]

  const items = []

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { headers: { "User-Agent": "OpenWorld-Bot" } })
      if (!res.ok) {
        console.warn(`  ⚠️  ${feed.name}: ${res.status}`)
        continue
      }

      const text = await res.text()
      // 简易 RSS 解析
      const entries = text.match(/<item>[\s\S]*?<\/item>/g) || text.match(/<entry>[\s\S]*?<\/entry>/g) || []

      for (const entry of entries.slice(0, 10)) {
        const titleMatch = entry.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)
        const linkMatch = entry.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) || entry.match(/<link[^>]*href="([^"]*)"/)
        const dateMatch = entry.match(/<pubDate>(.*?)<\/pubDate>/) || entry.match(/<updated>(.*?)<\/updated>/)

        if (titleMatch) {
          items.push({
            title: titleMatch[1].trim(),
            url: linkMatch ? linkMatch[1].trim() : "",
            date: dateMatch ? new Date(dateMatch[1]).toISOString().slice(0, 10) : "",
            source: feed.name
          })
        }
      }
      console.log(`  ✅ ${feed.name}: ${Math.min(10, entries.length)} 篇`)
    } catch (err) {
      console.warn(`  ⚠️  ${feed.name}: ${err.message}`)
    }
  }

  const output = {
    updated: new Date().toISOString(),
    count: items.length,
    items
  }

  writeFileSync(join(DATA_DIR, "news.json"), JSON.stringify(output, null, 2))
  console.log(`  📁 保存: src/data/news.json (${items.length} 篇)\n`)
  return output
}

// ── 主入口 ──

async function main() {
  const args = process.argv.slice(2)
  const trendingOnly = args.includes("--trending")
  const newsOnly = args.includes("--news")
  const all = !trendingOnly && !newsOnly

  console.log("🌐 OpenWorld 数据采集\n")

  if (all || trendingOnly) await fetchGitHubTrending()
  if (all || newsOnly) await fetchAINews()

  console.log("✅ 采集完成！网站重新构建后将展示最新数据。")
  console.log("   npm run build  # 重新构建网站")
}

main().catch(console.error)
