import { describe, it, expect } from 'vitest'
import { findJournalFields, applyReplacements } from '../src/bib-parser'

describe('findJournalFields', () => {
  it('extracts a single journal field with brace quoting', () => {
    const bib = `@article{key,
  journal = {Nature},
}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('journal')
    expect(fields[0].value).toBe('Nature')
    expect(fields[0].quoteChar).toBe('{')
  })

  it('extracts a journal field with double-quote quoting', () => {
    const bib = `@article{key,
  journal = "Journal of Chemistry",
}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(1)
    expect(fields[0].value).toBe('Journal of Chemistry')
    expect(fields[0].quoteChar).toBe('"')
  })

  it('extracts booktitle fields', () => {
    const bib = `@inproceedings{key,
  booktitle = {Advances in Materials},
}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(1)
    expect(fields[0].name).toBe('booktitle')
    expect(fields[0].value).toBe('Advances in Materials')
  })

  it('extracts multiple journal fields from multiple entries', () => {
    const bib = `@article{a, journal = {Nature}, year = {2020}}
@article{b, journal = {Science}, year = {2021}}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(2)
    expect(fields[0].value).toBe('Nature')
    expect(fields[1].value).toBe('Science')
  })

  it('does not capture journal fields nested inside titles', () => {
    const bib = `@article{key,
  title = {Study of journal = {Nature} stuff},
  journal = {Acta Crystallographica},
}`
    const fields = findJournalFields(bib)
    // Should only find the top-level journal field
    const journalFields = fields.filter((f) => f.name === 'journal')
    expect(journalFields).toHaveLength(1)
    expect(journalFields[0].value).toBe('Acta Crystallographica')
  })

  it('handles journal names with nested braces (LaTeX commands)', () => {
    const bib = `@article{key,
  journal = {Journal of {RNA} Research},
}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(1)
    expect(fields[0].value).toBe('Journal of {RNA} Research')
  })

  it('returns empty array for bib with no journal or booktitle', () => {
    const bib = `@article{key, title = {Something}, author = {Someone}}`
    expect(findJournalFields(bib)).toHaveLength(0)
  })

  it('records correct start/end indices into the original string', () => {
    const bib = `@article{key, journal = {Nature}, year = {2020}}`
    const fields = findJournalFields(bib)
    expect(fields).toHaveLength(1)
    const f = fields[0]
    expect(bib.substring(f.start, f.end)).toBe('Nature')
  })
})

describe('applyReplacements', () => {
  it('replaces a single journal name', () => {
    const bib = `@article{key, journal = {Nature}, year = {2020}}`
    const fields = findJournalFields(bib)
    const result = applyReplacements(bib, [{ match: fields[0], newValue: 'Nature (abbreviated)' }])
    expect(result).toContain('Nature (abbreviated)')
    expect(result).not.toContain('journal = {Nature}')
  })

  it('applies multiple replacements correctly (back-to-front)', () => {
    const bib = `@article{a, journal = {Nature}, year = {2020}}
@article{b, journal = {Science}, year = {2021}}`
    const fields = findJournalFields(bib)
    const replacements = fields.map((f, i) => ({
      match: f,
      newValue: `Abbr${i}`,
    }))
    const result = applyReplacements(bib, replacements)
    expect(result).toContain('Abbr0')
    expect(result).toContain('Abbr1')
    expect(result).not.toContain('Nature')
    expect(result).not.toContain('Science')
  })

  it('returns original string when replacements list is empty', () => {
    const bib = `@article{key, journal = {Nature}}`
    expect(applyReplacements(bib, [])).toBe(bib)
  })
})
