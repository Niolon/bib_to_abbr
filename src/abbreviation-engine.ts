export interface MatchResult {
  abbreviation: string
  matchType: 'exact' | 'normal' | 'fuzzy' | 'none' | 'custom' | 'abbreviated'
  originalKey?: string
  confidence?: number
}

interface DbEntry {
  originalKey: string
  abbreviation: string
  bigrams?: Set<string>
}

interface DatabaseState {
  originalDb: Record<string, string>
  normalizedDb: Map<string, DbEntry>
  abbreviationDb: Map<string, DbEntry>
  isLoaded: boolean
}

const databases: Record<'ncbi' | 'iso', DatabaseState> = {
  ncbi: { originalDb: {}, normalizedDb: new Map(), abbreviationDb: new Map(), isLoaded: false },
  iso: { originalDb: {}, normalizedDb: new Map(), abbreviationDb: new Map(), isLoaded: false },
}

let currentDbSource: 'ncbi' | 'iso' | 'iso-ncbi' = 'ncbi'

export function getDatabaseSource(): 'ncbi' | 'iso' | 'iso-ncbi' {
  return currentDbSource
}

export function setDatabaseSource(source: 'ncbi' | 'iso' | 'iso-ncbi') {
  currentDbSource = source
}

const customRules = new Map<string, { originalKey: string; abbreviation: string }>()

export function addCustomRule(journal: string, abbreviation: string): void {
  const normKey = normalizeString(journal)
  if (normKey) {
    customRules.set(normKey, {
      originalKey: journal.trim(),
      abbreviation: abbreviation.trim(),
    })
  }
}

export function deleteCustomRule(journal: string): void {
  const normKey = normalizeString(journal)
  customRules.delete(normKey)
}

export function getCustomRules(): { originalKey: string; abbreviation: string }[] {
  return Array.from(customRules.values())
}

export function clearCustomRules(): void {
  customRules.clear()
}

export function isDatabaseLoaded(source: 'ncbi' | 'iso' | 'iso-ncbi'): boolean {
  if (source === 'iso-ncbi') {
    return databases['iso'].isLoaded && databases['ncbi'].isLoaded
  }
  return databases[source].isLoaded
}

/**
 * Normalizes a string by converting to uppercase, replacing punctuation with spaces,
 * and collapsing whitespace.
 */
export function normalizeString(str: string): string {
  return str
    .toUpperCase()
    .replace(/[.,\-:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Helper to compute bigrams of a string for Dice coefficient comparison.
 */
function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>()
  const len = str.length
  for (let i = 0; i < len - 1; i++) {
    bigrams.add(str.substring(i, i + 2))
  }
  return bigrams
}

/**
 * Computes Sørensen-Dice coefficient between two sets of bigrams.
 */
function diceCoefficient(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++
    }
  }
  return (2 * intersection) / (setA.size + setB.size || 1)
}

/**
 * Loads a journal abbreviations database from public JSON asset.
 */
export async function loadDatabase(source: 'ncbi' | 'iso', url: string): Promise<void> {
  const dbState = databases[source]
  if (dbState.isLoaded) return
  const response = await fetch(url)
  const rawData: unknown = await response.json()

  let mappings: Record<string, string> = {}
  if (rawData && typeof rawData === 'object') {
    if (
      'default' in rawData &&
      rawData.default &&
      typeof rawData.default === 'object' &&
      'container-title' in rawData.default
    ) {
      mappings = rawData.default['container-title'] as Record<string, string>
    } else {
      mappings = rawData as Record<string, string>
    }
  }

  for (const [key, value] of Object.entries(mappings)) {
    const normKey = normalizeString(key)
    if (normKey) {
      // Normalize abbreviation to clean dotless format, preserving original casing
      const cleanAbbr = value.replace(/[.,:]/g, '').replace(/\s+/g, ' ').trim()

      dbState.originalDb[key.toUpperCase().trim()] = cleanAbbr
      dbState.normalizedDb.set(normKey, {
        originalKey: key,
        abbreviation: cleanAbbr,
      })
      const normAbbr = normalizeString(cleanAbbr)
      if (normAbbr) {
        dbState.abbreviationDb.set(normAbbr, {
          originalKey: key,
          abbreviation: cleanAbbr,
        })
      }
    }
  }
  dbState.isLoaded = true
}

const caseOverrides: Record<string, string> = {
  CRYSTENGCOMM: 'CrystEngComm',
  CHEMPHYSCHEM: 'ChemPhysChem',
  CHEMBIOCHEM: 'ChemBioChem',
}

/**
 * Formats an abbreviation string according to the requested style:
 * - 'wos': Keep uppercase, dotless (e.g. "J APPL CRYSTALLOGR")
 * - 'iso': Title Case, dots added to abbreviated words (e.g. "J. Appl. Crystallogr.")
 * - 'title-dotless': Title Case, dotless (e.g. "J Appl Crystallogr")
 */
export function formatAbbreviation(
  abbr: string,
  style: 'wos' | 'iso' | 'title-dotless',
  originalJournal?: string,
): string {
  if (style === 'wos') return abbr.toUpperCase()

  // Pre-process WoS annotations and specific crystallographic unifications
  const cleaned = abbr
    .replace(/\+/g, '') // Omit translation indicator "+"
    .replace(/\bCRYSTALLOGR\b/gi, 'CRYST')
    .replace(/\bCRYSTALL\b/gi, 'CRYST')
    .replace(/\bA-CRYS\b/gi, 'A')
    .replace(/\bB-STRU\b/gi, 'B')

  // Tokenize original words for alignment, ignoring punctuation
  let originalWords: string[] = []
  if (originalJournal) {
    originalWords = originalJournal.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0)
  }
  let origWordIndex = 0

  const parts = cleaned.split(/(\s+)/)
  const formattedParts = parts.map((part) => {
    if (/^\s+$/.test(part)) return part // Keep spacing

    const subparts = part.split('-')
    const formattedSubparts = subparts.map((sub) => {
      if (!sub) return ''

      const upperSub = sub.toUpperCase()
      const hasLowercase = /[a-z]/.test(sub)

      let titleCase: string
      if (caseOverrides[upperSub]) {
        titleCase = caseOverrides[upperSub]
      } else if (hasLowercase) {
        titleCase = sub
      } else {
        titleCase = sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase()
      }

      // Check if this word was shortened (abbreviated) compared to the original
      let isCompleteWord = false
      if (originalWords.length > 0) {
        const cleanSub = sub.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        for (let i = origWordIndex; i < originalWords.length; i++) {
          const cleanOrig = originalWords[i].replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
          if (cleanOrig.startsWith(cleanSub)) {
            origWordIndex = i + 1 // Advance alignment pointer
            if (cleanOrig === cleanSub) {
              isCompleteWord = true
            }
            break
          }
        }
      }

      if (style === 'iso') {
        const noDot = [
          'I',
          'II',
          'III',
          'IV',
          'V',
          'VI',
          'VII',
          'VIII',
          'IX',
          'X',
          'ACTA',
          'REVIEW',
          'REVIEWS',
          'LETTERS',
          'REPORTS',
          'PROGRESS',
          'COMMUNICATIONS',
          'CHRONICLE',
          'BULLETIN',
          'PROCEEDINGS',
          'TRANSACTIONS',
          'SECTION',
          'SERIES',
          'PART',
          'VOLUME',
          'AND',
          'OF',
          'THE',
          'FOR',
          'IN',
          'ON',
          'ET',
          'DE',
          'LA',
          'UND',
          'DER',
          'TO',
          'CRYSTENGCOMM',
        ]

        if (!noDot.includes(upperSub)) {
          if (!isCompleteWord) {
            titleCase += '.'
          }
        }
      }
      return titleCase
    })

    return formattedSubparts.join('-')
  })

  return formattedParts.join('')
}

/**
 * Searches the database for the given journal name and returns a list of matching
 * candidates sorted by confidence score descending.
 */
export function findAbbreviationCandidates(
  journal: string,
  strictness: 'strict' | 'normal' | 'fuzzy',
  threshold: number = 0.75,
): MatchResult[] {
  const normJournal = normalizeString(journal)
  if (customRules.has(normJournal)) {
    const custom = customRules.get(normJournal)!
    return [
      {
        abbreviation: custom.abbreviation,
        matchType: 'custom',
        originalKey: custom.originalKey,
        confidence: 1.0,
      },
    ]
  }

  if (currentDbSource === 'iso-ncbi') {
    // 1. Search ISO database first
    currentDbSource = 'iso'
    const isoResults = findAbbreviationCandidates(journal, strictness, threshold)
    currentDbSource = 'iso-ncbi' // Restore

    if (isoResults.length > 0 && isoResults[0].matchType !== 'none') {
      return isoResults
    }

    // 2. Fallback to NCBI database
    currentDbSource = 'ncbi'
    const ncbiResults = findAbbreviationCandidates(journal, strictness, threshold)
    currentDbSource = 'iso-ncbi' // Restore
    return ncbiResults
  }

  const upperJournal = journal.toUpperCase().trim()
  const results: MatchResult[] = []
  const activeDb = databases[currentDbSource]

  // 1. Exact Match (Case-insensitive)
  if (activeDb.originalDb[upperJournal]) {
    results.push({
      abbreviation: activeDb.originalDb[upperJournal],
      matchType: 'exact',
      originalKey: upperJournal,
      confidence: 1.0,
    })
  }

  // 1.5. Check if it matches an abbreviation directly (already abbreviated)
  const abbrEntry = activeDb.abbreviationDb.get(normJournal)
  if (abbrEntry && !results.some((r) => r.abbreviation === abbrEntry.abbreviation)) {
    results.push({
      abbreviation: abbrEntry.abbreviation,
      matchType: 'abbreviated',
      originalKey: abbrEntry.originalKey,
      confidence: 1.0,
    })
  }

  // Fallback check
  if (strictness === 'strict') {
    const entry = activeDb.normalizedDb.get(normJournal)
    if (entry && entry.originalKey.toUpperCase() === upperJournal) {
      if (!results.some((r) => r.abbreviation === entry.abbreviation)) {
        results.push({
          abbreviation: entry.abbreviation,
          matchType: 'exact',
          originalKey: entry.originalKey,
          confidence: 1.0,
        })
      }
    }
    if (results.length > 0) return results
    return [{ abbreviation: journal, matchType: 'none' }]
  }

  // 2. Normalized Match
  const normMatch = activeDb.normalizedDb.get(normJournal)
  if (normMatch) {
    if (!results.some((r) => r.abbreviation === normMatch.abbreviation)) {
      results.push({
        abbreviation: normMatch.abbreviation,
        matchType: 'normal',
        originalKey: normMatch.originalKey,
        confidence: 0.95,
      })
    }
  }

  if (strictness === 'normal') {
    if (results.length > 0) return results
    return [{ abbreviation: journal, matchType: 'none' }]
  }

  // 3. Fuzzy Match (Sørensen-Dice)
  const queryBigrams = getBigrams(normJournal)
  if (queryBigrams.size === 0) {
    if (results.length > 0) return results
    return [{ abbreviation: journal, matchType: 'none' }]
  }

  const fuzzyCandidates: { entry: DbEntry; score: number }[] = []

  for (const [normKey, entry] of activeDb.normalizedDb.entries()) {
    const lenDiff = Math.abs(normKey.length - normJournal.length)
    const maxLen = Math.max(normKey.length, normJournal.length)
    if (lenDiff > maxLen * 0.45) {
      continue
    }

    if (!entry.bigrams) {
      entry.bigrams = getBigrams(normKey)
    }

    const score = diceCoefficient(queryBigrams, entry.bigrams)
    if (score >= threshold) {
      fuzzyCandidates.push({ entry, score })
    }
  }

  // Sort fuzzy candidates descending by score
  fuzzyCandidates.sort((a, b) => b.score - a.score)

  // Add the best fuzzy candidates (up to 5)
  const limit = 5
  for (let idx = 0; idx < Math.min(fuzzyCandidates.length, limit); idx++) {
    const cand = fuzzyCandidates[idx]
    if (!results.some((r) => r.abbreviation === cand.entry.abbreviation)) {
      results.push({
        abbreviation: cand.entry.abbreviation,
        matchType: 'fuzzy',
        originalKey: cand.entry.originalKey,
        confidence: cand.score,
      })
    }
  }

  if (results.length > 0) {
    results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    return results
  }

  return [{ abbreviation: journal, matchType: 'none' }]
}

/**
 * Searches the database and returns the top single matching abbreviation.
 */
export function findAbbreviation(
  journal: string,
  strictness: 'strict' | 'normal' | 'fuzzy',
  threshold: number = 0.75,
): MatchResult {
  const candidates = findAbbreviationCandidates(journal, strictness, threshold)
  return candidates[0]
}
