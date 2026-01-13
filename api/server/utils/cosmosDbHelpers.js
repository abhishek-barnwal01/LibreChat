/**
 * CosmosDB Helper Functions
 *
 * CosmosDB's MongoDB API doesn't support certain operators like $bitsAllSet.
 * These helper functions provide CosmosDB-compatible alternatives.
 */

/**
 * Check if all required permission bits are set
 * CosmosDB-compatible replacement for $bitsAllSet
 *
 * @param {number} permBits - The permission bits to check
 * @param {number} requiredBits - The required permission bits
 * @returns {boolean} True if all required bits are set
 */
function hasAllBitsSet(permBits, requiredBits) {
  return (permBits & requiredBits) === requiredBits;
}

/**
 * Filter array of entries to only those with all required permission bits set
 *
 * @param {Array} entries - Array of ACL entries
 * @param {number} requiredBits - The required permission bits
 * @returns {Array} Filtered entries
 */
function filterByBits(entries, requiredBits) {
  return entries.filter(entry => hasAllBitsSet(entry.permBits, requiredBits));
}

/**
 * Check if CosmosDB is being used
 * This can be determined by checking environment variables or connection string
 *
 * @returns {boolean} True if using CosmosDB
 */
function isCosmosDB() {
  const connectionString = process.env.MONGO_URI || '';
  return connectionString.includes('cosmos.azure.com') ||
         connectionString.includes('documents.azure.com') ||
         process.env.USE_COSMOSDB === 'true';
}

module.exports = {
  hasAllBitsSet,
  filterByBits,
  isCosmosDB,
};
