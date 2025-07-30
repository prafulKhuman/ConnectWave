
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: 'dqi7pba6p', 
  api_key: '512457837499254', 
  api_secret: 'mrM6p-1HVDsueTndHRgI0i-bZk0' 
});

// Helper function to extract public ID from a Cloudinary URL
const getPublicIdFromUrl = (url: string) => {
    try {
        const urlParts = url.split('/');
        const versionIndex = urlParts.findIndex(part => part.startsWith('v'));
        if (versionIndex === -1) return null;

        const publicIdWithExtension = urlParts.slice(versionIndex + 1).join('/');
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
        return publicId;
    } catch (error) {
        console.error("Error extracting public ID:", error);
        return null;
    }
}


export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'No file URL provided' }, { status: 400 });
    }

    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
        return NextResponse.json({ error: 'Invalid Cloudinary URL or could not extract public ID' }, { status: 400 });
    }
    
    // We need to determine the resource type (image, video) for deletion
    // Cloudinary's destroy method can often work without it, but it's more reliable to provide it.
    // For simplicity, we'll try with 'image' and 'video' if one fails.
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (imageError) {
        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        } catch (videoError) {
             console.error('Cloudinary Deletion Error (tried image and video):', videoError);
             // Don't throw here, as the file might just not exist.
             // We can proceed to delete the message from Firestore regardless.
        }
    }

    return NextResponse.json({ success: true, message: `File ${publicId} deleted.` });

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
