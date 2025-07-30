
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    let resource_type: 'image' | 'video' | 'raw' = 'raw';
    if (file.type.startsWith('image/')) {
        resource_type = 'image';
    } else if (file.type.startsWith('video/')) {
        resource_type = 'video';
    }

    const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            resource_type: resource_type,
        }, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(result);
        }).end(buffer);
    });

    return NextResponse.json(uploadResult);

  } catch (error) {
    console.error('Upload API Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
