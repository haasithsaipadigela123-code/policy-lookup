/**
 * Policy Lookup — Server-Side SSRF-Protected Ticket & URL Retrieval Engine
 * 
 * Provides Strategy B (Local Node.js backend retrieval) with comprehensive
 * Server-Side Request Forgery (SSRF) and DNS-rebinding protection.
 * 
 * Safeguards:
 * 1. Protocol validation: strictly http: and https: (rejects file:, ftp:, gopher:, javascript:, data:, etc.).
 * 2. Hostname validation: blocks localhost, *.local, *.internal, metadata.google.internal, instance-data, etc.
 * 3. Pre-flight DNS resolution: resolves hostname via dns.promises.lookup({ all: true }).
 * 4. IP/Subnet validation: strictly rejects IPv4/IPv6 loopback (127.0.0.0/8, ::1),
 *    private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7),
 *    link-local / cloud metadata (169.254.0.0/16, 169.254.169.254, fe80::/10),
 *    carrier-grade NAT (100.64.0.0/10), multicast, broadcast, and reserved addresses.
 * 5. Handles IPv4-mapped IPv6 (::ffff:127.0.0.1 -> extracts IPv4 and validates).
 * 6. Redirect revalidation: re-resolves and revalidates destination IP on every 3xx redirect (max 5 hops).
 * 7. Response size cap: max 2MB (2,097,152 bytes) with streaming chunk abort.
 * 8. Request duration timeout: strict 6000ms timeout per hop.
 * 9. Content-Type filter: only accepts HTML, XHTML, XML, plain text, and JSON. Rejects binary/executables/media.
 * 10. Concurrency limit: protects server resources.
 * 11. No forwarding of client cookies or authentication headers.
 */

const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const url = require('url');

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const REQUEST_TIMEOUT_MS = 6000; // 6 seconds
const MAX_CONCURRENT_FETCHES = 5;

let activeFetchCount = 0;

/**
 * Validates whether an IP address belongs to private, loopback, link-local,
 * cloud metadata, multicast, or reserved ranges.
 */
function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let cleanIp = ip.trim();

  // Handle IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:a00:1
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.substring(7);
  }

  const fam = net.isIP(cleanIp);
  if (fam === 4) {
    const parts = cleanIp.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (a === 10) return true;
    // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local, including AWS/GCP/Azure metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.88.99.0/24 (6to4 Relay)
    if (a === 192 && b === 88 && c === 99) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (Network benchmark)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 (Multicast 224.0.0.0 - 239.255.255.255)
    // 240.0.0.0/4 (Reserved 240.0.0.0 - 255.255.255.254)
    // 255.255.255.255 (Broadcast)
    if (a >= 224) return true;

    return false;
  }

  if (fam === 6) {
    const norm = cleanIp.toLowerCase();
    // Loopback & Unspecified
    if (norm === '::1' || norm === '::' || norm === '0:0:0:0:0:0:0:1' || norm === '0:0:0:0:0:0:0:0') return true;
    // Link-local unicast fe80::/10
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    // Unique local address fc00::/7 (fc00:: - fdff::)
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    // Multicast ff00::/8
    if (norm.startsWith('ff')) return true;
    // IPv4-mapped addresses
    if (norm.includes('.')) {
      const lastPart = norm.split(':').pop();
      if (lastPart && net.isIP(lastPart) === 4) {
        return isPrivateOrReservedIp(lastPart);
      }
    }
    return false;
  }

  return true; // Not a valid IP format
}

/**
 * Validates hostname against known internal or cloud metadata aliases
 */
function isDisallowedHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'local' || h.endsWith('.local')) return true;
  if (h === 'internal' || h.endsWith('.internal')) return true;
  if (h === 'arpa' || h.endsWith('.arpa')) return true;
  if (h === 'metadata.google.internal' || h === 'metadata.internal' || h === 'instance-data') return true;
  if (h === '169.254.169.254' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
  return false;
}

/**
 * Validates URL format, protocol, and target host
 */
function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      valid: false,
      reason: 'MALFORMED_URL',
      error: 'Ticket URL must be a non-empty string.'
    };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    return {
      valid: false,
      reason: 'MALFORMED_URL',
      error: 'Invalid URL format. Please provide a complete URL starting with http:// or https://'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'UNSUPPORTED_SCHEME',
      error: `Unsupported protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'MALFORMED_URL',
      error: 'URLs containing embedded credentials are not permitted for security reasons.'
    };
  }

  if (!parsed.hostname) {
    return {
      valid: false,
      reason: 'MALFORMED_URL',
      error: 'URL is missing a valid hostname.'
    };
  }

  if (isDisallowedHostname(parsed.hostname)) {
    return {
      valid: false,
      reason: 'SSRF_BLOCKED',
      error: `Access to '${parsed.hostname}' is blocked (SSRF security policy: local/internal hostnames are restricted).`
    };
  }

  return {
    valid: true,
    parsedUrl: parsed
  };
}

/**
 * Resolves hostname via DNS and validates that ALL resolved IP addresses are public
 */
async function resolveAndValidateHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      const err = new Error(`Access to destination IP ${hostname} is blocked (SSRF security policy: restricted IP range).`);
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
    return [hostname];
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    const error = new Error(`DNS resolution failed for '${hostname}': ${err.message}`);
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  if (!records || records.length === 0) {
    const error = new Error(`No DNS records found for host '${hostname}'.`);
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  const verifiedIps = [];
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      const err = new Error(`Host '${hostname}' resolves to restricted IP ${record.address} (SSRF security policy).`);
      err.code = 'SSRF_BLOCKED';
      throw err;
    }
    verifiedIps.push(record.address);
  }

  return verifiedIps;
}

/**
 * Executes safe outbound HTTP/HTTPS request with SSRF defense, redirect revalidation,
 * size capping, and timeout protection.
 */
async function safeOutboundFetch(targetUrl, options = {}) {
  if (activeFetchCount >= MAX_CONCURRENT_FETCHES) {
    const err = new Error('Server retrieval capacity reached. Please wait a moment and retry.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  activeFetchCount++;
  const startTime = Date.now();
  let currentUrl = targetUrl;
  let redirectCount = 0;
  const redirectChain = [];
  const allResolvedIps = [];

  try {
    while (true) {
      const val = validateUrl(currentUrl);
      if (!val.valid) {
        const err = new Error(val.error);
        err.code = val.reason;
        throw err;
      }

      const parsed = val.parsedUrl;
      const resolvedIps = await resolveAndValidateHost(parsed.hostname);
      allResolvedIps.push(...resolvedIps);

      const client = parsed.protocol === 'https:' ? https : http;
      const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);

      const reqOptions = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: port,
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PolicyLookup/2.0 (SSRF-Protected Retrieval)',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Host': parsed.hostname
        },
        timeout: REQUEST_TIMEOUT_MS
      };

      const hopResult = await new Promise((resolve, reject) => {
        let isSettled = false;
        const settle = (err, res) => {
          if (isSettled) return;
          isSettled = true;
          if (err) reject(err);
          else resolve(res);
        };

        const req = client.request(reqOptions, (res) => {
          const contentType = res.headers['content-type'] || 'text/html';
          const lowerCt = contentType.toLowerCase();

          // Follow 3xx Redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume(); // discard body
            let nextLocation = res.headers.location;
            let nextUrl;
            try {
              nextUrl = new URL(nextLocation, currentUrl).toString();
            } catch (e) {
              const err = new Error(`Malformed redirect location header: ${nextLocation}`);
              err.code = 'REDIRECT_ERROR';
              return settle(err);
            }
            return settle(null, { isRedirect: true, statusCode: res.statusCode, nextUrl });
          }

          // Content-Type validation: only accept HTML, plain text, XML, JSON
          const isAllowedType = lowerCt.includes('text/') ||
                                lowerCt.includes('html') ||
                                lowerCt.includes('xhtml') ||
                                lowerCt.includes('xml') ||
                                lowerCt.includes('json');

          if (!isAllowedType) {
            res.resume();
            const err = new Error(`Unsupported content type '${contentType}'. Only text and HTML pages can be retrieved.`);
            err.code = 'UNSUPPORTED_CONTENT_TYPE';
            err.statusCode = res.statusCode;
            err.contentType = contentType;
            return settle(err);
          }

          // Content-Length check
          const cl = parseInt(res.headers['content-length'] || '0', 10);
          if (cl > MAX_RESPONSE_BYTES) {
            res.resume();
            const err = new Error(`Page size (${Math.round(cl / 1024)} KB) exceeds the 2MB safety limit.`);
            err.code = 'OVERSIZED_RESPONSE';
            err.statusCode = res.statusCode;
            return settle(err);
          }

          let body = '';
          let byteCount = 0;
          let aborted = false;

          res.on('data', chunk => {
            if (aborted) return;
            byteCount += chunk.length;
            if (byteCount > MAX_RESPONSE_BYTES) {
              aborted = true;
              req.destroy();
              const err = new Error('Page content exceeded 2MB limit during stream.');
              err.code = 'OVERSIZED_RESPONSE';
              err.statusCode = res.statusCode;
              return settle(err);
            }
            body += chunk.toString('utf8');
          });

          res.on('end', () => {
            if (aborted) return;
            settle(null, {
              isRedirect: false,
              statusCode: res.statusCode,
              headers: res.headers,
              contentType: contentType,
              body: body,
              byteSize: byteCount
            });
          });

          res.on('error', (err) => {
            const error = new Error(`Stream transmission error: ${err.message}`);
            error.code = 'NETWORK_ERROR';
            settle(error);
          });
        });

        req.on('timeout', () => {
          req.destroy();
          const err = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
          err.code = 'TIMEOUT';
          settle(err);
        });

        req.on('error', (err) => {
          const error = new Error(`Connection error: ${err.message}`);
          error.code = 'NETWORK_ERROR';
          settle(error);
        });

        req.end();
      });

      if (hopResult.isRedirect) {
        redirectChain.push({
          from: currentUrl,
          to: hopResult.nextUrl,
          statusCode: hopResult.statusCode
        });
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          const err = new Error(`Redirect chain exceeded limit of ${MAX_REDIRECTS} hops.`);
          err.code = 'REDIRECT_LOOP';
          throw err;
        }
        currentUrl = hopResult.nextUrl;
        continue; // Re-validate the redirect destination
      }

      return {
        success: true,
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: hopResult.statusCode,
        contentType: hopResult.contentType,
        body: hopResult.body,
        byteSize: hopResult.byteSize,
        redirects: redirectChain,
        resolvedIps: Array.from(new Set(allResolvedIps)),
        durationMs: Date.now() - startTime
      };
    }
  } finally {
    activeFetchCount = Math.max(0, activeFetchCount - 1);
  }
}

/**
 * Strips HTML clutter: scripts, styles, forms, navigation, footers, headers, asides
 */
function cleanPageHtml(html) {
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

/**
 * Converts HTML snippet to clean readable plain text
 */
function stripHtmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Classifies fetched page content and extracts structured data.
 * Crucially distinguishes:
 * - Knowledge Base / documentation articles (PAGE_RETRIEVED, NOT TICKET_CONTENT_EXTRACTED)
 * - Actual support tickets (TICKET_CONTENT_EXTRACTED)
 * - Tracking ID lookup forms (TRACKING_ID_REQUIRED)
 * - Login gates (AUTHENTICATION_REQUIRED)
 * - CAPTCHAs (CAPTCHA_REQUIRED)
 * - Access Denied (ACCESS_DENIED)
 */
function classifyAndExtract(html, pageUrl, statusCode = 200, contentType = 'text/html') {
  const normUrl = (pageUrl || '').toLowerCase();

  // 1. HTTP Status Code Checks
  if (statusCode === 401 || statusCode === 403) {
    return {
      classification: 'ACCESS_DENIED',
      pageType: 'access_denied',
      webpageRetrieved: false,
      ticketContentExtracted: false,
      ticket: null,
      error: `Access Denied (HTTP ${statusCode}).`,
      suggestion: 'This ticket requires an authenticated user session or access permissions. Please paste the ticket details manually into Ticket Description or Conversation.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  if (statusCode === 404) {
    return {
      classification: 'HTTP_ERROR',
      pageType: 'not_found',
      webpageRetrieved: false,
      ticketContentExtracted: false,
      ticket: null,
      error: 'Ticket page not found (HTTP 404).',
      suggestion: 'Please verify that the ticket URL or ID is correct.',
      fallbackAction: 'CHECK_URL'
    };
  }

  if (statusCode >= 400) {
    return {
      classification: 'HTTP_ERROR',
      pageType: 'server_error',
      webpageRetrieved: false,
      ticketContentExtracted: false,
      ticket: null,
      error: `Server returned HTTP status ${statusCode}.`,
      suggestion: 'The remote server reported an error. Please enter the ticket description manually.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return {
      classification: 'EXTRACTION_FAILED',
      pageType: 'empty_page',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      error: 'Empty response body received from server.',
      suggestion: 'The remote server returned zero content. Please enter the ticket description manually.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 1.5. Check specialized platform adapter if available (GitHub, Jira, ServiceNow, HESK)
  try {
    const TicketRetriever = require('./ticket-retriever.js');
    const adapter = TicketRetriever.getAdapter(pageUrl);
    if (adapter && adapter.name !== 'generic') {
      const parsed = adapter.parseHtml(html, pageUrl);
      if (parsed) {
        if (parsed.isKnowledgeBase) {
          return {
            classification: 'PAGE_RETRIEVED',
            pageType: 'knowledge_base',
            webpageRetrieved: true,
            ticketContentExtracted: false,
            ticket: null,
            platform: adapter.name,
            article: {
              title: parsed.title,
              content: parsed.description,
              url: pageUrl
            },
            message: parsed.error,
            fallbackAction: 'SWITCH_TO_DESCRIPTION'
          };
        }
        if (parsed.requiresAuth || parsed.failureReason) {
          return {
            classification: parsed.failureReason || 'AUTHENTICATION_REQUIRED',
            pageType: parsed.failureReason === 'TRACKING_ID_REQUIRED' ? 'ticket_lookup_form' : (parsed.failureReason === 'CAPTCHA_REQUIRED' ? 'captcha_gate' : 'login_page'),
            webpageRetrieved: true,
            ticketContentExtracted: false,
            ticket: null,
            platform: adapter.name,
            error: parsed.error,
            suggestion: parsed.suggestion,
            fallbackAction: parsed.fallbackAction || 'SWITCH_TO_DESCRIPTION'
          };
        }
        if (parsed.title && parsed.description) {
          return {
            classification: 'TICKET_CONTENT_EXTRACTED',
            pageType: 'support_ticket',
            webpageRetrieved: true,
            ticketContentExtracted: true,
            platform: adapter.name,
            ticket: parsed,
            fieldsRetrieved: parsed.fieldsRetrieved || [],
            isIncomplete: Boolean(parsed.isIncomplete),
            error: null,
            fallbackAction: null
          };
        }
      }
    }
  } catch (_) {}

  // Strip scripts and styles to prevent false positive matching on JavaScript variables while preserving forms
  const markupWithoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  const lowerHtml = markupWithoutScripts.toLowerCase();

  // 2. CAPTCHA Challenge Detection (on sanitized markup to avoid script false positives)
  const isCaptchaChallenge =
    lowerHtml.includes('g-recaptcha') ||
    lowerHtml.includes('hcaptcha') ||
    lowerHtml.includes('cf-turnstile') ||
    lowerHtml.includes('type the number you see in the picture below') ||
    /<(?:div|span|iframe)[^>]*(?:captcha|recaptcha|turnstile)[^>]*>/i.test(markupWithoutScripts) ||
    (lowerHtml.includes('captcha') && (lowerHtml.includes('security check') || lowerHtml.includes('robot') || lowerHtml.includes('verification challenge')));

  if (isCaptchaChallenge) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      pageType: 'captcha_gate',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      error: 'CAPTCHA or Bot Protection challenge detected.',
      suggestion: 'This page is protected by an interactive CAPTCHA or bot verification challenge. Policy Lookup preserves complete privacy and does not solve or bypass bot challenges. Switch to Ticket Description or Conversation to paste the ticket text directly.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 3. Ticket Tracking ID Lookup Form (e.g. HESK ticket.php form)
  if (
    (lowerHtml.includes('ticket tracking id') || lowerHtml.includes('view existing ticket') || lowerHtml.includes('forgot tracking id')) &&
    !lowerHtml.includes('ticket-message') &&
    !lowerHtml.includes('ticket__message') &&
    !lowerHtml.includes('ticket-body')
  ) {
    return {
      classification: 'TRACKING_ID_REQUIRED',
      pageType: 'ticket_lookup_form',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      error: 'Ticket Tracking ID and Email required to access ticket details.',
      suggestion: 'This help desk requires both a valid Ticket Tracking ID and requester email address to unlock the ticket conversation. Policy Lookup does not collect or brute-force user credentials. Please paste the ticket description or conversation transcript directly.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 4. Login / Authentication Barrier Detection
  if (
    (lowerHtml.includes('login') || lowerHtml.includes('sign in') || lowerHtml.includes('authenticate')) &&
    (lowerHtml.includes('password') || lowerHtml.includes('username') || lowerHtml.includes('sso') || lowerHtml.includes('id.atlassian.com')) &&
    !lowerHtml.includes('ticket-message') &&
    !lowerHtml.includes('comment-body') &&
    !lowerHtml.includes('issue-body')
  ) {
    return {
      classification: 'AUTHENTICATION_REQUIRED',
      pageType: 'login_page',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      error: 'Authentication or login session required.',
      suggestion: 'This ticketing system requires an authenticated user account. Switch to the Ticket Description or Conversation tab to analyze the ticket privately without credentials.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 5. Single Page Application (SPA) Empty Mount Detection
  const rawText = stripHtmlToText(html);
  if (rawText.length < 50 && (html.includes('<div id="root">') || html.includes('<div id="app">'))) {
    return {
      classification: 'UNSUPPORTED_PAGE',
      pageType: 'spa_shell',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      error: 'Client-rendered Single Page Application (SPA) detected.',
      suggestion: 'This ticket portal renders dynamically using browser JavaScript. Please copy and paste the ticket content into Ticket Description or Conversation.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 6. Knowledge Base / Documentation / FAQ Article Detection
  // NEVER label a knowledge base article as a support ticket!
  const isKbUrl = normUrl.includes('knowledgebase') ||
                  normUrl.includes('/kb/') ||
                  normUrl.includes('/docs/') ||
                  normUrl.includes('/faq/') ||
                  normUrl.includes('article=') ||
                  normUrl.includes('/help/article');

  const hasKbMarkers = lowerHtml.includes('knowledgebase') ||
                       lowerHtml.includes('suggested knowledgebase articles') ||
                       lowerHtml.includes('was this article helpful') ||
                       lowerHtml.includes('article rating') ||
                       lowerHtml.includes('article__body') ||
                       lowerHtml.includes('article__heading') ||
                       lowerHtml.includes('kb-article') ||
                       lowerHtml.includes('documentation');

  // Check if there is an active support ticket conversation thread
  const hasTicketThread = lowerHtml.includes('ticket-message') ||
                          lowerHtml.includes('ticket__message') ||
                          lowerHtml.includes('comment-body') ||
                          lowerHtml.includes('ticket-status') ||
                          normUrl.includes('/issues/') ||
                          normUrl.includes('/browse/');

  if ((isKbUrl || hasKbMarkers) && !hasTicketThread) {
    // Extract article title and body
    const titleMatch = html.match(/<h1[^>]*class="[^"]*article__heading[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? stripHtmlToText(titleMatch[1]) : 'Knowledge Base Article';
    title = title.replace(/\s*-\s*Help\s*Desk\s*Demo.*$/i, '').replace(/\s*-\s*HESK.*$/i, '').trim();

    const sanitizedHtml = cleanPageHtml(html);
    const bodyMatch = sanitizedHtml.match(/<div[^>]*class="[^"]*article__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      sanitizedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                      sanitizedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const articleBody = bodyMatch ? stripHtmlToText(bodyMatch[1]) : stripHtmlToText(sanitizedHtml).slice(0, 1000);

    return {
      classification: 'PAGE_RETRIEVED',
      pageType: 'knowledge_base',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: null,
      article: {
        title: title || 'Knowledge Base Article',
        summary: articleBody.slice(0, 300) + (articleBody.length > 300 ? '...' : ''),
        content: articleBody,
        url: pageUrl
      },
      error: null,
      message: `Retrieved public Knowledge Base article: "${title}". This is documentation/reference content, not an active support ticket.`,
      suggestion: 'To match an active incident against policies, switch to Ticket Description or Conversation. If you wish to query this article text, you can copy it to Description.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 7. Support Ticket Extraction
  // Look for ticket identifiers
  const idMatch = pageUrl.match(/(?:issues|pull)\/(\d+)/i) ||
                  pageUrl.match(/\b(INC\d{5,10}|REQ\d{5,10}|[A-Z0-9]+-\d+)\b/i) ||
                  html.match(/\b(Issue\s*#\d+|INC\d{5,10}|[A-Z0-9]+-\d+)\b/i);

  const ticketId = idMatch ? (idMatch[1].startsWith('#') ? idMatch[1] : (idMatch[0].includes('issues/') ? `#${idMatch[1]}` : idMatch[1])) : null;

  // Extract Title
  const titleMatch = html.match(/<bdi class="js-issue-title[^>]*>([\s\S]*?)<\/bdi>/i) ||
                     html.match(/<span class="js-issue-title[^>]*>([\s\S]*?)<\/span>/i) ||
                     html.match(/<h1[^>]*class="[^"]*(?:ticket-subject|gh-header-title)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/id="summary-val"[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                     html.match(/<title>([\s\S]*?)<\/title>/i);

  let title = titleMatch ? stripHtmlToText(titleMatch[1]) : '';
  title = title.replace(/\s*·\s*Issue\s*#\d+.*$/i, '')
               .replace(/\s*·\s*GitHub.*$/i, '')
               .replace(/\s*-\s*Help\s*Desk\s*Demo.*$/i, '')
               .replace(/View existing ticket/i, '')
               .replace(/#\d+\s*$/i, '')
               .replace(/\s+/g, ' ')
               .trim();

  // Extract Description from semantic elements
  const sanitized = cleanPageHtml(html);
  const descMatch = sanitized.match(/<(?:div|td)[^>]*class="[^"]*(?:comment-body|ticket-message|ticket__message|ticket-body|issue-body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|td)>/i) ||
                    sanitized.match(/id="description-val"[^>]*>([\s\S]*?)<\/div>/i) ||
                    sanitized.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    sanitized.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  let description = descMatch ? stripHtmlToText(descMatch[1]) : '';

  // Author extraction
  const authorMatch = html.match(/class="author[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                      html.match(/class="[^"]*ticket-submitted-by[^"]*"[^>]*>([\s\S]*?)<\//i);
  const author = authorMatch ? stripHtmlToText(authorMatch[1]) : null;

  // Check if we found semantic ticket content
  if (title && description && description.length >= 10) {
    const fieldsRetrieved = [];
    if (ticketId) fieldsRetrieved.push('ticketId');
    if (title) fieldsRetrieved.push('title');
    if (description) fieldsRetrieved.push('description');
    if (author) fieldsRetrieved.push('author');

    return {
      classification: 'TICKET_CONTENT_EXTRACTED',
      pageType: 'support_ticket',
      webpageRetrieved: true,
      ticketContentExtracted: true,
      ticket: {
        ticketId: ticketId || '#TICKET',
        title,
        description,
        author,
        url: pageUrl
      },
      fieldsRetrieved,
      isIncomplete: description.length < 25,
      error: null,
      message: 'Support ticket content extracted successfully.',
      fallbackAction: null
    };
  }

  if (ticketId && title) {
    return {
      classification: 'PARTIAL_CONTENT_EXTRACTED',
      pageType: 'support_ticket',
      webpageRetrieved: true,
      ticketContentExtracted: false,
      ticket: {
        ticketId: ticketId,
        title,
        description: description || title,
        author,
        url: pageUrl
      },
      fieldsRetrieved: ['title'],
      isIncomplete: true,
      error: 'Ticket title found, but detailed problem description could not be recognized.',
      suggestion: 'You can edit the description in the Ticket Description tab.',
      fallbackAction: 'SWITCH_TO_DESCRIPTION'
    };
  }

  // 8. Unsupported / Generic Page Fallback
  return {
    classification: 'UNSUPPORTED_PAGE',
    pageType: 'generic_page',
    webpageRetrieved: true,
    ticketContentExtracted: false,
    ticket: null,
    error: 'Webpage retrieved (HTTP 200), but no semantic ticket content or problem description could be recognized.',
    suggestion: 'Switch to the Ticket Description or Guided Builder tab to enter the ticket details manually.',
    fallbackAction: 'SWITCH_TO_DESCRIPTION'
  };
}

module.exports = {
  isPrivateOrReservedIp,
  isDisallowedHostname,
  validateUrl,
  resolveAndValidateHost,
  safeOutboundFetch,
  cleanPageHtml,
  stripHtmlToText,
  classifyAndExtract,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS
};
