/**
 * Remove fundo do avatar (IMG.LY ONNX) e compõe sobre Light #F3F4F4 da paleta WR.
 * Skip: INSTAGRAM_AVATAR_SKIP_BG=1
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

export const AVATAR_PALETTE_BG = '#F3F4F4'
export const AVATAR_OUTPUT_SIZE = 320

const require = createRequire(import.meta.url)

function skipBgRemoval() {
  // Vercel serverless não inclui o pack ONNX (~GB); só resize/flatten com sharp.
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return true
  const v = String(process.env.INSTAGRAM_AVATAR_SKIP_BG || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function resolveImglyPublicPath() {
  const entry = require.resolve('@imgly/background-removal-node')
  const distDir = path.dirname(entry)
  return `${pathToFileURL(distDir).href}/`
}

/**
 * @param {Buffer} inputBuf
 * @param {string} [contentType]
 * @returns {Promise<{ buf: Buffer, contentType: 'image/png', flattened: boolean }>}
 */
export async function flattenInstagramAvatar(inputBuf, contentType = 'image/jpeg') {
  if (skipBgRemoval()) {
    const buf = await sharp(inputBuf)
      .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, { fit: 'cover' })
      .flatten({ background: AVATAR_PALETTE_BG })
      .png()
      .toBuffer()
    return { buf, contentType: 'image/png', flattened: false }
  }

  const { removeBackground } = await import('@imgly/background-removal-node')
  const mime = contentType?.startsWith('image/') ? contentType : 'image/jpeg'
  const inputBlob = new Blob([inputBuf], { type: mime })

  const cutoutBlob = await removeBackground(inputBlob, {
    model: 'medium',
    publicPath: resolveImglyPublicPath(),
    output: { format: 'image/png', quality: 0.9, type: 'foreground' },
  })
  const cutoutBuf = Buffer.from(await cutoutBlob.arrayBuffer())

  const resized = await sharp(cutoutBuf)
    .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, {
      fit: 'cover',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer()

  const buf = await sharp({
    create: {
      width: AVATAR_OUTPUT_SIZE,
      height: AVATAR_OUTPUT_SIZE,
      channels: 3,
      background: AVATAR_PALETTE_BG,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer()

  return { buf, contentType: 'image/png', flattened: true }
}
