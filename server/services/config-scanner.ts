/**
 * 仓库配置文件扫描与解析。
 *
 * 从仓库根目录获取 .astro-editor.yml，解析并与默认值合并。
 * 使用 js-yaml 解析 YAML。
 */

import { load } from 'js-yaml'
import type { RepoConfig, FrontmatterField } from '../types.ts'
import { fetchFileContent } from './github.ts'

// ── Defaults ─────────────────────────────────────────────────────

const DEFAULT_FRONTMATTER_FIELDS: FrontmatterField[] = [
  { key: 'title', type: 'string', label: '标题', required: true },
  { key: 'published', type: 'date', label: '发布日期' },
  { key: 'tags', type: 'string[]', label: '标签' },
  { key: 'category', type: 'string', label: '分类' },
  { key: 'abbrlink', type: 'string', label: '永久链接标识' },
  { key: 'description', type: 'string', label: '摘要' },
  { key: 'cover', type: 'string', label: '封面图' },
  { key: 'draft', type: 'boolean', label: '草稿' },
]

const DEFAULT_CONFIG: RepoConfig = {
  postsDir: 'src/content/posts/',
  layout: 'folder',
  extensions: ['.md', '.mdx'],
  assetsMode: 'co-located',
  assetsPublicDir: 'public/images/blog',
  assetsNaming: '{slug}-{yyyy}{mm}{dd}-{rand6}',
  configFilePatterns: [
    '*.json',
    '*.yml',
    '*.yaml',
    '*.toml',
    'astro.config.*',
    '*.config.*',
    '.env.example',
  ],
  commitMessageTemplate: 'edit: {title}',
  frontmatterFields: DEFAULT_FRONTMATTER_FIELDS,
  frontmatterRequired: ['title'],
  frontmatterDefaults: { draft: false, tags: [], category: '' },
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Fetch and parse .astro-editor.yml from a repo root.
 * Returns merged config (user values override defaults).
 * Returns defaults if the file doesn't exist.
 */
export async function fetchRepoConfig(
  token: string,
  owner: string,
  name: string,
): Promise<RepoConfig> {
  const file = await fetchFileContent(
    token,
    owner,
    name,
    '.astro-editor.yml',
  )

  if (!file) return { ...DEFAULT_CONFIG }

  return parseConfig(file.content)
}

/**
 * Parse YAML config string and merge with defaults.
 * Exported for unit testing.
 */
export function parseConfig(yamlContent: string): RepoConfig {
  let userConfig: Record<string, unknown> = {}

  try {
    const parsed = load(yamlContent)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      userConfig = parsed as Record<string, unknown>
    }
  } catch {
    // Invalid YAML — fall through to defaults
  }

  return mergeConfig(DEFAULT_CONFIG, userConfig)
}

// ── Merge ────────────────────────────────────────────────────────

function mergeConfig(
  defaults: RepoConfig,
  overrides: Record<string, unknown>,
): RepoConfig {
  const repo = (overrides.repo || {}) as Record<string, unknown>
  const workflow = (overrides.workflow || {}) as Record<string, unknown>
  const frontmatter = (overrides.frontmatter || {}) as Record<string, unknown>

  return {
    postsDir: stringOrDefault(repo.postsDir, defaults.postsDir),
    layout: (repo.layout === 'flat' ? 'flat' : 'folder') as 'folder' | 'flat',
    extensions: arrayOrDefault(repo.extensions, defaults.extensions),
    assetsMode: (repo.assets && typeof repo.assets === 'object'
      ? (repo.assets as Record<string, unknown>).mode === 'public'
        ? 'public'
        : 'co-located'
      : defaults.assetsMode) as 'co-located' | 'public',
    assetsPublicDir: (repo.assets && typeof repo.assets === 'object'
      ? stringOrDefault(
        (repo.assets as Record<string, unknown>).publicDir,
        defaults.assetsPublicDir,
      )
      : defaults.assetsPublicDir),
    assetsNaming: (repo.assets && typeof repo.assets === 'object'
      ? stringOrDefault(
        (repo.assets as Record<string, unknown>).naming,
        defaults.assetsNaming,
      )
      : defaults.assetsNaming),
    configFilePatterns: arrayOrDefault(
      repo.configFilePatterns,
      defaults.configFilePatterns,
    ),
    commitMessageTemplate: stringOrDefault(
      workflow.commitMessageTemplate,
      defaults.commitMessageTemplate,
    ),
    frontmatterFields: parseFrontmatterFields(
      frontmatter.fields,
      defaults.frontmatterFields,
    ),
    frontmatterRequired: Array.isArray(frontmatter.required) &&
        frontmatter.required.every((v) => typeof v === 'string')
      ? frontmatter.required as string[]
      : defaults.frontmatterRequired,
    frontmatterDefaults: frontmatter.defaults &&
        typeof frontmatter.defaults === 'object' &&
        !Array.isArray(frontmatter.defaults)
      ? frontmatter.defaults as Record<string, unknown>
      : defaults.frontmatterDefaults,
  }
}

function parseFrontmatterFields(
  raw: unknown,
  defaults: FrontmatterField[],
): FrontmatterField[] {
  if (!Array.isArray(raw)) return defaults
  const fields: FrontmatterField[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const key = typeof obj.key === 'string' ? obj.key : ''
    const type = ['string', 'date', 'string[]', 'boolean', 'number'].includes(
      obj.type as string,
    )
      ? (obj.type as FrontmatterField['type'])
      : 'string'
    const label = typeof obj.label === 'string' ? obj.label : key
    if (!key) continue
    fields.push({
      key,
      type,
      label,
      required: obj.required === true ? true : undefined,
      default: obj.default,
    })
  }
  return fields.length > 0 ? fields : defaults
}

// ── Helpers ──────────────────────────────────────────────────────

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function arrayOrDefault(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? value
    : fallback
}
