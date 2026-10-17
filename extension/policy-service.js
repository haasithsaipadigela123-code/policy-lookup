(function (root, factory) {
  if (typeof module === 'object' && module.exports) {

    module.exports = factory();
  } else {

    root.PolicyServiceModule = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class PolicyDataSource {
    async fetchPolicies() {
      throw new Error('fetchPolicies() must be implemented by subclass.');
    }
  }

  class LocalJsonPolicySource extends PolicyDataSource {
    constructor(jsonPath = 'policies.json') {
      super();
      this.jsonPath = jsonPath;
    }

    async fetchPolicies() {

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          const stored = await chrome.storage.local.get(['importedPolicies', 'importedMetadata']);
          if (stored && Array.isArray(stored.importedPolicies) && stored.importedPolicies.length > 0) {
            this.isImported = true;
            this.sourceMetadata = stored.importedMetadata || null;
            return stored.importedPolicies;
          }
        } catch (storageErr) {
          console.warn('[PolicyService] Note checking storage.local:', storageErr);
        }
      }

      this.isImported = false;
      this.sourceMetadata = null;

      let url = this.jsonPath;

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        url = chrome.runtime.getURL(this.jsonPath);
      }

      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          const fs = require('fs');
          const path = require('path');
          const resolvedPath = path.isAbsolute(this.jsonPath) 
            ? this.jsonPath 
            : path.join(__dirname, this.jsonPath);
          const raw = fs.readFileSync(resolvedPath, 'utf8');
          const parsed = JSON.parse(raw);
          return parsed.policies || [];
        } catch (nodeErr) {
          throw new Error(`Failed to load policies via Node fs: ${nodeErr.message}`);
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} loading policies from ${url}`);
      }
      const data = await response.json();
      return Array.isArray(data.policies) ? data.policies : [];
    }
  }

  class RemoteApiPolicySource extends PolicyDataSource {
    constructor(apiEndpoint, authProvider = null) {
      super();
      this.apiEndpoint = apiEndpoint;
      this.authProvider = authProvider;
    }

    async fetchPolicies() {

      throw new Error('RemoteApiPolicySource is a placeholder. Configure enterprise API parameters first.');
    }
  }

  class PolicyService {
    constructor(dataSource = null) {
      this.dataSource = dataSource || new LocalJsonPolicySource('policies.json');
      this.cachedPolicies = null;
      this.lastFetched = null;
    }

    async getPolicies(forceRefresh = false) {
      if (!forceRefresh && this.cachedPolicies && this.cachedPolicies.length > 0) {
        return this.cachedPolicies;
      }

      try {
        const rawPolicies = await this.dataSource.fetchPolicies();
        this.cachedPolicies = this.validateAndSanitize(rawPolicies);
        this.lastFetched = new Date();
        return this.cachedPolicies;
      } catch (err) {
        console.error('[PolicyService] Error fetching policies:', err);
        throw err;
      }
    }

    getSourceInfo() {
      if (this.dataSource && this.dataSource.isImported) {
        return {
          type: 'imported',
          label: 'Custom Word Policies',
          metadata: this.dataSource.sourceMetadata
        };
      }
      return {
        type: 'bundled',
        label: 'Sample Fictional Policies',
        metadata: null
      };
    }

    validateAndSanitize(policies) {
      if (!Array.isArray(policies)) {
        console.warn('[PolicyService] Expected array of policies, got:', typeof policies);
        return [];
      }

      return policies.filter(p => {
        if (!p || typeof p !== 'object') return false;
        if (!p.id || typeof p.id !== 'string') return false;
        if (!p.name || typeof p.name !== 'string') return false;
        return true;
      }).map(p => ({
        id: p.id.trim(),
        name: p.name.trim(),
        category: p.category || 'General',
        problemDescription: p.problemDescription || p.conditions || '',
        conditions: p.conditions || p.problemDescription || '',
        exceptions: p.exceptions || '',
        resolution: p.resolution || p.approvedSolution || 'No solution description available.',
        approvedSolution: p.approvedSolution || p.resolution || 'No solution description available.',
        stepByStepInstructions: Array.isArray(p.stepByStepInstructions) ? p.stepByStepInstructions : [],
        reference: p.reference || p.id,
        keywords: Array.isArray(p.keywords) ? p.keywords : [],
        synonyms: Array.isArray(p.synonyms) ? p.synonyms : [],
        allColumns: p.allColumns || {}
      }));
    }
  }

  return {
    PolicyService,
    PolicyDataSource,
    LocalJsonPolicySource,
    RemoteApiPolicySource
  };
});
