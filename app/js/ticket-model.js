/**
 * Policy Lookup — Normalized Ticket Model
 * 
 * Unifies all intake methods (URL retrieval, manual description, conversation paste,
 * conversation file upload, guided builder) into one standardized data model.
 * 
 * Guarantees:
 * - Distinguishes retrieved facts from inferred or guided answers.
 * - Records provenance for every field.
 * - Retains original raw evidence unaltered.
 * - Detects missing information necessary for definitive policy application.
 */

const TicketModel = (function () {
  'use strict';

  function createNormalizedTicket(options = {}) {
    const source = options.source || 'manual_description';
    const ticketId = options.ticketId || null;
    const title = options.title || '';
    const description = options.description || '';
    const category = options.category || null;
    const subcategory = options.subcategory || null;
    const conversation = options.conversation || null;
    const guidedAnswers = Array.isArray(options.guidedAnswers) ? options.guidedAnswers : null;
    const attachments = Array.isArray(options.attachments) ? options.attachments : null;
    const provenance = options.provenance || {};
    const rawEvidence = options.rawEvidence || description || title || '';

    // Retrieval Status
    const retrievalStatus = Object.assign({
      status: 'MANUAL', // 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'MANUAL' | 'GUIDED'
      platform: 'manual',
      url: null,
      fieldsRetrieved: [],
      missingFields: [],
      failureReason: null,
      fallbackAction: null,
      isIncomplete: false,
      notes: null
    }, options.retrievalStatus || {});

    // Compute missing information list
    const missingInfo = [];
    if (!title && !ticketId) {
      missingInfo.push('Ticket Subject / Identifier not provided');
    }
    if (!description && (!conversation || !conversation.rawText)) {
      missingInfo.push('Detailed problem description not provided');
    }

    return {
      source,
      ticketId,
      title,
      description,
      category,
      subcategory,
      conversation,
      guidedAnswers,
      attachments,
      retrievalStatus,
      missingInformation: missingInfo,
      provenance,
      rawEvidence,

      /**
       * Returns a single consolidated search text for policy vectorization & signal extraction
       */
      getConsolidatedText() {
        const parts = [];
        if (this.ticketId) parts.push(`Ticket ID: ${this.ticketId}`);
        if (this.category) parts.push(`Category: ${this.category}`);
        if (this.subcategory) parts.push(`Subcategory: ${this.subcategory}`);
        if (this.title) parts.push(this.title);
        if (this.description) parts.push(this.description);

        if (this.guidedAnswers && this.guidedAnswers.length > 0) {
          const guidedStr = this.guidedAnswers.map(g => `${g.question}: ${g.answer}`).join('. ');
          parts.push(`Guided intake responses: ${guidedStr}`);
        }

        if (this.conversation) {
          if (this.conversation.hasStructuredMessages && this.conversation.messages.length > 0) {
            const dialogue = this.conversation.messages.map(m => `${m.speaker}: ${m.text}`).join('\n');
            parts.push(`Support Conversation:\n${dialogue}`);
          } else if (this.conversation.rawText) {
            parts.push(this.conversation.rawText);
          }
          if (this.conversation.extractedResolutions && this.conversation.extractedResolutions.length > 0) {
            parts.push(`Stated resolutions: ${this.conversation.extractedResolutions.join(', ')}`);
          }
        }

        if (this.attachments && this.attachments.length > 0) {
          this.attachments.forEach(att => {
            if (att.textExcerpt) {
              parts.push(`Attachment [${att.name}]: ${att.textExcerpt}`);
            }
          });
        }

        return parts.join('\n\n').trim();
      },

      /**
       * Detect missing policy conditions given a matched policy
       */
      detectPolicyGaps(policy) {
        if (!policy) return [];
        const gaps = [];
        const textLower = this.getConsolidatedText().toLowerCase();

        // Check if policy has contractor exception and ticket doesn't specify employee type
        if (policy.exceptions && /contractor|third[\s-]party|vendor/i.test(policy.exceptions)) {
          if (!/employee|contractor|vendor|third[\s-]party|staff/i.test(textLower)) {
            gaps.push('User employment status (Employee vs. Contractor) is unspecified. Required by Policy Exception clause.');
          }
        }

        // Check if policy requires executive / VIP authorization
        if (policy.exceptions && /vip|executive|director|vp/i.test(policy.exceptions)) {
          if (!/vip|executive|director|vp|regular|standard/i.test(textLower)) {
            gaps.push('VIP / Executive classification unverified.');
          }
        }

        // Check if policy requires identity verification
        if (policy.resolution && /verify|verification|identity|id/i.test(policy.resolution)) {
          if (!/verified|verification|manager|approved|identification/i.test(textLower)) {
            gaps.push('Identity verification confirmation not found in ticket record.');
          }
        }

        // Check device ownership for VPN/Network
        if (policy.conditions && /corporate|byod|personal/i.test(policy.conditions)) {
          if (!/corporate|company-owned|personal|byod|laptop|workstation/i.test(textLower)) {
            gaps.push('Device ownership (Corporate Asset vs Personal Device) is unspecified.');
          }
        }

        return gaps;
      }
    };
  }

  return {
    createNormalizedTicket
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TicketModel;
}
