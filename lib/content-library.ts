export const CONTENT_LIBRARY_BUCKET = 'content-library'

export const CONTENT_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
] as const

export const CONTENT_PLACEMENTS = [
  { id: 'post', label: 'Post' },
  { id: 'story', label: 'Story' },
  { id: 'reel', label: 'Reel' },
] as const

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number]['id']
export type ContentPlacement = (typeof CONTENT_PLACEMENTS)[number]['id']
export type ContentStatus = 'draft' | 'posted'

export type ContentMedia = {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  media_kind: 'image' | 'video' | 'other'
  created_by_user_id?: string | null
  created_by_name?: string | null
  created_at: string
}

export type ContentAllocation = {
  id: string
  media_id?: string | null
  scheduled_date: string
  platform: ContentPlatform
  placement: ContentPlacement
  caption: string
  status: ContentStatus
  created_at: string
  updated_at: string
  media?: ContentMedia | null
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const MAX_BYTES = 100 * 1024 * 1024

export function validateContentMediaFile(file: File) {
  if (!IMAGE_TYPES.has(file.type) && !VIDEO_TYPES.has(file.type)) {
    return 'Use JPEG, PNG, WebP, GIF, MP4, WebM, or MOV'
  }
  if (file.size > MAX_BYTES) {
    return 'File must be 100 MB or smaller'
  }
  return null
}

export function contentMediaKind(mimeType: string): ContentMedia['media_kind'] {
  if (IMAGE_TYPES.has(mimeType)) return 'image'
  if (VIDEO_TYPES.has(mimeType)) return 'video'
  return 'other'
}

export function contentLibraryStoragePath(filename: string, mimeType: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80)
  const ext = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/gif'
        ? 'gif'
        : mimeType === 'video/webm'
          ? 'webm'
          : mimeType === 'video/quicktime'
            ? 'mov'
            : mimeType === 'video/mp4'
              ? 'mp4'
              : 'jpg'
  return `uploads/${Date.now()}-${safeName || `file.${ext}`}`
}

export function contentMediaProxySrc(storagePath: string) {
  return `/api/content/library/file?path=${encodeURIComponent(storagePath)}`
}

export function platformLabel(platform: string) {
  return CONTENT_PLATFORMS.find((item) => item.id === platform)?.label || platform
}

export function placementLabel(placement: string) {
  return CONTENT_PLACEMENTS.find((item) => item.id === placement)?.label || placement
}
