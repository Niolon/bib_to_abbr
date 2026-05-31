import { describe, it, expect } from 'vitest'
import { formatAbbreviation } from '../src/abbreviation-engine'

describe('formatAbbreviation – wos style', () => {
  it('uppercases the input as-is', () => {
    expect(formatAbbreviation('J Appl Crystallogr', 'wos')).toBe('J APPL CRYSTALLOGR')
    expect(formatAbbreviation('nature', 'wos')).toBe('NATURE')
  })
})

describe('formatAbbreviation – iso style', () => {
  it('adds dots to abbreviated words', () => {
    const result = formatAbbreviation(
      'J APPL CRYSTALLOGR',
      'iso',
      'Journal of Applied Crystallography',
    )
    expect(result).toBe('J. Appl. Cryst.')
  })

  it('omits dot from section suffix letter (Acta Cryst. A)', () => {
    const result = formatAbbreviation(
      'ACTA CRYSTALL A-CRYS',
      'iso',
      'Acta Crystallographica Section A-Crystal Physics Diffraction Theoretical and General Crystallography',
    )
    expect(result).toBe('Acta Cryst. A')
  })

  it('omits dot from complete words', () => {
    expect(formatAbbreviation('Science', 'iso', 'Science')).toBe('Science')
    expect(formatAbbreviation('Nature', 'iso', 'Nature')).toBe('Nature')
  })

  it('preserves caseOverride for CrystEngComm', () => {
    expect(formatAbbreviation('CRYSTENGCOMM', 'iso')).toBe('CrystEngComm')
    expect(formatAbbreviation('CrystEngComm', 'iso')).toBe('CrystEngComm')
  })

  it('preserves caseOverride for ChemPhysChem (no dot since not a no-dot word)', () => {
    // ChemPhysChem has a caseOverride but is not in the noDot list, so it gets a dot
    expect(formatAbbreviation('CHEMPHYSCHEM', 'iso')).toBe('ChemPhysChem.')
  })

  it('does not add dot to words in the no-dot list (OF, AND, THE, etc.)', () => {
    // "OF" is in the noDot list, so no dot is added; it title-cases to "Of"
    const result = formatAbbreviation('J OF CHEM', 'iso', 'Journal of Chemistry')
    expect(result).toContain('Of')
    expect(result).not.toMatch(/Of\./)
  })
})

describe('formatAbbreviation – title-dotless style', () => {
  it('title-cases without dots', () => {
    const result = formatAbbreviation(
      'J APPL CRYSTALLOGR',
      'title-dotless',
      'Journal of Applied Crystallography',
    )
    expect(result).toBe('J Appl Cryst')
  })

  it('preserves caseOverride', () => {
    expect(formatAbbreviation('CRYSTENGCOMM', 'title-dotless')).toBe('CrystEngComm')
  })
})
