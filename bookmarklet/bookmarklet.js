(function () {
  'use strict';

  const EXISTING_HOST = document.getElementById('policy-bookmarklet-host');
  if (EXISTING_HOST) {
    if (EXISTING_HOST.style.display === 'none') {
      EXISTING_HOST.style.display = 'block';
      if (EXISTING_HOST._rescan) EXISTING_HOST._rescan();
    } else {
      EXISTING_HOST.remove();
    }
    return;
  }

  const DEFAULT_SAMPLE_POLICIES = [
    {
      id: "POL-SEC-001",
      name: "Corporate Password Reset & Self-Service Portal",
      category: "Identity & Access",
      conditions: "Forgotten domain password or expired password.",
      exceptions: "VIP executives require phone verification before reset.",
      resolution: "Direct to SSPR portal or verify identity via Helpdesk console.",
      keywords: ["password", "forgot password", "expired password", "reset password", "credentials", "sspr"],
      synonyms: ["passcode", "passphrase", "login secret"]
    },
    {
      id: "POL-SEC-002",
      name: "Account Lockout & Brute-Force Remediation",
      category: "Identity & Access",
      conditions: "Account locked out after consecutive failed logon attempts.",
      exceptions: "Suspicious geolocation requires security officer sign-off.",
      resolution: "Verify identity, clear lockout in Active Directory, assist updating credentials.",
      keywords: ["account locked", "account lockout", "locked out", "failed attempts", "unlock user"],
      synonyms: ["frozen account", "blocked profile"]
    },
    {
      id: "POL-APP-003",
      name: "Corporate Email & Mailbox Access Troubleshooting",
      category: "Applications",
      conditions: "Cannot send/receive emails in Outlook or webmail, quota full.",
      exceptions: "Legal hold mailboxes cannot have retention policies altered or items deleted.",
      resolution: "Verify Exchange license, test OWA, compact PST/OST, or expand quota.",
      keywords: ["email", "outlook", "webmail", "mailbox", "mailbox full", "send receive error"],
      synonyms: ["mail", "inbox", "email quota"]
    },
    {
      id: "POL-NET-004",
      name: "Remote Access VPN Connection Troubleshooting",
      category: "Networking",
      conditions: "Unable to establish connection to GlobalProtect or AnyConnect VPN.",
      exceptions: "Third-party contractors require active sponsor approval token before reconnecting.",
      resolution: "Reinstall root certificates, verify MFA push, restart VPN tunnel service.",
      keywords: ["vpn", "globalprotect", "anyconnect", "remote connection", "vpn tunnel"],
      synonyms: ["remote access", "vpn error", "tunnel failed"]
    },
    {
      id: "POL-APP-005",
      name: "Standard Software Installation & Deployment",
      category: "Software",
      conditions: "Request to install approved application requiring elevation.",
      exceptions: "Non-standard commercial software requires Architecture Review Board approval.",
      resolution: "Install via Software Center or Company Portal; deploy via Intune/SCCM if not listed.",
      keywords: ["install software", "software installation", "admin rights", "software center", "deploy application"],
      synonyms: ["need app installed", "program setup", "admin credentials needed"]
    },
    {
      id: "POL-OPS-006",
      name: "Office Network Printer & Print Queue Maintenance",
      category: "Hardware",
      conditions: "Network printer offline, paper jam, or spooler stuck.",
      exceptions: "Personal USB printers not purchased through IT are strictly not serviced.",
      resolution: "Power-cycle printer, clear paper jam, restart print spooler service.",
      keywords: ["printer", "print queue", "paper jam", "print spooler", "network printer"],
      synonyms: ["cannot print", "printer offline", "spooler stuck"]
    },
    {
      id: "POL-OPS-009",
      name: "Workstation Blue Screen (BSOD) & Crash Diagnostic",
      category: "Workstations",
      conditions: "Workstation crashes with BSOD or spontaneous reboots.",
      exceptions: "Physical liquid damage requires hardware warranty replacement.",
      resolution: "Inspect minidump with WinDbg, roll back drivers, run memory diagnostic.",
      keywords: ["blue screen", "bsod", "crash dump", "minidump", "kernel panic", "system crash"],
      synonyms: ["computer crashed", "blue screen of death"]
    },
    {
      id: "POL-SEC-010",
      name: "Accidental Data Deletion & File Recovery",
      category: "Backup & Storage",
      conditions: "User deleted files or folders from shared network drives or OneDrive.",
      exceptions: "Permanently purged files exceeding 30-day retention window require Disaster Recovery escalation.",
      resolution: "Check Recycle Bin, restore from Previous Versions, or submit backup restore.",
      keywords: ["file recovery", "deleted files", "restore document", "previous versions", "shadow copy"],
      synonyms: ["lost my file", "accidentally deleted"]
    }
  ];

  function getActivePolicies() {
    try {
      const stored = localStorage.getItem('__company_policies__');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { policies: parsed, isCustom: true, source: 'Imported Policies' };
        }
      }
    } catch (e) {}

    if (window.__COMPANY_POLICIES__ && Array.isArray(window.__COMPANY_POLICIES__)) {
      return { policies: window.__COMPANY_POLICIES__, isCustom: true, source: 'Window Global' };
    }
    return { policies: DEFAULT_SAMPLE_POLICIES, isCustom: false, source: 'Built-in Catalog' };
  }

  const COMMON_MISSPELLINGS = {
    passwrod:'password', passord:'password', pasword:'password', psswrd:'password',
    locekd:'locked', lokced:'locked', loced:'locked',
    acount:'account', accout:'account', acnt:'account',
    priter:'printer', pritner:'printer', printr:'printer',
    softare:'software', sofware:'software', sftware:'software',
    conection:'connection', conect:'connect', conected:'connected',
    instll:'install', instal:'install', instaled:'installed',
    restrt:'restart', rebot:'reboot', restrted:'restarted',
    delte:'delete', delet:'delete', deletd:'deleted',
    recovry:'recovery', recovr:'recover', recvrd:'recovered',
    monitr:'monitor', scrn:'screen', scren:'screen',
    emial:'email', maill:'mail', outlok:'outlook',
    credentails:'credentials', credintials:'credentials',
    permisson:'permission', privilage:'privilege', priviledge:'privilege'
  };

  const ABBREVIATIONS = {
    sspr:'self service password reset',
    mfa:'multi factor authentication',
    '2fa':'two factor authentication',
    ad:'active directory',
    bsod:'blue screen crash dump kernel panic',
    vpn:'virtual private network remote connection',
    pw:'password',
    pwd:'password',
    owa:'outlook webmail email',
    dc:'domain controller',
    sccm:'sccm software deployment'
  };

  const STOP_WORDS = new Set('a,about,above,after,again,against,all,am,an,and,any,are,as,at,be,because,been,before,being,below,between,both,but,by,could,did,do,does,doing,down,during,each,few,for,from,further,had,has,have,having,he,her,here,hers,herself,him,himself,his,how,i,if,in,into,is,it,its,itself,just,me,more,most,my,myself,of,off,on,once,only,or,other,our,ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs,them,themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,why,with,would,you,your,yours,yourself,yourselves,hello,hi,hey,please,help,ticket,support,urgent,asap,thanks,thank,greeting,greetings,regards'.split(','));
  const FAILURE_MARKERS = new Set('cannot,cant,unable,failed,failing'.split(','));
  const STATE_NEGATION_MARKERS = new Set('not,no,never,neither,nor,without,isnt,arent,wasnt,werent,dont,doesnt,didnt,wont,hardly'.split(','));
  const ACTION_VERBS = new Set('authenticate,connect,login,log,signin,sign,print,send,receive,access,install,deploy,boot,start,load,work,open'.split(','));
  const MODAL_UNCERTAINTY = [/\b(may\s+be|might\s+be|could\s+be|suspect\s+that|suspect\s+it\s+is|not\s+sure\s+if|possible|possibly|perhaps|wondering\s+if)\b/i];
  const HISTORICAL_RESOLVED = [
    /\b(?:was|were|had|previously)\b[\w\s]{1,40}\b(?:yesterday|earlier|before)\b[\w\s]{0,40}\b(?:now|today|currently)?\s*(?:working|works|fine|ok|resolved|fixed|accessible)\b/i,
    /\b(?:already|previously|has\s+been)\s+(?:resolved|fixed|working\s+now|restored)\b/i
  ];

  function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[\u2018\u2019\x60\u00B4]/g, "'").replace(/[\u201C\u201D]/g, ' ')
      .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'s\b/g, ' ')
      .replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will')
      .replace(/[^\w\s-]/g, ' ').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function correctSpellingAndExpand(text) {
    if (!text) return '';
    return text.split(' ').map(w => COMMON_MISSPELLINGS[w] || ABBREVIATIONS[w] || w).join(' ');
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

  function extractSignals(rawText) {
    const normalized = normalizeText(rawText);
    const corrected = correctSpellingAndExpand(normalized);
    const isHistorical = HISTORICAL_RESOLVED.some(p => p.test(rawText) || p.test(normalized));
    const isModal = MODAL_UNCERTAINTY.some(p => p.test(rawText) || p.test(normalized));

    const clauses = normalized.split(/[,;.!?]|\b(?:but|however|although|yet|except)\b/);
    const negatedTokens = new Set();
    const positiveTokens = new Set();
    const rawTokens = [];
    const stemmedTokens = [];

    clauses.forEach(clause => {
      const words = clause.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        let w = COMMON_MISSPELLINGS[words[i]] || words[i];
        if (STATE_NEGATION_MARKERS.has(w)) {
          let tIdx = i + 1;
          if (tIdx < words.length && (words[tIdx] === 'a' || words[tIdx] === 'an' || words[tIdx] === 'the')) tIdx++;
          if (tIdx < words.length) {
            let nextW = COMMON_MISSPELLINGS[words[tIdx]] || words[tIdx];
            if (!ACTION_VERBS.has(nextW)) {
              negatedTokens.add(nextW);
              negatedTokens.add(stemWord(nextW));
              i = tIdx;
            }
          }
          continue;
        }
        if (FAILURE_MARKERS.has(w)) continue;
        if (w.length > 1 && !STOP_WORDS.has(w)) {
          positiveTokens.add(w);
          rawTokens.push(w);
          stemmedTokens.push(stemWord(w));
        }
      }
    });

    return { normalizedText: corrected, rawTokens, stemmedTokens, positiveTokens, negatedTokens, isHistorical, isModal };
  }

  function extractTokens(text) {
    const sig = extractSignals(text);
    return { rawTokens: sig.rawTokens, stemmedTokens: sig.stemmedTokens };
  }

  function evaluatePolicy(ticket, policy, signals) {
    if (!policy || !policy.id) return { score: 0 };
    const tTokens = signals.titleSignals;
    const dTokens = signals.descSignals;

    if (tTokens.isHistorical || dTokens.isHistorical) return { score: 0, conditionViolated: true };

    const keywords = Array.isArray(policy.keywords) ? policy.keywords : [];
    let coreNegated = false;
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      for (const t of normKw.split(' ')) {
        if (tTokens.negatedTokens.has(t) || dTokens.negatedTokens.has(t)) {
          if (!tTokens.positiveTokens.has(t) && !dTokens.positiveTokens.has(t)) {
            coreNegated = true;
            break;
          }
        }
      }
      if (coreNegated) break;
    }
    if (coreNegated) return { score: 0, conditionViolated: true };

    let score = 0;
    const matchedSignals = [];
    const matchedExceptions = [];
    let exceptionTriggered = false;

    if (policy.name) {
      const normName = normalizeText(policy.name);
      if (normName && (tTokens.normalizedText.includes(normName) || (normName.length > 5 && dTokens.normalizedText.includes(normName)))) {
        score += 18.75;
        matchedSignals.push({ term: policy.name, source: 'Exact Name' });
      } else {
        const nTokens = extractTokens(policy.name);
        for (let i = 0; i < nTokens.stemmedTokens.length; i++) {
          const s = nTokens.stemmedTokens[i];
          const r = nTokens.rawTokens[i];
          if (tTokens.stemmedTokens.includes(s)) {
            score += 6.25;
            matchedSignals.push({ term: r, source: 'Title Name' });
          } else if (dTokens.stemmedTokens.includes(s)) {
            score += 2.5;
            matchedSignals.push({ term: r, source: 'Desc Name' });
          }
        }
      }
    }

    for (const kw of keywords) {
      if (typeof kw !== 'string') continue;
      const normKw = normalizeText(kw);
      if (!normKw) continue;
      if (normKw.includes(' ')) {
        if (tTokens.normalizedText.includes(normKw)) {
          score += 15.0;
          matchedSignals.push({ term: kw, source: 'Title Phrase' });
        } else if (dTokens.normalizedText.includes(normKw)) {
          score += 6.0;
          matchedSignals.push({ term: kw, source: 'Desc Phrase' });
        }
      } else {
        const sKw = stemWord(normKw);
        if (tTokens.rawTokens.includes(normKw) || tTokens.stemmedTokens.includes(sKw)) {
          score += 6.25;
          matchedSignals.push({ term: kw, source: 'Title Keyword' });
        }
        if (dTokens.rawTokens.includes(normKw) || dTokens.stemmedTokens.includes(sKw)) {
          score += 2.5;
          matchedSignals.push({ term: kw, source: 'Desc Keyword' });
        }
      }
    }

    const synonyms = Array.isArray(policy.synonyms) ? policy.synonyms : [];
    for (const syn of synonyms) {
      if (typeof syn !== 'string') continue;
      const normSyn = normalizeText(syn);
      if (!normSyn) continue;
      if (normSyn.includes(' ')) {
        if (tTokens.normalizedText.includes(normSyn)) {
          score += 12.75;
          matchedSignals.push({ term: syn, source: 'Title Synonym' });
        } else if (dTokens.normalizedText.includes(normSyn)) {
          score += 5.1;
          matchedSignals.push({ term: syn, source: 'Desc Synonym' });
        }
      } else {
        const sSyn = stemWord(normSyn);
        if (tTokens.rawTokens.includes(normSyn) || tTokens.stemmedTokens.includes(sSyn)) {
          score += 5.0;
          matchedSignals.push({ term: syn, source: 'Title Synonym' });
        }
        if (dTokens.rawTokens.includes(normSyn) || dTokens.stemmedTokens.includes(sSyn)) {
          score += 2.0;
          matchedSignals.push({ term: syn, source: 'Desc Synonym' });
        }
      }
    }

    const condText = policy.conditions || policy.problemDescription || '';
    if (condText) {
      const cTokens = extractTokens(condText);
      let hits = 0;
      for (let i = 0; i < cTokens.stemmedTokens.length; i++) {
        const s = cTokens.stemmedTokens[i];
        if (tTokens.stemmedTokens.includes(s)) {
          if (++hits <= 5) score += 1.25;
        } else if (dTokens.stemmedTokens.includes(s)) {
          if (++hits <= 5) score += 0.5;
        }
      }
    }

    const excText = policy.exceptions || '';
    if (excText) {
      const eTokens = extractTokens(excText);
      const hitWords = [];
      for (let i = 0; i < eTokens.stemmedTokens.length; i++) {
        const s = eTokens.stemmedTokens[i];
        if (tTokens.stemmedTokens.includes(s) || dTokens.stemmedTokens.includes(s)) {
          hitWords.push(eTokens.rawTokens[i]);
        }
      }
      if (hitWords.length > 0) {
        exceptionTriggered = true;
        matchedExceptions.push(excText.length > 120 ? excText.slice(0, 120) + '...' : excText);
        score += 2.0;
      }
    }

    if (tTokens.isModal || dTokens.isModal) score = score * 0.85;

    return { score: Math.round(score * 10) / 10, matchedSignals, exceptionTriggered, matchedExceptions };
  }

  function matchTicket(ticket, policies) {
    if (!ticket || (!ticket.title && !ticket.description)) {
      return { matched: false, status: 'NO_POLICY_FOUND', reason: 'Ticket title and description are empty' };
    }
    if (!policies || policies.length === 0) {
      return { matched: false, status: 'NO_POLICY_FOUND', reason: 'No policies available in catalog' };
    }

    const tSignals = extractSignals(ticket.title || '');
    const dSignals = extractSignals(ticket.description || '');
    const signals = { titleSignals: tSignals, descSignals: dSignals };

    const txt = `${ticket.title} ${ticket.description}`;
    const hasContradiction = (
      (/\b((working|works?)\s+(fine|ok|properly)|functioning)\b/i.test(txt) && /\b(unable|cannot|cant|failed)\b/i.test(txt)) ||
      (tSignals.negatedTokens.has('vpn') && tSignals.positiveTokens.has('vpn')) ||
      (dSignals.negatedTokens.has('vpn') && dSignals.positiveTokens.has('vpn')) ||
      (tSignals.negatedTokens.has('lockout') && tSignals.positiveTokens.has('lockout')) ||
      (dSignals.negatedTokens.has('locked') && dSignals.positiveTokens.has('locked'))
    );

    const scored = [];
    for (const p of policies) {
      if (!p || !p.id) continue;
      const res = evaluatePolicy(ticket, p, signals);
      if (res.score > 0) {
        scored.push({ policy: p, score: res.score, matchedSignals: res.matchedSignals, exceptionTriggered: res.exceptionTriggered, matchedExceptions: res.matchedExceptions });
      }
    }
    scored.sort((a, b) => b.score - a.score);

    if (hasContradiction && scored.length > 0) {
      return { matched: false, status: 'MANUAL_REVIEW_REQUIRED', reason: 'Conflicting problem statements detected in ticket (both asserting and negating the same symptom).' };
    }

    const MIN_THRESHOLD = 6.0;
    if (scored.length === 0 || scored[0].score < MIN_THRESHOLD) {
      return {
        matched: false,
        status: 'NO_POLICY_FOUND',
        reason: scored.length === 0 ? 'No matching policy terms or conditions identified.' : `Confidence score (${scored[0].score}) is below certainty threshold (${MIN_THRESHOLD}).`
      };
    }

    const top = scored[0];
    const runnerUp = scored.length > 1 ? scored[1] : null;

    let isAmbiguous = false;
    let ambiguityWarning = null;
    if (runnerUp && runnerUp.score >= MIN_THRESHOLD && (runnerUp.score >= top.score * 0.75 || (top.score - runnerUp.score) <= 8.0)) {
      isAmbiguous = true;
      ambiguityWarning = `Multiple policies match closely: ${top.policy.id} (${top.policy.name}) and ${runnerUp.policy.id} (${runnerUp.policy.name}).`;
    }

    if (top.policy.requiresManualReview || top.policy.isReliable === false) {
      return {
        matched: false,
        status: 'MANUAL_REVIEW_REQUIRED',
        reason: top.policy.structuralAmbiguityReason || 'Policy data requires manual operator verification.'
      };
    }

    const topKeywords = top.matchedSignals.slice(0, 4).map(s => s.term);
    return {
      matched: true,
      status: 'MATCH_FOUND',
      isAmbiguous,
      ambiguityWarning,
      confidence: isAmbiguous ? 'Ambiguous Match' : (top.score >= 18.0 ? 'High Confidence' : 'Moderate Confidence'),
      topMatch: {
        id: top.policy.id,
        name: top.policy.name,
        category: top.policy.category || 'General',
        resolution: top.policy.resolution || top.policy.approvedSolution || 'No resolution provided in policy record.',
        score: top.score,
        exceptionTriggered: top.exceptionTriggered,
        matchedExceptions: top.matchedExceptions,
        matchedSignals: top.matchedSignals,
        decisionRationale: `Matched "${top.policy.name}" via [${topKeywords.join(', ')}].`
      },
      runnerUp: isAmbiguous && runnerUp ? { id: runnerUp.policy.id, name: runnerUp.policy.name } : null
    };
  }

  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function getElText(el) {
    if (!el) return '';
    return clean((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value : (el.innerText || el.textContent));
  }
  function qFirst(doc, sel) {
    for (const s of sel) {
      try {
        const el = doc.querySelector(s);
        if (el) {
          const t = getElText(el);
          if (t) return { element: el, text: t };
        }
      } catch (e) {}
    }
    return null;
  }
  function findTableVal(doc, reg) {
    try {
      const cells = doc.querySelectorAll('td, th, dt, label, span');
      for (const c of cells) {
        if (reg.test(clean(c.innerText || c.textContent))) {
          if (c.nextElementSibling) {
            const v = getElText(c.nextElementSibling);
            if (v) return v;
          }
          if (c.parentElement && c.parentElement.tagName === 'TR') {
            const row = Array.from(c.parentElement.children);
            const idx = row.indexOf(c);
            if (idx !== -1 && idx + 1 < row.length) {
              const v = getElText(row[idx + 1]);
              if (v) return v;
            }
          }
        }
      }
    } catch (e) {}
    return '';
  }

  function extractTicket(doc, url) {
    const u = (url || window.location.href || '').toLowerCase();
    try {
      const cRaw = localStorage.getItem('__policy_custom_selectors__');
      if (cRaw) {
        const c = JSON.parse(cRaw);
        if (c && c.domain && u.includes(c.domain.toLowerCase())) {
          const t = c.titleSelector ? qFirst(doc, [c.titleSelector]) : null;
          const d = c.descSelector ? qFirst(doc, [c.descSelector]) : null;
          const id = c.idSelector ? qFirst(doc, [c.idSelector]) : null;
          if (t || d) return { platform: 'Custom', id: id ? id.text : 'CUSTOM-TICKET', title: t ? t.text : '', description: d ? d.text : '' };
        }
      }
    } catch (e) {}

    if (u.includes('ticket.php') || u.includes('admin_ticket.php') || u.includes('hesk') || doc.querySelector('.ticketmessage, .ticket-headline, #ticket-track')) {
      const tm = u.match(/[?&]track=([A-Za-z0-9-]+)/i);
      const id = tm ? tm[1] : (findTableVal(doc, /^tracking\s*id/i) || (qFirst(doc, ['.tracking-id', '#ticket-track', '.ticket-track']) || {}).text || 'HESK-TICKET');
      const t = (qFirst(doc, ['.ticket-headline', 'h2.ticket-headline', '.ticket-subject', '#ticket-subject', 'input[name="subject"]']) || {}).text || findTableVal(doc, /^subject\b/i);
      let d = (qFirst(doc, ['.ticketmessage', 'td.ticketmessage', '.ticket-message', '.ticket__message', '.message__text']) || {}).text || findTableVal(doc, /^message\b/i);
      if (!d) {
        for (const p of doc.querySelectorAll('.ticket__message p, .ticket-message p, .card-body p, p')) {
          if (p.closest('.ticket-headline, h1, h2, h3, header, .reply-box, form')) continue;
          const txt = clean(p.innerText || p.textContent);
          if (txt && txt.length > 2 && !/^(from:|custom|reply by|help desk|ticket status|priority:|owner:|category:|assigned)/i.test(txt) && !txt.toLowerCase().includes('from:') && (!t || !txt.toLowerCase().startsWith(clean(t).toLowerCase()))) {
            d = txt; break;
          }
        }
      }
      if (t || d) return { platform: 'HESK', id, title: t, description: d };
    }

    const adapters = [
      { name: 'Jira', m: u.includes('atlassian.net') || u.includes('jira') || doc.querySelector('#jira, [data-test-id*="issue"]'), id: ['#key-val', '[data-test-id*="issue-key"]'], t: ['#summary-val', '[data-test-id*="summary"]', 'h1[data-test-id*="issue.views"]'], d: ['#description-val', '[data-test-id*="description"]', '.user-content-block'] },
      { name: 'ServiceNow', m: u.includes('service-now.com') || doc.querySelector('[id*="incident."], [id*="sys_display.incident"]'), id: ['#sys_readonly\\.incident\\.number', 'input[name="incident.number"]'], t: ['#incident\\.short_description', 'input[name="incident.short_description"]'], d: ['#incident\\.description', 'textarea[name="incident.description"]'] },
      { name: 'Zendesk', m: u.includes('zendesk.com') || doc.querySelector('.ticket-pane, [data-test-id="ticket-pane-subject"]'), id: ['[data-test-id="ticket-id"]', '.ticket-id'], t: ['[data-test-id="ticket-pane-subject"]', 'input[name="subject"]'], d: ['.comment_input .body', '.ticket-body'] },
      { name: 'Freshdesk', m: u.includes('freshdesk.com') || doc.querySelector('[id*="helpdesk_ticket"]'), id: ['#ticket-display-id', '.ticket-id'], t: ['#helpdesk_ticket_subject', '.ticket-subject'], d: ['#helpdesk_ticket_ticket_body_attributes_description', '.ticket-details .body'] }
    ];

    for (const a of adapters) {
      if (a.m) {
        const idM = qFirst(doc, a.id);
        const tM = qFirst(doc, a.t);
        const dM = qFirst(doc, a.d);
        if (tM || dM) return { platform: a.name, id: idM ? idM.text : a.name, title: tM ? tM.text : '', description: dM ? dM.text : '' };
      }
    }

    const idM = qFirst(doc, ['[data-field="ticket-id"]', '[data-ticket-id]', '#ticket-id', '.ticket-id']);
    const tM = qFirst(doc, ['[data-field="ticket-title"]', '[data-ticket-title]', '#ticket-title', '.ticket-title', 'h1.ticket-subject', 'h1']);
    const dM = qFirst(doc, ['[data-field="ticket-description"]', '[data-ticket-description]', '#ticket-description', '.ticket-description', '.issue-body', 'article']);
    if (tM && tM.text.length > 3 && !/^(home|dashboard|login|welcome)$/i.test(tM.text)) {
      return { platform: 'Web Page', id: idM ? idM.text : 'TICKET', title: tM.text, description: dM ? dM.text : '' };
    }
    return null;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const host = document.createElement('div');
  host.id = 'policy-bookmarklet-host';
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = '*{box-sizing:border-box;margin:0;padding:0}.panel{width:360px;max-width:calc(100vw - 32px);background:#fff;color:#0f172a;font-size:13px;line-height:1.45;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.2),0 8px 10px -6px rgba(0,0,0,0.15);overflow:hidden}.header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0f172a;color:#f8fafc}.header-title{font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px}.actions{display:flex;gap:4px}.btn-act{background:rgba(255,255,255,0.15);border:none;color:#e2e8f0;cursor:pointer;font-size:13px;border-radius:4px;padding:3px 6px;line-height:1}.btn-act:hover{background:rgba(255,255,255,0.3);color:#fff}.ticket-bar{padding:6px 12px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:11px;display:flex;align-items:center;gap:6px}.ticket-pill{font-family:monospace;font-weight:700;color:#1e40af;background:#dbeafe;padding:1px 5px;border-radius:3px;white-space:nowrap}.ticket-subject{color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.body{padding:12px;max-height:480px;overflow-y:auto}.match-card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px}.match-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.policy-pill{font-family:monospace;font-size:11px;font-weight:700;color:#1e40af;background:#eff6ff;padding:2px 6px;border-radius:4px}.conf-badge{font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;background:#dcfce7;color:#166534}.policy-name{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px}.category-text{font-size:11px;color:#64748b;margin-bottom:8px}.res-box{background:#f8fafc;border-left:3px solid #2563eb;padding:8px;border-radius:0 4px 4px 0;font-size:12px;color:#1e293b;margin-bottom:8px}.res-label{font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;margin-bottom:3px}.btn-copy-res{background:#f1f5f9;border:1px solid #cbd5e1;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;color:#334155;margin-top:4px}.btn-copy-res:hover{background:#e2e8f0}.alert-banner{background:#fffbeb;border-left:3px solid #f59e0b;padding:8px;border-radius:0 4px 4px 0;font-size:11px;color:#92400e;margin-bottom:8px}.alert-manual{background:#fef2f2;border-left:3px solid #ef4444;padding:10px;border-radius:0 4px 4px 0;font-size:12px;color:#991b1b}.alert-manual-title{font-weight:700;margin-bottom:4px}.no-policy{text-align:center;padding:16px 8px;color:#64748b;font-size:12px}.expl-toggle{font-size:11px;color:#64748b;text-decoration:underline;cursor:pointer;margin-top:6px;display:inline-block}.expl-content{font-size:11px;color:#475569;background:#f1f5f9;padding:6px;border-radius:4px;margin-top:4px}.footer{font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding:6px 12px;background:#fafafa;display:flex;justify-content:space-between}.toast-msg{background:#0f172a;color:#f8fafc;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:12px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);border:1px solid #334155;cursor:pointer}.toast-close{background:none;border:none;color:#94a3b8;font-size:13px;cursor:pointer;padding:0;line-height:1}.toast-close:hover{color:#fff}';

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      host.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }
  }
  document.addEventListener('keydown', handleKeyDown);

  function renderResult(result, resultsContainer) {
    if (result.status === 'MATCH_FOUND' && result.topMatch) {
      const top = result.topMatch;
      let excHtml = '';
      if (top.exceptionTriggered && top.matchedExceptions && top.matchedExceptions.length > 0) {
        excHtml = `<div class="alert-banner">⚠️ <strong>Exception Condition Detected:</strong><br>${escapeHtml(top.matchedExceptions.join(' '))}</div>`;
      }

      resultsContainer.innerHTML = `
        <div class="match-card">
          <div class="match-meta">
            <span class="policy-pill">${escapeHtml(top.id)}</span>
            <span class="conf-badge">${escapeHtml(result.confidence || 'Matched')}</span>
          </div>
          <div class="policy-name">${escapeHtml(top.name)}</div>
          <div class="category-text">${escapeHtml(top.category)}</div>
          ${excHtml}
          <div class="res-box">
            <div class="res-label">Approved Resolution</div>
            <div>${escapeHtml(top.resolution)}</div>
            <button id="btn-copy-res" class="btn-copy-res">Copy Resolution</button>
          </div>
          <span id="expl-toggle" class="expl-toggle">Why did this match?</span>
          <div id="expl-box" class="expl-content" style="display:none;">
            ${escapeHtml(top.decisionRationale || '')} (Score: ${top.score})
          </div>
        </div>
      `;

      const btnCopy = shadow.getElementById('btn-copy-res');
      if (btnCopy) {
        btnCopy.addEventListener('click', () => {
          navigator.clipboard.writeText(top.resolution).then(() => {
            btnCopy.textContent = 'Copied!';
            setTimeout(() => { btnCopy.textContent = 'Copy Resolution'; }, 1500);
          });
        });
      }

      const explToggle = shadow.getElementById('expl-toggle');
      const explBox = shadow.getElementById('expl-box');
      if (explToggle && explBox) {
        explToggle.addEventListener('click', () => {
          explBox.style.display = explBox.style.display === 'none' ? 'block' : 'none';
        });
      }
    } else if (result.status === 'MANUAL_REVIEW_REQUIRED') {
      resultsContainer.innerHTML = `
        <div class="alert-manual">
          <div class="alert-manual-title">⚠️ MANUAL REVIEW REQUIRED</div>
          <div>${escapeHtml(result.reason || 'This ticket requires manual verification due to conflicting or ambiguous conditions.')}</div>
        </div>
      `;
    } else {
      resultsContainer.innerHTML = `
        <div class="no-policy">
          <div style="font-size:20px;margin-bottom:4px;">🔍</div>
          <strong>NO POLICY FOUND</strong>
          <div style="margin-top:4px;font-size:11px;">${escapeHtml(result.reason || 'No matching policy terms or conditions were identified.')}</div>
        </div>
      `;
    }
  }

  function runInspection() {
    shadow.innerHTML = '';
    shadow.appendChild(styleEl);

    const extracted = extractTicket(document, window.location.href);
    if (!extracted || (!extracted.title && !extracted.description)) {
      const toast = document.createElement('div');
      toast.id = 'results-container';
      toast.className = 'toast-msg';
      toast.innerHTML = '<span>No ticket found</span><button id="btn-close" class="toast-close" title="Close">✕</button>';
      const closeBtn = toast.querySelector ? toast.querySelector('#btn-close') : null;
      if (closeBtn && closeBtn.addEventListener) {
        closeBtn.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          host.remove();
        });
      }
      if (toast.addEventListener) {
        toast.addEventListener('click', () => host.remove());
      }
      shadow.appendChild(toast);
      if (typeof setTimeout !== 'undefined') {
        setTimeout(() => { if (host.parentNode) host.remove(); }, 3500);
      }
      return;
    }

    const { policies, source } = getActivePolicies();

    const container = document.createElement('div');
    container.className = 'panel';
    container.innerHTML = `
      <div class="header">
        <span class="header-title">🛡️ Policy Intelligence</span>
        <div class="actions">
          <button id="btn-rescan" class="btn-act" title="Re-scan">↻</button>
          <button id="btn-close" class="btn-act" title="Close">✕</button>
        </div>
      </div>
      <div id="ticket-bar" class="ticket-bar">
        <span id="ticket-id" class="ticket-pill">${escapeHtml(extracted.id || 'TICKET')}</span>
        <span id="ticket-title" class="ticket-subject">${escapeHtml(extracted.title || '(No Subject)')}</span>
      </div>
      <div class="body">
        <div id="results-container"></div>
      </div>
      <div class="footer">
        <span id="policy-count-text">${policies.length} policies (${source})</span>
        <span>100% Local Engine</span>
      </div>
    `;
    shadow.appendChild(container);

    const btnClose = shadow.getElementById('btn-close');
    const btnRescan = shadow.getElementById('btn-rescan');
    const resultsContainer = shadow.getElementById('results-container');

    if (btnClose && btnClose.addEventListener) btnClose.addEventListener('click', () => host.remove());
    if (btnRescan && btnRescan.addEventListener) btnRescan.addEventListener('click', runInspection);

    const result = matchTicket(extracted, policies);
    renderResult(result, resultsContainer);
  }

  host._rescan = runInspection;
  document.body.appendChild(host);
  runInspection();
})();
