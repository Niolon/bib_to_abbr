import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

// Allow loadDatabase() to read JSON files from disk in the Node test environment
global.fetch = async (url: RequestInfo | URL): Promise<Response> => {
  const urlStr = String(url)
  const basename = urlStr.split('/').pop()!
  const filePath = path.join(publicDir, basename)
  const data = fs.readFileSync(filePath, 'utf-8')
  return {
    json: async () => JSON.parse(data),
  } as Response
}
