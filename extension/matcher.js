(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PolicyMatcher = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COMMON_MISSPELLINGS = {
    'passwrod': 'password', 'passord': 'password', 'pasword': 'password', 'psswrd': 'password',
    'locekd': 'locked', 'lokced': 'locked', 'loced': 'locked',
    'acount': 'account', 'accout': 'account', 'acnt': 'account',
    'priter': 'printer', 'pritner': 'printer', 'printr': 'printer',
    'softare': 'software', 'sofware': 'software', 'sftware': 'software',
    'conection': 'connection', 'conect': 'connect', 'conected': 'connected',
    'instll': 'install', 'instal': 'install', 'instaled': 'installed',
    'restrt': 'restart', 'rebot': 'reboot', 'restrted': 'restarted',
    'delte': 'delete', 'delet': 'delete', 'deletd': 'deleted',
    'recovry': 'recovery', 'recovr': 'recover', 'recvrd': 'recovered',
    'monitr': 'monitor', 'scrn': 'screen', 'scren': 'screen',
    'emial': 'email', 'maill': 'mail', 'outlok': 'outlook',
    'credentails': 'credentials', 'credintials': 'credentials',
    'permisson': 'permission', 'privilage': 'privilege', 'priviledge': 'privilege'
  };

  const ABBREVIATIONS = {
    'sspr': 'self service password reset',
    'mfa': 'multi factor authentication',
    '2fa': 'two factor authentication',
    'ad': 'active directory',
    'bsod': 'blue screen crash dump kernel panic',
    'vpn': 'virtual private network remote connection',
    'pw': 'password',
    'pwd': 'password',
    'owa': 'outlook webmail email',
    'dc': 'domain controller',
    'sccm': 'system center configuration manager deployment'
  };

  const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
    'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
    'both', 'but', 'by', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
    'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he',
    'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
    'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
    'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
    'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
    'you', 'your', 'yours', 'yourself', 'yourselves',

    'hello', 'hi', 'hey', 'please', 'help', 'ticket', 'support', 'urgent', 'asap',
    'thanks', 'thank', 'greeting', 'greetings', 'regards'
  ]);

  const FAILURE_MARKERS = new Set([
    'cannot', 'cant', 'unable', 'failed', 'failing'
  ]);

  const STATE_NEGATION_MARKERS = new Set([
    'not', 'no', 'never', 'neither', 'nor', 'without', 'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt', 'wont', 'hardly'
  ]);

  const ACTION_VERBS = new Set([
    'authenticate', 'connect', 'login', 'log', 'signin', 'sign', 'print', 'send', 'receive', 'access', 'install', 'deploy', 'boot', 'start', 'load', 'work', 'open'
  ]);

  const MODAL_UNCERTAINTY_PATTERNS = [
    /\b(may\s+be|might\s+be|could\s+be|suspect\s+that|suspect\s+it\s+is|not\s+sure\s+if|possible|possibly|perhaps|wondering\s+if)\b/i
  ];

  const HISTORICAL_RESOLVED_PATTERNS = [
    /\b(?:was|were|had|previously)\b[\w\s]{1,40}\b(?:yesterday|earlier|before)\b[\w\s]{0,40}\b(?:now|today|currently)?\s*(?:working|works|fine|ok|resolved|fixed|accessible)\b/i,
    /\b(?:already|previously|has\s+been)\s+(?:resolved|fixed|working\s+now|restored)\b/i
  ];

  const DEFAULT_CONFIG = {
    minScoreThreshold: 6.0,
    titleWeight: 2.5,
    descriptionWeight: 1.0,
    phraseMatchPoints: 6.0,
    keywordTokenPoints: 2.5,
    synonymTokenPoints: 2.0,
    problemDescOverlapPoints: 0.5,
    ambiguityScoreRatioThreshold: 0.75,
    ambiguityAbsoluteDiffThreshold: 8.0
  };

  function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\u2018\u2019`´]/g, "'")
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

  function correctSpellingAndExpand(text) {
    if (!text) return '';
    const words = text.split(' ');
    const corrected = [];

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (COMMON_MISSPELLINGS[w]) {
        corrected.push(COMMON_MISSPELLINGS[w]);
      } else if (ABBREVIATIONS[w]) {
        corrected.push(ABBREVIATIONS[w]);
      } else {
        corrected.push(w);
      }
    }

    return corrected.join(' ');
  }

  function stemWord(word) {
    if (!word || word.length <= 3) return word;
    let w = word.toLowerCase();

    if (w.endsWith('sses')) return w.slice(0, -2);
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ss')) return w;
    if (w.endsWith('s') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);

    if (w.endsWith('eed')) return w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) {
      const base = w.slice(0, -3);
      if (base.endsWith('tt') || base.endsWith('pp') || base.endsWith('nn')) return base.slice(0, -1);
      return base;
    }
    if (w.endsWith('ed') && w.length > 4) {
      const base = w.slice(0, -2);
      if (base.endsWith('tt') || base.endsWith('pp') || base.endsWith('nn')) return base.slice(0, -1);
      return base;
    }

    if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
    if (w.endsWith('tion') && w.length > 6) return w.slice(0, -4);

    return w;
  }

  function extractSignals(rawText) {
    const normalized = normalizeText(rawText);
    const corrected = correctSpellingAndExpand(normalized);

    const isHistoricalResolved = HISTORICAL_RESOLVED_PATTERNS.some(pat => pat.test(rawText) || pat.test(normalized));
    const isModalUncertain = MODAL_UNCERTAINTY_PATTERNS.some(pat => pat.test(rawText) || pat.test(normalized));

    const clauses = normalized.split(/[,;.!?]|\b(?:but|however|although|yet|except)\b/);
    const negatedTokens = new Set();
    const positiveTokens = new Set();
    const rawTokens = [];
    const stemmedTokens = [];

    clauses.forEach(clause => {
      const words = clause.trim().split(/\s+/).filter(Boolean);

      for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (COMMON_MISSPELLINGS[w]) w = COMMON_MISSPELLINGS[w];

        if (STATE_NEGATION_MARKERS.has(w)) {

          let targetIdx = i + 1;
          if (targetIdx < words.length && (words[targetIdx] === 'a' || words[targetIdx] === 'an' || words[targetIdx] === 'the')) {
            targetIdx++;
          }
          if (targetIdx < words.length) {
            let nextW = words[targetIdx];
            if (COMMON_MISSPELLINGS[nextW]) nextW = COMMON_MISSPELLINGS[nextW];

            if (!ACTION_VERBS.has(nextW)) {
              negatedTokens.add(nextW);
              negatedTokens.add(stemWord(nextW));
              i = targetIdx;
            }
          }
          continue;
        }

        if (FAILURE_MARKERS.has(w)) {
          continue;
        }

        if (w.length > 1 && !STOP_WORDS.has(w)) {
          positiveTokens.add(w);
          rawTokens.push(w);
          stemmedTokens.push(stemWord(w));
        }
      }
    });

    return {
      normalizedText: corrected,
      rawTokens,
      stemmedTokens,
      positiveTokens,
      negatedTokens,
      isHistoricalResolved,
      isModalUncertain
    };
  }

  function extractTokens(text) {
    const signals = extractSignals(text);
    return {
      rawTokens: signals.rawTokens,
      stemmedTokens: signals.stemmedTokens
    };
  }

  function evaluatePolicyMatch(ticket, policy, config, signals) {
    if (!policy || !policy.id) {
      return { score: 0, matchedSignals: [], exceptionTriggered: false, matchedExceptions: [], conditionViolated: false, contradictionDetected: false };
    }

    if (!signals) {
      const titleSignals = extractSignals(ticket ? ticket.title : '');
      const descSignals = extractSignals(ticket ? ticket.description : '');
      signals = { titleSignals, descSignals };
    }

    const normTitle = signals.titleSignals.normalizedText;
    const normDesc = signals.descSignals.normalizedText;

    const titleTokens = signals.titleSignals;
    const descTokens = signals.descSignals;

    const policyKeywords = Array.isArray(policy.keywords) ? policy.keywords : [];
    let coreProblemNegated = false;

    for (const kw of policyKeywords) {
      const normKw = normalizeText(kw);
      const kwTokens = normKw.split(' ');
      for (const t of kwTokens) {
        if (titleTokens.negatedTokens.has(t) || descTokens.negatedTokens.has(t)) {

          if (!titleTokens.positiveTokens.has(t) && !descTokens.positiveTokens.has(t)) {
            coreProblemNegated = true;
            break;
          }
        }
      }
      if (coreProblemNegated) break;
    }

    if (signals.titleSignals.isHistoricalResolved || signals.descSignals.isHistoricalResolved) {

      return {
        score: 0,
        matchedSignals: [{ term: 'historical_resolution', source: 'Historical / Resolved State', points: 0 }],
        exceptionTriggered: false,
        matchedExceptions: [],
        conditionViolated: true,
        contradictionDetected: false,
        suppressionReason: 'Ticket indicates problem occurred in the past and is currently resolved.'
      };
    }

    if (coreProblemNegated) {
      return {
        score: 0,
        matchedSignals: [{ term: 'negated_condition', source: 'Negated Condition', points: 0 }],
        exceptionTriggered: false,
        matchedExceptions: [],
        conditionViolated: true,
        contradictionDetected: false,
        suppressionReason: 'Core problem condition explicitly negated by ticket wording.'
      };
    }

    let score = 0;
    const matchedSignals = [];
    const matchedPhrases = [];
    const seenSignals = new Set();
    const matchedExceptions = [];
    let exceptionTriggered = false;

    function addSignal(term, source, points, isPhrase = false) {
      const key = `${term.toLowerCase()}_${source}`;
      if (!seenSignals.has(key)) {
        seenSignals.add(key);
        matchedSignals.push({ term, source, points });
        if (isPhrase) matchedPhrases.push(term);
      }
    }

    if (typeof policy.name === 'string' && policy.name.trim()) {
      const normName = normalizeText(policy.name);
      if (normName && (normTitle.includes(normName) || (normName.length > 5 && normDesc.includes(normName)))) {
        const pts = (config.phraseMatchPoints * 1.25) * config.titleWeight;
        score += pts;
        addSignal(policy.name, 'Policy Name (Exact)', pts, true);
      } else {
        const nameTokens = extractTokens(policy.name);
        for (let i = 0; i < nameTokens.stemmedTokens.length; i++) {
          const stem = nameTokens.stemmedTokens[i];
          const raw = nameTokens.rawTokens[i];
          if (titleTokens.stemmedTokens.includes(stem)) {
            const pts = config.keywordTokenPoints * config.titleWeight;
            score += pts;
            addSignal(raw, 'Policy Name Token (Title)', pts);
          } else if (descTokens.stemmedTokens.includes(stem)) {
            const pts = config.keywordTokenPoints * config.descriptionWeight;
            score += pts;
            addSignal(raw, 'Policy Name Token (Description)', pts);
          }
        }
      }
    }

    for (const kw of policyKeywords) {
      if (typeof kw !== 'string') continue;
      const normKw = normalizeText(kw);
      if (!normKw) continue;

      if (normKw.includes(' ')) {
        if (normTitle.includes(normKw)) {
          const pts = config.phraseMatchPoints * config.titleWeight;
          score += pts;
          addSignal(kw, 'Title (Exact Phrase)', pts, true);
        } else if (normDesc.includes(normKw)) {
          const pts = config.phraseMatchPoints * config.descriptionWeight;
          score += pts;
          addSignal(kw, 'Description (Exact Phrase)', pts, true);
        }
      } else {
        const sKw = stemWord(normKw);
        let inTitle = titleTokens.rawTokens.includes(normKw) || titleTokens.stemmedTokens.includes(sKw);
        let inDesc = descTokens.rawTokens.includes(normKw) || descTokens.stemmedTokens.includes(sKw);

        if (inTitle) {
          const pts = config.keywordTokenPoints * config.titleWeight;
          score += pts;
          addSignal(kw, 'Title (Keyword)', pts);
        }
        if (inDesc) {
          const pts = config.keywordTokenPoints * config.descriptionWeight;
          score += pts;
          addSignal(kw, 'Description (Keyword)', pts);
        }
      }
    }

    const synonyms = Array.isArray(policy.synonyms) ? policy.synonyms : [];
    for (const syn of synonyms) {
      if (typeof syn !== 'string') continue;
      const normSyn = normalizeText(syn);
      if (!normSyn) continue;

      if (normSyn.includes(' ')) {
        if (normTitle.includes(normSyn)) {
          const pts = (config.phraseMatchPoints * 0.85) * config.titleWeight;
          score += pts;
          addSignal(syn, 'Title (Synonym Phrase)', pts, true);
        } else if (normDesc.includes(normSyn)) {
          const pts = (config.phraseMatchPoints * 0.85) * config.descriptionWeight;
          score += pts;
          addSignal(syn, 'Description (Synonym Phrase)', pts, true);
        }
      } else {
        const sSyn = stemWord(normSyn);
        if (titleTokens.rawTokens.includes(normSyn) || titleTokens.stemmedTokens.includes(sSyn)) {
          const pts = config.synonymTokenPoints * config.titleWeight;
          score += pts;
          addSignal(syn, 'Title (Synonym)', pts);
        }
        if (descTokens.rawTokens.includes(normSyn) || descTokens.stemmedTokens.includes(sSyn)) {
          const pts = config.synonymTokenPoints * config.descriptionWeight;
          score += pts;
          addSignal(syn, 'Description (Synonym)', pts);
        }
      }
    }

    const conditionsText = policy.conditions || policy.problemDescription || '';
    if (typeof conditionsText === 'string' && conditionsText.trim()) {
      const condTokens = extractTokens(conditionsText);
      let conditionHits = 0;

      for (let i = 0; i < condTokens.stemmedTokens.length; i++) {
        const pStem = condTokens.stemmedTokens[i];
        const pRaw = condTokens.rawTokens[i];
        if (titleTokens.stemmedTokens.includes(pStem)) {
          conditionHits++;
          if (conditionHits <= 5) {
            const pts = config.problemDescOverlapPoints * config.titleWeight;
            score += pts;
            addSignal(pRaw, 'Title (Condition)', pts);
          }
        } else if (descTokens.stemmedTokens.includes(pStem)) {
          conditionHits++;
          if (conditionHits <= 5) {
            const pts = config.problemDescOverlapPoints * config.descriptionWeight;
            score += pts;
            addSignal(pRaw, 'Description (Condition)', pts);
          }
        }
      }
    }

    const exceptionsText = policy.exceptions || '';
    if (typeof exceptionsText === 'string' && exceptionsText.trim()) {
      const excTokens = extractTokens(exceptionsText);
      const matchingExcWords = [];
      for (let i = 0; i < excTokens.stemmedTokens.length; i++) {
        const eStem = excTokens.stemmedTokens[i];
        const eRaw = excTokens.rawTokens[i];
        if (titleTokens.stemmedTokens.includes(eStem) || descTokens.stemmedTokens.includes(eStem)) {
          matchingExcWords.push(eRaw);
        }
      }

      if (matchingExcWords.length > 0) {
        exceptionTriggered = true;
        const matchedClause = exceptionsText.length > 120 ? exceptionsText.slice(0, 120) + '...' : exceptionsText;
        matchedExceptions.push(matchedClause);
        addSignal(matchingExcWords.slice(0, 3).join(', '), 'Exception Condition Triggered', 2.0);
      }
    }

    if (signals.titleSignals.isModalUncertain || signals.descSignals.isModalUncertain) {
      score = score * 0.85;
    }

    return {
      score: Math.round(score * 10) / 10,
      matchedSignals,
      matchedPhrases,
      exceptionTriggered,
      matchedExceptions,
      conditionViolated: false,
      contradictionDetected: false
    };
  }

  function matchTicket(ticket, policies, customConfig = {}) {
    const config = Object.assign({}, DEFAULT_CONFIG, customConfig);

    if (!ticket || typeof ticket !== 'object') {
      return {
        status: 'NO_POLICY_FOUND',
        message: 'No sufficiently relevant policy was identified for this ticket.',
        reason: 'Invalid or missing ticket object',
        matched: false,
        topMatch: null,
        isAmbiguous: false,
        explanation: { decisionRationale: 'Ticket input was null or invalid object.' }
      };
    }

    const title = (ticket.title || '').trim();
    const description = (ticket.description || '').trim();

    if (!title && !description) {
      return {
        status: 'NO_POLICY_FOUND',
        message: 'No sufficiently relevant policy was identified for this ticket.',
        reason: 'Ticket title and description are both empty',
        matched: false,
        topMatch: null,
        isAmbiguous: false,
        explanation: { decisionRationale: 'Ticket contains no title or description.' }
      };
    }

    if (!Array.isArray(policies) || policies.length === 0) {
      return {
        status: 'NO_POLICY_FOUND',
        message: 'No sufficiently relevant policy was identified for this ticket.',
        reason: 'Policy database is empty or unavailable',
        matched: false,
        topMatch: null,
        isAmbiguous: false,
        explanation: { decisionRationale: 'No policies available in policy store.' }
      };
    }

    const titleSignals = extractSignals(title);
    const descSignals = extractSignals(description);
    const combinedSignals = { titleSignals, descSignals };

    const fullText = `${title} ${description}`;
    const hasWorkingAssert = /\b(?:working\s+fine|works\s+fine|working\s+ok|works\s+ok|functioning|working\s+properly)\b/i.test(fullText);
    const hasFailureAssert = /\b(?:unable|cannot|cant|failing|failed|not\s+working)\b/i.test(fullText);

    const hasInternalContradiction = (
      (hasWorkingAssert && hasFailureAssert) ||
      (titleSignals.negatedTokens.has('vpn') && titleSignals.positiveTokens.has('vpn')) ||
      (descSignals.negatedTokens.has('vpn') && descSignals.positiveTokens.has('vpn')) ||
      (titleSignals.negatedTokens.has('lockout') && titleSignals.positiveTokens.has('lockout')) ||
      (descSignals.negatedTokens.has('locked') && descSignals.positiveTokens.has('locked'))
    );

    const scoredPolicies = [];

    for (const policy of policies) {
      if (!policy || typeof policy !== 'object' || !policy.id) continue;

      const evaluation = evaluatePolicyMatch({ title, description }, policy, config, combinedSignals);

      if (evaluation.score > 0) {
        scoredPolicies.push({
          policy,
          score: evaluation.score,
          matchedSignals: evaluation.matchedSignals,
          matchedPhrases: evaluation.matchedPhrases,
          exceptionTriggered: evaluation.exceptionTriggered,
          matchedExceptions: evaluation.matchedExceptions
        });
      }
    }

    scoredPolicies.sort((a, b) => b.score - a.score);

    if (hasInternalContradiction && scoredPolicies.length > 0) {
      return {
        status: 'MANUAL_REVIEW_REQUIRED',
        message: 'Contradictory problem statements detected in ticket text. Manual review required.',
        reason: 'Contradictory signals in ticket description',
        matched: false,
        topMatch: null,
        allCandidates: scoredPolicies.slice(0, 3),
        isAmbiguous: true,
        explanation: {
          decisionRationale: 'Ticket text contains conflicting statements (both asserting and negating the same symptom).',
          confidence: 'Low'
        }
      };
    }

    if (scoredPolicies.length === 0 || scoredPolicies[0].score < config.minScoreThreshold) {
      return {
        status: 'NO_POLICY_FOUND',
        message: 'No sufficiently relevant policy was identified for this ticket.',
        reason: scoredPolicies.length === 0 
          ? 'No matching keywords or patterns found' 
          : `Top score (${scoredPolicies[0].score}) is below required threshold (${config.minScoreThreshold})`,
        matched: false,
        topMatch: null,
        allCandidates: scoredPolicies.slice(0, 3),
        isAmbiguous: false,
        explanation: {
          decisionRationale: scoredPolicies.length === 0 ? 'No matching policy terms.' : 'Relevance score below confidence threshold.',
          confidence: 'Low'
        }
      };
    }

    const top = scoredPolicies[0];
    const runnerUp = scoredPolicies.length > 1 ? scoredPolicies[1] : null;

    let isAmbiguous = false;
    let ambiguityWarning = null;

    if (
      runnerUp &&
      runnerUp.score >= config.minScoreThreshold &&
      (runnerUp.score >= top.score * config.ambiguityScoreRatioThreshold ||
       (top.score - runnerUp.score) <= config.ambiguityAbsoluteDiffThreshold)
    ) {
      isAmbiguous = true;
      ambiguityWarning = `Ambiguous Match: Two policies matched with similar relevance scores. Review both ${top.policy.id} (${top.policy.name}) and ${runnerUp.policy.id} (${runnerUp.policy.name}).`;
    }

    if (top.policy.requiresManualReview || top.policy.isReliable === false) {
      return {
        status: 'MANUAL_REVIEW_REQUIRED',
        message: 'Matching policy record is structurally incomplete or marked for manual review.',
        reason: top.policy.structuralAmbiguityReason || 'Policy data is unreliable',
        matched: false,
        topMatch: {
          id: top.policy.id,
          name: top.policy.name,
          category: top.policy.category || 'General',
          resolution: top.policy.resolution || '',
          score: top.score
        },
        allCandidates: scoredPolicies.slice(0, 3),
        isAmbiguous,
        explanation: {
          decisionRationale: `Policy ${top.policy.id} matched but is flagged: ${top.policy.structuralAmbiguityReason || 'Requires manual verification'}`,
          confidence: 'Low'
        }
      };
    }

    let confidenceLabel = 'Moderate Match';
    if (isAmbiguous) {
      confidenceLabel = 'Ambiguous Match';
    } else if (top.score >= 18.0) {
      confidenceLabel = 'High Confidence Match';
    }

    const topPhrases = top.matchedPhrases && top.matchedPhrases.length > 0 ? top.matchedPhrases : [];
    const topKeywords = top.matchedSignals.slice(0, 4).map(s => s.term);

    const explanation = {
      confidence: confidenceLabel,
      score: top.score,
      matchedPhrases: topPhrases,
      matchedKeywords: topKeywords,
      exceptionTriggered: top.exceptionTriggered,
      matchedExceptions: top.matchedExceptions,
      decisionRationale: `Matched policy "${top.policy.name}" based on ${topKeywords.join(', ')}.`
    };

    return {
      status: 'MATCH_FOUND',
      message: `Matched Policy: ${top.policy.name} (${top.policy.id})`,
      reason: `Relevance score: ${top.score}`,
      matched: true,
      isAmbiguous,
      ambiguityWarning,
      confidence: confidenceLabel,
      explanation,
      topMatch: {
        id: top.policy.id,
        name: top.policy.name,
        category: top.policy.category || 'General',
        resolution: top.policy.resolution || top.policy.approvedSolution || 'No resolution provided in policy record.',
        score: top.score,
        exceptionTriggered: top.exceptionTriggered,
        matchedExceptions: top.matchedExceptions,
        matchedSignals: top.matchedSignals,
        explanation
      },
      runnerUp: isAmbiguous && runnerUp ? {
        id: runnerUp.policy.id,
        name: runnerUp.policy.name,
        category: runnerUp.policy.category || 'General',
        resolution: runnerUp.policy.resolution || runnerUp.policy.approvedSolution || '',
        score: runnerUp.score
      } : null,
      allCandidates: scoredPolicies.slice(0, 3)
    };
  }

  return {
    matchTicket,
    evaluatePolicyMatch,
    extractTokens,
    extractSignals,
    normalizeText,
    stemWord,
    correctSpellingAndExpand,
    DEFAULT_CONFIG,
    COMMON_MISSPELLINGS,
    ABBREVIATIONS
  };
});
