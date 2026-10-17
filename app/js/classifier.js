/**
 * Local Supervised Classifier (Multinomial Naive Bayes with Laplace Smoothing)
 * 
 * Strict Data Integrity Rule:
 * This model ONLY trains when legitimate labelled ticket-to-policy examples
 * (real ticket descriptions paired with known policy IDs) are explicitly provided.
 * 
 * If no labelled ticket examples exist, this classifier remains untrained (isTrained = false)
 * and the system relies strictly on unsupervised TF-IDF vector retrieval and rule validation.
 */

const LocalClassifier = (function () {
  'use strict';

  class NaiveBayesClassifier {
    constructor() {
      this.classCounts = new Map();
      this.classWordCounts = new Map();
      this.classWordTotals = new Map();
      this.vocabulary = new Set();
      this.totalSamples = 0;
      this.isTrained = false;
    }

    reset() {
      this.classCounts.clear();
      this.classWordCounts.clear();
      this.classWordTotals.clear();
      this.vocabulary.clear();
      this.totalSamples = 0;
      this.isTrained = false;
    }

    /**
     * Train supervised classifier on legitimate labelled ticket examples.
     * @param {Array<{ticket: string, policyId: string}>} labelledExamples
     */
    trainFromLabelledTickets(labelledExamples) {
      this.reset();

      if (!Array.isArray(labelledExamples) || labelledExamples.length === 0) {
        this.isTrained = false;
        return { success: false, reason: 'No labelled examples provided.' };
      }

      const validPairs = labelledExamples.filter(e => e && e.ticket && e.policyId);
      const uniqueClasses = new Set(validPairs.map(e => e.policyId));

      if (uniqueClasses.size < 2) {
        this.isTrained = false;
        return {
          success: false,
          reason: 'Supervised classification requires labelled examples for at least 2 distinct policy classes.'
        };
      }

      for (const item of validPairs) {
        const cls = String(item.policyId);
        this.classCounts.set(cls, (this.classCounts.get(cls) || 0) + 1);

        if (!this.classWordCounts.has(cls)) {
          this.classWordCounts.set(cls, new Map());
          this.classWordTotals.set(cls, 0);
        }

        const words = (typeof TfIdfEngine !== 'undefined')
          ? TfIdfEngine.tokenize(item.ticket)
          : item.ticket.toLowerCase().split(/\s+/).filter(Boolean);

        const wordMap = this.classWordCounts.get(cls);
        for (const w of words) {
          this.vocabulary.add(w);
          wordMap.set(w, (wordMap.get(w) || 0) + 1);
          this.classWordTotals.set(cls, this.classWordTotals.get(cls) + 1);
        }

        this.totalSamples++;
      }

      this.isTrained = this.totalSamples > 0;
      return {
        success: true,
        isTrained: this.isTrained,
        sampleCount: this.totalSamples,
        classCount: uniqueClasses.size
      };
    }

    predict(text) {
      if (!this.isTrained || this.totalSamples === 0) {
        return {
          isTrained: false,
          topClass: null,
          probability: 0,
          probabilities: {},
          reason: 'Supervised model is untrained (no labelled ticket examples provided).'
        };
      }

      const words = (typeof TfIdfEngine !== 'undefined')
        ? TfIdfEngine.tokenize(text)
        : text.toLowerCase().split(/\s+/).filter(Boolean);

      if (words.length === 0) {
        return { isTrained: true, topClass: null, probability: 0, probabilities: {} };
      }

      const vocabSize = Math.max(1, this.vocabulary.size);
      const scores = new Map();

      for (const [cls, count] of this.classCounts.entries()) {
        let logProb = Math.log(count / this.totalSamples);
        const wordMap = this.classWordCounts.get(cls);
        const totalWords = this.classWordTotals.get(cls) || 0;

        for (const w of words) {
          const wordCount = (wordMap && wordMap.get(w)) || 0;
          const prob = (wordCount + 1) / (totalWords + vocabSize);
          logProb += Math.log(prob);
        }

        scores.set(cls, logProb);
      }

      let maxLog = -Infinity;
      for (const v of scores.values()) {
        if (v > maxLog) maxLog = v;
      }

      let sumExp = 0;
      const unnormProbs = new Map();
      for (const [cls, logVal] of scores.entries()) {
        const p = Math.exp(logVal - maxLog);
        unnormProbs.set(cls, p);
        sumExp += p;
      }

      const probabilities = {};
      let topClass = null;
      let highestProb = -1;

      for (const [cls, p] of unnormProbs.entries()) {
        const normalized = Math.round((p / Math.max(sumExp, 1e-9)) * 1000) / 1000;
        probabilities[cls] = normalized;
        if (normalized > highestProb) {
          highestProb = normalized;
          topClass = cls;
        }
      }

      return {
        topClass,
        probability: highestProb,
        probabilities,
        isTrained: true,
        sampleCount: this.totalSamples
      };
    }
  }

  const defaultClassifier = new NaiveBayesClassifier();

  return {
    NaiveBayesClassifier,
    defaultClassifier
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalClassifier;
}
