export interface BibFieldMatch {
  name: 'journal' | 'booktitle'
  value: string // Extracted clean value, e.g., "Journal of Applied Crystallography"
  rawValue: string // Raw value including braces/quotes
  start: number // Start index of the clean value in the file string
  end: number // End index of the clean value in the file string
  quoteChar: '{' | '"' | ''
}

/**
 * Scans a BibTeX file and returns a list of journal and booktitle fields.
 * It uses a simple brace-depth tracking state machine to avoid matching
 * nested fields inside other fields (like titles).
 */
export function findJournalFields(content: string): BibFieldMatch[] {
  const matches: BibFieldMatch[] = []
  let i = 0
  const len = content.length

  while (i < len) {
    if (content[i] === '@') {
      // Find the start of the entry type
      i++
      while (i < len && /[a-zA-Z]/i.test(content[i])) {
        i++
      }

      // Skip comment/preamble/string entries if needed, or just let the brace matching handle them.
      // Find opening character for entry
      while (i < len && content[i] !== '{' && content[i] !== '(') {
        i++
      }
      if (i >= len) break

      const openChar = content[i]
      const closeChar = openChar === '{' ? '}' : ')'
      i++ // move past openChar

      let braceDepth = 1
      let inQuote = false

      while (i < len && braceDepth > 0) {
        const char = content[i]

        // Track quotes
        if (char === '"') {
          inQuote = !inQuote
          i++
          continue
        }

        // Track braces if not in quotes
        if (!inQuote) {
          if (char === '{' || char === '(') {
            braceDepth++
            i++
            continue
          }
          if (char === closeChar || char === '}' || char === ')') {
            braceDepth--
            i++
            continue
          }
        }

        // If we are at the top level of the entry fields, look for journal/booktitle
        if (braceDepth === 1 && !inQuote) {
          const remaining = content.substring(i)
          const fieldRegex = /^\s*(journal|booktitle)\s*=\s*/i
          const match = remaining.match(fieldRegex)

          if (match) {
            const fieldName = match[1].toLowerCase() as 'journal' | 'booktitle'
            i += match[0].length // Move past name and equals sign

            // Read the field value
            if (i >= len) break

            let valStart = i
            let valEnd = i
            let quoteChar: '{' | '"' | '' = ''

            if (content[i] === '{') {
              quoteChar = '{'
              valStart = i + 1
              let valBraceDepth = 1
              i++
              while (i < len && valBraceDepth > 0) {
                if (content[i] === '{') valBraceDepth++
                else if (content[i] === '}') valBraceDepth--
                i++
              }
              valEnd = i - 1
            } else if (content[i] === '"') {
              quoteChar = '"'
              valStart = i + 1
              i++
              while (i < len && content[i] !== '"') {
                i++
              }
              valEnd = i
              if (i < len) i++ // Move past closing quote
            } else {
              // Plain macro (no quotes or braces)
              valStart = i
              while (i < len && /[a-zA-Z0-9_\-+]/i.test(content[i])) {
                i++
              }
              valEnd = i
            }

            const cleanValue = content.substring(valStart, valEnd)
            const rawValue = content.substring(
              valStart - (quoteChar ? 1 : 0),
              valEnd + (quoteChar ? 1 : 0),
            )

            matches.push({
              name: fieldName,
              value: cleanValue,
              rawValue: rawValue,
              start: valStart,
              end: valEnd,
              quoteChar,
            })
            continue // We already advanced i, so don't increment again
          }
        }

        i++
      }
    } else {
      i++
    }
  }

  return matches
}

/**
 * Replaces the journal names at the specified matches with their new values.
 * Applies replacements from back to front to keep character indices valid.
 */
export function applyReplacements(
  content: string,
  replacements: { match: BibFieldMatch; newValue: string }[],
): string {
  // Sort replacements descending by start position
  const sorted = [...replacements].sort((a, b) => b.match.start - a.match.start)
  let result = content

  for (const r of sorted) {
    const { match, newValue } = r
    result = result.substring(0, match.start) + newValue + result.substring(match.end)
  }

  return result
}
