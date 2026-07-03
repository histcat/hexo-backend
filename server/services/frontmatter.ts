/**
 * Frontmatter 解析与序列化。
 *
 * 支持 hexo 风格的 YAML frontmatter：
 *   ---
 *   title: 标题
 *   tags: [a, b]
 *   ---
 *
 * 解析器会提取分隔符之间的 YAML 并保留
 * 所有未识别的字段（不丢失）。
 */

import { load, dump } from 'js-yaml'

// ── Types ────────────────────────────────────────────────────────

export interface ParsedPost {
  /** All frontmatter fields (parsed YAML object) */
  frontmatter: Record<string, unknown>
  /** Everything after the closing --- */
  content: string
}

// ── Parse ────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Extract and parse YAML frontmatter from raw Markdown content.
 * Returns the parsed frontmatter object and the body text.
 * If no frontmatter is found, returns an empty object and the original content.
 */
export function parseFrontmatter(raw: string): ParsedPost {
  const match = raw.match(FRONTMATTER_RE)

  if (!match) {
    return { frontmatter: {}, content: raw }
  }

  const yamlStr = match[1]
  const content = raw.slice(match[0].length)
  let frontmatter: Record<string, unknown> = {}

  try {
    const parsed = load(yamlStr)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>
    }
  } catch {
    // Invalid YAML — return empty frontmatter, keep original content
  }

  return { frontmatter, content }
}

// ── Serialize ────────────────────────────────────────────────────

/**
 * Serialize frontmatter + body back into a Markdown string with YAML header.
 * Preserves field order from the original frontmatter object.
 */
export function serializePost(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  const yaml = dump(frontmatter, {
    lineWidth: -1,        // Don't wrap long lines
  }).trim()

  return `---\n${yaml}\n---\n\n${content}`
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Extract a summary-friendly subset of frontmatter fields
 * for list views (avoids sending large extra fields).
 */
export function summarizeFrontmatter(
  fm: Record<string, unknown>,
): Record<string, unknown> {
  return {
    title: fm.title,
    published: fm.published,
    updated: fm.updated,
    tags: fm.tags,
    category: fm.category,
    abbrlink: fm.abbrlink,
    draft: fm.draft,
    description: fm.description,
    cover: fm.cover,
  }
}

/**
 * Try to extract a post title from frontmatter.
 * Falls back to the slug/filename if not present.
 */
export function extractTitle(fm: Record<string, unknown>, fallback: string): string {
  if (typeof fm.title === 'string' && fm.title.length > 0) return fm.title
  return fallback
}

/**
 * Extract tags as a string array.
 */
export function extractTags(fm: Record<string, unknown>): string[] {
  if (Array.isArray(fm.tags)) return fm.tags.filter((t) => typeof t === 'string')
  return []
}

/**
 * Extract category as a string (hexo uses single category).
 */
export function extractCategory(fm: Record<string, unknown>): string {
  if (typeof fm.category === 'string') return fm.category
  return ''
}

/**
 * Extract published date as ISO string or empty.
 */
export function extractPublished(fm: Record<string, unknown>): string {
  const d = fm.published ?? fm.date
  if (d instanceof Date) return d.toISOString()
  if (typeof d === 'string') return d
  return ''
}
