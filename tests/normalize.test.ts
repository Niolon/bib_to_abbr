import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeString,
  addCustomRule,
  deleteCustomRule,
  getCustomRules,
  clearCustomRules,
} from '../src/abbreviation-engine'

describe('normalizeString', () => {
  it('converts to uppercase', () => {
    expect(normalizeString('journal of chemistry')).toBe('JOURNAL OF CHEMISTRY')
  })

  it('replaces punctuation with spaces and collapses them', () => {
    expect(normalizeString('J. Appl. Cryst.')).toBe('J APPL CRYST')
    expect(normalizeString('J.Appl.Cryst.')).toBe('J APPL CRYST')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeString('JOURNAL  OF   CHEMISTRY')).toBe('JOURNAL OF CHEMISTRY')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeString('  Nature  ')).toBe('NATURE')
  })

  it('handles dashes and underscores', () => {
    expect(normalizeString('Acta Cryst-A')).toBe('ACTA CRYST A')
    expect(normalizeString('some_journal')).toBe('SOME JOURNAL')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeString('')).toBe('')
  })
})

describe('custom rules', () => {
  beforeEach(() => {
    clearCustomRules()
  })

  it('adds and retrieves a custom rule', () => {
    addCustomRule('My Fake Journal', 'MFJ')
    const rules = getCustomRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].originalKey).toBe('My Fake Journal')
    expect(rules[0].abbreviation).toBe('MFJ')
  })

  it('normalizes the key so lookup is case-insensitive', () => {
    addCustomRule('My Fake Journal', 'MFJ')
    // Adding same journal with different case should overwrite (same normalized key)
    addCustomRule('my fake journal', 'MFJ2')
    const rules = getCustomRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].abbreviation).toBe('MFJ2')
  })

  it('deletes a custom rule', () => {
    addCustomRule('My Fake Journal', 'MFJ')
    deleteCustomRule('My Fake Journal')
    expect(getCustomRules()).toHaveLength(0)
  })

  it('clears all custom rules', () => {
    addCustomRule('Journal A', 'JA')
    addCustomRule('Journal B', 'JB')
    clearCustomRules()
    expect(getCustomRules()).toHaveLength(0)
  })

  it('trims whitespace from abbreviation', () => {
    addCustomRule('Journal A', '  JA  ')
    expect(getCustomRules()[0].abbreviation).toBe('JA')
  })
})
