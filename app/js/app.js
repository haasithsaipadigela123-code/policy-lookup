(function () {
  'use strict';

  let currentStep = 1;
  let currentActiveTab = 'desc';
  let currentTicket = null;
  let activePoliciesList = [];
  let lastRetrievedTicket = null;

  // Navigation elements
  const navHome = document.getElementById('nav-home');
  const navLibrary = document.getElementById('nav-library');
  const navActivity = document.getElementById('nav-activity');
  const brandLink = document.getElementById('brand-link');

  const viewHome = document.getElementById('view-home');
  const viewLibrary = document.getElementById('view-library');
  const viewActivity = document.getElementById('view-activity');

  const linkViewLibrary = document.getElementById('link-view-library');
  const linkViewAllActivity = document.getElementById('link-view-all-activity');
  const btnManageDocs = document.getElementById('btn-manage-docs');
  const btnBackHomeLib = document.getElementById('btn-back-home-lib');
  const btnBackHomeAct = document.getElementById('btn-back-home-act');

  // Step Containers
  const stepContainer1 = document.getElementById('step-container-1');
  const stepContainer2 = document.getElementById('step-container-2');
  const stepContainer3 = document.getElementById('step-container-3');
  const stepContainer4 = document.getElementById('step-container-4');

  // Stepper Nav Items
  const stepNav1 = document.getElementById('step-nav-1');
  const stepNav2 = document.getElementById('step-nav-2');
  const stepNav3 = document.getElementById('step-nav-3');
  const stepNav4 = document.getElementById('step-nav-4');

  const stepConn1 = document.getElementById('step-conn-1');
  const stepConn2 = document.getElementById('step-conn-2');
  const stepConn3 = document.getElementById('step-conn-3');

  // Step 1 Elements
  const btnStep1Continue = document.getElementById('btn-step1-continue');
  const step1ReadyHint = document.getElementById('step1-ready-hint');

  // Step 2 Method Selector Elements
  const step2MethodSelector = document.getElementById('step2-method-selector');
  const step2MethodInput = document.getElementById('step2-method-input');
  const choiceLink = document.getElementById('choice-link');
  const choiceDesc = document.getElementById('choice-desc');
  const choiceConv = document.getElementById('choice-conv');
  const choiceGuided = document.getElementById('choice-guided');
  const btnStep2BackStep1 = document.getElementById('btn-step2-back-step1');
  const btnBackToMethods = document.getElementById('btn-back-to-methods');
  const activeMethodIndicatorBadge = document.getElementById('active-method-indicator-badge');

  // Panels for each method
  const panelDesc = document.getElementById('panel-desc');
  const panelLink = document.getElementById('panel-link');
  const panelConv = document.getElementById('panel-conv');
  const panelGuided = document.getElementById('panel-guided');

  // Method 1: Link and Fallback elements
  const ticketUrlInput = document.getElementById('ticket-url-input');
  const btnRetrieveUrl = document.getElementById('btn-retrieve-url');
  const urlStatusMsg = document.getElementById('url-status-msg');
  const urlTicketCard = document.getElementById('url-ticket-card');
  const utcPlatformIcon = document.getElementById('utc-platform-icon');
  const utcPlatformName = document.getElementById('utc-platform-name');
  const utcIdPill = document.getElementById('utc-id-pill');
  const utcExternalLink = document.getElementById('utc-external-link');
  const utcAvatar = document.getElementById('utc-avatar');
  const utcAuthorName = document.getElementById('utc-author-name');
  const utcTitle = document.getElementById('utc-title');
  const utcDescription = document.getElementById('utc-description');
  const utcWordCount = document.getElementById('utc-word-count');
  const utcBtnEdit = document.getElementById('utc-btn-edit');
  const utcBtnContinue = document.getElementById('utc-btn-continue');

  const urlFallbackCard = document.getElementById('url-fallback-card');
  const fallbackBadge = document.getElementById('fallback-badge');
  const fallbackReason = document.getElementById('fallback-reason');
  const fallbackMessage = document.getElementById('fallback-message');
  const fbBtnDesc = document.getElementById('fb-btn-desc');
  const fbBtnConv = document.getElementById('fb-btn-conv');
  const fbBtnUploadConv = document.getElementById('fb-btn-upload-conv');
  const fbBtnGuided = document.getElementById('fb-btn-guided');
  const fbBtnRetry = document.getElementById('fb-btn-retry');

  const urlKbCard = document.getElementById('url-kb-card');
  const kbPlatformName = document.getElementById('kb-platform-name');
  const kbExternalLink = document.getElementById('kb-external-link');
  const kbTitle = document.getElementById('kb-title');
  const kbContent = document.getElementById('kb-content');
  const kbWordCount = document.getElementById('kb-word-count');
  const kbBtnUseAsQuery = document.getElementById('kb-btn-use-as-query');
  const kbBtnSwitchTicket = document.getElementById('kb-btn-switch-ticket');
  const urlDiagnosticsDetails = document.getElementById('url-diagnostics-details');
  const urlDiagnosticsContent = document.getElementById('url-diagnostics-content');

  // Method 2: Description elements
  const ticketSubjectInput = document.getElementById('ticket-subject');
  const ticketDescInput = document.getElementById('ticket-desc');
  const charCounter = document.getElementById('char-counter');
  const btnClearInput = document.getElementById('btn-clear-input');
  const btnDescBack = document.getElementById('btn-desc-back');
  const btnDescContinue = document.getElementById('btn-desc-continue');

  // Method 3: Conversation elements
  const convTextInput = document.getElementById('conv-text-input');
  const convFileUpload = document.getElementById('conv-file-upload');
  const convStatusBadge = document.getElementById('conv-status-badge');
  const convPreviewArea = document.getElementById('conv-preview-area');
  const btnClearConv = document.getElementById('btn-clear-conv');
  const btnConvBack = document.getElementById('btn-conv-back');
  const btnConvContinue = document.getElementById('btn-conv-continue');

  // Method 4: Guided Builder elements
  const guidedStepIndicator = document.getElementById('guided-step-indicator');
  const btnResetGuided = document.getElementById('btn-reset-guided');
  const guidedStageCats = document.getElementById('guided-stage-cats');
  const guidedCatGrid = document.getElementById('guided-cat-grid');
  const guidedStageSubcats = document.getElementById('guided-stage-subcats');
  const guidedSubcatGrid = document.getElementById('guided-subcat-grid');
  const guidedStageQuestions = document.getElementById('guided-stage-questions');
  const guidedQuestionsContainer = document.getElementById('guided-questions-container');
  const guidedTicketId = document.getElementById('guided-ticket-id');
  const guidedFreeNotes = document.getElementById('guided-free-notes');
  const btnGuidedBackSub = document.getElementById('btn-guided-back-sub');
  const btnGuidedAssemble = document.getElementById('btn-guided-assemble');
  const guidedStageReview = document.getElementById('guided-stage-review');
  const guidedAssembledText = document.getElementById('guided-assembled-text');
  const btnGuidedEditBack = document.getElementById('btn-guided-edit-back');
  const btnGuidedContinue = document.getElementById('btn-guided-continue');
  const btnGuidedBackMain = document.getElementById('btn-guided-back-main');

  // Step 3 Review elements
  const reviewSourceBadge = document.getElementById('review-source-badge');
  const reviewTicketId = document.getElementById('review-ticket-id');
  const reviewTicketTitle = document.getElementById('review-ticket-title');
  const reviewTicketBody = document.getElementById('review-ticket-body');
  const reviewMetrics = document.getElementById('review-metrics');
  const btnReviewBack = document.getElementById('btn-review-back');
  const btnReviewAnalyze = document.getElementById('btn-review-analyze');

  // Step 4 Analysis elements
  const btnAnalyze = document.getElementById('btn-analyze');
  const analyzeSpinner = document.getElementById('analyze-spinner');
  const resultCard = document.getElementById('result-card');

  // Dropzone and uploads
  const dropzoneBox = document.getElementById('dropzone-box');
  const fileInputHome = document.getElementById('file-input-home');
  const fileInputLibrary = document.getElementById('file-input-library');
  const widgetPolicyCount = document.getElementById('widget-policy-count');
  const libraryPolicyCount = document.getElementById('library-policy-count');
  const docTableBody = document.getElementById('doc-table-body');
  const btnClearPolicies = document.getElementById('btn-clear-policies');

  // Tables
  const homeActivityTbody = document.getElementById('home-activity-tbody');
  const historyTableBody = document.getElementById('history-table-body');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Source Document Viewer Modal elements
  const sourceViewerModal = document.getElementById('source-viewer-modal');
  const svmCloseBtn = document.getElementById('svm-close-btn');
  const svmFooterClose = document.getElementById('svm-footer-close');
  const svmDocName = document.getElementById('svm-doc-name');
  const svmLocation = document.getElementById('svm-location');
  const svmPolicyIdWrap = document.getElementById('svm-policy-id-wrap');
  const svmPolicyId = document.getElementById('svm-policy-id');
  const svmPassage = document.getElementById('svm-passage');
  const svmContextSection = document.getElementById('svm-context-section');
  const svmContext = document.getElementById('svm-context');

  // Step 1 Home docs list elements
  const homeDocsList = document.getElementById('home-docs-list');
  const homeDocsCountLabel = document.getElementById('home-docs-count-label');

  function showToast(message) {
    let toast = document.getElementById('toast-notice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }

  // Reusable In-App Confirmation Modal Dialog
  const confirmModal = document.getElementById('confirm-modal');
  const confirmModalIcon = document.getElementById('confirm-modal-icon');
  const confirmModalTitle = document.getElementById('confirm-modal-title');
  const confirmModalSubtitle = document.getElementById('confirm-modal-subtitle');
  const confirmModalMessage = document.getElementById('confirm-modal-message');
  const confirmModalClose = document.getElementById('confirm-modal-close');
  const confirmModalCancel = document.getElementById('confirm-modal-cancel');
  const confirmModalOk = document.getElementById('confirm-modal-ok');

  let activeConfirmCallback = null;

  function closeConfirmModal() {
    if (confirmModal) confirmModal.style.display = 'none';
    activeConfirmCallback = null;
  }

  function showConfirmDialog(options) {
    const opts = options || {};
    const title = opts.title || 'Please Confirm';
    const subtitle = opts.subtitle || 'Local data management';
    const message = opts.message || 'Are you sure you want to proceed?';
    const icon = opts.icon || '⚠️';
    const confirmText = opts.confirmText || 'Confirm';
    const confirmColor = opts.confirmColor || '#B91C1C';
    const onConfirm = opts.onConfirm;

    if (!confirmModal) {
      if (window.confirm(message)) {
        if (typeof onConfirm === 'function') onConfirm();
      }
      return;
    }

    if (confirmModalTitle) confirmModalTitle.textContent = title;
    if (confirmModalSubtitle) confirmModalSubtitle.textContent = subtitle;
    if (confirmModalMessage) confirmModalMessage.textContent = message;
    if (confirmModalIcon) confirmModalIcon.textContent = icon;
    if (confirmModalOk) {
      confirmModalOk.textContent = confirmText;
      confirmModalOk.style.backgroundColor = confirmColor;
    }

    activeConfirmCallback = onConfirm;
    confirmModal.style.display = 'flex';
  }

  if (confirmModalClose) confirmModalClose.addEventListener('click', closeConfirmModal);
  if (confirmModalCancel) confirmModalCancel.addEventListener('click', closeConfirmModal);
  if (confirmModalOk) {
    confirmModalOk.addEventListener('click', async () => {
      const cb = activeConfirmCallback;
      closeConfirmModal();
      if (typeof cb === 'function') {
        await cb();
      }
    });
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirmModal();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModal && confirmModal.style.display === 'flex') {
      closeConfirmModal();
    }
  });

  function updateTicketPreview() {
    if (ticketDescInput && charCounter) {
      charCounter.textContent = `${ticketDescInput.value.length} characters`;
    }
    if (currentStep === 3 && currentTicket) {
      renderStep3Review();
    }
  }

  // View Switching (Home, Policy Library, Recent Activity)
  function switchView(viewName) {
    [viewHome, viewLibrary, viewActivity].forEach(v => {
      if (v) v.classList.remove('active');
    });
    [navHome, navLibrary, navActivity].forEach(n => {
      if (n) n.classList.remove('active');
    });

    if (viewName === 'library') {
      if (viewLibrary) viewLibrary.classList.add('active');
      if (navLibrary) navLibrary.classList.add('active');
      refreshLibraryView();
    } else if (viewName === 'activity') {
      if (viewActivity) viewActivity.classList.add('active');
      if (navActivity) navActivity.classList.add('active');
      refreshActivityView();
    } else {
      if (viewHome) viewHome.classList.add('active');
      if (navHome) navHome.classList.add('active');
      renderHomeDocsList();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (navHome) navHome.addEventListener('click', () => switchView('home'));
  if (navLibrary) navLibrary.addEventListener('click', () => switchView('library'));
  if (navActivity) navActivity.addEventListener('click', () => switchView('activity'));
  if (brandLink) brandLink.addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });

  if (linkViewLibrary) linkViewLibrary.addEventListener('click', (e) => { e.preventDefault(); switchView('library'); });
  if (btnManageDocs) btnManageDocs.addEventListener('click', () => switchView('library'));
  if (btnBackHomeLib) btnBackHomeLib.addEventListener('click', () => switchView('home'));
  if (btnBackHomeAct) btnBackHomeAct.addEventListener('click', () => switchView('home'));
  if (linkViewAllActivity) linkViewAllActivity.addEventListener('click', (e) => { e.preventDefault(); switchView('activity'); });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'library') switchView('library');
    else if (hash === 'activity') switchView('activity');
    else if (hash === 'home' || !hash) switchView('home');
  });
  if (window.location.hash) {
    const initHash = window.location.hash.replace('#', '');
    if (initHash === 'library') switchView('library');
    else if (initHash === 'activity') switchView('activity');
  }

  // =========================================================================
  // Step-by-Step Wizard Navigation
  // =========================================================================
  function goToStep(stepNum) {
    if (stepNum === 3) {
      const ok = prepareTicketForReview();
      if (!ok) return;
    }

    currentStep = stepNum;

    const containers = [stepContainer1, stepContainer2, stepContainer3, stepContainer4];
    containers.forEach((c, idx) => {
      if (c) {
        if (idx + 1 === stepNum) {
          c.style.display = 'block';
          c.classList.add('active');
        } else {
          c.style.display = 'none';
          c.classList.remove('active');
        }
      }
    });

    const navs = [stepNav1, stepNav2, stepNav3, stepNav4];
    navs.forEach((nav, idx) => {
      if (nav) {
        nav.classList.remove('active', 'completed');
        if (idx + 1 === stepNum) {
          nav.classList.add('active');
        } else if (idx + 1 < stepNum) {
          nav.classList.add('completed');
        }
      }
    });

    const conns = [stepConn1, stepConn2, stepConn3];
    conns.forEach((conn, idx) => {
      if (conn) {
        if (idx + 1 < stepNum) {
          conn.classList.add('completed');
        } else {
          conn.classList.remove('completed');
        }
      }
    });

    if (stepNum === 3) {
      renderStep3Review();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Stepper nav clicks
  if (stepNav1) stepNav1.addEventListener('click', () => goToStep(1));
  if (stepNav2) stepNav2.addEventListener('click', () => goToStep(2));
  if (stepNav3) stepNav3.addEventListener('click', () => {
    if (prepareTicketForReview()) goToStep(3);
  });
  if (stepNav4) stepNav4.addEventListener('click', () => {
    if (resultCard && resultCard.innerHTML.trim()) goToStep(4);
  });

  // Step 1 Continue
  if (btnStep1Continue) {
    btnStep1Continue.addEventListener('click', () => {
      goToStep(2);
    });
  }

  // Step 2 Method Selection
  function selectIntakeMethod(method) {
    currentActiveTab = method;
    if (step2MethodSelector) step2MethodSelector.style.display = 'none';
    if (step2MethodInput) step2MethodInput.style.display = 'block';

    const panels = {
      link: panelLink,
      desc: panelDesc,
      conv: panelConv,
      guided: panelGuided
    };

    Object.keys(panels).forEach(k => {
      if (panels[k]) {
        panels[k].style.display = (k === method) ? 'block' : 'none';
      }
    });

    const labels = {
      link: '🔗 Ticket Link',
      desc: '📄 Description',
      conv: '💬 Conversation',
      guided: '🧭 Guided Builder'
    };
    if (activeMethodIndicatorBadge) {
      activeMethodIndicatorBadge.textContent = labels[method] || 'Intake Mode';
    }

    if (method === 'desc') {
      if (ticketDescInput) ticketDescInput.focus();
    } else if (method === 'link') {
      if (ticketUrlInput) ticketUrlInput.focus();
    } else if (method === 'conv') {
      updateConversationStatus();
    } else if (method === 'guided') {
      renderGuidedCategories();
    }
  }

  function showMethodSelector() {
    if (step2MethodSelector) step2MethodSelector.style.display = 'block';
    if (step2MethodInput) step2MethodInput.style.display = 'none';
  }

  if (choiceLink) choiceLink.addEventListener('click', () => selectIntakeMethod('link'));
  if (choiceDesc) choiceDesc.addEventListener('click', () => selectIntakeMethod('desc'));
  if (choiceConv) choiceConv.addEventListener('click', () => selectIntakeMethod('conv'));
  if (choiceGuided) choiceGuided.addEventListener('click', () => selectIntakeMethod('guided'));

  if (btnStep2BackStep1) btnStep2BackStep1.addEventListener('click', () => goToStep(1));
  if (btnBackToMethods) btnBackToMethods.addEventListener('click', showMethodSelector);
  if (btnDescBack) btnDescBack.addEventListener('click', showMethodSelector);
  if (btnConvBack) btnConvBack.addEventListener('click', showMethodSelector);
  if (btnGuidedBackMain) btnGuidedBackMain.addEventListener('click', showMethodSelector);

  // Method Continue Buttons
  if (btnDescContinue) {
    btnDescContinue.addEventListener('click', () => {
      const desc = ticketDescInput ? ticketDescInput.value.trim() : '';
      if (!desc) {
        alert('Please enter the customer problem description.');
        if (ticketDescInput) ticketDescInput.focus();
        return;
      }
      const title = ticketSubjectInput ? ticketSubjectInput.value.trim() : '';
      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'manual_description',
            ticketId: (title.match(/#\d+|INC-\d+/i) || desc.match(/#\d+|INC-\d+/i) || [])[0] || null,
            title: title || 'Customer Problem Description',
            description: desc,
            provenance: { title: 'user_input', description: 'user_input' }
          })
        : { title: title || 'Customer Problem Description', description: desc, source: 'manual_description' };

      goToStep(3);
    });
  }

  if (btnConvContinue) {
    btnConvContinue.addEventListener('click', () => {
      const text = convTextInput ? convTextInput.value.trim() : '';
      if (!text) {
        alert('Please paste or upload a customer conversation.');
        if (convTextInput) convTextInput.focus();
        return;
      }
      const parsedConv = (typeof ConversationParser !== 'undefined')
        ? ConversationParser.parseConversation(text)
        : { hasStructuredMessages: false, rawText: text, messages: [], extractedResolutions: [], extractedIdentifiers: [] };
      const inferredId = parsedConv.extractedIdentifiers.length > 0 ? parsedConv.extractedIdentifiers[0] : null;

      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'conversation_paste',
            ticketId: inferredId,
            title: inferredId ? `Conversation Ticket #${inferredId}` : 'Support Conversation',
            description: text,
            conversation: parsedConv,
            provenance: { conversation: 'user_pasted_transcript' },
            retrievalStatus: { status: 'MANUAL', platform: 'conversation' }
          })
        : { title: inferredId ? `Conversation Ticket #${inferredId}` : 'Support Conversation', description: text, source: 'conversation_paste' };

      goToStep(3);
    });
  }

  if (utcBtnContinue) {
    utcBtnContinue.addEventListener('click', () => {
      if (!lastRetrievedTicket) {
        alert('No ticket retrieved yet. Please enter a ticket link and click Retrieve.');
        return;
      }
      const title = lastRetrievedTicket.title || 'Retrieved Support Ticket';
      const description = lastRetrievedTicket.description || title;
      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'url_retrieval',
            ticketId: lastRetrievedTicket.ticketId || null,
            title,
            description,
            provenance: {
              url: lastRetrievedTicket.url || (ticketUrlInput ? ticketUrlInput.value.trim() : ''),
              platform: lastRetrievedTicket.platform || 'web',
              author: lastRetrievedTicket.author || null,
              fieldsRetrieved: lastRetrievedTicket.fieldsRetrieved || []
            },
            retrievalStatus: { url: lastRetrievedTicket.url || (ticketUrlInput ? ticketUrlInput.value.trim() : ''), status: 'SUCCESS' }
          })
        : { title, description, source: 'url_retrieval', ticketId: lastRetrievedTicket.ticketId };

      goToStep(3);
    });
  }

  if (btnGuidedContinue) {
    btnGuidedContinue.addEventListener('click', () => {
      const draft = guidedAssembledText ? guidedAssembledText.value.trim() : '';
      if (!draft && typeof GuidedTicketBuilder !== 'undefined') {
        const assembled = GuidedTicketBuilder.assembleTicket();
        currentTicket = assembled;
      } else if (draft) {
        currentTicket = (typeof TicketModel !== 'undefined')
          ? TicketModel.createNormalizedTicket({
              source: 'guided_builder',
              ticketId: (guidedTicketId && guidedTicketId.value.trim()) || null,
              title: (guidedTicketId && guidedTicketId.value.trim()) ? `[${guidedTicketId.value.trim()}] Guided Support Ticket` : 'Guided Support Ticket',
              description: draft,
              provenance: { description: 'user_guided_builder' }
            })
          : { title: 'Guided Support Ticket', description: draft, source: 'guided_builder' };
      }

      if (!currentTicket || !currentTicket.description) {
        alert('Please complete the guided intake options or enter a problem description.');
        return;
      }
      goToStep(3);
    });
  }

  // Step 3 Review & Validation
  function prepareTicketForReview() {
    if (currentActiveTab === 'desc') {
      const desc = ticketDescInput ? ticketDescInput.value.trim() : '';
      if (!desc) {
        alert('Please enter a problem description.');
        if (ticketDescInput) ticketDescInput.focus();
        return false;
      }
      const title = ticketSubjectInput ? ticketSubjectInput.value.trim() : '';
      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'manual_description',
            ticketId: (title.match(/#\d+|INC-\d+/i) || desc.match(/#\d+|INC-\d+/i) || [])[0] || null,
            title: title || 'Customer Problem Description',
            description: desc,
            provenance: { title: 'user_input', description: 'user_input' }
          })
        : { title: title || 'Customer Problem Description', description: desc, source: 'manual_description' };
      return true;
    } else if (currentActiveTab === 'conv') {
      const text = convTextInput ? convTextInput.value.trim() : '';
      if (!text) {
        alert('Please paste or upload a customer conversation.');
        if (convTextInput) convTextInput.focus();
        return false;
      }
      const parsedConv = (typeof ConversationParser !== 'undefined')
        ? ConversationParser.parseConversation(text)
        : { hasStructuredMessages: false, rawText: text, messages: [], extractedResolutions: [], extractedIdentifiers: [] };
      const inferredId = parsedConv.extractedIdentifiers.length > 0 ? parsedConv.extractedIdentifiers[0] : null;

      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'conversation_paste',
            ticketId: inferredId,
            title: inferredId ? `Conversation Ticket #${inferredId}` : 'Support Conversation',
            description: text,
            conversation: parsedConv,
            provenance: { conversation: 'user_pasted_transcript' },
            retrievalStatus: { status: 'MANUAL', platform: 'conversation' }
          })
        : { title: inferredId ? `Conversation Ticket #${inferredId}` : 'Support Conversation', description: text, source: 'conversation_paste' };
      return true;
    } else if (currentActiveTab === 'link') {
      if (!lastRetrievedTicket) {
        alert('Please retrieve a ticket URL first.');
        return false;
      }
      const title = lastRetrievedTicket.title || 'Retrieved Support Ticket';
      const description = lastRetrievedTicket.description || title;
      currentTicket = (typeof TicketModel !== 'undefined')
        ? TicketModel.createNormalizedTicket({
            source: 'url_retrieval',
            ticketId: lastRetrievedTicket.ticketId || null,
            title,
            description,
            provenance: {
              url: lastRetrievedTicket.url || (ticketUrlInput ? ticketUrlInput.value.trim() : ''),
              platform: lastRetrievedTicket.platform || 'web',
              author: lastRetrievedTicket.author || null,
              fieldsRetrieved: lastRetrievedTicket.fieldsRetrieved || []
            },
            retrievalStatus: { url: lastRetrievedTicket.url || (ticketUrlInput ? ticketUrlInput.value.trim() : ''), status: 'SUCCESS' }
          })
        : { title, description, source: 'url_retrieval', ticketId: lastRetrievedTicket.ticketId };
      return true;
    } else if (currentActiveTab === 'guided') {
      const draft = guidedAssembledText ? guidedAssembledText.value.trim() : '';
      if (!draft && typeof GuidedTicketBuilder !== 'undefined') {
        currentTicket = GuidedTicketBuilder.assembleTicket();
      } else if (draft) {
        currentTicket = (typeof TicketModel !== 'undefined')
          ? TicketModel.createNormalizedTicket({
              source: 'guided_builder',
              ticketId: (guidedTicketId && guidedTicketId.value.trim()) || null,
              title: (guidedTicketId && guidedTicketId.value.trim()) ? `[${guidedTicketId.value.trim()}] Guided Support Ticket` : 'Guided Support Ticket',
              description: draft,
              provenance: { description: 'user_guided_builder' }
            })
          : { title: 'Guided Support Ticket', description: draft, source: 'guided_builder' };
      }
      if (!currentTicket || !currentTicket.description) {
        alert('Please complete the guided intake options or enter a problem description.');
        return false;
      }
      return true;
    }
    return false;
  }

  function renderStep3Review() {
    if (!currentTicket) return;

    const sourceLabels = {
      manual_description: '📄 User-Provided Description',
      conversation_paste: '💬 User-Provided Conversation',
      url_retrieval: '🔗 Verified External URL Retrieval',
      guided_builder: '🧭 Guided Intake Draft'
    };

    if (reviewSourceBadge) {
      reviewSourceBadge.textContent = sourceLabels[currentTicket.source] || '📄 Support Ticket';
    }
    if (reviewTicketId) {
      if (currentTicket.ticketId) {
        reviewTicketId.textContent = currentTicket.ticketId;
        reviewTicketId.style.display = 'inline-block';
      } else {
        reviewTicketId.style.display = 'none';
      }
    }
    if (reviewTicketTitle) {
      reviewTicketTitle.textContent = currentTicket.title || '(Untitled Ticket)';
    }
    if (reviewTicketBody) {
      reviewTicketBody.textContent = currentTicket.description || '(No description provided)';
    }
    if (reviewMetrics) {
      const chars = (currentTicket.description || '').length;
      const words = ((currentTicket.description || '').match(/\S+/g) || []).length;
      reviewMetrics.textContent = `${chars} characters · ${words} words`;
    }
  }

  if (btnReviewBack) {
    btnReviewBack.addEventListener('click', () => {
      goToStep(2);
      selectIntakeMethod(currentActiveTab || 'desc');
    });
  }

  if (btnReviewAnalyze) {
    btnReviewAnalyze.addEventListener('click', () => {
      if (!currentTicket) {
        prepareTicketForReview();
      }
      if (!currentTicket || !currentTicket.description) {
        alert('No ticket content available to analyze. Please provide a ticket description.');
        goToStep(2);
        return;
      }
      goToStep(4);
      executeAnalysis(currentTicket);
    });
  }

  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', () => {
      if (btnReviewAnalyze) btnReviewAnalyze.click();
    });
  }

  // Fallback Action Buttons
  if (fbBtnDesc) fbBtnDesc.addEventListener('click', () => { goToStep(2); selectIntakeMethod('desc'); });
  if (fbBtnConv) fbBtnConv.addEventListener('click', () => { goToStep(2); selectIntakeMethod('conv'); });
  if (fbBtnUploadConv) {
    fbBtnUploadConv.addEventListener('click', () => {
      goToStep(2);
      selectIntakeMethod('conv');
      if (convFileUpload) convFileUpload.click();
    });
  }
  if (fbBtnGuided) fbBtnGuided.addEventListener('click', () => { goToStep(2); selectIntakeMethod('guided'); });
  if (fbBtnRetry) fbBtnRetry.addEventListener('click', () => { if (btnRetrieveUrl) btnRetrieveUrl.click(); });

  if (ticketDescInput && charCounter) {
    ticketDescInput.addEventListener('input', () => {
      charCounter.textContent = `${ticketDescInput.value.length} characters`;
    });
  }

  if (btnClearInput) {
    btnClearInput.addEventListener('click', () => {
      if (ticketSubjectInput) ticketSubjectInput.value = '';
      if (ticketDescInput) ticketDescInput.value = '';
      if (ticketUrlInput) ticketUrlInput.value = '';
      if (charCounter) charCounter.textContent = '0 characters';
      if (urlStatusMsg) urlStatusMsg.textContent = '';
      lastRetrievedTicket = null;
      currentTicket = null;
      if (urlTicketCard) urlTicketCard.style.display = 'none';
      if (urlFallbackCard) urlFallbackCard.style.display = 'none';
      if (resultCard) resultCard.style.display = 'none';
      showToast('Cleared ticket input');
    });
  }

  if (btnRetrieveUrl) {
    btnRetrieveUrl.addEventListener('click', async () => {
      const url = ticketUrlInput.value.trim();
      if (!url) {
        urlStatusMsg.style.color = 'var(--status-err-text)';
        urlStatusMsg.textContent = 'Please enter a ticket URL.';
        return;
      }

      btnRetrieveUrl.disabled = true;
      btnRetrieveUrl.textContent = 'Retrieving...';
      urlStatusMsg.style.color = 'var(--text-secondary)';
      urlStatusMsg.textContent = 'Checking URL and initializing retrieval strategies...';
      if (urlFallbackCard) urlFallbackCard.style.display = 'none';
      if (urlTicketCard) urlTicketCard.style.display = 'none';
      if (urlKbCard) urlKbCard.style.display = 'none';
      if (urlDiagnosticsDetails) urlDiagnosticsDetails.style.display = 'none';

      const progressHistory = [];
      const onProgress = (step) => {
        progressHistory.push(step.message);
        if (urlStatusMsg) {
          urlStatusMsg.textContent = step.message;
        }
      };

      const res = await TicketRetriever.retrieveTicket(url, { onProgress });
      btnRetrieveUrl.disabled = false;
      btnRetrieveUrl.textContent = 'Retrieve';

      // Update Diagnostics section
      if (urlDiagnosticsDetails && urlDiagnosticsContent) {
        const diagInfo = {
          checkedUrl: url,
          finalUrl: res.finalUrl || url,
          classification: res.classification,
          pageType: res.pageType,
          webpageRetrieved: res.webpageRetrieved,
          ticketContentExtracted: res.ticketContentExtracted,
          retrievalMethod: res.retrievalMethod || 'local_backend',
          statusCode: res.statusCode,
          contentType: res.contentType,
          resolvedIps: res.diagnostics?.resolvedIps,
          redirectCount: res.diagnostics?.redirectCount,
          byteSize: res.diagnostics?.byteSize ? `${Math.round(res.diagnostics.byteSize / 1024)} KB` : undefined,
          durationMs: res.diagnostics?.durationMs ? `${res.diagnostics.durationMs} ms` : undefined,
          strategyTrace: progressHistory
        };
        urlDiagnosticsContent.textContent = JSON.stringify(diagInfo, null, 2);
        urlDiagnosticsDetails.style.display = 'block';
      }

      // Case 1: Genuine Ticket Content Extracted
      if (res.ticketContentExtracted && res.ticket) {
        lastRetrievedTicket = res.ticket;
        urlStatusMsg.style.color = 'var(--status-match-text)';
        urlStatusMsg.textContent = `Ticket retrieved successfully via ${res.platform ? res.platform.toUpperCase() : 'WEB'} adapter (${res.retrievalMethod || 'local_backend'})!`;

        if (urlFallbackCard) urlFallbackCard.style.display = 'none';
        if (urlKbCard) urlKbCard.style.display = 'none';

        if (urlTicketCard) {
          const platIcons = { github: '🐙', hesk: '🎫', jira: '🔷', servicenow: '🛠️', generic: '🌐' };
          const platNames = {
            github: 'GitHub Public Issue',
            hesk: 'Hesk Support Ticket',
            jira: 'Atlassian Jira Issue',
            servicenow: 'ServiceNow Incident',
            generic: 'Public Web Ticket'
          };

          if (utcPlatformIcon) utcPlatformIcon.textContent = platIcons[res.platform] || '🎫';
          if (utcPlatformName) utcPlatformName.textContent = platNames[res.platform] || ((res.platform ? res.platform.toUpperCase() : 'WEB') + ' Ticket');
          if (utcIdPill) utcIdPill.textContent = res.ticket.ticketId || '#TICKET';
          if (utcExternalLink) {
            utcExternalLink.href = res.finalUrl || res.url || url || '#';
            utcExternalLink.style.display = (res.finalUrl || res.url || url) ? 'inline-flex' : 'none';
          }
          if (utcAvatar) utcAvatar.textContent = (res.ticket.author ? res.ticket.author.charAt(0).toUpperCase() : 'U');
          if (utcAuthorName) {
            const authorText = res.ticket.author ? `@${res.ticket.author} reported this issue` : `Extracted from ${res.platform ? res.platform.toUpperCase() : 'Web'}`;
            utcAuthorName.innerHTML = `<strong>${escapeHtml(authorText)}</strong>`;
          }
          if (utcTitle) utcTitle.textContent = res.ticket.title || 'Untitled Ticket';
          if (utcDescription) utcDescription.textContent = res.ticket.description || '(No description provided)';
          if (utcWordCount) {
            const words = (res.ticket.description || '').split(/\s+/).filter(Boolean).length;
            const chars = (res.ticket.description || '').length;
            utcWordCount.textContent = `${words} words · ${chars} chars`;
          }

          if (utcBtnEdit) {
            utcBtnEdit.onclick = () => {
              if (ticketSubjectInput) ticketSubjectInput.value = res.ticket.title || '';
              if (ticketDescInput) ticketDescInput.value = res.ticket.description || '';
              if (charCounter) charCounter.textContent = `${(res.ticket.description || '').length} characters`;
              selectIntakeMethod('desc');
              showToast('Ticket copied to Description for manual editing');
            };
          }

          if (utcBtnContinue) {
            utcBtnContinue.onclick = () => {
              const title = res.ticket.title || 'Retrieved Support Ticket';
              const description = res.ticket.description || title;
              currentTicket = (typeof TicketModel !== 'undefined')
                ? TicketModel.createNormalizedTicket({
                    source: 'url_retrieval',
                    ticketId: res.ticket.ticketId || null,
                    title,
                    description,
                    provenance: {
                      url: res.finalUrl || res.url || url,
                      platform: res.platform || 'web',
                      author: res.ticket.author || null,
                      fieldsRetrieved: res.ticket.fieldsRetrieved || []
                    },
                    retrievalStatus: { url: res.finalUrl || res.url || url, status: 'SUCCESS' }
                  })
                : { title, description, source: 'url_retrieval', ticketId: res.ticket.ticketId };

              goToStep(3);
            };
          }

          urlTicketCard.style.display = 'block';
        }

        showToast('Ticket retrieved and displayed in card preview');
        return;
      }

      // Case 2: Knowledge Base / Documentation Article Retrieved (PAGE_RETRIEVED, NOT TICKET)
      if (res.classification === 'PAGE_RETRIEVED' && (res.pageType === 'knowledge_base' || res.article)) {
        lastRetrievedTicket = null;
        if (urlTicketCard) urlTicketCard.style.display = 'none';
        if (urlFallbackCard) urlFallbackCard.style.display = 'none';

        const art = res.article || {};
        const artTitle = art.title || res.title || 'Knowledge Base Article';
        const artContent = art.content || art.summary || res.description || '';

        urlStatusMsg.style.color = 'var(--brand)';
        urlStatusMsg.textContent = `Page retrieved successfully: "${artTitle}". (Public documentation article, not a support ticket).`;

        if (urlKbCard) {
          if (kbTitle) kbTitle.textContent = artTitle;
          if (kbContent) kbContent.textContent = artContent || '(No text content extracted)';
          if (kbExternalLink) {
            kbExternalLink.href = res.finalUrl || res.url || url || '#';
            kbExternalLink.style.display = (res.finalUrl || res.url || url) ? 'inline-flex' : 'none';
          }
          if (kbWordCount) {
            const words = artContent.split(/\s+/).filter(Boolean).length;
            kbWordCount.textContent = `${words} words`;
          }
          if (kbBtnUseAsQuery) {
            kbBtnUseAsQuery.onclick = () => {
              if (ticketSubjectInput) ticketSubjectInput.value = artTitle;
              if (ticketDescInput) ticketDescInput.value = artContent;
              if (charCounter) charCounter.textContent = `${artContent.length} characters`;
              selectIntakeMethod('desc');
              showToast('Article text copied to Description for policy search');
            };
          }
          if (kbBtnSwitchTicket) {
            kbBtnSwitchTicket.onclick = () => {
              selectIntakeMethod('desc');
              if (ticketSubjectInput) ticketSubjectInput.focus();
              showToast('Switched to Ticket Description tab for incident entry');
            };
          }
          urlKbCard.style.display = 'block';
        }

        showToast('Knowledge Base article retrieved (Documentation, not a support ticket)');
        return;
      }

      // Case 3: Barriers, Restrictions, or Retrieval Failure -> Strategy D Fallback
      lastRetrievedTicket = null;
      if (urlTicketCard) urlTicketCard.style.display = 'none';
      if (urlKbCard) urlKbCard.style.display = 'none';

      urlStatusMsg.style.color = 'var(--status-err-text)';
      urlStatusMsg.textContent = res.error || 'Retrieval failed.';

      if (urlFallbackCard) {
        if (fallbackBadge) fallbackBadge.textContent = res.classification || res.failureReason || 'RETRIEVAL_FAILED';
        if (fallbackReason) fallbackReason.textContent = res.error || 'Could not retrieve ticket';
        if (fallbackMessage) {
          const barrierNote = `<br><span style="font-size:11px;color:var(--text-muted);margin-top:6px;display:inline-block;line-height:1.4;"><strong>Privacy & Security Guarantee:</strong> Policy Lookup processes everything 100% locally on your machine. It never stores credentials, forwards cookies, or bypasses authentication barriers. Your original URL has been preserved.</span>`;
          fallbackMessage.innerHTML = `${escapeHtml(res.suggestion || 'Please choose an alternative input method below.')}${barrierNote}`;
        }
        urlFallbackCard.style.display = 'block';
      }

      updateTicketPreview();
    });
  }

  // Method 3: Conversation Input & File Upload Handling
  function updateConversationStatus() {
    if (!convTextInput || !convStatusBadge) return;
    const text = convTextInput.value.trim();
    if (!text) {
      convStatusBadge.textContent = 'Paste multi-message chat or upload transcript';
      convStatusBadge.className = 'conv-badge';
      if (convPreviewArea) convPreviewArea.style.display = 'none';
      return;
    }

    if (typeof ConversationParser !== 'undefined') {
      const parsed = ConversationParser.parseConversation(text);
      if (parsed.hasStructuredMessages) {
        const speakers = Array.from(new Set(parsed.messages.map(m => m.speaker))).join(', ');
        const idStr = parsed.extractedIdentifiers.length > 0 ? ` · ${parsed.extractedIdentifiers.join(', ')}` : '';
        const resStr = parsed.extractedResolutions.length > 0 ? ` · Stated Resolution` : '';
        convStatusBadge.textContent = `✓ ${parsed.messages.length} messages (${speakers})${idStr}${resStr}`;
        convStatusBadge.className = 'conv-badge pill-status-match';

        if (convPreviewArea) {
          convPreviewArea.innerHTML = ConversationParser.formatConversationHtml(parsed);
          convPreviewArea.style.display = 'block';
        }
      } else {
        convStatusBadge.textContent = 'Unstructured text (original phrasing preserved as evidence)';
        convStatusBadge.className = 'conv-badge';
        if (convPreviewArea) convPreviewArea.style.display = 'none';
      }
    }
    updateTicketPreview();
  }

  if (convTextInput) {
    convTextInput.addEventListener('input', () => {
      updateConversationStatus();
      updateTicketPreview();
    });
  }

  if (convFileUpload) {
    convFileUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showToast(`Parsing conversation file ${file.name}...`);
      try {
        const parsed = await DocumentParser.parseFile(file);
        if (parsed && parsed.rawText) {
          convTextInput.value = parsed.rawText;
          updateConversationStatus();
          showToast(`Loaded ${file.name}`);
        } else if (parsed && parsed.policies && parsed.policies.length > 0) {
          const txt = parsed.policies.map(p => `${p.name}: ${p.conditions || p.resolution || ''}`).join('\n\n');
          convTextInput.value = txt;
          updateConversationStatus();
          showToast(`Loaded ${file.name}`);
        } else {
          showToast(`File loaded, but no text could be extracted.`);
        }
      } catch (err) {
        alert(`Could not extract conversation from file "${file.name}":\n${err.message}`);
      }
      convFileUpload.value = '';
    });
  }

  if (btnClearConv) {
    btnClearConv.addEventListener('click', () => {
      if (convTextInput) convTextInput.value = '';
      updateConversationStatus();
      updateTicketPreview();
    });
  }

  // Method 4: Configurable Guided Ticket Builder Handling
  function renderGuidedCategories() {
    if (!guidedCatGrid || typeof GuidedTicketBuilder === 'undefined') return;
    const cats = GuidedTicketBuilder.getCategories();
    guidedCatGrid.innerHTML = cats.map(c => `
      <button class="guided-cat-btn" data-cat-id="${escapeHtml(c.id)}">
        <span style="font-size: 16px;">${escapeHtml(c.icon || '📌')}</span>
        <div>
          <div style="font-weight: 600;">${escapeHtml(c.name)}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">${escapeHtml(c.description)}</div>
        </div>
      </button>
    `).join('');

    guidedCatGrid.querySelectorAll('.guided-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        const cat = GuidedTicketBuilder.selectCategory(catId);
        if (cat) {
          renderGuidedSubcategories(cat);
        }
      });
    });
  }

  function renderGuidedSubcategories(cat) {
    if (!guidedStageCats || !guidedStageSubcats || !guidedSubcatGrid) return;
    guidedStageCats.style.display = 'none';
    guidedStageSubcats.style.display = 'block';
    if (guidedStepIndicator) guidedStepIndicator.textContent = `Step 2 of 4: ${cat.name} Subcategory`;

    guidedSubcatGrid.innerHTML = (cat.subcategories || []).map(s => `
      <button class="guided-cat-btn" data-sub-id="${escapeHtml(s.id)}">
        <div>
          <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">${escapeHtml(s.description || '')}</div>
        </div>
      </button>
    `).join('');

    guidedSubcatGrid.querySelectorAll('.guided-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-sub-id');
        const sub = GuidedTicketBuilder.selectSubcategory(subId);
        if (sub) {
          renderGuidedQuestions(sub);
        }
      });
    });
  }

  function renderGuidedQuestions(sub) {
    if (!guidedStageSubcats || !guidedStageQuestions || !guidedQuestionsContainer) return;
    guidedStageSubcats.style.display = 'none';
    guidedStageQuestions.style.display = 'block';
    if (guidedStepIndicator) guidedStepIndicator.textContent = `Step 3 of 4: Follow-up Questions (${sub.name})`;

    guidedQuestionsContainer.innerHTML = (sub.questions || []).map((q, qIdx) => `
      <div class="guided-question-box" data-q-id="${escapeHtml(q.id)}">
        <div class="guided-q-title">${qIdx + 1}. ${escapeHtml(q.question)}</div>
        <div class="guided-radio-group">
          ${q.options.map(opt => `
            <label class="guided-radio-label">
              <input type="radio" name="gq_${escapeHtml(q.id)}" value="${escapeHtml(opt)}" data-is-other="${opt === 'Other' ? 'true' : 'false'}">
              <span>${escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
        <div class="other-wrap" style="display:none; margin-top: 4px;">
          <input type="text" class="guided-other-input" placeholder="Specify details...">
        </div>
        ${q.optional ? `<button type="button" class="guided-skip-btn" data-skip-q="${escapeHtml(q.id)}">Skip this question</button>` : ''}
      </div>
    `).join('');

    guidedQuestionsContainer.querySelectorAll('.guided-question-box').forEach(box => {
      const qId = box.getAttribute('data-q-id');
      const otherWrap = box.querySelector('.other-wrap');
      const otherInput = box.querySelector('.guided-other-input');

      box.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const isOther = radio.getAttribute('data-is-other') === 'true';
          if (otherWrap) otherWrap.style.display = isOther ? 'block' : 'none';
          GuidedTicketBuilder.setAnswer(qId, radio.value, isOther, otherInput ? otherInput.value : '');
        });
      });

      if (otherInput) {
        otherInput.addEventListener('input', () => {
          const activeRadio = box.querySelector('input[type="radio"]:checked');
          if (activeRadio && activeRadio.getAttribute('data-is-other') === 'true') {
            GuidedTicketBuilder.setAnswer(qId, 'Other', true, otherInput.value);
          }
        });
      }

      const skipBtn = box.querySelector('.guided-skip-btn');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          box.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
          if (otherWrap) otherWrap.style.display = 'none';
          GuidedTicketBuilder.setAnswer(qId, '');
          showToast('Question skipped');
        });
      }
    });
  }

  if (btnGuidedBackSub) {
    btnGuidedBackSub.addEventListener('click', () => {
      if (guidedStageQuestions) guidedStageQuestions.style.display = 'none';
      if (guidedStageSubcats) guidedStageSubcats.style.display = 'block';
    });
  }

  if (btnGuidedAssemble) {
    btnGuidedAssemble.addEventListener('click', () => {
      if (guidedTicketId) GuidedTicketBuilder.setIdentifiers(guidedTicketId.value, 'Medium');
      if (guidedFreeNotes) GuidedTicketBuilder.setNotes(guidedFreeNotes.value, '');

      const assembled = GuidedTicketBuilder.assembleTicket();
      if (guidedAssembledText) {
        guidedAssembledText.value = assembled.description;
      }
      if (guidedStageQuestions) guidedStageQuestions.style.display = 'none';
      if (guidedStageReview) guidedStageReview.style.display = 'block';
      if (guidedStepIndicator) guidedStepIndicator.textContent = 'Step 4 of 4: Review Assembled Ticket';
      updateTicketPreview();
    });
  }

  if (guidedAssembledText) {
    guidedAssembledText.addEventListener('input', updateTicketPreview);
  }

  if (btnGuidedEditBack) {
    btnGuidedEditBack.addEventListener('click', () => {
      if (guidedStageReview) guidedStageReview.style.display = 'none';
      if (guidedStageQuestions) guidedStageQuestions.style.display = 'block';
    });
  }

  const btnGuidedUseDraft = document.getElementById('btn-guided-use-draft');
  if (btnGuidedUseDraft) {
    btnGuidedUseDraft.addEventListener('click', () => {
      const editedText = guidedAssembledText ? guidedAssembledText.value.trim() : '';
      if (!editedText) {
        alert('Please review the ticket content.');
        return;
      }
      if (ticketSubjectInput) {
        ticketSubjectInput.value = (guidedTicketId && guidedTicketId.value.trim())
          ? `[${guidedTicketId.value.trim()}] Support Request`
          : 'Guided Support Ticket';
      }
      if (ticketDescInput) ticketDescInput.value = editedText;
      if (charCounter) charCounter.textContent = `${editedText.length} characters`;
      selectIntakeMethod('desc');
      updateTicketPreview();
      showToast('Guided ticket draft applied to Description tab!');
    });
  }

  if (btnResetGuided) {
    btnResetGuided.addEventListener('click', () => {
      GuidedTicketBuilder.resetState();
      if (guidedStageReview) guidedStageReview.style.display = 'none';
      if (guidedStageQuestions) guidedStageQuestions.style.display = 'none';
      if (guidedStageSubcats) guidedStageSubcats.style.display = 'none';
      if (guidedStageCats) guidedStageCats.style.display = 'block';
      if (guidedStepIndicator) guidedStepIndicator.textContent = 'Step 1 of 4: Primary Category';
      renderGuidedCategories();
      updateTicketPreview();
    });
  }

  // File Upload & Drag and Drop Handling
  async function handleFileUpload(file) {
    if (!file) return;

    showToast(`Parsing ${file.name}...`);
    try {
      const parsed = await DocumentParser.parseFile(file);
      const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const docMeta = {
        id: docId,
        name: parsed.filename,
        type: parsed.fileType,
        size: parsed.size,
        uploadDate: new Date().toISOString(),
        sectionCount: parsed.policyCount,
        status: 'Indexed'
      };

      const docPolicies = parsed.policies.map(p => ({
        ...p,
        docId,
        sourceDocName: parsed.filename
      }));

      await StorageManager.saveDocument(docMeta, docPolicies);
      await loadPoliciesFromStorage();
      showToast(`Loaded ${parsed.policyCount} policies from ${parsed.filename}`);
      refreshLibraryView();
      refreshHomeActivity();
    } catch (err) {
      showToast(`Error: ${err.message}`);
      alert(`Could not process document "${file.name}":\n${err.message}`);
    }
  }

  if (fileInputHome) {
    fileInputHome.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => handleFileUpload(f));
      fileInputHome.value = '';
    });
  }

  if (fileInputLibrary) {
    fileInputLibrary.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => handleFileUpload(f));
      fileInputLibrary.value = '';
    });
  }

  if (dropzoneBox) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneBox.classList.remove('drag-over');
      });
    });

    dropzoneBox.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(f => handleFileUpload(f));
    });
  }

  if (btnClearPolicies) {
    btnClearPolicies.addEventListener('click', () => {
      showConfirmDialog({
        title: 'Remove All Stored Policies?',
        subtitle: 'Permanent local deletion',
        message: 'Are you sure you want to remove all indexed policy documents and clauses from this device? You will need to upload policy documents again before analyzing tickets.',
        icon: '⚠️',
        confirmText: 'Remove All Documents',
        confirmColor: '#B91C1C',
        onConfirm: async () => {
          await StorageManager.clearAllData();
          await loadPoliciesFromStorage();
          showToast('All stored policies removed from device');
          refreshLibraryView();
          renderHomeDocsList();
          if (resultCard) resultCard.style.display = 'none';
        }
      });
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      showConfirmDialog({
        title: 'Clear Analysis History?',
        subtitle: 'Permanent local deletion',
        message: 'Are you sure you want to clear your local ticket analysis verification history? All saved verification logs will be permanently deleted from this browser.',
        icon: '🗑️',
        confirmText: 'Clear History',
        confirmColor: '#B91C1C',
        onConfirm: async () => {
          await StorageManager.clearHistory();
          showToast('Analysis history cleared');
          refreshActivityView();
          refreshHomeActivity();
        }
      });
    });
  }

  async function loadPoliciesFromStorage() {
    activePoliciesList = await StorageManager.getAllPolicies();
    const docs = await StorageManager.getAllDocuments();
    const readyDocs = docs.filter(d => (d.sectionCount || 0) > 0);

    if (widgetPolicyCount) {
      widgetPolicyCount.textContent = `${readyDocs.length} ${readyDocs.length === 1 ? 'document' : 'documents'} · Ready`;
    }
    if (libraryPolicyCount) {
      libraryPolicyCount.textContent = `${activePoliciesList.length} policies`;
    }
    if (homeDocsCountLabel) {
      homeDocsCountLabel.textContent = `${readyDocs.length} ${readyDocs.length === 1 ? 'document' : 'documents'} ready`;
    }
    await renderHomeDocsList();
  }

  async function refreshLibraryView() {
    const docs = await StorageManager.getAllDocuments();
    if (!docTableBody) return;

    if (docs.length === 0) {
      docTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-row">
            <div><strong>No policy documents loaded</strong></div>
            <div style="margin-top:4px;color:var(--text-secondary);">Upload a PDF, DOCX, XLSX, CSV, or TXT file to index policies.</div>
          </td>
        </tr>
      `;
      return;
    }

    docTableBody.innerHTML = docs.map(d => {
      let statusBadge = '<span class="pill-status pill-status-match">Ready</span>';
      if (d.status === 'Partially processed') {
        statusBadge = '<span class="pill-status pill-status-review">Partially processed</span>';
      } else if (d.status === 'Failed' || (d.sectionCount || 0) === 0) {
        statusBadge = '<span class="pill-status pill-status-nomatch">Failed</span>';
      }

      return `
        <tr>
          <td><strong>${escapeHtml(d.name)}</strong></td>
          <td><span class="status-pill-neutral">${escapeHtml((d.type || '').toUpperCase())}</span></td>
          <td>${d.sectionCount || 0} clauses</td>
          <td>${statusBadge}</td>
          <td style="white-space:nowrap;">
            <button class="btn-secondary btn-inspect-doc" data-doc-id="${escapeHtml(d.id)}" style="padding:4px 8px;font-size:11px;margin-right:4px;">Inspect 🔍</button>
            <button class="btn-danger-outline btn-delete-doc" data-doc-id="${escapeHtml(d.id)}" data-doc-name="${escapeHtml(d.name)}" style="padding:4px 8px;font-size:11px;">Remove</button>
          </td>
        </tr>
      `;
    }).join('');

    docTableBody.querySelectorAll('.btn-inspect-doc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-doc-id');
        const allPolicies = await StorageManager.getAllPolicies();
        const docPolicies = allPolicies.filter(p => p.docId === id);
        const docs = await StorageManager.getAllDocuments();
        const doc = docs.find(d => d.id === id);
        if (!doc) return;

        const summaryText = docPolicies.map((p, idx) => {
          const loc = p.pageOrRow || (p.sourceLocations && p.sourceLocations[0] ? p.sourceLocations[0].label : `Clause ${idx + 1}`);
          const pName = p.title || p.name || 'Clause';
          const pId = p.hasExplicitId ? ` [${p.policyId || p.id}]` : '';
          return `=== ${loc}: ${pName}${pId} ===\n${p.mainText || p.conditions || p.rawText || ''}\n`;
        }).join('\n');

        openSourceViewer({
          docName: doc.name,
          location: `${docPolicies.length} extracted clauses`,
          hasExplicitId: false,
          passage: summaryText || '(No readable clauses extracted from this document)',
          context: `Format: ${(doc.type || '').toUpperCase()} | Size: ${Math.round((doc.size || 0) / 1024)} KB | Uploaded: ${formatDateTime(doc.uploadDate)}`
        });
      });
    });

    docTableBody.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-doc-id');
        const docName = btn.getAttribute('data-doc-name') || 'this document';
        showConfirmDialog({
          title: 'Remove Policy Document?',
          subtitle: docName,
          message: `Are you sure you want to remove "${docName}" and all of its indexed policy clauses from your library?`,
          icon: '🗑️',
          confirmText: 'Remove Document',
          confirmColor: '#B91C1C',
          onConfirm: async () => {
            await StorageManager.deleteDocument(id);
            await loadPoliciesFromStorage();
            refreshLibraryView();
            refreshHomeActivity();
            renderHomeDocsList();
            showToast('Document removed');
          }
        });
      });
    });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()] || '';
    const day = d.getDate();
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year} · ${hours}:${mins}`;
  }

  function formatTicketTag(ticketTitle, ticketDesc, fallbackIdx) {
    if (!ticketTitle && !ticketDesc) return `INC-${1000 + fallbackIdx}`;
    const text = `${ticketTitle || ''} ${ticketDesc || ''}`;
    const idMatch = text.match(/\b(INC-\d+|#?[A-Z]{2,4}-\d+|#\d{4,6})\b/i);
    if (idMatch) return idMatch[0].toUpperCase();
    if (ticketTitle) {
      const words = ticketTitle.trim().split(/\s+/).slice(0, 3).join(' ');
      return words.length > 20 ? words.slice(0, 18) + '...' : words;
    }
    return `INC-${1000 + fallbackIdx}`;
  }

  function getStatusPillHtml(status) {
    if (status === 'MATCH_FOUND') {
      return `<span class="pill-status pill-status-match">Policy Found</span>`;
    } else if (status === 'MANUAL_REVIEW_REQUIRED' || status === 'CONFLICTING_POLICIES') {
      return `<span class="pill-status pill-status-review">Manual Review</span>`;
    } else {
      return `<span class="pill-status pill-status-nomatch">No Policy Found</span>`;
    }
  }

  async function refreshHomeActivity() {
    if (!homeActivityTbody) return;
    const history = await StorageManager.getHistory(5);

    if (history.length === 0) {
      homeActivityTbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-row">No local activity recorded yet. Upload a policy and analyze your first ticket above.</td>
        </tr>
      `;
      return;
    }

    homeActivityTbody.innerHTML = history.map((h, idx) => {
      const dtStr = formatDateTime(h.timestamp);
      const ticketTag = formatTicketTag(h.ticketTitle, h.ticketDescription, idx);
      const policyName = h.policyName || h.policyId || '—';
      const statusPill = getStatusPillHtml(h.status);

      return `
        <tr class="table-row-clickable" data-hist-id="${escapeHtml(h.id)}">
          <td>
            <div class="cell-datetime">
              <span>📄</span>
              <span>${escapeHtml(dtStr)}</span>
            </div>
          </td>
          <td><span class="cell-ticket-id">${escapeHtml(ticketTag)}</span></td>
          <td><span class="cell-policy-name">${escapeHtml(policyName)}</span></td>
          <td>${statusPill}</td>
          <td><span class="chevron-icon">›</span></td>
        </tr>
      `;
    }).join('');

    homeActivityTbody.querySelectorAll('.table-row-clickable').forEach(row => {
      row.addEventListener('click', async () => {
        const id = row.getAttribute('data-hist-id');
        const allHist = await StorageManager.getHistory();
        const entry = allHist.find(h => h.id === id);
        if (entry) {
          renderSavedHistoryResult(entry);
          resultCard.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  async function refreshActivityView() {
    const history = await StorageManager.getHistory(50);
    if (!historyTableBody) return;

    if (history.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-row">
            <div><strong>No analysis history yet</strong></div>
            <div style="margin-top:4px;color:var(--text-secondary);">Analyze your first ticket on the dashboard to see history recorded here.</div>
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = history.map((h, idx) => {
      const dt = formatDateTime(h.timestamp);
      const statusPill = getStatusPillHtml(h.status);

      return `
        <tr>
          <td style="font-size:12px;color:var(--text-secondary);white-space:nowrap;">${dt}</td>
          <td><strong>${escapeHtml(h.ticketTitle || '(Untitled)')}</strong><br><span style="font-size:11px;color:var(--text-secondary);">${escapeHtml((h.ticketDescription || '').slice(0, 60))}...</span></td>
          <td>${escapeHtml(h.policyName || h.policyId || '—')}</td>
          <td>${statusPill}</td>
          <td style="white-space:nowrap;">
            <button class="btn-secondary btn-view-hist" data-hist-id="${escapeHtml(h.id)}" style="padding:4px 10px;font-size:11px;">View</button>
            <button class="btn-danger-outline btn-del-hist" data-hist-id="${escapeHtml(h.id)}" style="padding:4px 8px;font-size:11px;">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    historyTableBody.querySelectorAll('.btn-view-hist').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-hist-id');
        const allHist = await StorageManager.getHistory();
        const entry = allHist.find(h => h.id === id);
        if (entry) {
          renderSavedHistoryResult(entry);
          switchView('home');
          resultCard.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    historyTableBody.querySelectorAll('.btn-del-hist').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-hist-id');
        showConfirmDialog({
          title: 'Delete History Entry?',
          subtitle: 'Single log deletion',
          message: 'Are you sure you want to delete this ticket verification entry from your history?',
          icon: '🗑️',
          confirmText: 'Delete Entry',
          confirmColor: '#B91C1C',
          onConfirm: async () => {
            await StorageManager.deleteHistory(id);
            refreshActivityView();
            refreshHomeActivity();
            showToast('History entry deleted');
          }
        });
      });
    });
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function executeAnalysis(ticketToAnalyze) {
    let ticket = ticketToAnalyze || currentTicket;

    if (!ticket) {
      if (currentActiveTab === 'conv') {
        const convText = convTextInput ? convTextInput.value.trim() : '';
        if (!convText) {
          alert('Please paste or upload a support conversation first.');
          return;
        }
        const parsedConv = (typeof ConversationParser !== 'undefined')
          ? ConversationParser.parseConversation(convText)
          : { hasStructuredMessages: false, rawText: convText, messages: [], extractedResolutions: [], extractedIdentifiers: [] };
        const inferredId = parsedConv.extractedIdentifiers.length > 0 ? parsedConv.extractedIdentifiers[0] : null;

        ticket = (typeof TicketModel !== 'undefined')
          ? TicketModel.createNormalizedTicket({
              source: 'conversation_paste',
              ticketId: inferredId,
              title: inferredId ? `Conversation Ticket ${inferredId}` : 'Support Conversation',
              description: convText,
              conversation: parsedConv,
              provenance: { conversation: 'user_pasted_transcript' },
              retrievalStatus: { status: 'MANUAL', platform: 'conversation' }
            })
          : { title: 'Support Conversation', description: convText };

      } else if (currentActiveTab === 'link') {
        const url = ticketUrlInput ? ticketUrlInput.value.trim() : '';
        if (lastRetrievedTicket) {
          const title = lastRetrievedTicket.title || 'URL Ticket';
          const description = lastRetrievedTicket.description || title;
          ticket = (typeof TicketModel !== 'undefined')
            ? TicketModel.createNormalizedTicket({
                source: 'url_retrieval',
                ticketId: lastRetrievedTicket.ticketId || (title.match(/#\d+|INC-\d+/i) || [])[0] || null,
                title,
                description,
                provenance: {
                  url: lastRetrievedTicket.url || url,
                  platform: lastRetrievedTicket.platform || 'web',
                  author: lastRetrievedTicket.author || null,
                  fieldsRetrieved: lastRetrievedTicket.fieldsRetrieved || []
                },
                retrievalStatus: { url: lastRetrievedTicket.url || url, status: 'SUCCESS' }
              })
            : { title, description, url: lastRetrievedTicket.url || url, ticketId: lastRetrievedTicket.ticketId };
        } else {
          alert('Please enter a ticket URL and click "Retrieve" first, or switch to the Description, Conversation, or Guided Builder tabs.');
          return;
        }

      } else if (currentActiveTab === 'guided') {
        const draft = guidedAssembledText ? guidedAssembledText.value.trim() : '';
        if (!draft && typeof GuidedTicketBuilder !== 'undefined') {
          const assembled = GuidedTicketBuilder.assembleTicket();
          ticket = assembled;
        } else if (draft) {
          ticket = (typeof TicketModel !== 'undefined')
            ? TicketModel.createNormalizedTicket({
                source: 'guided_builder',
                ticketId: (guidedTicketId && guidedTicketId.value.trim()) || null,
                title: (guidedTicketId && guidedTicketId.value.trim()) ? `[${guidedTicketId.value.trim()}] Guided Ticket` : 'Guided Ticket',
                description: draft,
                provenance: { description: 'user_guided_builder' }
              })
            : { title: 'Guided Ticket', description: draft };
        }

        if (!ticket || (!ticket.title && !ticket.description)) {
          alert('Please complete the guided intake options or enter a problem description.');
          return;
        }

      } else {
        const title = ticketSubjectInput ? ticketSubjectInput.value.trim() : '';
        const description = ticketDescInput ? ticketDescInput.value.trim() : '';

        if (!title && !description) {
          alert('Please enter a ticket subject or description to analyze.');
          return;
        }

        ticket = (typeof TicketModel !== 'undefined')
          ? TicketModel.createNormalizedTicket({
              source: 'manual_description',
              ticketId: (title.match(/#\d+|INC-\d+/i) || description.match(/#\d+|INC-\d+/i) || [])[0] || null,
              title,
              description,
              provenance: { title: 'user_input', description: 'user_input' }
            })
          : { title, description };
      }
    }

    if (!ticket || !ticket.description) {
      alert('Please provide a ticket description to analyze.');
      goToStep(2);
      return;
    }

    if (activePoliciesList.length === 0) {
      alert('No policy documents are currently loaded. Please upload a policy document in Step 1 or the Policy Library first.');
      goToStep(1);
      return;
    }

    currentTicket = ticket;
    goToStep(4);

    if (btnAnalyze) btnAnalyze.disabled = true;
    if (btnReviewAnalyze) btnReviewAnalyze.disabled = true;
    if (analyzeSpinner) analyzeSpinner.style.display = 'block';

    setTimeout(async () => {
      let result = PolicyEngine.matchTicket(ticket, activePoliciesList);

      // Optional Python ML scikit-learn cross-validation if served over HTTP
      if (window.location.protocol.startsWith('http') && result.matched) {
        try {
          const apiRes = await fetch('/api/ml-classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket, policies: activePoliciesList })
          });
          if (apiRes.ok) {
            const mlData = await apiRes.json();
            if (mlData && mlData.success && mlData.topMatch) {
              if (mlData.topMatch.probability) {
                result.topMatch.mlProbability = mlData.topMatch.probability;
              }
              if (mlData.engine) {
                result.engineUsed = mlData.engine;
              }
            }
          }
        } catch (e) {
          // Graceful local fallback
        }
      }

      renderResult(ticket, result);

      await StorageManager.saveHistory({
        ticketUrl: ticket.url || (ticket.retrievalStatus ? ticket.retrievalStatus.url : ''),
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketSource: ticket.source || 'manual_description',
        status: result.status,
        policyId: result.topMatch ? result.topMatch.id : null,
        internalReference: result.topMatch ? (result.topMatch.internalReference || result.topMatch.id) : '',
        hasExplicitId: result.topMatch ? Boolean(result.topMatch.hasExplicitId) : false,
        hasExplicitTitle: result.topMatch ? Boolean(result.topMatch.hasExplicitTitle) : false,
        hasExplicitResolution: result.topMatch ? Boolean(result.topMatch.hasExplicitResolution) : false,
        hasExplicitCategory: result.topMatch ? Boolean(result.topMatch.hasExplicitCategory) : false,
        policyName: result.topMatch ? result.topMatch.name : '',
        category: result.topMatch ? result.topMatch.category : null,
        sourceDocName: result.topMatch ? result.topMatch.sourceDocName : 'Policy Document',
        pageOrRow: result.topMatch ? result.topMatch.pageOrRow : '',
        sourceLocations: result.topMatch ? result.topMatch.sourceLocations : [],
        sourceDocumentId: result.topMatch ? result.topMatch.sourceDocumentId : null,
        resolution: result.topMatch ? result.topMatch.resolution : null,
        conditions: result.topMatch ? result.topMatch.conditions : '',
        exceptions: result.topMatch ? result.topMatch.exceptions : '',
        confidence: result.confidence || '',
        confidenceType: result.topMatch ? 'Deterministic + TF-IDF Retrieval' : '',
        similarityScore: result.similarityScore || 0,
        evidence: result.topMatch ? result.topMatch.evidence : '',
        fullEvidence: result.topMatch ? result.topMatch.fullEvidence : '',
        whyApplies: result.topMatch ? result.topMatch.whyApplies : '',
        exceptionTriggered: result.topMatch ? result.topMatch.exceptionTriggered : false,
        matchedExceptions: result.topMatch ? result.topMatch.matchedExceptions : [],
        missingInformation: result.missingInformation || [],
        evaluatedConditions: result.evaluatedConditions || [],
        evaluatedExceptions: result.evaluatedExceptions || []
      });

      refreshHomeActivity();

      if (btnAnalyze) btnAnalyze.disabled = false;
      if (btnReviewAnalyze) btnReviewAnalyze.disabled = false;
      if (analyzeSpinner) analyzeSpinner.style.display = 'none';
      if (resultCard) {
        resultCard.style.display = 'block';
        resultCard.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  }

  function runAnalysis() {
    executeAnalysis();
  }

  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', runAnalysis);
  }

  // Source Viewer Modal Handlers
  function openSourceViewer(opts) {
    if (!sourceViewerModal) return;
    if (svmDocName) svmDocName.textContent = opts.docName || 'Policy Document';
    if (svmLocation) svmLocation.textContent = opts.location || 'Verified Location';
    if (svmPolicyIdWrap && svmPolicyId) {
      if (opts.hasExplicitId && opts.policyId) {
        svmPolicyIdWrap.style.display = 'flex';
        svmPolicyId.textContent = opts.policyId;
      } else {
        svmPolicyIdWrap.style.display = 'none';
      }
    }
    if (svmPassage) svmPassage.textContent = opts.passage || '(No extracted passage recorded)';
    if (svmContextSection && svmContext) {
      if (opts.context) {
        svmContextSection.style.display = 'block';
        svmContext.textContent = opts.context;
      } else {
        svmContextSection.style.display = 'none';
      }
    }
    sourceViewerModal.style.display = 'flex';
  }

  function closeSourceViewer() {
    if (sourceViewerModal) sourceViewerModal.style.display = 'none';
  }

  if (svmCloseBtn) svmCloseBtn.addEventListener('click', closeSourceViewer);
  if (svmFooterClose) svmFooterClose.addEventListener('click', closeSourceViewer);
  if (sourceViewerModal) {
    sourceViewerModal.addEventListener('click', (e) => {
      if (e.target === sourceViewerModal) closeSourceViewer();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sourceViewerModal && sourceViewerModal.style.display === 'flex') {
      closeSourceViewer();
    }
  });

  // Step 1 Home Document Library Quick List
  async function renderHomeDocsList() {
    if (!homeDocsList) return;
    const docs = await StorageManager.getAllDocuments();
    const readyDocs = docs.filter(d => (d.sectionCount || 0) > 0);

    if (homeDocsCountLabel) {
      homeDocsCountLabel.textContent = `${readyDocs.length} ${readyDocs.length === 1 ? 'document' : 'documents'} ready`;
    }
    if (widgetPolicyCount) {
      widgetPolicyCount.textContent = `${readyDocs.length} ${readyDocs.length === 1 ? 'document' : 'documents'} · Ready`;
    }

    if (docs.length === 0) {
      homeDocsList.innerHTML = `<div class="home-docs-empty">No policy documents uploaded yet. Upload a document above to begin.</div>`;
      return;
    }

    homeDocsList.innerHTML = docs.map(d => {
      const ext = (d.type || d.name.split('.').pop() || 'doc').toUpperCase();
      let statusBadge = '<span class="pill-status pill-status-match" style="font-size:10px;padding:1px 5px;">Ready</span>';
      if (d.status === 'Partially processed') {
        statusBadge = '<span class="pill-status pill-status-review" style="font-size:10px;padding:1px 5px;">Partial</span>';
      } else if (d.status === 'Failed' || (d.sectionCount || 0) === 0) {
        statusBadge = '<span class="pill-status pill-status-nomatch" style="font-size:10px;padding:1px 5px;">Failed</span>';
      }

      return `
        <div class="home-doc-card">
          <div class="home-doc-info">
            <span class="home-doc-badge">${escapeHtml(ext)}</span>
            <div class="home-doc-text">
              <div class="home-doc-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
              <div class="home-doc-meta">${d.sectionCount || 0} clauses &bull; ${statusBadge}</div>
            </div>
          </div>
          <div class="home-doc-actions">
            <button class="btn-doc-inspect" data-doc-id="${escapeHtml(d.id)}" title="Inspect extracted content">Inspect 🔍</button>
            <button class="btn-doc-remove" data-doc-id="${escapeHtml(d.id)}" data-doc-name="${escapeHtml(d.name)}" title="Remove document">✕</button>
          </div>
        </div>
      `;
    }).join('');

    homeDocsList.querySelectorAll('.btn-doc-inspect').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-doc-id');
        const allPolicies = await StorageManager.getAllPolicies();
        const docPolicies = allPolicies.filter(p => p.docId === id);
        const docs = await StorageManager.getAllDocuments();
        const doc = docs.find(d => d.id === id);
        if (!doc) return;

        const summaryText = docPolicies.map((p, idx) => {
          const loc = p.pageOrRow || (p.sourceLocations && p.sourceLocations[0] ? p.sourceLocations[0].label : `Clause ${idx + 1}`);
          const pName = p.title || p.name || 'Clause';
          const pId = p.hasExplicitId ? ` [${p.policyId || p.id}]` : '';
          return `=== ${loc}: ${pName}${pId} ===\n${p.mainText || p.conditions || p.rawText || ''}\n`;
        }).join('\n');

        openSourceViewer({
          docName: doc.name,
          location: `${docPolicies.length} extracted clauses`,
          hasExplicitId: false,
          passage: summaryText || '(No readable clauses extracted from this document)',
          context: `Format: ${(doc.type || '').toUpperCase()} | Size: ${Math.round((doc.size || 0) / 1024)} KB | Uploaded: ${formatDateTime(doc.uploadDate)}`
        });
      });
    });

    homeDocsList.querySelectorAll('.btn-doc-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-doc-id');
        const docName = btn.getAttribute('data-doc-name') || 'this document';
        showConfirmDialog({
          title: 'Remove Policy Document?',
          subtitle: docName,
          message: `Are you sure you want to remove "${docName}" and all of its indexed policy clauses?`,
          icon: '🗑️',
          confirmText: 'Remove Document',
          confirmColor: '#B91C1C',
          onConfirm: async () => {
            await StorageManager.deleteDocument(id);
            await loadPoliciesFromStorage();
            refreshLibraryView();
            refreshHomeActivity();
            renderHomeDocsList();
            showToast('Document removed');
          }
        });
      });
    });
  }

  // PART 9: Results Screen — Structured Sections A through H
  function renderResult(ticket, result) {
    // SECTION A: DECISION
    let bannerClass = 'res-banner-match';
    let statusText = '✓ Policy Found';

    if (result.status === 'CONFLICTING_POLICIES') {
      bannerClass = 'res-banner-nomatch';
      statusText = '⚠️ Conflicting Policies Identified';
    } else if (result.status === 'MANUAL_REVIEW_REQUIRED') {
      bannerClass = 'res-banner-review';
      statusText = '⚠️ Manual Review Required';
    } else if (result.status === 'NO_POLICY_FOUND') {
      bannerClass = 'res-banner-nomatch';
      statusText = '✕ No Policy Found';
    }

    const sourceLabel = ticket.source ? ticket.source.replace(/_/g, ' ').toUpperCase() : 'MANUAL';
    const analyzedPayloadHtml = `
      <div class="res-card res-card-full" style="margin-bottom: 14px; background-color: #FAFCF9;">
        <div class="res-card-header">
          <span>Analyzed Ticket Payload</span>
          <span class="status-pill-neutral">${escapeHtml(sourceLabel)}</span>
        </div>
        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
          ${escapeHtml(ticket.title || '(Untitled Ticket)')}
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); max-height: 90px; overflow-y: auto; background: #FFFFFF; border: 1px solid #ECEFEA; border-radius: var(--radius-sm); padding: 6px 10px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(ticket.description || '')}</div>
      </div>
    `;

    if (!result.matched || !result.topMatch) {
      resultCard.innerHTML = `
        <div class="res-banner ${bannerClass}">
          <span>${statusText}</span>
          <span style="font-size:12px;font-weight:normal;">100% Local Inference &bull; Calibrated Retrieval</span>
        </div>
        ${analyzedPayloadHtml}
        <div class="res-card" style="margin-bottom:16px;">
          <div class="res-card-header">Decision &amp; Assessment</div>
          <p style="font-size:13.5px;color:var(--text-primary);margin-bottom:8px;">${escapeHtml(result.reason || 'No applicable policy could be established from the uploaded documents.')}</p>
          <div style="font-size:12px;color:var(--text-secondary);">
            Checked ${activePoliciesList.length} indexed policy records across local repository. No general knowledge or external AI was used.
          </div>
        </div>
        <div class="res-actions-bar">
          <button class="btn-secondary" id="btn-re-analyze">Analyze Another Ticket</button>
        </div>
      `;

      const btnRe = document.getElementById('btn-re-analyze');
      if (btnRe) btnRe.addEventListener('click', () => {
        if (ticketSubjectInput) ticketSubjectInput.value = '';
        if (ticketDescInput) ticketDescInput.value = '';
        if (charCounter) charCounter.textContent = '0 characters';
        currentTicket = null;
        lastRetrievedTicket = null;
        if (resultCard) resultCard.style.display = 'none';
        goToStep(2);
        showMethodSelector();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    const top = result.topMatch;

    // SECTION B: APPLICABLE POLICY (Only show fields present in source)
    const policyIdBadgeHtml = top.hasExplicitId && top.id
      ? `<span class="status-pill-neutral" title="Source Policy ID">Policy ID: ${escapeHtml(top.id)}</span>`
      : '';

    const categoryHtml = top.category
      ? `<span><strong>Category:</strong> ${escapeHtml(top.category)}</span>`
      : '';

    const sourceDocHtml = `<span><strong>Source:</strong> ${escapeHtml(top.sourceDocName || 'Policy Document')} (${escapeHtml(top.pageOrRow || 'Verified Section')})</span>`;

    // Warnings and alerts
    let excAlertHtml = '';
    if (top.exceptionTriggered && top.matchedExceptions && top.matchedExceptions.length > 0) {
      excAlertHtml = `
        <div class="alert-exc">
          <strong>⚠️ Exception Clause Triggered:</strong><br>
          ${escapeHtml(top.matchedExceptions.join(' '))}
        </div>
      `;
    }

    let ambigAlertHtml = '';
    if (result.isAmbiguous && result.ambiguityWarning) {
      ambigAlertHtml = `
        <div class="alert-exc" style="background:#FEF3C7;color:#92400E;border-left-color:#D97706;">
          <strong>⚠️ Ambiguous Match Warning:</strong><br>
          ${escapeHtml(result.ambiguityWarning)}
        </div>
      `;
    }

    let missingAlertHtml = '';
    if (result.missingInformation && result.missingInformation.length > 0) {
      missingAlertHtml = `
        <div class="alert-exc" style="background:#FEF3C7;color:#92400E;border-left-color:#D97706;margin-top:8px;">
          <strong>ℹ️ Information Verification Required:</strong>
          <ul style="margin:4px 0 0 16px;">
            ${result.missingInformation.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // SECTION E: CONDITIONS AND EXCEPTIONS BREAKDOWN
    let evaluatedCondsHtml = '';
    if (result.evaluatedConditions && result.evaluatedConditions.length > 0) {
      evaluatedCondsHtml = result.evaluatedConditions.map(c => {
        let badge = '<span class="req-badge-unknown">Verification Needed</span>';
        if (c.status === 'SUPPORTED') badge = '<span class="req-badge-supported">✓ Supported by ticket</span>';
        else if (c.status === 'NOT_SATISFIED') badge = '<span class="req-badge-unsatisfied">✕ Not Satisfied</span>';
        else if (c.status === 'NOT_SPECIFIED') badge = '<span class="req-badge-not-specified">Not explicitly specified</span>';
        return `
          <div class="eval-req-item">
            <div class="eval-req-text">${escapeHtml(c.text)}</div>
            ${badge}
          </div>
        `;
      }).join('');
    } else {
      evaluatedCondsHtml = `<div style="font-size:12px;color:var(--text-muted);">No explicit conditions specified in the source passage.</div>`;
    }

    let evaluatedExcsHtml = '';
    if (result.evaluatedExceptions && result.evaluatedExceptions.length > 0) {
      evaluatedExcsHtml = result.evaluatedExceptions.map(e => {
        let badge = '<span class="req-badge-supported">Does not apply</span>';
        if (e.status === 'APPLIES') badge = '<span class="req-badge-unsatisfied">⚠️ Exception Applies</span>';
        else if (e.status === 'NOT_SPECIFIED') badge = '<span class="req-badge-not-specified">No explicit exceptions identified</span>';
        return `
          <div class="eval-req-item">
            <div class="eval-req-text">${escapeHtml(e.text)}</div>
            ${badge}
          </div>
        `;
      }).join('');
    } else {
      evaluatedExcsHtml = `<div style="font-size:12px;color:var(--text-muted);">No explicit exceptions identified in the available source.</div>`;
    }

    // SECTION F: RECOMMENDED RESOLUTION
    let resolutionContentHtml = '';
    if (top.hasExplicitResolution && top.resolution) {
      resolutionContentHtml = `
        <div class="res-resolution-box">${escapeHtml(top.resolution)}</div>
      `;
    } else {
      resolutionContentHtml = `
        <div class="res-resolution-box" style="background:#FAF8F5;border-color:#E5E2DC;color:var(--text-secondary);font-style:italic;">
          No explicit resolution established in source document. Refer to standard organization escalation procedures.
        </div>
      `;
    }

    // SECTION G: OTHER RELEVANT POLICIES
    let otherMatchesHtml = '';
    if (result.otherMatches && result.otherMatches.length > 0) {
      otherMatchesHtml = `
        <div class="res-card res-card-full" style="margin-top:14px;">
          <div class="res-card-header">Other Relevant Policies Considered</div>
          <div class="other-matches-list">
            ${result.otherMatches.map(om => `
              <div class="other-match-item">
                <div class="other-match-header">
                  <strong>${escapeHtml(om.name)}</strong>
                  ${om.hasExplicitId && om.id ? `<span class="status-pill-neutral" style="font-size:10px;">${escapeHtml(om.id)}</span>` : ''}
                  <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(om.sourceDocName)} (${escapeHtml(om.pageOrRow)})</span>
                </div>
                <div class="other-match-excerpt">${escapeHtml(om.evidence)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Full Assembly: Sections A through H
    resultCard.innerHTML = `
      <!-- A. Decision -->
      <div class="res-banner ${bannerClass}">
        <span>${statusText}</span>
        <span style="font-size:12px;font-weight:normal;">Confidence: ${escapeHtml(result.confidence || 'Assessed')} &bull; Local Deterministic Verification</span>
      </div>

      ${analyzedPayloadHtml}

      <div class="res-grid">
        <!-- B. Applicable Policy -->
        <div class="res-card">
          <div class="res-card-header">
            <span>Applicable Policy</span>
            ${policyIdBadgeHtml}
          </div>
          <div class="res-policy-name">${escapeHtml(top.name)}</div>
          <div class="res-policy-meta">
            ${categoryHtml}
            ${sourceDocHtml}
          </div>
          ${ambigAlertHtml}
          ${excAlertHtml}
          ${missingAlertHtml}
        </div>

        <!-- C. Why It Applies -->
        <div class="res-card">
          <div class="res-card-header">
            <span>Why It Applies</span>
            <span class="status-pill-neutral" style="font-size:10px;">INTAKE: ${escapeHtml(sourceLabel)}</span>
          </div>
          <p style="font-size:13px;color:var(--text-primary);line-height:1.5;">${escapeHtml(top.whyApplies)}</p>
          <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);">
            Retrieval Method: <strong>TF-IDF Cosine Match (${Math.round((result.similarityScore || 0) * 100)}%)</strong>
            ${top.mlProbability !== null && top.mlProbability !== undefined ? ` &nbsp;|&nbsp; Supervised ML: <strong>${Math.round(top.mlProbability * 100)}%</strong>` : ' &nbsp;|&nbsp; Supervised ML: <span style="color:var(--text-muted);">Inactive (no labelled ticket training data)</span>'}
          </div>
        </div>

        <!-- D. Source Evidence -->
        <div class="res-card res-card-full">
          <div class="res-card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Source Policy Evidence</span>
            <button class="btn-secondary" id="btn-view-source" style="padding:3px 10px;font-size:11px;">View Source ↗</button>
          </div>
          <div class="res-evidence-quote">${escapeHtml(top.evidence)}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
            Verbatim passage from: <strong>${escapeHtml(top.sourceDocName)}</strong> &mdash; <em>${escapeHtml(top.pageOrRow)}</em>
          </div>
        </div>

        <!-- E. Conditions & Exceptions Breakdown -->
        <div class="res-card res-card-full">
          <div class="res-card-header">Conditions &amp; Exceptions Verification</div>
          <div style="margin-bottom:8px;">
            <div style="font-size:11.5px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Stated Conditions:</div>
            <div class="eval-req-list">${evaluatedCondsHtml}</div>
          </div>
          <div style="margin-top:10px;">
            <div style="font-size:11.5px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Identified Exceptions / Exclusions:</div>
            <div class="eval-req-list">${evaluatedExcsHtml}</div>
          </div>
        </div>

        <!-- F. Recommended Resolution -->
        <div class="res-card res-card-full" style="background-color:#F5F9F6;border-color:var(--brand-border);">
          <div class="res-card-header" style="color:var(--brand);">Recommended Resolution</div>
          ${resolutionContentHtml}
        </div>
      </div>

      <!-- G. Other Relevant Policies -->
      ${otherMatchesHtml}

      <!-- H. Actions -->
      <div class="res-actions-bar">
        ${top.hasExplicitResolution && top.resolution ? '<button class="btn-choose-files" id="btn-copy-res" style="margin-bottom:0;">Copy Resolution</button>' : ''}
        <button class="btn-secondary" id="btn-copy-all">Copy Full Analysis</button>
        <button class="btn-secondary" id="btn-view-source-action">View Source ↗</button>
        <button class="btn-secondary" id="btn-new-ticket">Analyze Another Ticket</button>
      </div>
    `;

    // Connect View Source buttons
    const triggerSourceView = () => {
      openSourceViewer({
        docName: top.sourceDocName,
        location: top.pageOrRow,
        hasExplicitId: top.hasExplicitId,
        policyId: top.id,
        passage: top.fullEvidence || top.evidence || top.mainText,
        context: `Document: ${top.sourceDocName} | Location: ${top.pageOrRow} | Traceable: Verified local extraction`
      });
    };

    const btnViewSrc = document.getElementById('btn-view-source');
    if (btnViewSrc) btnViewSrc.addEventListener('click', triggerSourceView);

    const btnViewSrcAction = document.getElementById('btn-view-source-action');
    if (btnViewSrcAction) btnViewSrcAction.addEventListener('click', triggerSourceView);

    const btnCopyRes = document.getElementById('btn-copy-res');
    if (btnCopyRes && top.resolution) {
      btnCopyRes.addEventListener('click', () => {
        navigator.clipboard.writeText(top.resolution).then(() => {
          showToast('Resolution copied to clipboard');
        });
      });
    }

    const btnCopyAll = document.getElementById('btn-copy-all');
    if (btnCopyAll) {
      btnCopyAll.addEventListener('click', () => {
        const idLine = top.hasExplicitId && top.id ? `Policy ID: [${top.id}]\n` : '';
        const catLine = top.category ? `Category: ${top.category}\n` : '';
        const resText = top.hasExplicitResolution && top.resolution ? top.resolution : 'No explicit resolution established in source document.';
        const text = `POLICY ANALYSIS SUMMARY
Status: ${result.status}
Policy: ${top.name}
${idLine}${catLine}Source: ${top.sourceDocName} (${top.pageOrRow})
Confidence: ${result.confidence}

WHY IT APPLIES:
${top.whyApplies}

RECOMMENDED RESOLUTION:
${resText}

SOURCE EVIDENCE:
${top.evidence}`;
        navigator.clipboard.writeText(text).then(() => {
          showToast('Complete analysis copied to clipboard');
        });
      });
    }

    const btnNew = document.getElementById('btn-new-ticket');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        if (ticketSubjectInput) ticketSubjectInput.value = '';
        if (ticketDescInput) ticketDescInput.value = '';
        if (charCounter) charCounter.textContent = '0 characters';
        currentTicket = null;
        lastRetrievedTicket = null;
        if (resultCard) resultCard.style.display = 'none';
        goToStep(2);
        showMethodSelector();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // Restore analysis from local IndexedDB history without fabricated 'Stored History' / 'Saved Entry'
  function renderSavedHistoryResult(h) {
    const hasMatch = h.status === 'MATCH_FOUND' || h.status === 'MANUAL_REVIEW_REQUIRED' || h.status === 'POLICY_FOUND';
    const fakeResult = {
      matched: hasMatch,
      status: h.status,
      confidence: h.confidence,
      similarityScore: h.similarityScore,
      missingInformation: h.missingInformation || [],
      evaluatedConditions: h.evaluatedConditions || [],
      evaluatedExceptions: h.evaluatedExceptions || [],
      topMatch: (hasMatch && (h.policyName || h.policyId || h.internalReference)) ? {
        id: h.hasExplicitId ? h.policyId : null,
        internalReference: h.internalReference || h.policyId,
        hasExplicitId: Boolean(h.hasExplicitId),
        hasExplicitTitle: Boolean(h.hasExplicitTitle !== false),
        hasExplicitResolution: Boolean(h.hasExplicitResolution),
        hasExplicitCategory: Boolean(h.hasExplicitCategory),
        name: h.policyName || 'Policy Clause',
        title: h.policyName || 'Policy Clause',
        category: h.category || null,
        sourceDocName: h.sourceDocName || 'Policy Document',
        pageOrRow: h.pageOrRow || 'Verified Section',
        sourceLocations: h.sourceLocations || [],
        sourceDocumentId: h.sourceDocumentId,
        resolution: h.hasExplicitResolution ? h.resolution : null,
        conditions: h.conditions || '',
        exceptions: h.exceptions || '',
        whyApplies: h.whyApplies || 'Policy analysis loaded from local verification log.',
        evidence: h.evidence || '',
        fullEvidence: h.fullEvidence || h.evidence || '',
        exceptionTriggered: h.exceptionTriggered,
        matchedExceptions: h.matchedExceptions || []
      } : null
    };

    if (ticketSubjectInput) ticketSubjectInput.value = h.ticketTitle || '';
    if (ticketDescInput) ticketDescInput.value = h.ticketDescription || '';
    if (charCounter) charCounter.textContent = `${(h.ticketDescription || '').length} characters`;

    currentTicket = {
      source: h.ticketSource || 'saved_history',
      title: h.ticketTitle,
      description: h.ticketDescription
    };

    switchView('home');
    goToStep(4);
    renderResult(currentTicket, fakeResult);
    if (resultCard) {
      resultCard.style.display = 'block';
      resultCard.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Initialize
  loadPoliciesFromStorage().then(() => {
    refreshHomeActivity();
    updateTicketPreview();
    renderHomeDocsList();
  });
})();

