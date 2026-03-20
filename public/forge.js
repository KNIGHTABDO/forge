// Forge BaaS SDK
// Automatically injected into all Forge generated tools

window.forge = window.forge || {};

window.forge.db = {
  /**
   * Fetch a document from a collection.
   * @param {string} collection - The collection name (e.g. 'users')
   * @param {string} docId - The document ID (e.g. '123')
   * @returns {Promise<any>} The parsed JSON data or null if not found
   */
  async get(collection, docId) {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', collection, docId })
      });
      const response = await res.json();
      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (e) {
      console.error('[ForgeDB:GET]', e);
      return null;
    }
  },

  /**
   * Save a document to a collection. Overwrites existing.
   * @param {string} collection - The collection name
   * @param {string} docId - The document ID
   * @param {any} data - The JSON serializable data to save
   * @returns {Promise<boolean>} True if successful
   */
  async set(collection, docId, data) {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', collection, docId, data })
      });
      const response = await res.json();
      if (response.error) throw new Error(response.error);
      return response.success === true;
    } catch (e) {
      console.error('[ForgeDB:SET]', e);
      return false;
    }
  }
};

console.log('⚡ Forge BaaS SDK initialized.');
