/**
 * Receipt picking + storage. Objects live in the PRIVATE `receipts` bucket
 * under `{kharcha_id}/{filename}` (no bucket prefix inside the key). Storage
 * RLS lets only the expense owner insert/update/delete under that folder and
 * lets owner + share recipients read, so every URL must be minted per render
 * via `getReceiptSignedUrl` — never persist a signed URL.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { AppError } from './errors';
import { supabase } from './supabase';

const BUCKET = 'receipts';

export interface PickedFile {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

const COMMON_OPTIONS = {
  mediaType: 'photo',
  quality: 0.8,
  maxWidth: 1600,
  maxHeight: 1600,
  includeBase64: false,
} as const;

async function ensureCameraPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new AppError('permission', 'Camera permission is required to take a photo.');
  }
}

function toPickedFile(response: ImagePickerResponse): PickedFile | null {
  if (response.didCancel) {
    return null;
  }
  if (response.errorCode) {
    throw new AppError('storage', response.errorMessage ?? 'Could not pick a receipt.');
  }
  const asset = response.assets?.[0];
  if (!asset?.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `receipt-${Date.now()}.jpg`,
    mimeType: asset.type ?? 'image/jpeg',
    fileSize: asset.fileSize,
  };
}

/** Opens the camera or gallery. Resolves to null when the user cancels. */
export async function pickReceipt(source: 'camera' | 'gallery'): Promise<PickedFile | null> {
  if (source === 'camera') {
    await ensureCameraPermission();
    const options: CameraOptions = { ...COMMON_OPTIONS, saveToPhotos: false };
    return toPickedFile(await launchCamera(options));
  }
  const options: ImageLibraryOptions = { ...COMMON_OPTIONS, selectionLimit: 1 };
  return toPickedFile(await launchImageLibrary(options));
}

/** Lower-cases and strips anything outside [a-z0-9._-]; capped at 80 chars. */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'receipt').slice(0, 80);
}

/**
 * Uploads a picked file under the expense's folder and returns the object
 * key to store in `kharcha.receipt_path`. A non-owner is rejected by storage
 * RLS (403), which `AppError.from` maps to 'permission'.
 */
export async function uploadReceipt(kharchaId: string, file: PickedFile): Promise<string> {
  const key = `${kharchaId}/${Date.now()}-${sanitizeFileName(file.fileName)}`;
  let body: ArrayBuffer;
  try {
    const res = await fetch(file.uri);
    body = await res.arrayBuffer();
  } catch (err) {
    throw new AppError('storage', 'Could not read the selected file.', err);
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, body, { contentType: file.mimeType, upsert: false });
  if (error) {
    throw AppError.from(error);
  }
  return key;
}

/** Mints a short-lived URL for a private object. Call at render time, never cache. */
export async function getReceiptSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    throw AppError.from(error);
  }
  return data.signedUrl;
}

/** Deletes an object. A missing object is not an error (already gone). */
export async function deleteReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    const appErr = AppError.from(error);
    if (appErr.kind === 'not_found' || /not\s*found|NoSuchKey/i.test(appErr.message)) {
      return;
    }
    throw appErr;
  }
}

export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path.split('?')[0] ?? path);
}
