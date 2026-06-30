import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import {
  CONTENT_LIBRARY_BUCKET,
  contentLibraryStoragePath,
  contentMediaKind,
  contentMediaProxySrc,
  validateContentMediaFile,
} from '@/lib/content-library'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const validationError = validateContentMediaFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const path = contentLibraryStoragePath(file.name, file.type)
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from(CONTENT_LIBRARY_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Content library upload error:', uploadError)
      const hint = uploadError.message?.toLowerCase().includes('bucket')
        ? 'Storage bucket missing — run supabase/content_library.sql'
        : 'Failed to upload file'
      return NextResponse.json({ error: hint }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('content_media')
      .insert({
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: path,
        media_kind: contentMediaKind(file.type),
        created_by_user_id: admin.id,
        created_by_name: admin.full_name,
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      console.error('Content media insert error:', insertError)
      const missingTable = insertError?.message?.toLowerCase().includes('content_media')
      return NextResponse.json(
        { error: missingTable ? 'Database tables missing — run supabase/content_library.sql' : 'Failed to save media record' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      media: {
        ...inserted,
        url: contentMediaProxySrc(inserted.storage_path),
      },
    })
  } catch (error) {
    console.error('Content library upload route error:', error)
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 })
  }
}
