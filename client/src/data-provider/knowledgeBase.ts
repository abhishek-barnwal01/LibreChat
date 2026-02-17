import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

export interface BlobDocument {
  name: string;
  creationTime: string;
  lastModified: string;
  contentLength: string;
  contentType: string;
  metadata: Record<string, string>;
}

export interface BlobListResponse {
  documents: BlobDocument[];
  totalCount: number;
}

export const getBlobList = async (): Promise<BlobListResponse> => {
  try {
    const response = await request.get('/api/knowledge-base/blobs');
    return response as BlobListResponse;
  } catch (error) {
    console.error('Error fetching blob list:', error);
    throw error;
  }
};

export const useGetBlobListQuery = (
  config?: UseQueryOptions<BlobListResponse>,
): QueryObserverResult<BlobListResponse, unknown> => {
  return useQuery<BlobListResponse>(
    ['blobList'],
    () => getBlobList(),
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};
