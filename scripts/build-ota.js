import fs from 'fs'
import archiver from 'archiver'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distDir = path.join(__dirname, '../dist')
const updateZipPath = path.join(__dirname, '../update.zip')
const finalZipPath = path.join(distDir, 'update.zip')

// Make sure dist exists
if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist. Run vite build first.')
  process.exit(1)
}

const output = fs.createWriteStream(updateZipPath)
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
})

output.on('close', () => {
  console.log(`Generated OTA zip: ${archive.pointer()} total bytes`)
  
  // Move the zip into the dist folder so Vercel serves it
  fs.renameSync(updateZipPath, finalZipPath)
  
  // Create version.json inside dist
  const versionInfo = {
    version: Date.now().toString(), // Use timestamp as version
    url: '/update.zip'
  }
  
  fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionInfo, null, 2))
  console.log('Successfully created update.zip and version.json in dist folder.')
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)

// append files from a sub-directory, putting its contents at the root of archive
archive.directory(distDir, false)

archive.finalize()
