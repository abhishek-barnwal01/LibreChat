const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();

// Azure Blob Storage configuration
const BLOB_BASE_URL = 'https://gcplcmiadls001.blob.core.windows.net/gcpl-rag-embeddings';
const SAS_TOKEN =
  'sv=2024-11-04&ss=bfqt&srt=c&sp=rwdlacupyx&se=2026-03-19T15:43:36Z&st=2026-01-19T07:28:36Z&spr=https&sig=OoHZbdmTr06nN6I4q6ggv7lBm4IpzxmsmdcfgP32MV0%3D';

// Folders to include in the knowledge base listing
const FOLDERS = ['soaps/', 'Household_Insecticides/'];

/**
 * Build an Azure List Blobs URL for a given folder prefix, including metadata.
 */
function buildListUrl(prefix) {
  return `${BLOB_BASE_URL}?restype=container&comp=list&prefix=${prefix}&include=metadata&${SAS_TOKEN}`;
}

/**
 * Parse Azure Blob Storage XML response into structured documents with metadata.
 */
function parseXmlBlobs(xmlText) {
  const documents = [];
  const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
  let match;

  while ((match = blobRegex.exec(xmlText)) !== null) {
    const blobXml = match[1];

    const getTag = (xml, tag) => {
      const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1] : '';
    };

    const nameMatch = blobXml.match(/<Name>([\s\S]*?)<\/Name>/);
    const name = nameMatch ? nameMatch[1] : '';

    const propsMatch = blobXml.match(/<Properties>([\s\S]*?)<\/Properties>/);
    const propsXml = propsMatch ? propsMatch[1] : '';

    const creationTime = getTag(propsXml, 'Creation-Time');
    const lastModified = getTag(propsXml, 'Last-Modified');
    const contentLength = getTag(propsXml, 'Content-Length');
    const contentType = getTag(propsXml, 'Content-Type');

    // Parse user-defined metadata
    const metadata = {};
    const metadataMatch = blobXml.match(/<Metadata>([\s\S]*?)<\/Metadata>/);
    if (metadataMatch) {
      const metaXml = metadataMatch[1];
      const metaTagRegex = /<([^/\s>]+)>([\s\S]*?)<\/\1>/g;
      let metaMatch;
      while ((metaMatch = metaTagRegex.exec(metaXml)) !== null) {
        metadata[metaMatch[1]] = metaMatch[2];
      }
    }

    documents.push({
      name,
      creationTime,
      lastModified,
      contentLength,
      contentType,
      metadata,
    });
  }

  return documents;
}

/**
 * GET /api/knowledge-base/blobs
 * Proxy endpoint to fetch blob list from Azure Storage.
 * Fetches from multiple folders in parallel and merges results.
 * Includes blob metadata for filtering.
 */
router.get('/blobs', requireJwtAuth, async (req, res) => {
  try {
    logger.info(
      '[KnowledgeBase] Fetching blob list from Azure Storage for folders: ' + FOLDERS.join(', '),
    );

    // Fetch blobs from all configured folders in parallel
    const responses = await Promise.all(
      FOLDERS.map((folder) =>
        axios.get(buildListUrl(folder), {
          headers: { Accept: 'application/xml' },
          timeout: 30000,
        }),
      ),
    );

    // Parse XML and merge all documents
    const allDocuments = [];
    for (const response of responses) {
      const docs = parseXmlBlobs(response.data);
      allDocuments.push(...docs);
    }

    res.json({
      documents: allDocuments,
      totalCount: allDocuments.length,
    });

    logger.info(`[KnowledgeBase] Successfully fetched ${allDocuments.length} blobs`);
  } catch (error) {
    logger.error('[KnowledgeBase] Error fetching blob list:', error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: 'Failed to fetch blob list from Azure Storage',
        message: error.response.data || error.message,
      });
    } else if (error.request) {
      res.status(503).json({
        error: 'Azure Storage is not responding',
        message: 'Unable to connect to Azure Blob Storage',
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
});

module.exports = router;
