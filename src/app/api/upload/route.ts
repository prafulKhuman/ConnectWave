
import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { Writable } from 'stream';

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-service-account.json', // path relative to project root
  scopes: ['https://www.googleapis.com/auth/drive'],
});

async function uploadToDrive(file: formidable.File) {
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    const folderId = '1ozNSvT4atux8buVv6b1NS2GN3F_MZiq1'; // From Google Drive URL

    const fileMetadata = {
        name: file.originalFilename || 'upload',
        parents: [folderId],
    };

    const media = {
        mimeType: file.mimetype || 'application/octet-stream',
        body: fs.createReadStream(file.filepath),
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
        const form = formidable({});
        
        const file = await new Promise<formidable.File>((resolve, reject) => {
             form.parse(req as any, (err, fields, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                const uploadedFile = files.file;
                if (!uploadedFile || Array.isArray(uploadedFile)) {
                    reject(new Error("No file uploaded or multiple files uploaded"));
                    return;
                }
                resolve(uploadedFile as formidable.File);
            });
        });

        const url = await uploadToDrive(file);

        return NextResponse.json({ url });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Upload failed', details: error.message }, { status: 500 });
    }
}
