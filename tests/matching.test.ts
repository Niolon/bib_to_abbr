import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  loadDatabase,
  setDatabaseSource,
  findAbbreviation,
  findAbbreviationCandidates,
  addCustomRule,
  clearCustomRules,
} from '../src/abbreviation-engine'

beforeAll(async () => {
  await loadDatabase('ncbi', './ncbi-abbreviations.json')
  await loadDatabase('iso', './iso-abbreviations.json')
})

afterEach(() => {
  clearCustomRules()
  setDatabaseSource('ncbi')
})

describe('findAbbreviation – NCBI source', () => {
  it('finds an exact match', () => {
    setDatabaseSource('ncbi')
    const result = findAbbreviation(
      '1199 news. National Union of Hospital and Health Care Employees. District 1199',
      'normal',
    )
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toBe('1199 News')
  })

  it('returns matchType none for a journal not in the database', () => {
    setDatabaseSource('ncbi')
    const result = findAbbreviation('Totally Made Up Journal Of Nonsense XYZZY', 'normal')
    expect(result.matchType).toBe('none')
  })
})

describe('findAbbreviation – ISO source', () => {
  it('finds Journal of Applied Crystallography', () => {
    setDatabaseSource('iso')
    const result = findAbbreviation('Journal of Applied Crystallography', 'normal')
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toBe('J Appl Crystallogr')
  })
})

describe('findAbbreviation – iso-ncbi fallback source', () => {
  it('resolves ISO-first match in iso-ncbi mode', () => {
    setDatabaseSource('iso-ncbi')
    const result = findAbbreviation('Journal of Applied Crystallography', 'normal')
    expect(result.abbreviation).toBe('J Appl Crystallogr')
  })

  it('falls back to NCBI for journals not in ISO', () => {
    setDatabaseSource('iso-ncbi')
    const result = findAbbreviation(
      '1199 news. National Union of Hospital and Health Care Employees. District 1199',
      'normal',
    )
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toBe('1199 News')
  })
})

describe('custom rules take priority', () => {
  it('returns custom rule match before database', () => {
    setDatabaseSource('iso')
    addCustomRule('Journal of Applied Crystallography', 'MY CUSTOM ABBR')
    const result = findAbbreviation('Journal of Applied Crystallography', 'normal')
    expect(result.matchType).toBe('custom')
    expect(result.abbreviation).toBe('MY CUSTOM ABBR')
    expect(result.confidence).toBe(1.0)
  })
})

describe('findAbbreviationCandidates', () => {
  it('returns candidates sorted by confidence descending', () => {
    setDatabaseSource('iso')
    const candidates = findAbbreviationCandidates('Journal of Applied Crystallography', 'normal')
    expect(candidates.length).toBeGreaterThan(0)
    for (let i = 0; i < candidates.length - 1; i++) {
      expect(candidates[i].confidence ?? 0).toBeGreaterThanOrEqual(
        candidates[i + 1].confidence ?? 0,
      )
    }
  })

  it('returns an abbreviated match when input looks like an abbreviation', () => {
    setDatabaseSource('iso')
    const candidates = findAbbreviationCandidates('J Appl Crystallogr', 'normal')
    const abbreviated = candidates.find((c) => c.matchType === 'abbreviated')
    expect(abbreviated).toBeDefined()
  })

  it('returns fuzzy matches under fuzzy strictness', () => {
    setDatabaseSource('iso')
    // Slightly misspelled version
    const candidates = findAbbreviationCandidates('Journal of Aplied Crystalography', 'fuzzy')
    expect(candidates.length).toBeGreaterThan(0)
    const hasFuzzy = candidates.some((c) => c.matchType === 'fuzzy')
    expect(hasFuzzy).toBe(true)
  })

  it('returns no results in strict mode for a fuzzy-only match', () => {
    setDatabaseSource('iso')
    const candidates = findAbbreviationCandidates('Journal of Aplied Crystalography', 'strict')
    // Strict mode should not return fuzzy matches
    const noFuzzy = candidates.every((c) => c.matchType !== 'fuzzy')
    expect(noFuzzy).toBe(true)
  })
})

describe('Acta Cryst short-form aliases', () => {
  it.each(['A', 'B', 'C', 'D', 'E', 'F'])('resolves "Acta Cryst. %s" in ISO mode', (section) => {
    setDatabaseSource('iso')
    const result = findAbbreviation(`Acta Cryst. ${section}`, 'normal')
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toMatch(new RegExp(`Acta Crystallogr.*${section}`, 'i'))
  })

  it.each(['A', 'B', 'C', 'D', 'E', 'F'])('resolves "Acta Cryst. %s" in NCBI mode', (section) => {
    setDatabaseSource('ncbi')
    const result = findAbbreviation(`Acta Cryst. ${section}`, 'normal')
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toMatch(new RegExp(`Acta Crystallogr.*${section}`, 'i'))
  })

  it('resolves "Acta Crystallogr. A" as an alias', () => {
    setDatabaseSource('iso')
    const result = findAbbreviation('Acta Crystallogr. A', 'normal')
    expect(result.matchType).not.toBe('none')
    expect(result.abbreviation).toMatch(/Acta Crystallogr.*A/i)
  })
})
