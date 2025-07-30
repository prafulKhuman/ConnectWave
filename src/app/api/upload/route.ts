
import { google } from 'googleapis';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-service-account.json', // path relative to project root
  scopes: ['https://www.googleapis.com/auth/drive'],
});

async function uploadToDrive(filePath: string, originalFilename: string, mimetype: string) {
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    const folderId = '1ozNSvT4atux8buVv6b1NS2GN3F_MZiq1'; // From Google Drive URL

    const fileMetadata = {
        name: originalFilename,
        parents: [folderId],
    };

    const media = {
        mimeType: mimetype,
        body: require('fs').createReadStream(filePath),
    };

    const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
    });

    if (!driveFile.data.id) {
        throw new Error('Failed to get file ID from Google Drive');
    }

    // Make the file public
    await drive.permissions.create({
        fileId: driveFile.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    const publicUrl = `https://drive.google.com/uc?id=${driveFile.data.id}`;
    return publicUrl;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempFilePath = path.join(os.tmpdir(), file.name);
        await fs.writeFile(tempFilePath, buffer);

        const url = await uploadToDrive(tempFilePath, file.name, file.type);
        
        // Clean up the temporary file
        await fs.unlink(tempFilePath);

        return NextResponse.json({ url });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
    }
}
