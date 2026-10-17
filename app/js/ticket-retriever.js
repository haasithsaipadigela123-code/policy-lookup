/**
 * Policy Lookup — Robust Multi-Adapter Ticket Retriever
 * 
 * Implements a pluggable adapter architecture for URL-based ticket intake.
 * 
 * Adapters:
 * 1. GitHubAdapter — Specialized for GitHub public issues & PRs.
 * 2. JiraAdapter — Detects Atlassian Jira tickets, handles SSO auth barriers gracefully.
 * 3. ServiceNowAdapter — Detects ServiceNow incidents/requests, handles enterprise auth barriers.
 * 4. GenericWebAdapter — Fallback for generic web helpdesks and knowledge pages.
 * 
 * Guarantees:
 * - Never silently returns an empty ticket as successful.
 * - Never invents missing ticket content.
 * - Accurately reports fieldsRetrieved, isIncomplete, failureReason, and fallbackAction.
 * - Explains CORS and authentication limitations honestly.
 */

const TicketRetriever = (function () {
  'use strict';

  function isValidUrl(string) {
    if (!string || typeof string !== 'string') return false;
    try {
      const url = new URL(string.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function cleanText(str) {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
  }

  function cleanBoilerplateText(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/gi, ' ')
      .replace(/Help\s*Desk\s*Demo/gi, '')
      .replace(/Login\s*Help\s*Desk\s*Software/gi, '')
      .replace(/Help\s*Desk\s*Software/gi, '')
      .replace(/View\s*existing\s*ticket/gi, '')
      .replace(/Ticket\s*tracking\s*ID\s*[-—–]?\s*This\s*field\s*is\s*required/gi, '')
      .replace(/Ticket\s*tracking\s*ID/gi, '')
      .replace(/This\s*field\s*is\s*required/gi, '')
      .replace(/Forgot\s*tracking\s*ID\??/gi, '')
      .replace(/No\s*worries!\s*Enter your Email address and we will send you your tracking ID right away:?/gi, '')
      .replace(/Send\s*me\s*only\s*open\s*tickets/gi, '')
      .replace(/Send\s*me\s*all\s*my\s*tickets/gi, '')
      .replace(/Type\s*the\s*number\s*you\s*see\s*in\s*the\s*picture\s*below\.?/gi, '')
      .replace(/Send\s*me\s*my\s*tracking\s*ID/gi, '')
      .replace(/Powered\s*by\s*Help\s*Desk\s*Software\s*HESK/gi, '')
      .replace(/Powered\s*by\s*HESK/gi, '')
      .replace(/©\s*\d{4}[^.]*\.?/gi, '')
      .replace(/All\s*rights\s*reserved\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  function sanitizePageHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ');
  }

  function detectAccessBarrier(html, url) {
    if (!html) return null;
    const lower = html.toLowerCase();

    // 1. CAPTCHA challenges
    if (
      lower.includes('captcha') ||
      lower.includes('g-recaptcha') ||
      lower.includes('hcaptcha') ||
      lower.includes('cf-turnstile') ||
      lower.includes('type the number you see in the picture below')
    ) {
      return {
        isBarrier: true,
        barrierType: 'CAPTCHA_REQUIRED',
        error: 'CAPTCHA or Bot Protection challenge detected.',
        suggestion: 'This ticket page is protected by a CAPTCHA verification challenge. Policy Lookup preserves complete privacy and does not solve or bypass bot challenges. Switch to Ticket Description or Conversation to paste the ticket text directly.'
      };
    }

    // 2. Ticket Tracking ID Lookup Gates (e.g. HESK ticket.php form)
    if (
      (lower.includes('ticket tracking id') || lower.includes('view existing ticket') || lower.includes('forgot tracking id')) &&
      !lower.includes('ticket-message') &&
      !lower.includes('ticket__message') &&
      !lower.includes('ticket-body')
    ) {
      return {
        isBarrier: true,
        barrierType: 'TRACKING_ID_REQUIRED',
        error: 'Ticket Tracking ID and Email required to access ticket.',
        suggestion: 'This help desk requires both a valid Ticket Tracking ID and requester email address to unlock the conversation. Policy Lookup does not collect or brute-force user credentials. Please paste the ticket description or conversation transcript directly.'
      };
    }

    // 3. Login / Authentication walls
    if (
      (lower.includes('login') || lower.includes('sign in') || lower.includes('authenticate')) &&
      (lower.includes('password') || lower.includes('username') || lower.includes('sso')) &&
      !lower.includes('ticket-message') &&
      !lower.includes('comment-body')
    ) {
      return {
        isBarrier: true,
        barrierType: 'AUTHENTICATION_REQUIRED',
        error: 'Authentication or login session required.',
        suggestion: 'This ticketing system requires an authenticated user account. Switch to the Ticket Description or Conversation tab to analyze the ticket privately without credentials.'
      };
    }

    return null;
  }

  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  }

  // --------------------------------------------------------------------------
  // ADAPTER 1: GitHub Issues Adapter
  // --------------------------------------------------------------------------
  const GitHubAdapter = {
    name: 'github',
    displayName: 'GitHub Public Issue Adapter',

    matches(url) {
      try {
        const u = new URL(url);
        return (u.hostname === 'github.com' || u.hostname === 'www.github.com') &&
               /\/[^\/]+\/[^\/]+\/(?:issues|pull)\/\d+/i.test(u.pathname);
      } catch (_) {
        return false;
      }
    },

    extractIssueDetails(url) {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        // /:owner/:repo/issues/:number
        if (parts.length >= 4) {
          return {
            owner: parts[0],
            repo: parts[1],
            type: parts[2].toLowerCase(),
            number: parts[3]
          };
        }
      } catch (_) {}
      return null;
    },

    parseHtml(html, url) {
      const details = this.extractIssueDetails(url);
      const ticketId = details ? `#${details.number}` : null;

      // Extract title
      const titleMatch = html.match(/<bdi class="js-issue-title[^>]*>([\s\S]*?)<\/bdi>/i) ||
                         html.match(/<span class="js-issue-title[^>]*>([\s\S]*?)<\/span>/i) ||
                         html.match(/<h1[^>]*class="[^"]*gh-header-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/<title>([\s\S]*?)<\/title>/i);

      let title = titleMatch ? stripHtml(titleMatch[1]) : '';
      title = title.replace(/\s*·\s*Issue\s*#\d+[\s\S]*$/i, '')
                   .replace(/\s*·\s*GitHub\s*$/i, '')
                   .replace(/#\d+\s*$/, '')
                   .trim();

      // Extract body
      const bodyMatch = html.match(/<(?:div|td)[^>]*class="[^"]*comment-body[^"]*"[^>]*>([\s\S]*?)<\/(?:div|td)>/i) ||
                        html.match(/class="[^"]*comment-body[^"]*"[^>]*>([\s\S]*?)<\/(?:div|td)>/i) ||
                        html.match(/<div class="[^"]*edit-comment-hide[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<meta property="og:description" content="([^"]+)"/i);

      let description = bodyMatch ? stripHtml(bodyMatch[1]) : '';

      // Check author
      const authorMatch = html.match(/class="author[^"]*"[^>]*>([^<]+)<\/a>/i);
      const author = authorMatch ? cleanText(authorMatch[1]) : null;

      const fieldsRetrieved = [];
      if (ticketId) fieldsRetrieved.push('ticketId');
      if (title) fieldsRetrieved.push('title');
      if (description) fieldsRetrieved.push('description');
      if (author) fieldsRetrieved.push('author');

      if (!title && !description) {
        return null;
      }

      return {
        ticketId,
        title: title || (ticketId ? `GitHub Issue ${ticketId}` : 'GitHub Issue'),
        description: description || title,
        author,
        url,
        platform: 'github',
        fieldsRetrieved,
        isIncomplete: !description || description.length < 5
      };
    }
  };

  // --------------------------------------------------------------------------
  // ADAPTER 2: Atlassian Jira Adapter
  // --------------------------------------------------------------------------
  const JiraAdapter = {
    name: 'jira',
    displayName: 'Atlassian Jira Adapter',

    matches(url) {
      try {
        const u = new URL(url);
        return u.hostname.includes('atlassian.net') ||
               u.pathname.includes('/browse/') ||
               u.pathname.includes('/jira/');
      } catch (_) {
        return false;
      }
    },

    extractKey(url) {
      const match = url.match(/\/browse\/([A-Z0-9]+-\d+)/i) ||
                    url.match(/selectedIssue=([A-Z0-9]+-\d+)/i) ||
                    url.match(/key=([A-Z0-9]+-\d+)/i);
      return match ? match[1].toUpperCase() : null;
    },

    parseHtml(html, url) {
      const key = this.extractKey(url);
      const isLoginPage = /login|auth|sign[\s_-]?in|id\.atlassian\.com/i.test(html) ||
                          html.includes('data-testid="login"');

      if (isLoginPage) {
        return {
          requiresAuth: true,
          ticketId: key,
          platform: 'jira'
        };
      }

      // Title & description in rendered Jira HTML
      const titleMatch = html.match(/id="summary-val"[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/data-test-id="issue.views.issue-base.foundation.summary.heading"[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

      const descMatch = html.match(/id="description-val"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/data-test-id="issue.views.field.rich-text.description"[^>]*>([\s\S]*?)<\/div>/i);

      const title = titleMatch ? stripHtml(titleMatch[1]) : '';
      const description = descMatch ? stripHtml(descMatch[1]) : '';

      if (!title && !description) return null;

      return {
        ticketId: key,
        title: title || (key ? `Jira Issue ${key}` : 'Jira Ticket'),
        description: description || title,
        url,
        platform: 'jira',
        fieldsRetrieved: [key ? 'ticketId' : '', title ? 'title' : '', description ? 'description' : ''].filter(Boolean),
        isIncomplete: !description
      };
    }
  };

  // --------------------------------------------------------------------------
  // ADAPTER 3: ServiceNow Adapter
  // --------------------------------------------------------------------------
  const ServiceNowAdapter = {
    name: 'servicenow',
    displayName: 'ServiceNow ITSM Adapter',

    matches(url) {
      try {
        const u = new URL(url);
        return u.hostname.includes('service-now.com') ||
               u.pathname.includes('incident.do') ||
               u.pathname.includes('nav_to.do');
      } catch (_) {
        return false;
      }
    },

    extractNumber(url) {
      const match = url.match(/\b(INC\d{7,10}|REQ\d{7,10}|RITM\d{7,10})\b/i);
      return match ? match[1].toUpperCase() : null;
    },

    parseHtml(html, url) {
      const number = this.extractNumber(url);
      const isLoginPage = /login|auth|navpage/i.test(html) && /password|credentials|sign[\s_-]?in/i.test(html);

      if (isLoginPage) {
        return {
          requiresAuth: true,
          ticketId: number,
          platform: 'servicenow'
        };
      }

      const shortDescMatch = html.match(/name="incident\.short_description"[^>]*value="([^"]+)"/i) ||
                             html.match(/id="incident\.short_description"[^>]*>([\s\S]*?)<\/span>/i);
      const descMatch = html.match(/name="incident\.description"[^>]*>([\s\S]*?)<\/textarea>/i);

      const title = shortDescMatch ? stripHtml(shortDescMatch[1]) : '';
      const description = descMatch ? stripHtml(descMatch[1]) : '';

      if (!title && !description) return null;

      return {
        ticketId: number,
        title: title || (number ? `ServiceNow Incident ${number}` : 'ServiceNow Ticket'),
        description: description || title,
        url,
        platform: 'servicenow',
        fieldsRetrieved: [number ? 'ticketId' : '', title ? 'title' : '', description ? 'description' : ''].filter(Boolean),
        isIncomplete: !description
      };
    }
  };

  // --------------------------------------------------------------------------
  // ADAPTER 4: Hesk Help Desk Adapter (hesk.com and self-hosted Hesk)
  // --------------------------------------------------------------------------
  const HeskAdapter = {
    name: 'hesk',
    displayName: 'Hesk Help Desk Adapter',

    matches(url) {
      try {
        const u = new URL(url);
        return u.hostname.includes('hesk.com') ||
               u.pathname.includes('/ticket.php') ||
               u.pathname.includes('/knowledgebase.php') ||
               u.search.includes('track=');
      } catch (_) {
        return false;
      }
    },

    extractTrackId(url) {
      const match = url.match(/[?&]track=([A-Z0-9\-]+)/i) ||
                    url.match(/\b([A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{4})\b/i);
      return match ? match[1].toUpperCase() : null;
    },

    parseHtml(html, url) {
      const trackId = this.extractTrackId(url);

      // 1. Detect access barrier first (CAPTCHA or Tracking ID lookup form)
      const barrier = detectAccessBarrier(html, url);
      if (barrier) {
        return {
          requiresAuth: true,
          ticketId: trackId,
          platform: 'hesk',
          failureReason: barrier.barrierType,
          error: barrier.error,
          suggestion: barrier.suggestion
        };
      }

      // 2. Detect Knowledge Base articles (e.g. knowledgebase.php?article=1)
      const isKnowledgeBase = url.includes('knowledgebase.php') ||
                              url.includes('/kb/') ||
                              /suggested knowledgebase articles/i.test(html) ||
                              (/class="[^"]*article__body[^"]*"/i.test(html) && !url.includes('ticket.php'));

      if (isKnowledgeBase) {
        const titleMatch = html.match(/<h1[^>]*class="[^"]*article__heading[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                           html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                           html.match(/<title>([\s\S]*?)<\/title>/i);
        let title = titleMatch ? stripHtml(titleMatch[1]) : 'Hesk Knowledge Base Article';
        title = cleanBoilerplateText(title).replace(/\s*-\s*Help\s*Desk\s*Demo.*$/i, '').trim();

        const bodyMatch = html.match(/<div[^>]*class="[^"]*article__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        let content = bodyMatch ? stripHtml(bodyMatch[1]) : '';
        content = cleanBoilerplateText(cleanText(content));

        return {
          isKnowledgeBase: true,
          classification: 'PAGE_RETRIEVED',
          pageType: 'knowledge_base',
          title: title || 'Hesk Knowledge Base Article',
          description: content,
          url,
          platform: 'hesk',
          webpageRetrieved: true,
          ticketContentExtracted: false,
          fieldsRetrieved: ['title'],
          failureReason: 'UNSUPPORTED_PAGE',
          error: `Retrieved public Knowledge Base article ("${title}"). This is documentation/help content rather than a private support ticket.`,
          suggestion: 'To analyze an active support ticket against policies, please switch to the Ticket Description or Conversation tab.'
        };
      }

      // Check if this is the "View existing ticket" lookup form without ticket content
      const hasRealMessage = /class="[^"]*(?:ticket-message|ticket__message|ticket-body)[^"]*"/i.test(html) ||
                             /<article[^>]*>[\s\S]{30,}<\/article>/i.test(html);

      if (!hasRealMessage) {
        return {
          requiresAuth: true,
          ticketId: trackId,
          platform: 'hesk',
          failureReason: 'TRACKING_ID_REQUIRED',
          error: 'Hesk Help Desk requires Ticket Tracking ID and Email to access ticket details.',
          suggestion: 'This ticket page is a tracking lookup gate. To analyze this ticket without logging into Hesk, switch to the Ticket Description or Conversation tab to paste the issue directly.'
        };
      }

      // Title & Subject in Hesk HTML
      const titleMatch = html.match(/<h1[^>]*class="[^"]*ticket-subject[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/<b>Subject:<\/b>\s*([^<]+)/i) ||
                         html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/<title>([\s\S]*?)<\/title>/i);

      let title = titleMatch ? stripHtml(titleMatch[1]) : '';
      title = cleanBoilerplateText(title)
                   .replace(/\s*-\s*Help\s*Desk\s*Demo\s*$/i, '')
                   .replace(/\s*-\s*HESK\s*$/i, '')
                   .replace(/View existing ticket/i, '')
                   .trim();

      // Message in Hesk HTML
      const msgMatch = html.match(/<div[^>]*class="[^"]*(?:ticket-message|ticket__message)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/<td[^>]*class="[^"]*ticket-message[^"]*"[^>]*>([\s\S]*?)<\/td>/i);

      let description = msgMatch ? stripHtml(msgMatch[1]) : '';
      description = cleanBoilerplateText(cleanText(description));

      // Never fall back to dumping raw body slices or form inputs!
      if (!description || description.length < 10) {
        return {
          requiresAuth: true,
          ticketId: trackId,
          platform: 'hesk',
          failureReason: 'TRACKING_ID_REQUIRED',
          error: 'Hesk ticket message content could not be found or required tracking credentials.',
          suggestion: 'Please switch to the Ticket Description or Conversation tab to paste the ticket text directly.'
        };
      }

      const fieldsRetrieved = [];
      if (trackId) fieldsRetrieved.push('ticketId');
      if (title) fieldsRetrieved.push('title');
      if (description) fieldsRetrieved.push('description');

      return {
        ticketId: trackId,
        title: title || (trackId ? `Hesk Ticket ${trackId}` : 'Hesk Help Desk Ticket'),
        description,
        url,
        platform: 'hesk',
        fieldsRetrieved,
        isIncomplete: description.length < 20
      };
    }
  };

  // --------------------------------------------------------------------------
  // ADAPTER 5: Generic Web Helpdesk Adapter
  // --------------------------------------------------------------------------
  const GenericWebAdapter = {
    name: 'generic',
    displayName: 'Generic Web Adapter',

    matches() {
      return true; // Fallback for any HTTP/HTTPS URL
    },

    parseHtml(html, url) {
      // 1. Detect access barrier first
      const barrier = detectAccessBarrier(html, url);
      if (barrier) {
        return {
          requiresAuth: true,
          failureReason: barrier.barrierType,
          error: barrier.error,
          suggestion: barrier.suggestion,
          platform: 'generic'
        };
      }

      // Check for empty or minimal SPA shells (React/Vue/Angular empty mounts)
      const cleanBody = stripHtml(html);
      if (cleanBody.length < 50 && (html.includes('<div id="root">') || html.includes('<div id="app">'))) {
        return {
          isSpaShell: true,
          platform: 'generic'
        };
      }

      // Sanitize page to exclude nav, header, footer, forms, scripts
      const sanitizedHtml = sanitizePageHtml(html);

      // Title candidates
      const titleMatch = sanitizedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                         html.match(/<title>([\s\S]*?)<\/title>/i) ||
                         sanitizedHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);

      let title = titleMatch ? stripHtml(titleMatch[1]) : '';
      title = cleanBoilerplateText(cleanText(title));

      // Description candidates: look ONLY for semantic containers
      const articleMatch = sanitizedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                           sanitizedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                           sanitizedHtml.match(/<div[^>]*class="[^"]*(?:ticket-content|ticket-body|issue-body|comment-body|article-body|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

      let description = articleMatch ? stripHtml(articleMatch[1]) : '';
      description = cleanBoilerplateText(cleanText(description));

      // NEVER dump raw body slice!
      if (!description || description.length < 15) {
        return {
          failureReason: 'UNSUPPORTED_PAGE',
          error: 'Webpage retrieved (HTTP 200), but no semantic ticket content or problem description could be recognized.',
          suggestion: 'Switch to the Ticket Description or Guided Builder tab to enter the ticket details.'
        };
      }

      // Ticket ID extraction from URL or title
      const idMatch = url.match(/\b(INC-\d+|#\d{3,8}|TCK-\d+|[A-Z]{2,5}-\d{2,6})\b/i) ||
                      (title && title.match(/\b(INC-\d+|#\d{3,8}|TCK-\d+|[A-Z]{2,5}-\d{2,6})\b/i));
      const ticketId = idMatch ? idMatch[0].toUpperCase() : null;

      const fieldsRetrieved = [];
      if (ticketId) fieldsRetrieved.push('ticketId');
      if (title) fieldsRetrieved.push('title');
      if (description) fieldsRetrieved.push('description');

      return {
        ticketId,
        title: title || 'Retrieved Web Ticket',
        description: description || title,
        url,
        platform: 'generic',
        fieldsRetrieved,
        isIncomplete: description.length < 30
      };
    }
  };

  const ADAPTERS = [GitHubAdapter, JiraAdapter, ServiceNowAdapter, HeskAdapter, GenericWebAdapter];

  function getAdapter(url) {
    for (const a of ADAPTERS) {
      if (a.matches(url)) return a;
    }
    return GenericWebAdapter;
  }

  /**
   * Main retrieval function
   */
  // --------------------------------------------------------------------------
  // CENTRAL RETRIEVAL STRATEGY MANAGER
  // --------------------------------------------------------------------------
  const RetrievalStrategyManager = {
    // Strategy A: Direct Browser Retrieval
    async attemptDirectBrowser(targetUrl, onProgress) {
      if (typeof onProgress === 'function') {
        onProgress({ strategy: 'STRATEGY_A', status: 'ATTEMPTING', message: 'Strategy A: Testing direct browser retrieval...' });
      }

      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        return { attempted: false, error: 'Direct browser retrieval is not supported in non-browser runtime' };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9' },
          signal: controller.signal
        });
        clearTimeout(timer);

        const contentType = response.headers.get('content-type') || 'text/html';
        const lowerCt = contentType.toLowerCase();
        if (contentType && !lowerCt.includes('text/') && !lowerCt.includes('html') && !lowerCt.includes('xml') && !lowerCt.includes('json')) {
          return {
            attempted: true,
            success: false,
            classification: 'UNSUPPORTED_CONTENT_TYPE',
            statusCode: response.status,
            contentType,
            error: `Unsupported content type '${contentType}'. Only text and HTML pages can be retrieved.`
          };
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return {
              attempted: true,
              success: false,
              classification: 'ACCESS_DENIED',
              statusCode: response.status,
              error: `Authentication Required / Access Denied (HTTP ${response.status}).`,
              suggestion: 'This ticket page requires an authenticated user session.',
              fallbackAction: 'SWITCH_TO_DESCRIPTION'
            };
          }
          return {
            attempted: true,
            success: false,
            classification: 'HTTP_ERROR',
            statusCode: response.status,
            error: `Server responded with HTTP ${response.status} ${response.statusText}.`,
            fallbackAction: 'SWITCH_TO_DESCRIPTION'
          };
        }

        const html = await response.text();
        const adapter = getAdapter(targetUrl);
        const parsed = adapter.parseHtml(html, targetUrl);

        if (parsed && parsed.isKnowledgeBase) {
          return {
            attempted: true,
            success: true,
            classification: 'PAGE_RETRIEVED',
            pageType: 'knowledge_base',
            webpageRetrieved: true,
            ticketContentExtracted: false,
            platform: adapter.name,
            url: targetUrl,
            article: {
              title: parsed.title,
              content: parsed.description,
              url: targetUrl
            },
            message: parsed.error || `Retrieved public Knowledge Base article: "${parsed.title}".`,
            suggestion: parsed.suggestion,
            fallbackAction: 'SWITCH_TO_DESCRIPTION',
            diagnostics: { strategy: 'direct_browser', statusCode: response.status, contentType }
          };
        }

        if (parsed && (parsed.requiresAuth || parsed.failureReason)) {
          return {
            attempted: true,
            success: false,
            classification: parsed.failureReason || 'AUTHENTICATION_REQUIRED',
            pageType: parsed.failureReason === 'TRACKING_ID_REQUIRED' ? 'ticket_lookup_form' : 'login_page',
            webpageRetrieved: true,
            ticketContentExtracted: false,
            platform: adapter.name,
            url: targetUrl,
            error: parsed.error,
            suggestion: parsed.suggestion,
            fallbackAction: parsed.fallbackAction || 'SWITCH_TO_DESCRIPTION',
            diagnostics: { strategy: 'direct_browser', statusCode: response.status }
          };
        }

        if (parsed && parsed.title && parsed.description) {
          return {
            attempted: true,
            success: true,
            classification: 'TICKET_CONTENT_EXTRACTED',
            pageType: 'support_ticket',
            webpageRetrieved: true,
            ticketContentExtracted: true,
            platform: adapter.name,
            url: targetUrl,
            ticket: parsed,
            fieldsRetrieved: parsed.fieldsRetrieved || [],
            isIncomplete: Boolean(parsed.isIncomplete),
            diagnostics: { strategy: 'direct_browser', statusCode: response.status }
          };
        }

        return {
          attempted: true,
          success: false,
          classification: 'UNSUPPORTED_PAGE',
          webpageRetrieved: true,
          ticketContentExtracted: false,
          platform: adapter.name,
          url: targetUrl,
          error: 'Page retrieved directly, but no recognized ticket content was found.',
          fallbackAction: 'SWITCH_TO_DESCRIPTION'
        };

      } catch (err) {
        clearTimeout(timer);
        const errMsg = (err && err.message) ? err.message.toLowerCase() : '';
        const isCors = errMsg.includes('failed to fetch') ||
                       errMsg.includes('network') ||
                       errMsg.includes('cross-origin') ||
                       err.name === 'TypeError';

        return {
          attempted: true,
          success: false,
          isCors: isCors,
          classification: isCors ? 'CORS_RESTRICTED' : (err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'),
          failureReason: isCors ? 'CORS_RESTRICTION' : 'NETWORK_ERROR',
          error: isCors
            ? 'Browser security restrictions (CORS) prevented direct client-side retrieval from this domain.'
            : `Direct browser fetch error: ${err.message}`,
          suggestion: 'Retrying automatically via the local Node.js backend...',
          diagnostics: { strategy: 'direct_browser', errorName: err.name, errorMessage: err.message }
        };
      }
    },

    // Strategy B: Local Node.js Backend Retrieval
    async attemptLocalBackend(targetUrl, onProgress) {
      if (typeof onProgress === 'function') {
        onProgress({ strategy: 'STRATEGY_B', status: 'ATTEMPTING', message: 'Strategy B: Retrieving via local SSRF-protected backend...' });
      }

      // In Node.js environment directly:
      if (typeof window === 'undefined') {
        try {
          const ServerRetriever = require('./server-retriever.js');
          const fetchResult = await ServerRetriever.safeOutboundFetch(targetUrl);
          const extraction = ServerRetriever.classifyAndExtract(fetchResult.body, fetchResult.finalUrl, fetchResult.statusCode, fetchResult.contentType);
          const isSuccess = extraction.ticketContentExtracted || extraction.classification === 'PAGE_RETRIEVED';
          return {
            attempted: true,
            success: isSuccess,
            ...extraction,
            url: targetUrl,
            finalUrl: fetchResult.finalUrl,
            statusCode: fetchResult.statusCode,
            contentType: fetchResult.contentType,
            diagnostics: {
              strategy: 'local_backend',
              retrievalMethod: 'local_backend',
              resolvedIps: fetchResult.resolvedIps,
              redirectCount: fetchResult.redirects.length,
              byteSize: fetchResult.byteSize,
              durationMs: fetchResult.durationMs
            }
          };
        } catch (serverErr) {
          return {
            attempted: true,
            success: false,
            classification: serverErr.code || 'NETWORK_ERROR',
            failureReason: serverErr.code || 'NETWORK_ERROR',
            error: serverErr.message,
            diagnostics: { strategy: 'local_backend', errorDetail: serverErr.code }
          };
        }
      }

      // In Browser environment: call POST /api/ticket/retrieve
      try {
        let res = await fetch('/api/ticket/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl })
        });

        if (res.status === 404) {
          res = await fetch('/api/retrieve-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl })
          });
        }

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            return {
              attempted: true,
              success: false,
              classification: 'ENDPOINT_HTML_FALLBACK',
              failureReason: 'ENDPOINT_HTML_FALLBACK',
              error: 'Backend retrieval endpoint returned non-JSON response.',
              suggestion: 'You can switch to Description, Conversation, or Guided intake below to proceed.'
            };
          }
          const data = await res.json();
          return {
            attempted: true,
            ...data
          };
        } else {
          return {
            attempted: true,
            success: false,
            classification: 'HTTP_ERROR',
            statusCode: res.status,
            error: `Backend returned HTTP ${res.status}`,
            suggestion: 'You can switch to Description, Conversation, or Guided intake below to proceed.'
          };
        }
      } catch (err) {
        return {
          attempted: true,
          success: false,
          serverOffline: true,
          classification: 'SERVER_OFFLINE',
          failureReason: 'SERVER_OFFLINE',
          error: 'Backend retrieval endpoint is not reachable.',
          suggestion: 'You can switch to Description, Conversation, or Guided intake below to proceed.'
        };
      }
    },

    // Strategy C: Official Integration / Documented Public API
    async attemptOfficialIntegration(targetUrl, onProgress) {
      try {
        const u = new URL(targetUrl);
        if (u.hostname === 'github.com' || u.hostname === 'www.github.com') {
          const match = u.pathname.match(/\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
          if (match) {
            const [_, owner, repo, issueNum] = match;
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}`;
            if (typeof onProgress === 'function') {
              onProgress({ strategy: 'STRATEGY_C', status: 'ATTEMPTING', message: `Strategy C: Querying GitHub Public API (${apiUrl})...` });
            }
            return await this.attemptLocalBackend(apiUrl, onProgress);
          }
        }
      } catch (_) {}

      return { attempted: false, supported: false };
    },

    // Master Retrieve Coordinator
    async retrieve(rawUrl, options = {}) {
      const onProgress = options.onProgress || (() => {});

      if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return {
          success: false,
          url: '',
          classification: 'MALFORMED_URL',
          failureReason: 'MALFORMED_URL',
          error: 'Please enter a valid ticket URL.',
          suggestion: 'Enter a complete web address including http:// or https://',
          fallbackAction: 'CHECK_URL'
        };
      }

      const trimmedUrl = rawUrl.trim();
      if (!isValidUrl(trimmedUrl)) {
        return {
          success: false,
          url: trimmedUrl,
          classification: 'MALFORMED_URL',
          failureReason: 'MALFORMED_URL',
          error: 'Please enter a valid HTTP or HTTPS URL (e.g., https://github.com/owner/repo/issues/123).',
          suggestion: 'Check the URL format and try again.',
          fallbackAction: 'CHECK_URL'
        };
      }

      const adapter = getAdapter(trimmedUrl);
      const isBrowser = typeof window !== 'undefined';
      const strategyTrace = [];

      // Step 1: Strategy A (Direct Browser Retrieval) in browser
      if (isBrowser) {
        onProgress({ strategy: 'STRATEGY_A', status: 'STARTED', message: 'Strategy A: Testing direct browser retrieval...' });
        const resA = await this.attemptDirectBrowser(trimmedUrl, onProgress);
        strategyTrace.push({ strategy: 'STRATEGY_A', result: resA });

        if (resA.success && resA.ticketContentExtracted) {
          return {
            ...resA,
            strategyTrace,
            retrievalMethod: 'direct_browser'
          };
        }

        if (resA.success && resA.classification === 'PAGE_RETRIEVED') {
          return {
            ...resA,
            strategyTrace,
            retrievalMethod: 'direct_browser'
          };
        }

        if (resA.isCors) {
          onProgress({
            strategy: 'STRATEGY_A',
            status: 'CORS_RESTRICTED',
            message: 'Your browser could not retrieve this page directly (CORS restricted). Trying the local retrieval method (Strategy B)...'
          });
        }
      }

      // Step 2: Strategy B (Local Backend Retrieval)
      onProgress({ strategy: 'STRATEGY_B', status: 'STARTED', message: 'Strategy B: Attempting local Node.js backend retrieval...' });
      const resB = await this.attemptLocalBackend(trimmedUrl, onProgress);
      strategyTrace.push({ strategy: 'STRATEGY_B', result: resB });

      if (resB.success) {
        return {
          ...resB,
          strategyTrace,
          retrievalMethod: 'local_backend'
        };
      }

      // Permanent barriers: Do not enter retry loop!
      if (
        resB.classification === 'TRACKING_ID_REQUIRED' ||
        resB.classification === 'AUTHENTICATION_REQUIRED' ||
        resB.classification === 'CAPTCHA_REQUIRED' ||
        resB.classification === 'ACCESS_DENIED' ||
        resB.classification === 'SSRF_BLOCKED' ||
        resB.classification === 'PAGE_RETRIEVED'
      ) {
        return {
          ...resB,
          strategyTrace,
          retrievalMethod: 'local_backend',
          fallbackAction: 'SWITCH_TO_DESCRIPTION',
          fallbackOptions: [
            { id: 'desc', label: 'Paste Ticket Description' },
            { id: 'conv', label: 'Paste Full Conversation' },
            { id: 'upload', label: 'Upload Conversation File' },
            { id: 'guided', label: 'Build Ticket Using Guided Options' }
          ]
        };
      }

      // Step 3: Strategy C (Official Integration) if supported
      const resC = await this.attemptOfficialIntegration(trimmedUrl, onProgress);
      if (resC.attempted && resC.success) {
        strategyTrace.push({ strategy: 'STRATEGY_C', result: resC });
        return {
          ...resC,
          strategyTrace,
          retrievalMethod: 'official_api'
        };
      }

      // Step 4: Strategy D (User-provided content fallback with preserved URL)
      const finalError = resB.error || (strategyTrace[0] && strategyTrace[0].result && strategyTrace[0].result.error) || 'Automatic URL retrieval could not access the ticket.';
      const finalClassification = resB.classification || (strategyTrace[0] && strategyTrace[0].result && strategyTrace[0].result.classification) || 'RETRIEVAL_FAILED';

      return {
        success: false,
        url: trimmedUrl,
        classification: finalClassification,
        failureReason: finalClassification,
        platform: adapter.name,
        ticket: null,
        error: finalError,
        suggestion: resB.suggestion || 'Please choose an alternative intake method below. Your URL has been preserved.',
        fallbackAction: 'SWITCH_TO_DESCRIPTION',
        strategyTrace,
        fallbackOptions: [
          { id: 'desc', label: 'Paste Ticket Description' },
          { id: 'conv', label: 'Paste Full Conversation' },
          { id: 'upload', label: 'Upload Conversation File' },
          { id: 'guided', label: 'Build Ticket Using Guided Options' }
        ]
      };
    }
  };

  /**
   * Main retrieval function: delegates to RetrievalStrategyManager
   */
  async function retrieveTicket(rawUrl, options = {}) {
    return RetrievalStrategyManager.retrieve(rawUrl, options);
  }

  return {
    isValidUrl,
    retrieveTicket,
    RetrievalStrategyManager,
    getAdapter,
    ADAPTERS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TicketRetriever;
}
