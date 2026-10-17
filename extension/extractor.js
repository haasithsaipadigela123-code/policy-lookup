(function (root, factory) {
  if (typeof module === 'object' && module.exports) {

    module.exports = factory();
  } else {

    root.TicketExtractor = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function cleanText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    if (el.type === 'hidden') return false;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
      } catch (e) { }
    }
    return true;
  }

  function getElementText(el) {
    if (!el) return '';
    if (!isElementVisible(el)) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      return cleanText(el.value);
    }
    return cleanText(el.innerText || el.textContent);
  }

  function queryFirst(doc, selectors) {
    for (const sel of selectors) {
      try {
        const elList = doc.querySelectorAll ? doc.querySelectorAll(sel) : [doc.querySelector(sel)].filter(Boolean);
        for (const el of elList) {
          if (!isElementVisible(el)) continue;
          const text = getElementText(el);
          if (text) return { element: el, text, selector: sel };
        }
      } catch (e) {

      }
    }
    return null;
  }

  function findTableValue(doc, labelRegex) {
    if (!doc || !doc.querySelectorAll) return '';
    try {
      const candidates = doc.querySelectorAll('td, th, dt, label, span, div.ticket-info-label');
      for (const el of candidates) {
        const text = cleanText(el.innerText || el.textContent);
        if (labelRegex.test(text)) {
          if (el.nextElementSibling) {
            const val = getElementText(el.nextElementSibling);
            if (val) return val;
          }
          if (el.parentElement && el.parentElement.tagName === 'TR') {
            const cells = Array.from(el.parentElement.children);
            const idx = cells.indexOf(el);
            if (idx !== -1 && idx + 1 < cells.length) {
              const val = getElementText(cells[idx + 1]);
              if (val) return val;
            }
          }
        }
      }
    } catch (e) {

    }
    return '';
  }
  class PlatformAdapter {
    constructor(name) {
      this.name = name;
    }

    matches(doc, url) {
      return false;
    }

    extract(doc, url) {
      return null;
    }
  }

  class JiraAdapter extends PlatformAdapter {
    constructor() {
      super('Jira / Jira Service Management');
    }

    matches(doc, url) {
      const hostname = (url || '').toLowerCase();
      if (hostname.includes('atlassian.net') || hostname.includes('jira')) return true;
      return !!doc.querySelector('[data-test-id*="issue"], [data-testid*="issue"], #jira');
    }

    extract(doc, url) {
      const idMatch = queryFirst(doc, [
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]',
        '#key-val',
        '[data-testid="issue-key"]',
        'a[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]'
      ]);

      const titleMatch = queryFirst(doc, [
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        'h1[data-test-id*="summary"]',
        '#summary-val',
        '[data-testid="issue-summary"]'
      ]);

      const descMatch = queryFirst(doc, [
        '[data-testid="issue.views.issue-base.foundation.description"]',
        '[data-testid="issue-description"]',
        '#description-val',
        '.ak-renderer-document',
        '.user-content-block'
      ]);

      if (titleMatch || descMatch) {
        return {
          platform: this.name,
          id: idMatch ? idMatch.text : 'JIRA-TICKET',
          title: titleMatch ? titleMatch.text : '',
          description: descMatch ? descMatch.text : '',
          confidence: 'configured'
        };
      }
      return null;
    }
  }

  class ServiceNowAdapter extends PlatformAdapter {
    constructor() {
      super('ServiceNow');
    }

    matches(doc, url) {
      const hostname = (url || '').toLowerCase();
      if (hostname.includes('service-now.com')) return true;
      return !!doc.querySelector('[id*="sys_display.incident"], [name*="incident."]');
    }

    extract(doc, url) {
      const idMatch = queryFirst(doc, [
        '#incident\\.number',
        '[name="incident.number"]',
        '#sys_readonly\\.incident\\.number'
      ]);

      const titleMatch = queryFirst(doc, [
        '#incident\\.short_description',
        '[name="incident.short_description"]',
        '#sys_display\\.incident\\.short_description',
        '[data-field-name="short_description"]'
      ]);

      const descMatch = queryFirst(doc, [
        '#incident\\.description',
        '[name="incident.description"]',
        '[data-field-name="description"]'
      ]);

      if (titleMatch || descMatch) {
        return {
          platform: this.name,
          id: idMatch ? idMatch.text : 'SN-INCIDENT',
          title: titleMatch ? titleMatch.text : '',
          description: descMatch ? descMatch.text : '',
          confidence: 'configured'
        };
      }
      return null;
    }
  }

  class ZendeskAdapter extends PlatformAdapter {
    constructor() {
      super('Zendesk');
    }

    matches(doc, url) {
      const hostname = (url || '').toLowerCase();
      if (hostname.includes('zendesk.com')) return true;
      return !!doc.querySelector('[data-test-id*="ticket"], .ticket-pane');
    }

    extract(doc, url) {
      const idMatch = queryFirst(doc, [
        '[data-test-id="ticket-pane-header-id"]',
        '.ticket-id',
        '[data-side-conversations-ticket-id]'
      ]);

      const titleMatch = queryFirst(doc, [
        'input[name="subject"]',
        '[data-test-id="ticket-pane-subject"]',
        '.ticket-subject'
      ]);

      const descMatch = queryFirst(doc, [
        '[data-test-id="omni-log-body-content"]',
        '.comment_input .content',
        '.ticket-description',
        '.zd-comment'
      ]);

      if (titleMatch || descMatch) {
        return {
          platform: this.name,
          id: idMatch ? idMatch.text : 'ZD-TICKET',
          title: titleMatch ? titleMatch.text : '',
          description: descMatch ? descMatch.text : '',
          confidence: 'configured'
        };
      }
      return null;
    }
  }

  class FreshdeskAdapter extends PlatformAdapter {
    constructor() {
      super('Freshdesk');
    }

    matches(doc, url) {
      const hostname = (url || '').toLowerCase();
      if (hostname.includes('freshdesk.com')) return true;
      return !!doc.querySelector('[id*="helpdesk_ticket"]');
    }

    extract(doc, url) {
      const idMatch = queryFirst(doc, [
        '#ticket-display-id',
        '.ticket-id'
      ]);

      const titleMatch = queryFirst(doc, [
        '#helpdesk_ticket_subject',
        '.ticket-subject',
        '[data-test-id="ticket-subject"]'
      ]);

      const descMatch = queryFirst(doc, [
        '#helpdesk_ticket_ticket_body_attributes_description',
        '.ticket-details .body',
        '.helpdesk_ticket_description'
      ]);

      if (titleMatch || descMatch) {
        return {
          platform: this.name,
          id: idMatch ? idMatch.text : 'FD-TICKET',
          title: titleMatch ? titleMatch.text : '',
          description: descMatch ? descMatch.text : '',
          confidence: 'configured'
        };
      }
      return null;
    }
  }

  class HeskAdapter extends PlatformAdapter {
    constructor() {
      super('HESK Help Desk');
    }

    matches(doc, url) {
      const u = (url || '').toLowerCase();
      if (u.includes('ticket.php') || u.includes('admin_ticket.php') || u.includes('hesk')) {
        return true;
      }
      return !!doc.querySelector('.ticketmessage, .ticket-message, .ticket__message, #ticket-track, form[action*="ticket.php"]');
    }

    extract(doc, url) {

      let id = '';
      try {
        if (url) {
          const match = url.match(/[?&]track=([A-Za-z0-9-]+)/i);
          if (match) id = match[1];
        }
      } catch (e) { }

      if (!id) {
        id = findTableValue(doc, /^tracking\s*id/i);
      }
      if (!id) {
        const idMatch = queryFirst(doc, [
          '.tracking-id',
          '#ticket-track',
          '.ticket-track',
          '[data-tracking-id]',
          '.ticket__track-id'
        ]);
        if (idMatch) id = idMatch.text;
      }

      let title = '';
      const titleMatch = queryFirst(doc, [
        '.ticket-headline',
        'h2.ticket-headline',
        'h3.ticket-headline',
        '.ticket__subject',
        '#ticket-subject',
        '.ticket-subject',
        'input[name="subject"]',
        'h2.ticket-title',
        'h3.ticket-title'
      ]);

      if (titleMatch) {
        title = titleMatch.text;
      } else {
        title = findTableValue(doc, /^subject\b/i);
      }

      if (!title) {
        const headingMatch = queryFirst(doc, ['h2', 'h3']);
        if (headingMatch && headingMatch.text.length > 3 && !/help\s*desk/i.test(headingMatch.text)) {
          title = headingMatch.text;
        }
      }

      let description = '';
      const descMatch = queryFirst(doc, [
        '.ticketmessage',
        'td.ticketmessage',
        '.ticket-message',
        '.ticket__message',
        '.ticket__message-text',
        '.message__text',
        '.ticket__body',
        '.ticket__content',
        '.ticket__text',
        '.article__content',
        '.message-body',
        '.ticket-body',
        'div[id^="msg_"]',
        'div.message',
        'td.message',
        '.message',
        '#message'
      ]);

      if (descMatch) {
        description = descMatch.text;
      } else {
        description = findTableValue(doc, /^message\b/i);
      }

      if (!description) {
        const msgParagraphs = doc.querySelectorAll('.ticket__message p, .ticket-message p, .message__text p, .card-body p, .ticket__section p, .card p, p');
        for (const p of msgParagraphs) {
          if (p.closest('.ticket-headline, h1, h2, h3, header, .reply-box, form')) continue;
          const txt = cleanText(p.innerText || p.textContent);
          if (!txt || txt.length < 1) continue;
          if (/^(from:|custom|reply by|help desk|ticket status|priority:|owner:|category:|assigned)/i.test(txt)) continue;
          if (txt.toLowerCase().includes('from:') && txt.toLowerCase().includes('ago')) continue;
          if (title && txt.toLowerCase().startsWith(cleanText(title).toLowerCase())) continue;
          description = txt;
          break;
        }
      }

      if (title || description) {
        return {
          platform: this.name,
          id: id || 'HESK-TICKET',
          title: title || '',
          description: description || '',
          confidence: 'configured'
        };
      }

      return null;
    }
  }

  class GenericSemanticAdapter extends PlatformAdapter {
    constructor() {
      super('Generic Web Page (Heuristic)');
    }

    matches(doc, url) {
      return true;
    }

    extract(doc, url) {

      const idMatch = queryFirst(doc, [
        '[data-field="ticket-id"]',
        '[data-ticket-id]',
        '#ticket-id',
        '.ticket-id',
        '[aria-label*="ticket id" i]'
      ]);

      const titleMatch = queryFirst(doc, [
        '[data-field="ticket-title"]',
        '[data-ticket-title]',
        '#ticket-title',
        '.ticket-title',
        'h1.ticket-subject',
        'h1.issue-title',
        'h1.subject',
        'h1'
      ]);

      const descMatch = queryFirst(doc, [
        '[data-field="ticket-description"]',
        '[data-ticket-description]',
        '#ticket-description',
        '.ticket-description',
        '.issue-body',
        'article',
        '.ticket-content',
        '.description'
      ]);

      if (titleMatch && (titleMatch.text.length > 3)) {
        return {
          platform: this.name,
          id: idMatch ? idMatch.text : 'TICKET',
          title: titleMatch.text,
          description: descMatch ? descMatch.text : '',
          confidence: 'heuristic'
        };
      }

      return null;
    }
  }

  class CustomConfiguredAdapter extends PlatformAdapter {
    constructor(customConfig = null) {
      super('Custom Configured Site');
      this.config = customConfig;
    }

    setConfig(config) {
      this.config = config;
    }

    matches(doc, url) {
      if (!this.config || !this.config.domain) return false;
      const currentUrl = (url || '').toLowerCase();
      return currentUrl.includes(this.config.domain.toLowerCase());
    }

    extract(doc, url) {
      if (!this.config) return null;

      const idMatch = this.config.idSelector ? queryFirst(doc, [this.config.idSelector]) : null;
      const titleMatch = this.config.titleSelector ? queryFirst(doc, [this.config.titleSelector]) : null;
      const descMatch = this.config.descSelector ? queryFirst(doc, [this.config.descSelector]) : null;

      if (titleMatch || descMatch) {
        return {
          platform: `Custom: ${this.config.domain}`,
          id: idMatch ? idMatch.text : 'CUSTOM-TICKET',
          title: titleMatch ? titleMatch.text : '',
          description: descMatch ? descMatch.text : '',
          confidence: 'configured'
        };
      }
      return null;
    }
  }

  class TicketExtractorEngine {
    constructor() {
      this.customAdapter = new CustomConfiguredAdapter();
      this.standardAdapters = [
        new HeskAdapter(),
        new JiraAdapter(),
        new ServiceNowAdapter(),
        new ZendeskAdapter(),
        new FreshdeskAdapter()
      ];
      this.fallbackAdapter = new GenericSemanticAdapter();
    }

    setCustomConfig(config) {
      this.customAdapter.setConfig(config);
    }

    extract(doc, url) {
      if (!doc) {
        return {
          detected: false,
          reason: 'NO_DOCUMENT',
          message: 'No document context available for extraction.'
        };
      }

      const activeUrl = url || (typeof window !== 'undefined' && window.location ? window.location.href : '');

      if (this.customAdapter.matches(doc, activeUrl)) {
        const result = this.customAdapter.extract(doc, activeUrl);
        if (result && (result.title || result.description)) {
          return { detected: true, ticket: result };
        }
      }

      for (const adapter of this.standardAdapters) {
        if (adapter.matches(doc, activeUrl)) {
          const result = adapter.extract(doc, activeUrl);
          if (result && (result.title || result.description)) {
            return { detected: true, ticket: result };
          }
        }
      }

      const genericResult = this.fallbackAdapter.extract(doc, activeUrl);
      if (genericResult && (genericResult.title || genericResult.description)) {
        return { detected: true, ticket: genericResult };
      }

      return {
        detected: false,
        reason: 'UNSUPPORTED_OR_EMPTY',
        message: 'No ticket title or description could be extracted from this webpage using current adapters.',
        url: activeUrl
      };
    }
  }

  function setupNavigationObserver(callback) {
    if (typeof window === 'undefined') return () => { };
    let lastUrl = window.location ? window.location.href : '';

    const checkChange = () => {
      const currentUrl = window.location ? window.location.href : '';
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        callback();
      }
    };

    window.addEventListener('popstate', checkChange);
    window.addEventListener('hashchange', checkChange);

    let observer = null;
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
      observer = new MutationObserver(() => {
        checkChange();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('popstate', checkChange);
      window.removeEventListener('hashchange', checkChange);
      if (observer) observer.disconnect();
    };
  }

  return {
    TicketExtractorEngine,
    PlatformAdapter,
    HeskAdapter,
    JiraAdapter,
    ServiceNowAdapter,
    ZendeskAdapter,
    FreshdeskAdapter,
    GenericSemanticAdapter,
    CustomConfiguredAdapter,
    setupNavigationObserver
  };
});
