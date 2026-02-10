const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();

// Azure Blob Storage configuration
const BLOB_API_URL = 'https://gcplcmiadls001.blob.core.windows.net/gcpl-rag-embeddings?restype=container&comp=list&prefix=soaps/&sv=2024-11-04&ss=bfqt&srt=c&sp=rwdlacupyx&se=2026-03-19T15:43:36Z&st=2026-01-19T07:28:36Z&spr=https&sig=OoHZbdmTr06nN6I4q6ggv7lBm4IpzxmsmdcfgP32MV0%3D';
/**
 * GET /api/knowledge-base/blobs
 * Proxy endpoint to fetch blob list from Azure Storage
 * This avoids CORS issues when calling Azure directly from the frontend
 */
router.get('/blobs', requireJwtAuth, async (req, res) => {
  try {
    logger.info('[KnowledgeBase] Fetching blob list from Azure Storage');

    // Make request to Azure Blob Storage
    const response = await axios.get(BLOB_API_URL, {
      headers: {
        'Accept': 'application/xml',
      },
      timeout: 30000, // 30 second timeout
    });

    // Return the XML response
    res.set('Content-Type', 'application/xml');
    res.send(response.data);

    logger.info('[KnowledgeBase] Successfully fetched blob list');
  } catch (error) {
    logger.error('[KnowledgeBase] Error fetching blob list:', error.message);

    if (error.response) {
      // Azure returned an error response
      res.status(error.response.status).json({
        error: 'Failed to fetch blob list from Azure Storage',
        message: error.response.data || error.message,
      });
    } else if (error.request) {
      // Request was made but no response received
      res.status(503).json({
        error: 'Azure Storage is not responding',
        message: 'Unable to connect to Azure Blob Storage',
      });
    } else {
      // Something else went wrong
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
});

module.exports = router;
