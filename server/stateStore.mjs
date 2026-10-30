import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const dataDir = resolve(process.env.GODEN_EGG_DATA_DIR || join(process.cwd(), 'data'))
const stateFile = join(dataDir, 'state.json')
const backupDir = join(dataDir, 'backups')

function todayKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function ensureDirs() {
  await mkdir(dataDir, { recursive: true })
  await mkdir(backupDir, { recursive: true })
}

async function dailyBackup() {
  const target = join(backupDir, `state-${todayKey()}.json`)
  try {
    await stat(target)
    return
  } catch {
    // first write of the day
  }
  try {
    await copyFile(stateFile, target)
  } catch {
    // no previous state yet
  }
}

export async function readState() {
  try {
    const text = await readFile(stateFile, 'utf8')
    const parsed = JSON.parse(text)
    const state = parsed?.state ?? parsed
    if (!state || typeof state !== 'object' || !Array.isArray(state.accounts)) {
      throw new Error('STATE_SCHEMA_INVALID')
    }
    const fileStat = await stat(stateFile)
    return {
      state,
      savedAt: parsed?.savedAt || fileStat.mtime.toISOString(),
      path: stateFile,
      bytes: fileStat.size,
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { state: null, savedAt: null, path: stateFile, bytes: 0 }
    }
    const wrapped = new Error('读取本地数据文件失败')
    wrapped.code = 'STATE_READ_FAILED'
    wrapped.cause = error
    throw wrapped
  }
}

export async function writeState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.accounts)) {
    const error = new Error('数据格式不正确')
    error.code = 'STATE_SCHEMA_INVALID'
    throw error
  }
  await ensureDirs()
  await dailyBackup()

  const savedAt = new Date().toISOString()
  const payload = JSON.stringify({
    format: 'god-en-egg-state',
    version: 1,
    savedAt,
    state,
  })
  const bytes = Buffer.byteLength(payload, 'utf8')
  if (bytes > 30 * 1024 * 1024) {
    const error = new Error('数据超过 30MB，无法写入')
    error.code = 'STATE_TOO_LARGE'
    throw error
  }

  const tmp = `${stateFile}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, payload, 'utf8')
  try {
    await rename(tmp, stateFile)
  } catch (error) {
    // Windows can refuse to replace an existing file in rare cases.
    await writeFile(stateFile, payload, 'utf8')
    await rm(tmp, { force: true })
  }
  return { savedAt, path: stateFile, bytes }
}

export async function clearState() {
  await rm(stateFile, { force: true })
  await rm(backupDir, { recursive: true, force: true })
  return { path: stateFile }
}

export async function getInfo() {
  let exists = false
  let bytes = 0
  let savedAt = null
  let backupCount = 0
  try {
    const fileStat = await stat(stateFile)
    exists = true
    bytes = fileStat.size
    savedAt = fileStat.mtime.toISOString()
  } catch {
    // no state yet
  }
  try {
    const entries = await readdir(backupDir)
    backupCount = entries.filter((name) => name.endsWith('.json')).length
  } catch {
    // no backups yet
  }
  return { path: stateFile, dataDir, exists, bytes, savedAt, backupCount }
}

export { stateFile, backupDir }
