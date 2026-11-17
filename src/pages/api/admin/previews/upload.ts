/**
 * POST /api/admin/previews/upload — short-lived Vercel Blob tokens so the browser uploads an app build ZIP (made by
 * scripts/previews/build.mjs) straight to Blob at <folder>/previews/<key>.zip. Staff only; ZIPs only, 40 MB max.
 * The upload is then registered with PUT /api/admin/previews { action: 'build' }.
 */
import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { canManageSubmissions } from '@/lib/accounts/labscope';
import { json } from '@/lib/progress/server';
import { blobFolder, blobToken } from '@/lib/project-files/server';
import { MAX_BUILD_BYTES } from '@/lib/previews/core';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await canManageSubmissions(cookies))) return json({ error: 'Unauthorized' }, 401);
  if (!blobToken()) return json({ error: 'Vercel Blob is not connected.' }, 503);
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!new RegExp(`^${blobFolder()}/previews/[a-z0-9]{20}\\.zip$`).test(pathname)) throw new Error('Invalid file path.');
        return { allowedContentTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], maximumSizeInBytes: MAX_BUILD_BYTES, addRandomSuffix: false };
      },
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upload failed.' }, 400);
  }
};
