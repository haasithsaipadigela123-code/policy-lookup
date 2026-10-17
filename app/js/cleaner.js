/**
 * Policy Lookup — Copied Text Cleaner & Noise Filter
 * 
 * Automatically sanitizes user-pasted text by stripping:
 * 1. Email signatures ("Best regards...", "Sent from my iPhone", etc.)
 * 2. Confidentiality & legal disclaimers
 * 3. Mail headers (From:, To:, Sent:, Date:, Subject:)
 * 4. Quoted line markers (> )
 * 5. Web UI debris (Reply, Forward, Copy link, timestamps)
 * 6. Automated chatbot greeting/exit notices
 * 7. HTML pasting remnants & zero-width artifacts
 */

const TextCleaner = (function () {
  'use strict';

  // Email signature lead-ins
  const SIGN_OFF_REGEX = /(?:\r?\n|^)\s*(?:thanks\s*(?:&|and)\s*regards|best\s*regards|kind\s*regards|warm\s*regards|with\s*regards|regards|sincerely|cheers|thanks\s+in\s+advance|thank\s*you|thanks)[,\s]*\r?\n+[\s\S]*$/i;

  // Mobile device signatures
  const DEVICE_SIG_REGEX = /(?:\r?\n|^)\s*(?:sent\s+from\s+(?:my\s+)?(?:iphone|ipad|galaxy|android|mobile|smartphone|device)|get\s+outlook\s+for\s+(?:ios|android)|sent\s+from\s+(?:outlook|mail\s+for\s+windows))[^\r\n]*/gi;

  // Legal and confidentiality disclaimers
  const DISCLAIMER_REGEXES = [
    /(?:confidentiality\s+notice|disclaimer|notice\s+of\s+confidentiality|privileged[\s\/]+confidential)[\s\S]*?(?=(?:\r?\n\s*\r?\n|$))/gi,
    /(?:this\s+(?:e[-]?mail|message)\s+(?:and\s+any\s+attachments\s+)?is\s+intended\s+(?:only|solely)\s+for\s+the\s+use\s+of)[\s\S]*?(?=(?:\r?\n\s*\r?\n|$))/gi,
    /please\s+consider\s+the\s+environment\s+before\s+printing\s+this\s+email\.?/gi,
    /(?:caution:\s*)?this\s+email\s+originated\s+from\s+outside\s+(?:of\s+)?the\s+organization\.?/gi,
    /(?:click\s+here\s+to\s+unsubscribe|unsubscribe\s*\|\s*update\s+(?:your\s+)?preferences)[^\r\n]*/gi
  ];

  // Automated notification / tag noise
  const TAG_NOISE_REGEX = /\[(?:EXTERNAL\s*(?:EMAIL)?|SPAM\s*DETECTED|CAUTION|CONFIDENTIAL|SECURE\s*MESSAGE|AUTO-GENERATED)\]\s*/gi;

  // Standalone UI button / action lines
  const UI_LINE_REGEX = /^(?:reply|quote|quote\s*reply|forward|like|react|copy\s*link|translate|show\s*original|add\s*comment|view\s*in\s*browser|hide\s*details|show\s*details|click\s*here)\s*$/i;

  // System status / bot entry lines
  const BOT_STATUS_REGEX = /^(?:(?:system|bot|notification):\s*)?(?:an\s+agent\s+has\s+joined|user\s+joined\s+the\s+chat|chat\s+session\s+(?:started|ended)|you\s+are\s+now\s+connected|transcript\s+generated|rate\s+your\s+chat)[^\r\n]*$/i;

  // Email header lines
  const EMAIL_HEADER_LINE_REGEX = /^(?:from|to|sent|date|cc|bcc):\s+.*$/i;

  // Separator lines
  const SEPARATOR_LINE_REGEX = /^[\-\=\_\*~]{3,}\s*$/;

  /**
   * Sanitizes pasted or copied text, removing unwanted noise
   * @param {string} rawText - The uncleaned string from clipboard or file
   * @returns {{ cleanedText: string, changed: boolean, removedArtifacts: string[] }}
   */
  function cleanCopiedText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { cleanedText: '', changed: false, removedArtifacts: [] };
    }

    const removedArtifacts = [];
    let text = rawText;

    // 1. Remove zero-width & non-standard whitespace
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
    text = text.replace(/\u00A0/g, ' ');

    // 2. Decode common HTML entities if raw pasted HTML
    if (text.includes('&nbsp;') || text.includes('&lt;') || text.includes('&amp;')) {
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Strip raw HTML paragraph breaks and simple tags
    if (/<br\s*\/?>/i.test(text) || /<\/p>/i.test(text)) {
      text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '');
      removedArtifacts.push('HTML tags');
    }

    // 3. Remove email tag notices like [EXTERNAL EMAIL]
    if (TAG_NOISE_REGEX.test(text)) {
      text = text.replace(TAG_NOISE_REGEX, '');
      removedArtifacts.push('Security tag prefixes');
    }

    // 4. Remove mobile device signatures
    if (DEVICE_SIG_REGEX.test(text)) {
      text = text.replace(DEVICE_SIG_REGEX, '');
      removedArtifacts.push('Mobile device signature');
    }

    // 5. Remove legal & confidentiality disclaimers
    DISCLAIMER_REGEXES.forEach(re => {
      if (re.test(text)) {
        text = text.replace(re, '');
        removedArtifacts.push('Legal/Confidentiality disclaimer');
      }
    });

    // 6. Split into lines and process line-by-line
    const lines = text.split(/\r?\n/);
    const cleanedLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Strip quoting marks (> )
      line = line.replace(/^[>|\s]{1,4}/, '');

      const trimmedLine = line.trim();

      // Check for standalone UI lines
      if (UI_LINE_REGEX.test(trimmedLine)) {
        removedArtifacts.push(`UI artifact ("${trimmedLine}")`);
        continue;
      }

      // Check for bot status lines
      if (BOT_STATUS_REGEX.test(trimmedLine)) {
        removedArtifacts.push(`Bot notification`);
        continue;
      }

      // Check for email header lines
      if (EMAIL_HEADER_LINE_REGEX.test(trimmedLine)) {
        removedArtifacts.push(`Email header`);
        continue;
      }

      // Check for separator lines
      if (SEPARATOR_LINE_REGEX.test(trimmedLine)) {
        continue;
      }

      cleanedLines.push(line);
    }

    text = cleanedLines.join('\n');

    // 7. Check for sign-off signatures at the end of the text
    // Strict safeguard: Inspect lines following the sign-off to ensure they are genuinely
    // sender contact details (name, title, phone, email) and NOT ticket facts or policy conditions.
    const signOffMatch = text.match(/(?:\r?\n|^)\s*(?:thanks\s*(?:&|and)\s*regards|best\s*regards|kind\s*regards|warm\s*regards|with\s*regards|regards|sincerely|cheers|thanks\s+in\s+advance|thank\s*you)[,\s]*\r?\n([\s\S]*)$/i);
    if (signOffMatch) {
      const trailingBlock = signOffMatch[1].trim();
      const preText = text.slice(0, signOffMatch.index).trim();

      if (preText.length > 15) {
        const trailingLines = trailingBlock.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        // A genuine signature block has 1 to 5 short lines (Name, Role, Company, Phone/Email)
        // If trailing lines contain questions (?), sentence periods, or policy keywords, PRESERVE IT!
        const PROBLEM_KEYWORDS = /\b(ticket|error|issue|problem|fail|cannot|unable|exception|contractor|approved|requires?|manager|policy|refund|delay|replace|cancel|account|password|access|login|vpn)\b/i;
        const containsProblemFacts = trailingLines.some(l => PROBLEM_KEYWORDS.test(l) || l.includes('?') || l.length > 80);

        if (!containsProblemFacts && trailingLines.length <= 5) {
          text = preText;
          removedArtifacts.push('Sign-off signature');
        }
      }
    }

    // 8. Collapse 3+ newlines to max 2
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    const changed = text !== rawText.trim();
    return {
      cleanedText: text,
      changed,
      removedArtifacts: Array.from(new Set(removedArtifacts))
    };
  }

  return {
    cleanCopiedText
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextCleaner;
}
