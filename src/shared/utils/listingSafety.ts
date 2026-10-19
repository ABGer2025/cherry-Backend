import { Response } from 'express';

export class ListingSafetyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ListingSafetyError';
  }
}

export function sendListingSafetyError(res: Response, error: unknown): boolean {
  if (!(error instanceof ListingSafetyError)) return false;
  res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  return true;
}

/** Apply only at the API boundary, never before a payment/ownership check. */
export function exposedListing<T extends object>(data: T): T {
  const result = { ...data } as Record<string, unknown>;
  if (result.status === undefined && typeof result.number === 'number') {
    result.status = result.number > 0 ? 'active' : 'sold';
  }
  for (const key of ['hasSales', 'hasBeenEdited'])
    delete result[key];
  return result as T;
}

export function assertOwner(data: { userId?: unknown }, uid: string): void {
  if (!uid)
    throw new ListingSafetyError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Sign in to change this listing.',
    );
  if (data.userId !== uid)
    throw new ListingSafetyError(
      403,
      'LISTING_NOT_OWNER',
      'You can only change your own listings.',
    );
}

export function assertOwnedProductImages(images: string[], uid: string): void {
  const prefix = `products/${uid}/`;

  for (const image of images) {
    try {
      const url = new URL(image);
      let objectPath: string | undefined;

      if (url.protocol === 'gs:') {
        objectPath = decodeURIComponent(url.pathname.slice(1));
      } else if (url.hostname === 'firebasestorage.googleapis.com') {
        const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
        if (match) objectPath = decodeURIComponent(match[1]);
      } else if (url.hostname === 'storage.googleapis.com') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 1) {
          objectPath = decodeURIComponent(parts.slice(1).join('/'));
        }
      }

      if (!objectPath || !objectPath.startsWith(prefix)) throw new Error();
    } catch {
      throw new ListingSafetyError(
        400,
        'LISTING_MEDIA_NOT_OWNED',
        'Listing images must belong to the authenticated seller.',
      );
    }
  }
}
