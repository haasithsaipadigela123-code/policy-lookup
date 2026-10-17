const StorageManager = (function () {
  'use strict';

  const DB_NAME = 'PolicyLookupDB';
  const DB_VERSION = 1;

  let dbInstance = null;

  function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('policies')) {
          const policyStore = db.createObjectStore('policies', { keyPath: 'id' });
          policyStore.createIndex('docId', 'docId', { unique: false });
        }

        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id' });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = function (event) {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = function (event) {
        reject(new Error('IndexedDB open error: ' + (event.target.error ? event.target.error.message : 'Unknown')));
      };
    });
  }

  async function getStore(storeName, mode) {
    const db = await openDb();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  async function getAll(storeName) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDocument(docMeta, policies) {
    const db = await openDb();
    const tx = db.transaction(['documents', 'policies'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const policyStore = tx.objectStore('policies');

    docStore.put(docMeta);

    if (Array.isArray(policies)) {
      for (const p of policies) {
        policyStore.put(p);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ success: true, docId: docMeta.id });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  async function getAllDocuments() {
    return getAll('documents');
  }

  async function getAllPolicies() {
    return getAll('policies');
  }

  async function deleteDocument(docId) {
    const db = await openDb();
    const tx = db.transaction(['documents', 'policies'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const policyStore = tx.objectStore('policies');

    docStore.delete(docId);

    const index = policyStore.index('docId');
    const keyReq = index.getAllKeys(docId);

    return new Promise((resolve, reject) => {
      keyReq.onsuccess = () => {
        const keys = keyReq.result || [];
        for (const k of keys) {
          policyStore.delete(k);
        }
      };
      tx.oncomplete = () => resolve({ success: true });
      tx.onerror = () => reject(tx.error);
    });
  }

  async function saveHistory(entry) {
    const store = await getStore('history', 'readwrite');
    const item = {
      id: entry.id || ('hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      timestamp: entry.timestamp || new Date().toISOString(),
      ticketUrl: entry.ticketUrl || '',
      ticketTitle: entry.ticketTitle || '',
      ticketDescription: entry.ticketDescription || '',
      ticketSource: entry.ticketSource || 'manual_description',
      status: entry.status || 'NO_POLICY_FOUND',
      policyId: entry.hasExplicitId ? (entry.policyId || null) : null,
      internalReference: entry.internalReference || entry.policyId || '',
      hasExplicitId: Boolean(entry.hasExplicitId),
      hasExplicitTitle: Boolean(entry.hasExplicitTitle !== false),
      hasExplicitResolution: Boolean(entry.hasExplicitResolution),
      hasExplicitCategory: Boolean(entry.hasExplicitCategory),
      policyName: entry.policyName || '',
      category: entry.category || null,
      sourceDocName: entry.sourceDocName || 'Policy Document',
      pageOrRow: entry.pageOrRow || '',
      sourceLocations: Array.isArray(entry.sourceLocations) ? entry.sourceLocations : [],
      sourceDocumentId: entry.sourceDocumentId || null,
      resolution: entry.hasExplicitResolution ? (entry.resolution || null) : null,
      conditions: entry.conditions || '',
      exceptions: entry.exceptions || '',
      confidence: entry.confidence || 'Low',
      confidenceType: entry.confidenceType || '',
      similarityScore: entry.similarityScore || 0,
      evidence: entry.evidence || '',
      fullEvidence: entry.fullEvidence || entry.evidence || '',
      whyApplies: entry.whyApplies || '',
      exceptionTriggered: entry.exceptionTriggered || false,
      matchedExceptions: entry.matchedExceptions || [],
      missingInformation: entry.missingInformation || [],
      evaluatedConditions: entry.evaluatedConditions || [],
      evaluatedExceptions: entry.evaluatedExceptions || []
    };

    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async function getHistory(limit) {
    const all = await getAll('history');
    all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (typeof limit === 'number' && limit > 0) {
      return all.slice(0, limit);
    }
    return all;
  }

  async function deleteHistory(id) {
    const store = await getStore('history', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve({ success: true });
      req.onerror = () => reject(req.error);
    });
  }

  async function clearHistory() {
    const store = await getStore('history', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve({ success: true });
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAllData() {
    const db = await openDb();
    const tx = db.transaction(['documents', 'policies', 'history'], 'readwrite');
    tx.objectStore('documents').clear();
    tx.objectStore('policies').clear();
    tx.objectStore('history').clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ success: true });
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    openDb,
    saveDocument,
    getAllDocuments,
    getAllPolicies,
    deleteDocument,
    saveHistory,
    getHistory,
    deleteHistory,
    clearHistory,
    clearAllData
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
