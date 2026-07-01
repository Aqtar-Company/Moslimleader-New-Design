import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

export interface DriveUploadResult {
  id: string;
  webViewLink: string;
  downloadLink: string;
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
    fields: 'id,webViewLink,webContentLink',
  });

  const file = res.data;
  if (!file.id) throw new Error('Drive upload returned no file ID');

  // Make readable by anyone with the link so employees with the link can view/download
  await drive.permissions.create({
    fileId: file.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    id: file.id,
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    downloadLink: file.webContentLink ?? `https://drive.google.com/uc?export=download&id=${file.id}`,
  };
}

export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}
