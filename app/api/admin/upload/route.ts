import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds the 5 MB upload limit' },
        { status: 400 }
      );
    }

    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);

    // Always re-optimize to stripped WebP max 1000px at quality 80
    const optimizedBuffer = await sharp(rawBuffer)
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80, alphaQuality: 88, effort: 5 })
      .toBuffer();

    const fileName = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.webp`;

    // 1. Try uploading optimized WebP to Supabase Storage bucket 'menu'
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('menu')
        .upload(fileName, optimizedBuffer, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabaseAdmin.storage.from('menu').getPublicUrl(fileName);
        return NextResponse.json({
          url: publicUrlData.publicUrl,
          path: fileName,
          bytes: optimizedBuffer.length,
        });
      }
    } catch (storageErr) {
      console.warn('Supabase Storage upload fallback to local:', storageErr);
    }

    // 2. Reliable local fallback: save optimized WebP to public/uploads/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, optimizedBuffer);

    return NextResponse.json({
      url: `/uploads/${fileName}`,
      path: `/uploads/${fileName}`,
      bytes: optimizedBuffer.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
