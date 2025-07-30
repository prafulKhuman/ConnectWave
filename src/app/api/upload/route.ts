
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: 'dqi7pba6p', 
  api_key: '512457837499254', 
  api_secret: 'mrM6p-1HVDsueTndHRgI0i-bZk0' 
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
                console.error('Cloudinary Upload Error:', error);
                reject(error);
                return;
            }
            resolve(result);
        }).end(buffer);
    });

    return NextResponse.json(uploadResult);

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
