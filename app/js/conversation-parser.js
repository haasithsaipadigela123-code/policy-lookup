/**
 * Policy Lookup — Conversation Parser Module
 * 
 * Accurately parses multi-message support conversations (from live chat,
 * email threads, Zendesk/Intercom transcripts, etc.).
 * 
 * Features:
 * - Preserves exact chronological message order.
 * - Extracts speaker labels when present (Customer, Agent, Support, named users).
 * - Extracts timestamps when present (12h, 24h, ISO formats).
 * - Preserves original message text verbatim.
 * - Extracts stated order or ticket identifiers (e.g., #1347, INC-1029, ORD-9921).
 * - Detects explicitly stated decisions and resolutions.
 * - FALLBACK: If unstructured, retains original text as raw evidence WITHOUT inventing speakers or timestamps.
 */

const ConversationParser = (function () {
  'use strict';

  // Recognized speaker role labels
  const ROLE_MAP = {
    customer: 'Customer',
    client: 'Customer',
    user: 'Customer',
    requester: 'Customer',
    caller: 'Customer',
    employee: 'Customer',
    buyer: 'Customer',
    consumer: 'Customer',
    agent: 'Support Agent',
    support: 'Support Agent',
    helpdesk: 'Support Agent',
    operator: 'Support Agent',
    tech: 'Support Agent',
    technician: 'Support Agent',
    admin: 'Support Agent',
    specialist: 'Support Agent',
    bot: 'System / Bot',
    system: 'System / Bot',
    auto: 'System / Bot'
  };

  // Resolution detection patterns
  const RESOLUTION_PATTERNS = [
    /\b(?:we\s+have|i\s+have)\s+(?:processed|issued|initiated|approved)\s+(?:a\s+)?(refund|replacement|cancellation|waiver|credit|exchange)\b/i,
    /\b(?:password\s+(?:has\s+been\s+)?reset|reset\s+link\s+sent|temporary\s+credentials?\s+issued)\b/i,
    /\b(?:account|profile|user)\s+(?:has\s+been\s+)?unlocked\b/i,
    /\bunlocked\s+(?:your\s+|the\s+)?(?:account|profile|user)\b/i,
    /\b(?:lockout\s+cleared|profile\s+enabled)\b/i,
    /\b(?:ticket\s+resolved|issue\s+resolved|case\s+closed|marked\s+as\s+resolved)\b/i,
    /\b(?:escalated\s+to|transferred\s+to|reassigned\s+to)\s+(?:tier\s*2|security|hardware|field\s+support|vendor\s+management)\b/i,
    /\b(?:vpn\s+profile\s+reinstalled|client\s+certificate\s+renewed|tunnel\s+reset)\b/i
  ];

  // Ticket / Order ID detection patterns
  const IDENTIFIER_PATTERNS = [
    /\b(INC-\d{4,8})\b/i,
    /\b(TCK-\d{4,8})\b/i,
    /\b(REQ-\d{4,8})\b/i,
    /\b(ORD-\d{4,10})\b/i,
    /\b(SR-\d{4,8})\b/i,
    /(?:^|[^\w])(#\d{3,8})\b/
  ];

  // Regex patterns for speaker lines
  // Examples:
  // "Agent [10:14 AM]: How can I help?"
  // "[10:14:00] Customer: My screen is black"
  // "John Doe (Support): We are looking into this"
  // "Agent: Please verify your phone number"
  // "2026-10-15 10:14 - Customer - I need a password reset"
  const SPEAKER_PATTERNS = [
    // [10:14 AM] Speaker: text
    /^\[([\d:APMapm\s\-\/\.T]+)\]\s*([^:–—]+?)\s*[:–—]\s*(.*)$/,
    // Speaker [10:14 AM]: text
    /^([^:\[\]–—]+?)\s*\[([\d:APMapm\s\-\/\.T]+)\]\s*[:–—]\s*(.*)$/,
    // 2026-10-15 10:14 - Speaker: text
    /^([\d:APMapm\s\-\/\.T]{6,25})\s*[-–—]\s*([^:–—]+?)\s*[:–—]\s*(.*)$/,
    // Speaker: text
    /^([A-Za-z0-9_\s\.\(\)\/]{2,35}?)\s*[:]\s*(.*)$/
  ];

  const TIMESTAMP_PATTERNS = [
    /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/,
    /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)\b/,
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/
  ];

  function extractIdentifiers(text) {
    if (!text || typeof text !== 'string') return [];
    const ids = new Set();
    IDENTIFIER_PATTERNS.forEach(pat => {
      const matches = text.match(new RegExp(pat.source, pat.flags + 'g'));
      if (matches) {
        matches.forEach(m => ids.add(m.trim().toUpperCase()));
      }
    });
    return Array.from(ids);
  }

  function extractResolutions(text) {
    if (!text || typeof text !== 'string') return [];
    const resolutions = [];
    RESOLUTION_PATTERNS.forEach(pat => {
      const match = text.match(pat);
      if (match) {
        resolutions.push(match[0].trim());
      }
    });
    return Array.from(new Set(resolutions));
  }

  function cleanSpeaker(raw) {
    if (!raw) return 'Unknown';
    let s = raw.trim().replace(/^[\(\[\{]/, '').replace(/[\)\]\}]$/, '').trim();
    const lower = s.toLowerCase();
    for (const [key, val] of Object.entries(ROLE_MAP)) {
      if (lower === key || lower.startsWith(key + ' ') || lower.includes(`(${key})`)) {
        return val;
      }
    }
    return s;
  }

  function cleanTimestamp(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    for (const pat of TIMESTAMP_PATTERNS) {
      const m = trimmed.match(pat);
      if (m) return m[1];
    }
    return trimmed;
  }

  /**
   * Parse conversation raw text into structured messages
   */
  function parseConversation(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        hasStructuredMessages: false,
        messages: [],
        rawText: '',
        extractedResolutions: [],
        extractedIdentifiers: [],
        summary: ''
      };
    }

    const trimmed = rawText.trim();
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const parsedMessages = [];
    let currentMessage = null;
    let structuredTurnCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let matched = false;

      // Check against speaker patterns
      for (const pattern of SPEAKER_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          let speaker = '';
          let timestamp = null;
          let content = '';

          if (pattern === SPEAKER_PATTERNS[0]) {
            // [Timestamp] Speaker: text
            timestamp = cleanTimestamp(match[1]);
            speaker = cleanSpeaker(match[2]);
            content = match[3].trim();
          } else if (pattern === SPEAKER_PATTERNS[1]) {
            // Speaker [Timestamp]: text
            speaker = cleanSpeaker(match[1]);
            timestamp = cleanTimestamp(match[2]);
            content = match[3].trim();
          } else if (pattern === SPEAKER_PATTERNS[2]) {
            // 2026-10-15 10:14 - Speaker: text
            timestamp = cleanTimestamp(match[1]);
            speaker = cleanSpeaker(match[2]);
            content = match[3].trim();
          } else if (pattern === SPEAKER_PATTERNS[3]) {
            // Speaker: text
            speaker = cleanSpeaker(match[1]);
            content = match[2].trim();
          }

          // Validation: Ensure speaker is plausible (not a long paragraph or standard English sentence)
          const isPlausibleSpeaker = speaker.length <= 40 && !speaker.includes('.') && !/^(note|attention|remember|please|the|this|that|there|when|why|what|if)\b/i.test(speaker);

          if (isPlausibleSpeaker && content) {
            if (currentMessage) {
              parsedMessages.push(currentMessage);
            }
            currentMessage = {
              index: parsedMessages.length + 1,
              speaker,
              timestamp,
              text: content,
              rawLine: line
            };
            structuredTurnCount++;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        if (currentMessage) {
          // Multiline continuation of previous speaker's message
          currentMessage.text += '\n' + line;
        } else {
          // Line before any structured speaker
          // Keep as unassigned entry
        }
      }
    }

    if (currentMessage) {
      parsedMessages.push(currentMessage);
    }

    // Require at least 2 structured speaker turns to classify as structured conversation
    const hasStructuredMessages = structuredTurnCount >= 2 && parsedMessages.length >= 2;

    const allText = hasStructuredMessages
      ? parsedMessages.map(m => `${m.speaker}: ${m.text}`).join('\n')
      : trimmed;

    const extractedResolutions = extractResolutions(allText);
    const extractedIdentifiers = extractIdentifiers(allText);

    return {
      hasStructuredMessages,
      messages: hasStructuredMessages ? parsedMessages : [],
      rawText: trimmed,
      extractedResolutions,
      extractedIdentifiers,
      messageCount: hasStructuredMessages ? parsedMessages.length : 0,
      summary: hasStructuredMessages
        ? `Conversation with ${parsedMessages.length} messages between ${Array.from(new Set(parsedMessages.map(m => m.speaker))).join(', ')}`
        : 'Unstructured text input (original phrasing preserved)'
    };
  }

  /**
   * Format structured conversation into clean readable representation
   */
  function formatConversationHtml(convResult) {
    if (!convResult) return '';

    if (!convResult.hasStructuredMessages || convResult.messages.length === 0) {
      return `<div class="conv-raw-box"><pre>${escapeHtml(convResult.rawText)}</pre></div>`;
    }

    return `
      <div class="conv-thread-container">
        ${convResult.messages.map(m => {
          const isAgent = m.speaker.toLowerCase().includes('agent') || m.speaker.toLowerCase().includes('support') || m.speaker.toLowerCase().includes('helpdesk');
          const roleClass = isAgent ? 'conv-msg-agent' : 'conv-msg-customer';
          return `
            <div class="conv-msg-row ${roleClass}">
              <div class="conv-msg-bubble">
                <div class="conv-msg-header">
                  <strong class="conv-msg-speaker">${escapeHtml(m.speaker)}</strong>
                  ${m.timestamp ? `<span class="conv-msg-time">${escapeHtml(m.timestamp)}</span>` : ''}
                </div>
                <div class="conv-msg-text">${escapeHtml(m.text)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    parseConversation,
    formatConversationHtml,
    extractIdentifiers,
    extractResolutions
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationParser;
}
