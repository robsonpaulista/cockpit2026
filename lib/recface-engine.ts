import type { NextRequest } from 'next/server'
import { getRecfaceApiUrl } from '@/lib/recface-server'

export interface FaceEncodeResult {
  vector: number[]
  dimensions: number
  boundingBox: { x: number; y: number; width: number; height: number } | null
  message: string
}

export async function encodeFaceFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<FaceEncodeResult> {
  const form = new FormData()
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'image/jpeg' })
  form.append('image', blob, filename || 'face.jpg')

  const res = await fetch(`${getRecfaceApiUrl()}/encode`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(body.detail ?? `Falha ao extrair rosto (${res.status})`)
  }

  return res.json() as Promise<FaceEncodeResult>
}

export async function encodeFaceFromRequestFile(
  file: File | Blob,
  filename?: string,
): Promise<FaceEncodeResult> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const name = filename ?? (file instanceof File ? file.name : 'face.jpg')
  const type = file instanceof File ? file.type : 'image/jpeg'
  return encodeFaceFromBuffer(buffer, name, type)
}

export interface FaceMatchResult {
  recognized: boolean
  personId: string | null
  name: string | null
  roleTag: string | null
  distance: number
  confidence: number
  noFace?: boolean
  error?: string
}

export interface KnownFaceInput {
  personId: string
  name: string
  roleTag?: string | null
  vector: number[]
}

export interface FaceMatchItem {
  personId: string
  name: string
  roleTag: string | null
  distance: number
  confidence: number
}

export interface FaceMatchAllResult {
  faceCount: number
  matches: FaceMatchItem[]
  recognized: boolean
  noFace?: boolean
  error?: string
}

function parseMatchApiError(detail: string): Pick<FaceMatchAllResult, 'noFace' | 'error'> | null {
  const detailLower = detail.toLowerCase()
  if (detailLower.includes('nenhum rosto')) {
    return { noFace: true }
  }
  if (
    detailLower.includes('imagem inválida') ||
    detailLower.includes('corrompida') ||
    detailLower.includes('cannot identify') ||
    detailLower.includes('unidentifiedimage')
  ) {
    return { error: detail }
  }
  return { error: detail }
}

function buildKnownPayload(known: KnownFaceInput[]) {
  return known.map((k) => ({ personId: k.personId, name: k.name, vector: k.vector }))
}

function imageBase64FromBuffer(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`
}

export async function matchAllFacesFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  known: KnownFaceInput[],
): Promise<FaceMatchAllResult> {
  if (known.length === 0) {
    return { faceCount: 0, matches: [], recognized: false }
  }

  const res = await fetch(`${getRecfaceApiUrl()}/match-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: imageBase64FromBuffer(buffer, mimeType),
      known: buildKnownPayload(known),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    const detail = body.detail ?? `Falha no match (${res.status})`
    const parsed = parseMatchApiError(detail)
    return {
      faceCount: 0,
      matches: [],
      recognized: false,
      ...parsed,
    }
  }

  const data = (await res.json()) as {
    faceCount: number
    recognized: boolean
    matches: Array<{
      personId: string
      name: string
      distance: number
      confidence: number
    }>
  }

  const matches = (data.matches ?? []).map((item) => {
    const matched = known.find((k) => k.personId === item.personId)
    return {
      personId: item.personId,
      name: item.name,
      roleTag: matched?.roleTag ?? null,
      distance: item.distance,
      confidence: item.confidence,
    }
  })

  return {
    faceCount: data.faceCount ?? matches.length,
    matches,
    recognized: data.recognized ?? matches.length > 0,
  }
}

export async function matchFaceFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  known: KnownFaceInput[],
): Promise<FaceMatchResult> {
  if (known.length === 0) {
    return {
      recognized: false,
      personId: null,
      name: null,
      roleTag: null,
      distance: 1,
      confidence: 0,
    }
  }

  const base64 = imageBase64FromBuffer(buffer, mimeType)

  const res = await fetch(`${getRecfaceApiUrl()}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      known: buildKnownPayload(known),
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    const detail = body.detail ?? `Falha no match (${res.status})`
    const parsed = parseMatchApiError(detail)
    return {
      recognized: false,
      personId: null,
      name: null,
      roleTag: null,
      distance: 1,
      confidence: 0,
      ...parsed,
    }
  }

  const data = (await res.json()) as {
    recognized: boolean
    personId: string | null
    name: string | null
    distance: number
    confidence: number
  }

  const matched = known.find((k) => k.personId === data.personId)
  return {
    recognized: data.recognized,
    personId: data.personId,
    name: data.name,
    roleTag: matched?.roleTag ?? null,
    distance: data.distance,
    confidence: data.confidence,
  }
}

export async function recfaceEngineAvailable(request?: NextRequest): Promise<boolean> {
  void request
  try {
    const res = await fetch(`${getRecfaceApiUrl()}/engine`, { cache: 'no-store', signal: AbortSignal.timeout(2000) })
    if (!res.ok) return false
    const data = (await res.json()) as { available?: boolean }
    return Boolean(data.available)
  } catch {
    return false
  }
}
