'use strict';

/**
 * Builds a mandatory OData filter string for Azure AI Search based on
 * the user's dataAccess field. The filter is AND-ed with any LLM-provided
 * filter at invocation time, so the LLM cannot bypass access restrictions.
 *
 * @param {import('@librechat/data-schemas').IUser} user
 * @returns {string|null} OData filter string, or null if user has unrestricted access
 *
 * Usage (set via mongo admin):
 *   db.users.updateOne({ email: "user@company.com" }, {
 *     $set: { dataAccess: { productCategories: ["Soaps"], countries: null } }
 *   })
 *
 * Full access:   dataAccess: null  (or field absent)
 * Soaps only:    dataAccess: { productCategories: ["Soaps"], countries: null }
 * Soaps + India: dataAccess: { productCategories: ["Soaps"], countries: ["India"] }
 */
function buildMandatoryAzureFilter(user) {
  const access = user?.dataAccess;
  if (!access) {
    return null;
  }

  const parts = [];
  const { productCategories, countries } = access;

  if (productCategories && productCategories.length > 0) {
    const clause = productCategories
      .map((c) => `product_category_ai eq '${c}'`)
      .join(' or ');
    parts.push(`(${clause})`);
  }

  if (countries && countries.length > 0) {
    const clause = countries
      .map((c) => `country_ai eq '${c}'`)
      .join(' or ');
    parts.push(`(${clause})`);
  }

  return parts.length > 0 ? parts.join(' and ') : null;
}

module.exports = { buildMandatoryAzureFilter };
