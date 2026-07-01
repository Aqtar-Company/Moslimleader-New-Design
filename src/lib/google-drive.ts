import { google } from 'googleapis';
import { Readable } from 'stream';
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Module-level singleton — avoids creating a new JWT + fetching a new
// access token on every Drive operation.
let _drive: ReturnType<typeof google.drive> | null = null;
function getDrive() {
  if (!_drive) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    _drive = google.drive({ version: 'v3', auth });
  }
  return _drive;
}

export interface DriveUploadResult {
  id: string;
  webViewLink: string;
}

export async function uploadToDrive(params: {
  name: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<DriveUploadResult> {
  const drive = getDrive();
  const stream = Readable.from(params.buffer);

  const res = await drive.files.create({
    requestBody: {
      name: params.name,
      mimeType: params.mimeType,
      parents: FOLDER_ID ? [FOLDER_ID] : undefined,
    },
    media: {
      mimeType: params.mimeType,
      body: stream,
    },
    fields: 'id,webViewLink',
  });

  const file = res.data;
  if (!file.id) throw new Error('Drive upload returned no file ID');

  // No public permissions are granted — all access goes through
  // the authenticated /api/admin/production-files/[id]/download route.

  return {
    id: file.id,
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
  };
}

// Returns a readable stream directly from Drive to avoid buffering the
// entire file in Node.js heap (production files can be 100+ MB).
export async function streamFromDrive(fileId: string): Promise<NodeJS.ReadableStream> {
  const drive = getDrive();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }) as any;
  return res.data as NodeJS.ReadableStream;
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}
