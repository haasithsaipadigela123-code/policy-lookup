const TfIdfEngine = (function () {
  'use strict';

  const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as',
    'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could',
    'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
    'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
    'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'please', 'help', 'ticket', 'issue', 'problem', 'user', 'hi', 'hello',
    'thanks', 'thank', 'regards', 'asap', 'urgent'
  ]);

  function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/n't\b/g, ' not')
      .replace(/'m\b/g, ' am')
      .replace(/'s\b/g, ' ')
      .replace(/'re\b/g, ' are')
      .replace(/'ve\b/g, ' have')
      .replace(/'ll\b/g, ' will')
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stem(word) {
    if (!word || word.length <= 3) return word;
    let w = word.toLowerCase();
    if (w.endsWith('sses')) return w.slice(0, -2);
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ss')) return w;
    if (w.endsWith('s') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
    if (w.endsWith('eed')) return w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) {
      const base = w.slice(0, -3);
      return (base.endsWith('tt') || base.endsWith('pp') || base.endsWith('nn')) ? base.slice(0, -1) : base;
    }
    if (w.endsWith('ed') && w.length > 4) {
      const base = w.slice(0, -2);
      return (base.endsWith('tt') || base.endsWith('pp') || base.endsWith('nn')) ? base.slice(0, -1) : base;
    }
    if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
    if (w.endsWith('tion') && w.length > 6) return w.slice(0, -4);
    return w;
  }

  function tokenize(text) {
    const norm = normalizeText(text);
    if (!norm) return [];
    return norm
      .split(' ')
      .filter(w => w.length > 1 && !STOP_WORDS.has(w))
      .map(w => stem(w));
  }

  class TfIdfIndex {
    constructor() {
      this.documents = [];
      this.docFreqs = new Map();
      this.docVectors = [];
      this.docCount = 0;
    }

    addDocument(docId, text, metadata = {}) {
      const tokens = tokenize(text);
      const termCounts = new Map();

      for (const t of tokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1);
      }

      this.documents.push({
        id: docId,
        tokens,
        termCounts,
        metadata
      });

      const uniqueTerms = new Set(tokens);
      for (const t of uniqueTerms) {
        this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
      }
    }

    buildIndex() {
      this.docCount = this.documents.length;
      this.docVectors = [];

      for (let i = 0; i < this.docCount; i++) {
        const doc = this.documents[i];
        const vector = new Map();
        let normSq = 0;

        for (const [term, count] of doc.termCounts.entries()) {
          const tf = 1 + Math.log(count);
          const df = this.docFreqs.get(term) || 1;
          const idf = Math.log(1 + (this.docCount / df)) + 1;
          const tfidf = tf * idf;
          vector.set(term, tfidf);
          normSq += tfidf * tfidf;
        }

        const magnitude = Math.sqrt(normSq) || 1;
        for (const [term, val] of vector.entries()) {
          vector.set(term, val / magnitude);
        }

        this.docVectors.push({
          id: doc.id,
          vector,
          metadata: doc.metadata
        });
      }
    }

    query(queryText, topK = 5) {
      if (this.docCount === 0 || !queryText) return [];

      const queryTokens = tokenize(queryText);
      const queryTermCounts = new Map();

      for (const t of queryTokens) {
        queryTermCounts.set(t, (queryTermCounts.get(t) || 0) + 1);
      }

      const qVector = new Map();
      let qNormSq = 0;

      for (const [term, count] of queryTermCounts.entries()) {
        const tf = 1 + Math.log(count);
        const df = this.docFreqs.get(term) || 0;
        if (df > 0) {
          const idf = Math.log(1 + (this.docCount / df)) + 1;
          const tfidf = tf * idf;
          qVector.set(term, tfidf);
          qNormSq += tfidf * tfidf;
        }
      }

      const qMagnitude = Math.sqrt(qNormSq) || 1;
      for (const [term, val] of qVector.entries()) {
        qVector.set(term, val / qMagnitude);
      }

      const results = [];

      for (let i = 0; i < this.docVectors.length; i++) {
        const doc = this.docVectors[i];
        let dotProduct = 0;
        const matchingTerms = [];

        for (const [qTerm, qVal] of qVector.entries()) {
          const dVal = doc.vector.get(qTerm);
          if (dVal !== undefined) {
            dotProduct += qVal * dVal;
            matchingTerms.push(qTerm);
          }
        }

        if (dotProduct > 0) {
          results.push({
            id: doc.id,
            similarity: Math.round(dotProduct * 1000) / 1000,
            matchingTerms,
            metadata: doc.metadata
          });
        }
      }

      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, topK);
    }
  }

  return {
    tokenize,
    normalizeText,
    stem,
    TfIdfIndex
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TfIdfEngine;
}
