import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

let _drive: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (!_drive) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    _drive = google.drive({ version: 'v3', auth });
  }
  return _drive;
}

export async function uploadToDrive(params: {
  buffer: Buffer;
  name: string;
  mimeType: string;
}): Promise<{ id: string; webViewLink: string }> {
  const drive = getDrive();
  const stream = Readable.from(params.buffer);
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: params.name,
      mimeType: params.mimeType,
      parents: FOLDER_ID ? [FOLDER_ID] : undefined,
    },
    media: { mimeType: params.mimeType, body: stream },
    fields: 'id,webViewLink',
  });
  if (!res.data.id) throw new Error('Drive upload returned no file ID');
  return { id: res.data.id, webViewLink: res.data.webViewLink ?? '' };
}

export async function streamFromDrive(fileId: string): Promise<NodeJS.ReadableStream> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return res.data as unknown as NodeJS.ReadableStream;
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}
