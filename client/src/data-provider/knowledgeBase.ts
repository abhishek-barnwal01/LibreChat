import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

export interface BlobDocument {
  name: string;
  creationTime: string;
  lastModified: string;
  contentLength: string;
  contentType: string;
}

export interface BlobListResponse {
  documents: BlobDocument[];
  totalCount: number;
}

const parseBlobXmlResponse = (xmlText: string): BlobListResponse => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const blobs = xmlDoc.getElementsByTagName('Blob');
  const documents: BlobDocument[] = [];

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    const name = blob.getElementsByTagName('Name')[0]?.textContent || '';
    const properties = blob.getElementsByTagName('Properties')[0];

    if (properties) {
      const creationTime = properties.getElementsByTagName('Creation-Time')[0]?.textContent || '';
      const lastModified = properties.getElementsByTagName('Last-Modified')[0]?.textContent || '';
      const contentLength = properties.getElementsByTagName('Content-Length')[0]?.textContent || '';
      const contentType = properties.getElementsByTagName('Content-Type')[0]?.textContent || '';

      documents.push({
        name,
        creationTime,
        lastModified,
        contentLength,
        contentType,
      });
    }
  }

  return {
    documents,
    totalCount: documents.length,
  };
};

export const getBlobList = async (): Promise<BlobListResponse> => {
  try {
    const xmlText = await request.get<string>('/api/knowledge-base/blobs');
    return parseBlobXmlResponse(xmlText);
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
