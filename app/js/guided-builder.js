/**
 * Policy Lookup — Configurable Guided Ticket Builder
 * 
 * Provides a structured, multi-step intake flow inspired by customer-support
 * interfaces (e.g., Swiggy, modern helpdesks).
 * 
 * Architecture:
 * - Category tree and questions are 100% data-driven and configurable.
 * - Supports "Other" write-in on all questions.
 * - Allows users to skip optional fields without blocking.
 * - Assembles a normalized ticket draft that is FULLY EDITABLE before analysis.
 */

const GuidedTicketBuilder = (function () {
  'use strict';

  // Configurable Category & Question Hierarchy
  const DEFAULT_GUIDED_CONFIG = {
    categories: [
      {
        id: 'access_auth',
        name: 'Access & Authentication',
        icon: '🔑',
        description: 'Passwords, account lockouts, logins, MFA & security credentials',
        subcategories: [
          {
            id: 'lockout',
            name: 'Account Lockout',
            description: 'User profile locked after failed logon attempts',
            questions: [
              {
                id: 'lockout_error',
                question: 'What error message or behavior is displayed?',
                options: [
                  'Account has been locked. Please contact your administrator.',
                  'The user account is frozen due to excessive failed attempts.',
                  'Password expired or invalid credentials.',
                  'Other'
                ],
                optional: false
              },
              {
                id: 'user_role',
                question: 'What is the user employment classification?',
                options: [
                  'Regular Full-Time Employee',
                  'External Contractor / Consultant (requires vendor manager change ticket)',
                  'VIP / Executive Leadership',
                  'Other'
                ],
                optional: true
              },
              {
                id: 'identity_verified',
                question: 'Has caller / user identity verification been confirmed?',
                options: [
                  'Yes - Verified via manager confirmation / employee ID badge',
                  'Pending identity verification',
                  'Not yet verified',
                  'Other'
                ],
                optional: true
              }
            ]
          },
          {
            id: 'password_reset',
            name: 'Password Reset',
            description: 'Forgotten password, expired credentials, or reset link request',
            questions: [
              {
                id: 'reset_channel',
                question: 'Has self-service reset (SSPR) been attempted?',
                options: [
                  'Tried SSPR but SMS / secondary email is inaccessible',
                  'SSPR was never enrolled or configured',
                  'Temporary password expired before first login',
                  'Other'
                ],
                optional: true
              },
              {
                id: 'vip_status',
                question: 'Does the account belong to an executive / VIP?',
                options: [
                  'Yes - VIP executive (requires verbal phone verification per policy)',
                  'No - Standard domain user account',
                  'Other'
                ],
                optional: true
              }
            ]
          },
          {
            id: 'mfa_token',
            name: 'MFA & Authenticator',
            description: 'Authenticator app, phone change, or verification code issues',
            questions: [
              {
                id: 'mfa_issue',
                question: 'What MFA issue is preventing login?',
                options: [
                  'Lost, replaced, or upgraded mobile phone',
                  'Verification SMS or push notification not received',
                  'Hardware token out of sync',
                  'Other'
                ],
                optional: true
              }
            ]
          }
        ]
      },
      {
        id: 'network_vpn',
        name: 'Network & Remote Access',
        icon: '🌐',
        description: 'VPN tunnels, Wi-Fi connections, remote gateways & firewalls',
        subcategories: [
          {
            id: 'vpn_failure',
            name: 'GlobalProtect / Corporate VPN',
            description: 'VPN tunnel unable to connect or authenticating fails',
            questions: [
              {
                id: 'device_type',
                question: 'What type of device is attempting the connection?',
                options: [
                  'Corporate-managed laptop / desktop asset',
                  'Personal device / BYOD (Bring Your Own Device)',
                  'Mobile / Tablet device',
                  'Other'
                ],
                optional: true
              },
              {
                id: 'contractor_check',
                question: 'Is the user an external contractor or third-party vendor?',
                options: [
                  'Yes - Contractor (requires approved change ticket from vendor manager)',
                  'No - Internal company staff',
                  'Other'
                ],
                optional: true
              },
              {
                id: 'internet_status',
                question: 'Are general websites (e.g. google.com) reachable outside the VPN?',
                options: [
                  'Yes - Local internet is working; only VPN fails',
                  'No - Entire network / Wi-Fi connection is disconnected',
                  'Unsure'
                ],
                optional: true
              }
            ]
          },
          {
            id: 'wifi_access',
            name: 'Office Wi-Fi & LAN',
            description: 'Local office network, 802.1X certificate, or ethernet port',
            questions: [
              {
                id: 'office_location',
                question: 'Which office facility is affected?',
                options: [
                  'Headquarters / Main Campus',
                  'Regional Branch Office',
                  'Remote / Home Office',
                  'Other'
                ],
                optional: true
              }
            ]
          }
        ]
      },
      {
        id: 'hardware_device',
        name: 'Hardware & Workstation',
        icon: '💻',
        description: 'Crashes, blue screens, monitors, printers & computer assets',
        subcategories: [
          {
            id: 'bsod_crash',
            name: 'System Crash & Blue Screen (BSOD)',
            description: 'Kernel panic, stop error code, or sudden restart loop',
            questions: [
              {
                id: 'crash_timing',
                question: 'When does the crash occur?',
                options: [
                  'Immediately during boot before login',
                  'When opening a specific software application',
                  'Intermittently throughout the workday',
                  'Other'
                ],
                optional: true
              }
            ]
          },
          {
            id: 'printer_scanner',
            name: 'Printers & Peripherals',
            description: 'Network printer offline, paper jams, or driver errors',
            questions: [
              {
                id: 'printer_status',
                question: 'What is the printer behavior?',
                options: [
                  'Spooler service error or queue stuck',
                  'Printer displays offline status',
                  'Hardware paper jam / toner empty',
                  'Other'
                ],
                optional: true
              }
            ]
          }
        ]
      },
      {
        id: 'order_operations',
        name: 'Order & Service Operations',
        icon: '📦',
        description: 'Customer order delivery, cancellations, refunds & replacements',
        subcategories: [
          {
            id: 'delivery_delay',
            name: 'Delivery Delay / Missing Shipment',
            description: 'Item past estimated arrival or marked delivered without receipt',
            questions: [
              {
                id: 'tracking_state',
                question: 'What does the tracking status indicate?',
                options: [
                  'Status shows In-Transit but delivery time has elapsed',
                  'Status shows Delivered but customer has not received package',
                  'Tracking stuck at distribution facility',
                  'Other'
                ],
                optional: true
              },
              {
                id: 'elapsed_window',
                question: 'Has the guaranteed delivery window elapsed by over 30 minutes?',
                options: [
                  'Yes - Over 30 minutes overdue',
                  'No - Under 30 minutes',
                  'Unsure / No window provided'
                ],
                optional: true
              }
            ]
          },
          {
            id: 'item_defect',
            name: 'Damaged or Missing Item',
            description: 'Product arrived defective, damaged, or items missing from package',
            questions: [
              {
                id: 'defect_type',
                question: 'What is the specific issue with the package?',
                options: [
                  'One or more ordered items were omitted from the package',
                  'Product package arrived visibly damaged / broken seal',
                  'Wrong product delivered entirely',
                  'Other'
                ],
                optional: true
              }
            ]
          }
        ]
      },
      {
        id: 'custom_other',
        name: 'Other / General Inquiry',
        icon: '📝',
        description: 'General support inquiry, policy question, or unlisted problem',
        subcategories: [
          {
            id: 'general_tech',
            name: 'General Policy Lookup',
            description: 'Search for standard operating procedures or organizational guidelines',
            questions: [
              {
                id: 'general_nature',
                question: 'What is the primary nature of this ticket?',
                options: [
                  'Standard technical inquiry',
                  'Exception or approval request',
                  'Compliance or security check',
                  'Other'
                ],
                optional: true
              }
            ]
          }
        ]
      }
    ]
  };

  let activeConfig = JSON.parse(JSON.stringify(DEFAULT_GUIDED_CONFIG));

  // Current builder state
  let state = {
    selectedCategory: null,
    selectedSubcategory: null,
    answers: {},
    ticketId: '',
    urgency: 'Medium',
    customNotes: '',
    conversationText: ''
  };

  function setCategoryTree(newConfig) {
    if (newConfig && Array.isArray(newConfig.categories)) {
      activeConfig = JSON.parse(JSON.stringify(newConfig));
    }
  }

  function resetState() {
    state = {
      selectedCategory: null,
      selectedSubcategory: null,
      answers: {},
      ticketId: '',
      urgency: 'Medium',
      customNotes: '',
      conversationText: ''
    };
  }

  function getCategories() {
    return activeConfig.categories;
  }

  function selectCategory(categoryId) {
    const cat = activeConfig.categories.find(c => c.id === categoryId);
    if (!cat) return null;
    state.selectedCategory = cat;
    state.selectedSubcategory = null;
    state.answers = {};
    return cat;
  }

  function selectSubcategory(subcategoryId) {
    if (!state.selectedCategory) return null;
    const sub = state.selectedCategory.subcategories.find(s => s.id === subcategoryId);
    if (!sub) return null;
    state.selectedSubcategory = sub;
    state.answers = {};
    return sub;
  }

  function setAnswer(questionId, answerValue, isOther = false, otherText = '') {
    const finalAnswer = isOther && otherText.trim()
      ? `Other: ${otherText.trim()}`
      : answerValue;
    state.answers[questionId] = finalAnswer;
  }

  function setIdentifiers(ticketId, urgency) {
    if (typeof ticketId === 'string') state.ticketId = ticketId.trim();
    if (typeof urgency === 'string') state.urgency = urgency.trim();
  }

  function setNotes(notes, convText) {
    if (typeof notes === 'string') state.customNotes = notes.trim();
    if (typeof convText === 'string') state.conversationText = convText.trim();
  }

  function getState() {
    return { ...state };
  }

  /**
   * Assembles a structured NormalizedTicket object from guided selections
   */
  function assembleTicket() {
    const catName = state.selectedCategory ? state.selectedCategory.name : 'Uncategorized';
    const subName = state.selectedSubcategory ? state.selectedSubcategory.name : 'General Issue';
    const id = state.ticketId || null;

    // Build question-answer list
    const guidedAnswers = [];
    if (state.selectedSubcategory && Array.isArray(state.selectedSubcategory.questions)) {
      state.selectedSubcategory.questions.forEach(q => {
        const ans = state.answers[q.id];
        if (ans) {
          guidedAnswers.push({
            id: q.id,
            question: q.question,
            answer: ans,
            category: catName
          });
        }
      });
    }

    // Compose title
    const title = id
      ? `[${id}] ${subName}`
      : `${catName} — ${subName}`;

    // Compose description
    const descParts = [];
    descParts.push(`Category: ${catName} / ${subName}`);
    if (state.urgency) descParts.push(`Urgency Level: ${state.urgency}`);

    if (guidedAnswers.length > 0) {
      descParts.push('\nIntake Questions & Responses:');
      guidedAnswers.forEach(ga => {
        descParts.push(`• ${ga.question}\n  → ${ga.answer}`);
      });
    }

    if (state.customNotes) {
      descParts.push(`\nProblem Description:\n${state.customNotes}`);
    }

    let parsedConv = null;
    if (state.conversationText && typeof ConversationParser !== 'undefined') {
      parsedConv = ConversationParser.parseConversation(state.conversationText);
      descParts.push(`\nAttached Support Conversation:\n${state.conversationText}`);
    }

    const fullDescription = descParts.join('\n').trim();

    const provenance = {
      title: 'guided_builder_assembly',
      category: 'guided_builder_category',
      subcategory: 'guided_builder_subcategory',
      description: 'guided_builder_synthesis'
    };
    if (id) provenance.ticketId = 'user_guided_field';
    if (state.customNotes) provenance.customNotes = 'user_free_text';
    if (state.conversationText) provenance.conversation = 'user_pasted_transcript';

    if (typeof TicketModel !== 'undefined') {
      return TicketModel.createNormalizedTicket({
        source: 'guided_builder',
        ticketId: id,
        title,
        description: fullDescription,
        category: catName,
        subcategory: subName,
        conversation: parsedConv,
        guidedAnswers,
        provenance,
        rawEvidence: fullDescription,
        retrievalStatus: {
          status: 'GUIDED',
          platform: 'guided_builder',
          fieldsRetrieved: ['category', 'subcategory', 'guidedAnswers', ...(id ? ['ticketId'] : [])],
          isIncomplete: false
        }
      });
    }

    return {
      source: 'guided_builder',
      ticketId: id,
      title,
      description: fullDescription,
      category: catName,
      subcategory: subName,
      guidedAnswers,
      rawEvidence: fullDescription
    };
  }

  return {
    getCategories,
    selectCategory,
    selectSubcategory,
    setAnswer,
    setIdentifiers,
    setNotes,
    getState,
    resetState,
    assembleTicket,
    setCategoryTree,
    DEFAULT_GUIDED_CONFIG
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuidedTicketBuilder;
}
