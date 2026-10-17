const PolicyEngine = (function () {
  'use strict';

  const COMMON_MISSPELLINGS = {
    passwrod: 'password', passord: 'password', pasword: 'password', psswrd: 'password',
    locekd: 'locked', lokced: 'locked', loced: 'locked',
    acount: 'account', accout: 'account', acnt: 'account',
    priter: 'printer', pritner: 'printer', printr: 'printer',
    softare: 'software', sofware: 'software', sftware: 'software',
    conection: 'connection', conect: 'connect', conected: 'connected',
    instll: 'install', instal: 'install', instaled: 'installed',
    restrt: 'restart', rebot: 'reboot', restrted: 'restarted',
    delte: 'delete', delet: 'delete', deletd: 'deleted',
    recovry: 'recovery', recovr: 'recover', recvrd: 'recovered',
    monitr: 'monitor', scrn: 'screen', scren: 'screen',
    emial: 'email', maill: 'mail', outlok: 'outlook',
    credentails: 'credentials', credintials: 'credentials',
    permisson: 'permission', privilage: 'privilege', priviledge: 'privilege',
    refnd: 'refund', refudn: 'refund', reifund: 'refund',
    cancle: 'cancel', cancled: 'cancelled', canclation: 'cancellation',
    delivry: 'delivery', delvery: 'delivery', delivred: 'delivered',
    receit: 'receipt', reciept: 'receipt',
    inovice: 'invoice', invoce: 'invoice',
    leav: 'leave', vaccation: 'vacation', vaccance: 'vacation'
  };

  const ABBREVIATIONS = {
    sspr: 'self service password reset',
    mfa: 'multi factor authentication',
    '2fa': 'two factor authentication',
    ad: 'active directory',
    bsod: 'blue screen crash dump kernel panic',
    vpn: 'virtual private network remote connection',
    pw: 'password',
    pwd: 'password',
    owa: 'outlook webmail email',
    dc: 'domain controller',
    sccm: 'sccm software deployment',
    pto: 'paid time off vacation leave',
    sla: 'service level agreement deadline',
    sop: 'standard operating procedure',
    eta: 'estimated arrival time delivery'
  };

  const FAILURE_MARKERS = new Set(['cannot', 'cant', 'unable', 'failed', 'failing', 'refused', 'rejected', 'broken', 'error', 'defect', 'missing', 'damaged']);
  const STATE_NEGATION_MARKERS = new Set(['not', 'no', 'never', 'neither', 'nor', 'without', 'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt', 'wont', 'hardly']);
  const ACTION_VERBS = new Set(['authenticate', 'connect', 'login', 'log', 'signin', 'sign', 'print', 'send', 'receive', 'access', 'install', 'deploy', 'boot', 'start', 'load', 'work', 'open', 'refund', 'reimburse', 'deliver']);

  const HISTORICAL_RESOLVED = [
    /\b(?:was|were|had|previously)\b[\w\s]{1,40}\b(?:yesterday|earlier|before)\b[\w\s]{0,40}\b(?:now|today|currently)?\s*(?:working|works|fine|ok|resolved|fixed|accessible)\b/i,
    /\b(?:already|previously|has\s+been)\s+(?:resolved|fixed|working\s+now|restored)\b/i
  ];

  function normalize(text) {
    if (typeof text !== 'string') return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\u2018\u2019\x60\u00B4]/g, "'")
      .replace(/[\u201C\u201D]/g, ' ')
      .replace(/n't\b/g, ' not')
      .replace(/'m\b/g, ' am')
      .replace(/'s\b/g, ' ')
      .replace(/'re\b/g, ' are')
      .replace(/'ve\b/g, ' have')
      .replace(/'ll\b/g, ' will')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function expandTokens(text) {
    if (!text) return '';
    return text.split(' ').map(w => COMMON_MISSPELLINGS[w] || ABBREVIATIONS[w] || w).join(' ');
  }

  function extractSignals(rawText) {
    const norm = normalize(rawText);
    const expanded = expandTokens(norm);
    const isHistorical = HISTORICAL_RESOLVED.some(p => p.test(rawText) || p.test(norm));
    const clauses = norm.split(/[,;.!?]|\b(?:but|however|although|yet|except)\b/);

    const negatedTokens = new Set();
    const positiveTokens = new Set();

    clauses.forEach(clause => {
      const words = clause.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        const w = COMMON_MISSPELLINGS[words[i]] || words[i];
        if (STATE_NEGATION_MARKERS.has(w)) {
          let tIdx = i + 1;
          const SKIP_NEG_FILLER = new Set(['a', 'an', 'the', 'have', 'has', 'had', 'any', 'get', 'see', 'experience', 'experiencing', 'such', 'with']);
          while (tIdx < words.length && SKIP_NEG_FILLER.has(words[tIdx])) tIdx++;
          if (tIdx < words.length) {
            const nextW = COMMON_MISSPELLINGS[words[tIdx]] || words[tIdx];
            if (!ACTION_VERBS.has(nextW) && nextW.length > 2) {
              negatedTokens.add(nextW);
              i = tIdx;
            }
          }
          continue;
        }
        if (FAILURE_MARKERS.has(w)) continue;
        if (w.length > 1) {
          positiveTokens.add(w);
        }
      }
    });

    return {
      normalizedText: expanded,
      positiveTokens,
      negatedTokens,
      isHistorical
    };
  }

  function detectDirectiveConflict(textA, textB) {
    if (!textA || !textB) return false;
    const a = normalize(textA);
    const b = normalize(textB);

    const ALLOW_WORDS = ['approve', 'approved', 'eligible', 'allow', 'allowed', 'grant', 'reimburse', 'reimbursable', 'valid', 'issue refund', 'process replacement'];
    const DENY_WORDS = ['deny', 'denied', 'ineligible', 'disallow', 'disallowed', 'reject', 'rejected', 'prohibit', 'forbidden', 'no refund', 'non refundable', 'not eligible', 'not permitted'];

    const aAllows = ALLOW_WORDS.some(w => a.includes(w));
    const aDenies = DENY_WORDS.some(w => a.includes(w));
    const bAllows = ALLOW_WORDS.some(w => b.includes(w));
    const bDenies = DENY_WORDS.some(w => b.includes(w));

    return (aAllows && bDenies) || (aDenies && bAllows);
  }

  function evaluateRequirements(text, ticketText, negatedTokens) {
    if (!text || !text.trim()) return [];
    const normTicket = normalize(ticketText);
    const rawItems = text.split(/[;\n•·]|(?:\b\d+[\.\)]\s+)/).map(s => s.trim()).filter(Boolean);
    const STOP = new Set(['the', 'and', 'for', 'with', 'must', 'have', 'been', 'from', 'this', 'that', 'shall', 'will', 'should', 'each', 'every', 'when', 'only']);

    return rawItems.map(item => {
      const words = normalize(item).split(' ').filter(w => w.length > 3 && !STOP.has(w));
      if (words.length === 0) {
        return { text: item, status: 'UNKNOWN' };
      }

      const anyNegated = words.some(w => negatedTokens.has(w));
      if (anyNegated) {
        return { text: item, status: 'NOT_SATISFIED' };
      }

      const matchCount = words.filter(w => normTicket.includes(w)).length;
      if (matchCount >= Math.min(2, words.length)) {
        return { text: item, status: 'SUPPORTED' };
      }

      return { text: item, status: 'UNKNOWN' };
    });
  }

  function matchTicket(ticket, policies) {
    if (!ticket || (!ticket.title && !ticket.description && !(ticket.getConsolidatedText && ticket.getConsolidatedText()))) {
      return {
        matched: false,
        status: 'NO_POLICY_FOUND',
        reason: 'Ticket title and description are empty.',
        topMatch: null
      };
    }

    if (!Array.isArray(policies) || policies.length === 0) {
      return {
        matched: false,
        status: 'NO_POLICY_FOUND',
        reason: 'No policies available in library. Please upload policy documents first.'
      };
    }

    const fullText = ticket.getConsolidatedText ? ticket.getConsolidatedText() : `${ticket.title || ''} ${ticket.description || ''}`;
    const tSignals = extractSignals(ticket.title || '');
    const dSignals = extractSignals(ticket.description || fullText);

    if (tSignals.isHistorical || dSignals.isHistorical) {
      return {
        matched: false,
        status: 'NO_POLICY_FOUND',
        reason: 'The issue described appears already resolved in the past according to ticket phrasing.'
      };
    }

    const hasWorkingAssert = /\b((working|works?)\s+(fine|ok|properly)|functioning)\b/i.test(fullText);
    const hasFailureAssert = /\b(unable|cannot|cant|failed|failing|error)\b/i.test(fullText);

    // Generalized token contradiction detection (any symptom asserted and negated)
    let tokenContradiction = false;
    for (const tok of tSignals.negatedTokens) {
      if (tSignals.positiveTokens.has(tok)) {
        tokenContradiction = true;
        break;
      }
    }
    if (!tokenContradiction) {
      for (const tok of dSignals.negatedTokens) {
        if (dSignals.positiveTokens.has(tok)) {
          tokenContradiction = true;
          break;
        }
      }
    }

    const hasContradiction = (hasWorkingAssert && hasFailureAssert) || tokenContradiction;

    // Index policies into TF-IDF vector space
    let tfidfResults = [];
    if (typeof TfIdfEngine !== 'undefined') {
      const index = new TfIdfEngine.TfIdfIndex();
      policies.forEach((p, idx) => {
        const pid = p.internalReference || p.id || p.policyId || `POLICY_ITEM_${idx}`;
        if (!p || !pid) return;
        const docText = `${p.name || p.title || ''} ${p.category || ''} ${p.conditions || ''} ${p.exceptions || ''} ${p.resolution || ''} ${(p.keywords || []).join(' ')} ${p.mainText || ''}`;
        index.addDocument(pid, docText, p);
      });
      index.buildIndex();
      tfidfResults = index.query(fullText, policies.length);
    }

    const tfidfMap = new Map();
    tfidfResults.forEach(r => tfidfMap.set(r.id, r));

    let mlResult = null;
    if (typeof LocalClassifier !== 'undefined' && LocalClassifier.defaultClassifier) {
      mlResult = LocalClassifier.defaultClassifier.predict(fullText);
    }

    const scored = [];

    for (let pIdx = 0; pIdx < policies.length; pIdx++) {
      const p = policies[pIdx];
      const pid = p.internalReference || p.id || p.policyId || `POLICY_ITEM_${pIdx}`;
      if (!p || !pid) continue;

      const keywords = Array.isArray(p.keywords) ? p.keywords : [];
      let coreNegated = false;
      for (const kw of keywords) {
        const normKw = normalize(kw);
        for (const t of normKw.split(' ')) {
          if (tSignals.negatedTokens.has(t) || dSignals.negatedTokens.has(t)) {
            if (!tSignals.positiveTokens.has(t) && !dSignals.positiveTokens.has(t)) {
              coreNegated = true;
              break;
            }
          }
        }
        if (coreNegated) break;
      }
      if (coreNegated) continue;

      let score = 0;
      const matchedTerms = [];

      const tfidfEntry = tfidfMap.get(pid);
      if (tfidfEntry) {
        score += tfidfEntry.similarity * 25.0;
        if (tfidfEntry.matchingTerms) {
          matchedTerms.push(...tfidfEntry.matchingTerms.slice(0, 5));
        }
      }

      const policyDisplayName = p.name || p.title || '';
      if (policyDisplayName) {
        const normName = normalize(policyDisplayName);
        if (tSignals.normalizedText.includes(normName)) {
          score += 20.0;
          matchedTerms.push(policyDisplayName);
        } else if (dSignals.normalizedText.includes(normName)) {
          score += 10.0;
          matchedTerms.push(policyDisplayName);
        }
      }

      for (const kw of keywords) {
        const normKw = normalize(kw);
        if (!normKw) continue;
        if (tSignals.normalizedText.includes(normKw)) {
          score += 12.0;
          matchedTerms.push(kw);
        } else if (dSignals.normalizedText.includes(normKw)) {
          score += 6.0;
          matchedTerms.push(kw);
        }
      }

      const synonyms = Array.isArray(p.synonyms) ? p.synonyms : [];
      for (const syn of synonyms) {
        const normSyn = normalize(syn);
        if (!normSyn) continue;
        if (tSignals.normalizedText.includes(normSyn)) {
          score += 10.0;
          matchedTerms.push(syn);
        } else if (dSignals.normalizedText.includes(normSyn)) {
          score += 5.0;
          matchedTerms.push(syn);
        }
      }

      let exceptionTriggered = false;
      const matchedExceptions = [];
      const excText = p.exceptions || '';
      if (excText) {
        const excNorm = normalize(excText);
        const GENERIC_EXC_WORDS = new Set([
          'require', 'strictly', 'before', 'access', 'account', 'accounts', 'user', 'users',
          'system', 'service', 'with', 'from', 'this', 'that', 'have', 'been', 'after',
          'only', 'when', 'more', 'than', 'over', 'into', 'under', 'between', 'within',
          'minutes', 'hours', 'days', 'time', 'restaurant', 'partner', 'company', 'organization'
        ]);

        const corePolicyWords = new Set();
        (normalize(policyDisplayName) + ' ' + normalize(p.category || '')).split(' ').forEach(w => {
          if (w.length > 2) corePolicyWords.add(w);
        });
        keywords.forEach(k => {
          normalize(k).split(' ').forEach(w => {
            if (w.length > 2) corePolicyWords.add(w);
          });
        });

        const excTokens = excNorm.split(' ').filter(w => w.length > 3 && !GENERIC_EXC_WORDS.has(w) && !corePolicyWords.has(w));
        const hits = excTokens.filter(t => tSignals.normalizedText.includes(t) || dSignals.normalizedText.includes(t));
        if (hits.length > 0) {
          exceptionTriggered = true;
          matchedExceptions.push(excText);
          score += 4.0;
        }
      }

      if (mlResult && mlResult.isTrained && mlResult.probabilities) {
        const mlProb = mlResult.probabilities[pid] || mlResult.probabilities[p.category] || 0;
        score += mlProb * 10.0;
      }

      if (score > 0) {
        scored.push({
          policy: p,
          score: Math.round(score * 10) / 10,
          similarityScore: tfidfEntry ? tfidfEntry.similarity : 0,
          mlProbability: (mlResult && mlResult.isTrained && mlResult.probabilities) ? (mlResult.probabilities[pid] || 0) : null,
          matchedTerms: Array.from(new Set(matchedTerms)),
          exceptionTriggered,
          matchedExceptions
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (hasContradiction && scored.length > 0) {
      return {
        matched: false,
        status: 'CONFLICTING_POLICIES',
        reason: 'Ticket contains conflicting problem statements (both asserting and negating the same symptom). Operator verification is required.',
        topCandidate: scored[0] ? scored[0].policy : null
      };
    }

    const CERTAINTY_THRESHOLD = 7.0;
    if (scored.length === 0 || scored[0].score < CERTAINTY_THRESHOLD) {
      return {
        matched: false,
        status: 'NO_POLICY_FOUND',
        reason: scored.length === 0
          ? 'No matching policies or relevant conditions identified from uploaded documents.'
          : `Highest candidate confidence (${scored[0].score}) is below certainty threshold (${CERTAINTY_THRESHOLD}).`,
        topMatch: null
      };
    }

    const top = scored[0];
    const runnerUp = scored.length > 1 ? scored[1] : null;

    // Check for conflicting operational directives between top candidate policies
    if (runnerUp && runnerUp.score >= CERTAINTY_THRESHOLD && (runnerUp.score >= top.score * 0.5 || runnerUp.score >= 10.0)) {
      const topDir = (top.policy.resolution || '') + ' ' + (top.policy.conditions || '') + ' ' + (top.policy.mainText || '');
      const runDir = (runnerUp.policy.resolution || '') + ' ' + (runnerUp.policy.conditions || '') + ' ' + (runnerUp.policy.mainText || '');
      if (detectDirectiveConflict(topDir, runDir)) {
        return {
          matched: false,
          status: 'CONFLICTING_POLICIES',
          reason: `Conflicting policy directives identified between "${top.policy.name || top.policy.title || 'Candidate A'}" and "${runnerUp.policy.name || runnerUp.policy.title || 'Candidate B'}". Uploaded source documents do not establish precedence.`,
          topCandidate: top.policy,
          conflictingCandidate: runnerUp.policy
        };
      }
    }

    let isAmbiguous = false;
    let ambiguityWarning = null;
    if (runnerUp && runnerUp.score >= CERTAINTY_THRESHOLD && runnerUp.score >= top.score * 0.80 && (top.score - runnerUp.score <= 6.0)) {
      isAmbiguous = true;
      const topExplicitId = top.policy.hasExplicitId !== undefined ? top.policy.hasExplicitId : Boolean(top.policy.policyId || top.policy.id);
      const runExplicitId = runnerUp.policy.hasExplicitId !== undefined ? runnerUp.policy.hasExplicitId : Boolean(runnerUp.policy.policyId || runnerUp.policy.id);
      const topIdStr = topExplicitId ? ` (${top.policy.policyId || top.policy.id})` : '';
      const runIdStr = runExplicitId ? ` (${runnerUp.policy.policyId || runnerUp.policy.id})` : '';
      ambiguityWarning = `Multiple policies match closely: "${top.policy.name || top.policy.title}"${topIdStr} and "${runnerUp.policy.name || runnerUp.policy.title}"${runIdStr}.`;
    }

    const hasExplicitId = top.policy.hasExplicitId !== undefined
      ? Boolean(top.policy.hasExplicitId)
      : Boolean(top.policy.policyId || top.policy.id);

    const hasExplicitTitle = top.policy.hasExplicitTitle !== undefined
      ? Boolean(top.policy.hasExplicitTitle)
      : Boolean(top.policy.title || top.policy.name);

    const hasExplicitResolution = top.policy.hasExplicitResolution !== undefined
      ? Boolean(top.policy.hasExplicitResolution)
      : Boolean(top.policy.resolution || top.policy.approvedSolution);

    const policyNameDisplay = top.policy.title || top.policy.name || (hasExplicitId ? `Policy ${top.policy.policyId || top.policy.id}` : 'Policy Clause');
    const uniqueTerms = top.matchedTerms.slice(0, 5);
    const whyApplies = uniqueTerms.length > 0
      ? `Ticket matches policy criteria for "${policyNameDisplay}" via verified signals: ${uniqueTerms.join(', ')}.`
      : `Ticket problem statement matches requirements defined in "${policyNameDisplay}".`;

    let evidence = top.policy.conditions || top.policy.mainText || top.policy.rawText || '';
    if (hasExplicitResolution && (top.policy.resolution || top.policy.approvedSolution) && !evidence.includes(top.policy.resolution || top.policy.approvedSolution)) {
      evidence = `${evidence}\nApproved Resolution: ${top.policy.resolution || top.policy.approvedSolution}`;
    }

    const missingInfoGaps = (ticket && typeof ticket.detectPolicyGaps === 'function')
      ? ticket.detectPolicyGaps(top.policy)
      : [];

    let status = isAmbiguous ? 'MANUAL_REVIEW_REQUIRED' : 'MATCH_FOUND';
    let reviewReason = ambiguityWarning;
    if (!isAmbiguous && top.exceptionTriggered && missingInfoGaps.length > 0) {
      status = 'MANUAL_REVIEW_REQUIRED';
      reviewReason = `Policy exception applies, but critical verification information is missing: ${missingInfoGaps.join('; ')}`;
    }

    const confidenceLabel = isAmbiguous
      ? 'Ambiguous Match'
      : (status === 'MANUAL_REVIEW_REQUIRED' ? 'Manual Review Required' : (top.score >= 20.0 ? 'High Confidence' : 'Moderate Confidence'));

    // Structured condition & exception breakdown
    const evaluatedConditions = evaluateRequirements(
      top.policy.conditions || '',
      fullText,
      new Set([...tSignals.negatedTokens, ...dSignals.negatedTokens])
    );

    const evaluatedExceptions = evaluateRequirements(
      top.policy.exceptions || '',
      fullText,
      new Set()
    );

    // Other relevant policies
    const otherMatches = scored.slice(1, 4).map(s => {
      const sExplicitId = s.policy.hasExplicitId !== undefined
        ? Boolean(s.policy.hasExplicitId)
        : Boolean(s.policy.policyId || s.policy.id);
      const sExplicitRes = s.policy.hasExplicitResolution !== undefined
        ? Boolean(s.policy.hasExplicitResolution)
        : Boolean(s.policy.resolution || s.policy.approvedSolution);
      return {
        id: sExplicitId ? (s.policy.policyId || s.policy.id) : null,
        internalReference: s.policy.internalReference || s.policy.id,
        hasExplicitId: sExplicitId,
        name: s.policy.title || s.policy.name || 'Related Policy',
        category: s.policy.category || null,
        sourceDocName: s.policy.sourceDocName || s.policy.sourceDocumentName || 'Policy Document',
        pageOrRow: s.policy.pageOrRow || (s.policy.sourceLocations && s.policy.sourceLocations[0] ? s.policy.sourceLocations[0].label : ''),
        score: s.score,
        similarityScore: s.similarityScore,
        evidence: cleanExcerpt(s.policy.conditions || s.policy.mainText || s.policy.rawText || '', 200),
        resolution: sExplicitRes ? (s.policy.resolution || s.policy.approvedSolution) : null
      };
    });

    return {
      matched: true,
      status,
      isAmbiguous,
      ambiguityWarning: reviewReason,
      confidence: confidenceLabel,
      similarityScore: top.similarityScore,
      mlProbability: top.mlProbability,
      isMlTrained: Boolean(mlResult && mlResult.isTrained),
      retrievalMethod: 'TF-IDF Vector Space Model (Cosine Similarity)',
      missingInformation: missingInfoGaps,
      evaluatedConditions,
      evaluatedExceptions,
      otherMatches,
      topMatch: {
        id: hasExplicitId ? (top.policy.policyId || top.policy.id) : null,
        internalReference: top.policy.internalReference || top.policy.id,
        hasExplicitId,
        name: policyNameDisplay,
        title: hasExplicitTitle ? (top.policy.title || top.policy.name) : null,
        hasExplicitTitle,
        category: top.policy.category || null,
        hasExplicitCategory: Boolean(top.policy.hasExplicitCategory !== undefined ? top.policy.hasExplicitCategory : top.policy.category),
        sourceDocName: top.policy.sourceDocName || top.policy.sourceDocumentName || 'Policy Document',
        pageOrRow: top.policy.pageOrRow || (top.policy.sourceLocations && top.policy.sourceLocations[0] ? top.policy.sourceLocations[0].label : 'Section 1'),
        sourceLocations: top.policy.sourceLocations || [],
        sourceDocumentId: top.policy.sourceDocumentId || null,
        resolution: hasExplicitResolution ? (top.policy.resolution || top.policy.approvedSolution) : null,
        hasExplicitResolution,
        conditions: top.policy.conditions || '',
        hasExplicitConditions: Boolean(top.policy.hasExplicitConditions || (top.policy.conditions && top.policy.conditions.trim())),
        exceptions: top.policy.exceptions || '',
        hasExplicitExceptions: Boolean(top.policy.hasExplicitExceptions || (top.policy.exceptions && top.policy.exceptions.trim())),
        mainText: top.policy.mainText || top.policy.rawText || '',
        metadataCompleteness: top.policy.metadataCompleteness || 'partial',
        score: top.score,
        evidence: cleanExcerpt(evidence, 350),
        fullEvidence: evidence,
        whyApplies,
        exceptionTriggered: top.exceptionTriggered,
        matchedExceptions: top.matchedExceptions
      },
      runnerUp: isAmbiguous && runnerUp ? {
        id: (runnerUp.policy.hasExplicitId !== undefined ? runnerUp.policy.hasExplicitId : Boolean(runnerUp.policy.policyId || runnerUp.policy.id))
          ? (runnerUp.policy.policyId || runnerUp.policy.id) : null,
        name: runnerUp.policy.title || runnerUp.policy.name
      } : null
    };
  }

  function cleanExcerpt(text, maxLen) {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen) + '...';
  }

  return {
    matchTicket,
    normalize,
    extractSignals,
    detectDirectiveConflict
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PolicyEngine;
}
