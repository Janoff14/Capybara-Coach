const SAMPLE_DOCUMENT = `
Working Memory & The Central Executive

Overview
Working memory is the short-term system that keeps information active while we solve a problem, read a sentence, or follow a chain of instructions. It is not just a passive storage shelf. The system allocates attention, combines information from different sources, and keeps goals in view while distracting inputs compete for the same limited mental space.

The Central Executive
The central executive is the control system inside working memory. It does not store much content on its own. Instead, it directs attention, shifts between tasks, selects strategies, and coordinates the other subsystems when more than one stream of information has to stay active. Researchers often describe it as the manager that decides what deserves immediate processing and what can be ignored.

The Phonological Loop
The phonological loop supports speech-based material. It keeps verbal information alive for a short time and refreshes it through rehearsal. This is why repeating a phone number can preserve it long enough to use it. The loop is helpful, but it is fragile: competing speech or too much verbal material can crowd it quickly.

The Visuospatial Sketchpad
The visuospatial sketchpad maintains visual patterns, spatial relations, and mental images. It helps when someone rotates a diagram in their head, remembers the position of objects on a map, or tracks movement through a scene. Like the phonological loop, it is limited. Strong visual detail can interfere with other visual-spatial tasks if too much must be held at once.

The Episodic Buffer
The episodic buffer integrates information from multiple systems into a single episode-like representation. It helps connect verbal material, visual material, and long-term knowledge so that a person can understand a meaningful scene instead of handling isolated fragments. The buffer matters because comprehension often depends on combining sources, not just preserving them independently.
`.trim();

const SCREEN_ASSETS = {
  sessionCover: "https://www.figma.com/api/mcp/asset/8d610ebf-1585-4852-8936-b2debd9a40c1",
  readingHero: "https://www.figma.com/api/mcp/asset/76071d83-626c-4c77-8412-b4036d69b8c4",
  recallDeck: "https://www.figma.com/api/mcp/asset/022c5f88-57f6-4304-add2-d372ac40434c",
};

const USER = {
  name: "Alex Rivera",
  tier: "Free Tier",
};

const stopWords = new Set([
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an",
  "and", "any", "are", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "could", "did", "do", "does",
  "doing", "down", "during", "each", "few", "for", "from", "further", "had",
  "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
  "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of",
  "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out",
  "over", "own", "same", "she", "should", "so", "some", "such", "than", "that",
  "the", "their", "theirs", "them", "themselves", "then", "there", "these",
  "they", "this", "those", "through", "to", "too", "under", "until", "up", "very",
  "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
  "why", "with", "would", "you", "your", "yours", "yourself", "yourselves",
]);

const state = {
  page: "dashboard",
  busy: false,
  statusMessage: "Connecting to the backend...",
  statusTone: "neutral",
  documents: [],
  notes: [],
  sessions: [],
  sessionDetails: {},
  source: null,
  selectedSectionId: null,
  recallMode: "assisted",
  currentSession: null,
  currentNote: null,
  searchQuery: "",
  importModalOpen: false,
  importMode: "file",
  importForm: {
    title: "",
    subject: "",
    manualText: "",
    file: null,
    fileName: "",
  },
  reflectionText: "",
  recallText: "",
  readingBaseMs: 0,
  readingStartedAt: null,
  recallBaseMs: 0,
  recallStartedAt: null,
  recordedBlob: null,
  recordingActive: false,
  recordingSupported: Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
  reviewOpen: {},
};

const refs = {};
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let tickHandle = null;
let statusHideHandle = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  refs.app = document.getElementById("app");
  refs.fileInput = document.getElementById("hiddenFileInput");

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  refs.fileInput.addEventListener("change", handleFilePicked);

  startTicker();
  await bootstrap();
}

async function bootstrap() {
  setBusy(true, "Loading documents, notes, and sessions...");
  try {
    await refreshCollections({ preserveSource: false });
    state.page = state.documents.length || state.sessions.length ? "dashboard" : "library";
    applyHashStateOverride();
    setStatus("Connected to the Capybara Coach backend.", "positive");
  } catch (error) {
    setStatus(error.message || "Could not load data from the backend.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

function startTicker() {
  tickHandle = window.setInterval(() => {
    syncTimers();
  }, 300);
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.importModalOpen) {
    state.importModalOpen = false;
    renderApp();
  }
}

async function handleClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) {
    return;
  }

  const action = actionNode.dataset.action;
  const value = actionNode.dataset.value || "";

  switch (action) {
    case "nav-dashboard":
      state.page = "dashboard";
      renderApp();
      break;
    case "nav-library":
      state.page = "library";
      renderApp();
      break;
    case "open-import":
      openImportModal();
      break;
    case "close-import":
      state.importModalOpen = false;
      renderApp();
      break;
    case "toggle-import-mode":
      state.importMode = state.importMode === "file" ? "text" : "file";
      renderApp();
      break;
    case "open-file-picker":
      refs.fileInput.click();
      break;
    case "load-sample":
      await handleLoadSample();
      break;
    case "import-submit":
      await submitImport();
      break;
    case "open-session-setup":
      if (!state.source && !state.documents.length) {
        openImportModal();
      } else if (value) {
        await openSessionSetup(value);
      } else {
        await openSessionSetup(state.source?.id || state.documents[0]?.id || "");
      }
      break;
    case "open-continue-session":
      await handleContinueSession();
      break;
    case "select-domain":
      await openDomainDocument(value);
      break;
    case "open-note":
      await openSavedNote(value);
      break;
    case "select-section":
      state.selectedSectionId = value;
      renderApp();
      break;
    case "set-recall-mode":
      state.recallMode = value;
      renderApp();
      break;
    case "launch-session":
      await createSessionFromSelection();
      break;
    case "advance-to-recall":
      advanceToRecall();
      break;
    case "exit-session":
      stopReadingClock();
      stopRecallClock();
      cleanupRecorder();
      state.page = "sessionSetup";
      setStatus("Returned to session setup.", "neutral");
      renderApp();
      break;
    case "toggle-recording":
      await toggleRecording();
      break;
    case "evaluate-recall":
      await evaluateRecallAttempt();
      break;
    case "retry-recall":
      retryRecall();
      break;
    case "generate-note":
      await requestGeneratedNote();
      break;
    case "save-note":
      state.page = "library";
      setStatus("The note is already stored in the library.", "positive");
      renderApp();
      break;
    case "retry-from-note":
      retryFromSavedSession();
      break;
    case "reveal-question":
      state.reviewOpen[value] = !state.reviewOpen[value];
      renderApp();
      break;
    case "generate-more-questions":
      generateMoreQuestions();
      break;
    case "save-template":
      setStatus("Template saving is coming later. The current setup is preserved in this session.", "neutral");
      renderApp();
      break;
    case "practice-weak-points":
    case "start-prompt":
    case "quick-quiz":
      if (state.source || state.documents.length) {
        openSessionSetup(state.source?.id || state.documents[0].id);
      } else {
        openImportModal();
      }
      break;
    case "scroll-top":
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    default:
      break;
  }
}

function handleInput(event) {
  const fieldNode = event.target.closest("[data-field]");
  if (!fieldNode) {
    return;
  }

  const field = fieldNode.dataset.field;
  const value = fieldNode.value;

  switch (field) {
    case "search":
      state.searchQuery = value.trim().toLowerCase();
      rerenderKeepingFocus(fieldNode);
      break;
    case "import-title":
      state.importForm.title = value;
      break;
    case "import-subject":
      state.importForm.subject = value;
      break;
    case "import-text":
      state.importForm.manualText = value;
      break;
    case "reflection":
      state.reflectionText = value;
      break;
    case "recall":
      state.recallText = value;
      syncRecallLive();
      break;
    default:
      break;
  }
}

function rerenderKeepingFocus(input) {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const field = input.dataset.field;
  renderApp();
  const nextInput = refs.app.querySelector(`[data-field="${field}"]`);
  if (nextInput) {
    nextInput.focus();
    if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
      nextInput.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

function renderApp() {
  document.body.dataset.page = state.page;
  document.body.dataset.layout = state.page === "reading" ? "focus" : "app";

  refs.app.innerHTML = `
    ${renderSidebar()}
    <div class="app-main ${state.page === "reading" ? "app-main--focus" : ""}">
      ${renderTopbar()}
      <main class="page-stage">
        ${renderPage()}
      </main>
    </div>
    ${renderModal()}
    ${renderToast()}
  `;

  bindDropzone();
  syncTimers();
  syncRecallLive();
}

function renderSidebar() {
  if (state.page === "reading") {
    return "";
  }

  const active = state.page === "dashboard" ? "dashboard" : "library";
  const subtitle = state.page === "dashboard" || state.importModalOpen ? "ACTIVE RECALL" : "LEARNING PLATFORM";
  const ctaLabel = state.page === "dashboard" ? "Start Session" : "Start Review";

  return `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <div class="brand-mark">${icon("book")}</div>
        <div>
          <div class="brand-title">Capybara Coach</div>
          <div class="brand-subtitle">${subtitle}</div>
        </div>
      </div>

      <nav class="sidebar__nav" aria-label="Primary">
        ${renderSidebarLink("dashboard", "Dashboard", "dashboard", active)}
        ${renderSidebarLink("library", "Library", "library", active)}
        ${renderSidebarLink("profile", "Profile", "profile", active)}
        ${renderSidebarLink("settings", "Settings", "settings", active)}
      </nav>

      <div class="sidebar__spacer"></div>

      <button class="sidebar__cta" data-action="open-session-setup">${icon("bolt")}<span>${ctaLabel}</span></button>

      <div class="sidebar__footer">
        <button class="sidebar__footer-link" type="button">${icon("settings")}<span>Settings</span></button>
        <button class="sidebar__footer-link" type="button">${icon("help")}<span>Help</span></button>
      </div>
    </aside>
  `;
}

function renderSidebarLink(name, label, iconName, active) {
  const isActive = active === name;
  const action = name === "dashboard" ? "nav-dashboard" : name === "library" ? "nav-library" : "";
  return `
    <button class="sidebar-link ${isActive ? "sidebar-link--active" : ""}" type="button" ${action ? `data-action="${action}"` : ""}>
      <span class="icon-wrap">${icon(iconName)}</span>
      <span>${label}</span>
    </button>
  `;
}

function renderTopbar() {
  switch (state.page) {
    case "dashboard":
      return renderStandardTopbar({
        placeholder: "Search your library...",
        searchWidth: "288px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("history")}
          </div>
          <div class="topbar-divider"></div>
          <button class="topbar-pill topbar-pill--green" data-action="open-import">New Deck</button>
          <div class="topbar-user">
            <div class="topbar-user__meta">
              <strong>${USER.name}</strong>
              <span>${USER.tier}</span>
            </div>
            ${renderAvatar()}
          </div>
        `,
      });
    case "library":
      return renderStandardTopbar({
        placeholder: "Search library...",
        searchWidth: "288px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("history")}
          </div>
          <div class="topbar-divider"></div>
          <button class="topbar-pill topbar-pill--green" data-action="open-import">New Deck</button>
          <div class="topbar-user">
            <div class="topbar-user__meta">
              <strong>Library</strong>
              <span>Active Learning</span>
            </div>
            ${renderAvatar()}
          </div>
        `,
      });
    case "sessionSetup":
      return renderStandardTopbar({
        placeholder: "Search your library...",
        searchWidth: "384px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("help")}
          </div>
          <button class="topbar-pill topbar-pill--green" data-action="open-import">New Deck</button>
          ${renderAvatar()}
        `,
      });
    case "recall":
      return renderStandardTopbar({
        placeholder: "Search concepts...",
        searchWidth: "384px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("help")}
          </div>
          <button class="topbar-pill topbar-pill--green" data-action="open-import">New Deck</button>
          ${renderAvatar()}
        `,
      });
    case "feedback":
      return renderStandardTopbar({
        placeholder: "Search your decks...",
        searchWidth: "384px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("help")}
          </div>
          <button class="topbar-pill" data-action="open-import">New Deck</button>
          ${renderAvatar()}
        `,
      });
    case "note":
      return renderStandardTopbar({
        placeholder: "Search your knowledge base...",
        searchWidth: "384px",
        right: `
          <div class="topbar-icons">
            ${iconButton("bell")}
            ${iconButton("help")}
          </div>
          <button class="topbar-pill" data-action="open-import">New Deck</button>
          ${renderAvatar()}
        `,
      });
    case "reading":
      return renderReadingTopbar();
    default:
      return "";
  }
}

function renderStandardTopbar({ placeholder, right, searchWidth = "288px" }) {
  return `
    <header class="topbar">
      <label class="search-pill" style="--search-width:${searchWidth}">
        ${icon("search")}
        <input
          type="search"
          data-field="search"
          value="${escapeHtml(state.searchQuery)}"
          placeholder="${escapeHtml(placeholder)}"
          autocomplete="off"
        />
      </label>
      <div class="topbar-right">${right}</div>
    </header>
  `;
}

function renderReadingTopbar() {
  const progress = getReadingProgress();
  return `
    <header class="topbar topbar--reading">
      <div class="reading-head reading-head--left">
        <button class="reading-link" data-action="exit-session">${icon("x")}<span>EXIT SESSION</span></button>
        <div class="topbar-divider topbar-divider--soft"></div>
        <div class="reading-deck-meta">
          <span>CURRENT DECK</span>
          <strong>${escapeHtml(state.source?.title || "Active Session")}</strong>
        </div>
      </div>

      <div class="reading-progress">
        <div class="reading-progress__labels">
          <span>READING PROGRESS</span>
          <span>${progress.label}</span>
        </div>
        <div class="progress-track progress-track--thin">
          <div class="progress-track__fill" style="width:${progress.percent}%"></div>
        </div>
      </div>

      <div class="reading-head reading-head--right">
        <div class="reading-chip">
          ${icon("timer")}
          <strong data-live="reading-topbar-time">${formatDuration(getReadingElapsedMs())}</strong>
        </div>
        ${iconButton("settings")}
        ${renderAvatar("CC")}
      </div>
    </header>
  `;
}

function renderPage() {
  switch (state.page) {
    case "dashboard":
      return renderDashboardPage();
    case "library":
      return renderLibraryPage();
    case "sessionSetup":
      return renderSessionSetupPage();
    case "reading":
      return renderReadingPage();
    case "recall":
      return renderRecallPage();
    case "feedback":
      return renderFeedbackPage();
    case "note":
      return renderNotePage();
    default:
      return "";
  }
}

function renderDashboardPage() {
  const primary = getPrimarySession();
  const weakConcepts = getWeakConcepts();
  const streak = getStreakModel();
  const stats = getDashboardStats();
  const continueModel = getContinueModel(primary);

  return `
    <section class="screen dashboard-screen">
      <div class="screen-heading">
        <span class="eyebrow">WELCOME BACK, ALEX</span>
        <h1>Focus on what matters.</h1>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-main">
          <div class="section-row">
            <h2>Continue Learning</h2>
            <button class="text-link" data-action="nav-library">View All Documents</button>
          </div>

          ${continueModel
            ? `
              <article class="panel panel--xl continue-card">
                <div class="continue-card__header">
                  <div>
                    <div class="meta-inline">
                      <span class="topic-badge">${escapeHtml(continueModel.topic)}</span>
                      <span class="dot-divider"></span>
                      <span>${escapeHtml(continueModel.modifiedLabel)}</span>
                    </div>
                    <h3>${escapeHtml(continueModel.title)}</h3>
                    <p>${escapeHtml(continueModel.subtitle)}</p>
                  </div>
                  <div class="score-burst">
                    <strong>${continueModel.mastered}</strong>
                    <span>%</span>
                    <small>MASTERED</small>
                  </div>
                </div>
                <div class="progress-row">
                  <div class="progress-meta">
                    <span>Progress</span>
                    <strong>${continueModel.progressLabel}</strong>
                  </div>
                  <div class="progress-track">
                    <div class="progress-track__fill" style="width:${continueModel.mastered}%"></div>
                  </div>
                </div>
                <button class="button button--solid" data-action="open-continue-session">${icon("play")}Resume Session</button>
              </article>
            `
            : renderEmptyPanel("No decks yet", "Import your first deck to unlock the dashboard flow.", true)}

          <div class="dashboard-stats">
            <article class="panel panel--soft stat-card">
              <div class="stat-card__icon">${icon("timer")}</div>
              <strong>${escapeHtml(stats.focusHours)}</strong>
              <span>DAILY AVG. FOCUS</span>
            </article>
            <article class="panel panel--soft stat-card">
              <div class="stat-card__icon">${icon("bolt")}</div>
              <strong>${escapeHtml(stats.totalRecalls)}</strong>
              <span>TOTAL ACTIVE RECALLS</span>
            </article>
          </div>
        </div>

        <aside class="dashboard-side">
          <article class="panel daily-streak-card">
            <div class="panel-title-row">
              <h3>DAILY STREAK</h3>
              <span class="panel-glyph panel-glyph--gold">${icon("flame")}</span>
            </div>
            <div class="daily-streak-card__value">${streak.count}</div>
            <p>Days of consistent growth</p>
            <div class="streak-days">
              ${streak.days
                .map(
                  (day) => `
                    <div class="streak-day ${day.active ? "streak-day--active" : ""}">
                      <span>${day.label}</span>
                      <i></i>
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>

          <article class="panel weak-panel">
            <div class="panel-title-row">
              <h3>WEAK CONCEPTS</h3>
            </div>
            <div class="weak-list">
              ${weakConcepts
                .map(
                  (concept) => `
                    <div class="weak-item">
                      <div class="weak-item__title-row">
                        <strong>${escapeHtml(concept.title)}</strong>
                        <span class="weak-item__badge weak-item__badge--${concept.priority}">${escapeHtml(concept.priority)}</span>
                      </div>
                      <div class="weak-item__bar">
                        <div class="weak-item__fill weak-item__fill--${concept.priority}" style="width:${concept.accuracy}%"></div>
                      </div>
                      <span>Recall accuracy: ${concept.accuracy}%</span>
                    </div>
                  `
                )
                .join("")}
            </div>
            <button class="button button--ghost" data-action="practice-weak-points">Practice Weak Points</button>
          </article>

          <article class="panel panel--accent coach-card">
            <div class="panel-title-row">
              <span class="panel-glyph">${icon("bulb")}</span>
              <h3>COACH INSIGHT</h3>
            </div>
            <p>${escapeHtml(getCoachInsight(weakConcepts))}</p>
          </article>
        </aside>
      </div>

      <button class="floating-pill" data-action="open-session-setup">${icon("plus")}New Study Session</button>
    </section>
  `;
}

function renderLibraryPage() {
  const domains = getDomains();
  const recentNotes = getRecentNotes();
  const weakConcepts = getWeakConcepts();
  const weekly = getWeeklyMasteryBars();

  return `
    <section class="screen library-screen">
      <div class="library-grid">
        <div class="library-main">
          <section class="screen-block">
            <div class="section-row">
              <div>
                <span class="eyebrow eyebrow--green">KNOWLEDGE DOMAINS</span>
                <h2>Subject Library</h2>
              </div>
              <button class="text-link">View All Topics</button>
            </div>

            <div class="domain-grid">
              ${domains.slice(0, 2).map(renderDomainCard).join("")}
              <button class="domain-card domain-card--empty" data-action="open-import">
                <span class="domain-card__plus">${icon("plus")}</span>
                <strong>New Domain</strong>
              </button>
            </div>
          </section>

          <section class="screen-block">
            <div>
              <span class="eyebrow eyebrow--green">WORKING MEMORY</span>
              <h2>Recent Notes</h2>
            </div>
            <div class="note-row-list">
              ${recentNotes.length
                ? recentNotes.map(renderRecentNoteRow).join("")
                : renderEmptyPanel("No notes yet", "Complete a recall and generate a note to populate this space.", false)}
            </div>
          </section>
        </div>

        <aside class="library-side">
          <article class="panel panel--soft review-panel">
            <div class="panel-title-row">
              <span class="panel-glyph panel-glyph--warning">${icon("warning")}</span>
              <h3>Review Weak Concepts</h3>
            </div>
            <p>You have <strong>${weakConcepts.length}</strong> concepts that fall below your target mastery threshold of 70%. Focus here to maximize retention.</p>
            <div class="review-panel__chips">
              ${weakConcepts
                .map(
                  (concept) => `
                    <div class="concept-chip-row">
                      <span>${escapeHtml(concept.title)}</span>
                      <strong class="tone-${concept.priority}">${concept.accuracy}%</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
            <button class="button button--dark" data-action="start-prompt">${icon("sparkles")}Start Prompt</button>
            <button class="button button--soft" data-action="quick-quiz">${icon("bolt")}Quick Quiz</button>
          </article>

          <article class="panel mastery-panel">
            <div class="panel-title-row">
              <span class="panel-glyph panel-glyph--green">${icon("chart")}</span>
              <h3>Weekly Mastery</h3>
            </div>
            <div class="mastery-bars">
              ${weekly
                .map(
                  (bar) => `
                    <span class="mastery-bar ${bar.active ? "mastery-bar--active" : ""}" style="height:${bar.height}px"></span>
                  `
                )
                .join("")}
            </div>
            <span class="mastery-label">LAST 7 DAYS</span>
          </article>
        </aside>
      </div>
    </section>
  `;
}

function renderSessionSetupPage() {
  if (!state.source) {
    return `
      <section class="screen setup-screen">
        ${renderEmptyPanel("No document loaded", "Import a PDF or use the sample deck to create the first session.", true)}
      </section>
    `;
  }

  const summary = getSessionSummaryModel();

  return `
    <section class="screen setup-screen">
      <div class="breadcrumbs">
        <span>LIBRARY</span>
        ${icon("chevron-right")}
        <strong>SESSION SETUP</strong>
      </div>

      <div class="setup-grid">
        <aside class="setup-left">
          <article class="setup-cover-card">
            <div class="setup-cover-card__art" style="background-image:url('${SCREEN_ASSETS.sessionCover}')">
              <span class="topic-badge">ACADEMIC</span>
              <h2>${escapeHtml(state.source.title)}</h2>
            </div>
          </article>

          <article class="panel panel--soft setup-meta-card">
            <div class="setup-meta-block">
              <span class="eyebrow">ESTIMATED LOAD</span>
              <div class="setup-stat-line"><strong>${summary.readMinutes}</strong><span>min reading</span></div>
            </div>
            <div class="setup-meta-block">
              <span class="eyebrow">DIFFICULTY PROFILE</span>
              <div class="difficulty-bars">
                ${Array.from({ length: 5 }, (_, index) => `<span class="${index < summary.difficultyLevel ? "active" : ""}"></span>`).join("")}
              </div>
              <p>${escapeHtml(summary.difficultyLabel)}</p>
            </div>
            <div class="meta-footer-row">
              <span>Last accessed</span>
              <strong>${escapeHtml(summary.lastAccessed)}</strong>
            </div>
          </article>
        </aside>

        <div class="setup-center">
          <article class="panel panel--white selection-panel">
            <div class="section-copy">
              <h2>Selection Range</h2>
              <p>Select specific chapters or pages to focus your session.</p>
            </div>
            <div class="selection-list">
              ${state.source.sections
                .map(
                  (section) => `
                    <button class="selection-card ${section.id === state.selectedSectionId ? "selection-card--selected" : ""}" data-action="select-section" data-value="${section.id}">
                      <span class="selection-card__checkbox ${section.id === state.selectedSectionId ? "selection-card__checkbox--checked" : ""}">
                        ${section.id === state.selectedSectionId ? icon("check") : ""}
                      </span>
                      <div class="selection-card__body">
                        <div class="selection-card__title-row">
                          <strong>${escapeHtml(section.title)}</strong>
                          <span>${escapeHtml(section.pageLabel)}</span>
                        </div>
                        <p>${escapeHtml(section.excerpt)}</p>
                      </div>
                    </button>
                  `
                )
                .join("")}
            </div>
            <button class="add-range-link" type="button">${icon("plus")}Add Custom Page Range</button>
          </article>

          <article class="panel panel--white mode-panel">
            <h2>Recall Mode</h2>
            <div class="mode-grid">
              ${renderModeCard("assisted", "Assisted", "Hints provided. Best for initial learning and heavy concept building.", "target")}
              ${renderModeCard("strict", "Strict", "No hints. Timed responses. Maximum cognitive load for mastery.", "timer")}
            </div>
          </article>
        </div>

        <aside class="setup-right">
          <article class="panel panel--white summary-panel">
            <h2>Session Summary</h2>
            <div class="summary-stack">
              ${renderSummaryMetric("TOTAL CONCEPTS", summary.totalConcepts, "note")}
              ${renderSummaryMetric("PREDICTED QUESTIONS", summary.predictedQuestions, "question")}
              ${renderSummaryMetric("COMPLEXITY INDEX", summary.complexityIndex, "warning")}
            </div>
            <div class="summary-callout">
              ${icon("sparkles")}
              <p>Session is optimized for Interleaved Practice.</p>
            </div>
            <button class="button button--solid button--large" data-action="launch-session">Launch Session</button>
            <button class="summary-link" data-action="save-template">Save Setup as Template</button>
          </article>
        </aside>
      </div>
    </section>
  `;
}

function renderModeCard(mode, title, description, iconName) {
  const active = state.recallMode === mode;
  return `
    <button class="mode-card ${active ? "mode-card--active" : ""}" data-action="set-recall-mode" data-value="${mode}">
      <span class="mode-card__icon">${icon(iconName)}</span>
      <strong>${title}</strong>
      <p>${description}</p>
      ${active ? `<span class="mode-card__check">${icon("check")}</span>` : ""}
    </button>
  `;
}

function renderSummaryMetric(label, value, iconName) {
  return `
    <div class="summary-metric">
      <span class="summary-metric__icon">${icon(iconName)}</span>
      <div>
        <span>${label}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </div>
    </div>
  `;
}

function renderReadingPage() {
  const section = getSelectedSection();
  const paragraphs = splitParagraphs(section?.text || state.source?.rawText || "");
  const outline = getReadingOutline(paragraphs);

  return `
    <section class="screen reading-screen">
      <aside class="reading-outline">
        <span class="eyebrow">ON THIS PAGE</span>
        ${outline.map((item, index) => `<div class="reading-outline__item ${index === 0 ? "reading-outline__item--active" : ""}"><i></i><span>${escapeHtml(item)}</span></div>`).join("")}
      </aside>

      <article class="reading-article">
        <header class="reading-hero" style="background-image:url('${SCREEN_ASSETS.readingHero}')">
          <div class="reading-hero__copy">
            <h1>${escapeHtml(state.source?.title || "Reading Session")}</h1>
            <p>${escapeHtml(section ? `${section.title} - ${section.pageLabel}` : "Reading Phase")}</p>
          </div>
        </header>

        <div class="reading-body">
          ${paragraphs
            .map((paragraph, index) => {
              if (index === 2) {
                return `
                  <p>${renderHighlightedText(paragraph, buildReadingHighlights())}</p>
                  ${renderReflectionCard()}
                `;
              }
              if (index === Math.max(0, paragraphs.length - 2)) {
                return `<blockquote class="reading-quote">"${escapeHtml(paragraph)}"</blockquote>`;
              }
              return `<p>${renderHighlightedText(paragraph, buildReadingHighlights())}</p>`;
            })
            .join("")}
        </div>

        <footer class="reading-footer">
          <div class="reading-footer__source">
            <span class="panel-glyph panel-glyph--soft">${icon("note")}</span>
            <div>
              <strong>Source: ${escapeHtml(deriveSubject(state.source))}</strong>
              <span>Last reviewed ${escapeHtml(formatRelativeTime(state.source?.updatedAt || new Date().toISOString()))}</span>
            </div>
          </div>
          <div class="reading-footer__actions">
            ${iconButton("share")}
            ${iconButton("bookmark")}
          </div>
        </footer>
      </article>

      <div class="reading-floating-actions">
        <button class="round-button" data-action="scroll-top">${icon("arrow-up")}</button>
        <button class="pill-button" data-action="advance-to-recall">
          <span>I'm Ready</span>
          ${icon("arrow-right")}
        </button>
      </div>
    </section>
  `;
}

function renderReflectionCard() {
  return `
    <section class="reflection-card">
      <span class="eyebrow eyebrow--green">REFLECTION PROMPT</span>
      <h3>How would you explain this section in your own words before recall?</h3>
      <div class="reflection-card__input">
        <textarea data-field="reflection" rows="4" placeholder="Type your thoughts here to solidify your learning...">${escapeHtml(state.reflectionText)}</textarea>
        <div class="reflection-card__autosave">AUTO-SAVING ${icon("dot")}</div>
      </div>
    </section>
  `;
}

function renderRecallPage() {
  const section = getSelectedSection();
  const concepts = section?.keyConcepts || [];
  const coverage = concepts.filter((concept) => containsPhrase(state.recallText, concept)).length;
  const timerText = formatDuration(getRecallElapsedMs());
  const actionLabel = state.recordingActive
    ? "Finish Recording"
    : state.recordedBlob || countWords(state.recallText) > 0
      ? "Evaluate Recall"
      : "Finish Recording";

  return `
    <section class="screen recall-screen">
      <div class="recall-progress-row">
        <div class="recall-progress-row__left">
          <span>RECALL MODE: ACTIVE</span>
          <div class="progress-track progress-track--mini">
            <div class="progress-track__fill" style="width:${concepts.length ? Math.round((coverage / concepts.length) * 100) : 0}%"></div>
          </div>
          <strong>${coverage.toString().padStart(2, "0")}/${concepts.length.toString().padStart(2, "0")} Concepts</strong>
        </div>
        <div class="recall-progress-row__right">
          ${icon("timer")}
          <strong data-live="recall-timer">${timerText}</strong>
        </div>
      </div>

      <div class="recall-grid">
        <div class="recall-left-column">
          <article class="panel panel--soft concept-panel">
            <span class="eyebrow">KEY CONCEPTS TO COVER</span>
            <div class="concept-list" data-live="concept-list">${renderRecallConcepts()}</div>
          </article>

          <article class="coach-tip-card">
            <span class="eyebrow eyebrow--gold">COACH TIP</span>
            <p>${escapeHtml(getRecallTip())}</p>
          </article>
        </div>

        <article class="recall-main">
          <div class="recall-main__copy">
            <h1>Explain what you read in your own words.</h1>
            <p>The document is hidden to maximize recall. Focus on the core narrative and mechanics.</p>
          </div>

          <button class="record-orb ${state.recordingActive ? "record-orb--active" : ""}" data-action="toggle-recording">
            <span class="record-orb__ring record-orb__ring--outer"></span>
            <span class="record-orb__ring record-orb__ring--inner"></span>
            <span class="record-orb__core">${icon("mic")}</span>
          </button>

          <div class="recall-timer-stack">
            <strong data-live="recall-center-timer">${timerText}</strong>
            <span class="listening-pill ${state.recordingActive ? "listening-pill--live" : ""}">
              <i></i>${state.recordingActive ? "LISTENING..." : state.recordedBlob ? "AUDIO READY" : "TYPED MODE"}
            </span>
          </div>

          <div class="recall-actions">
            <button class="button button--soft" data-action="exit-session">Cancel</button>
            <button class="button button--solid" data-action="evaluate-recall">${icon("check")}${actionLabel}</button>
          </div>
        </article>

        <aside class="recall-right-column">
          <article class="panel panel--soft waveform-card">
            <span class="eyebrow">WAVEFORM ANALYSIS</span>
            <div class="wave-bars">
              ${[32, 48, 80, 64, 96, 56, 40, 24].map((height) => `<span style="height:${height}px"></span>`).join("")}
            </div>
            <div class="transcript-card">
              <span>Transcription Live:</span>
              <textarea
                data-field="recall"
                rows="6"
                placeholder="${state.recordingSupported ? "Type here if you want to override the recording with a typed recall..." : "Type your recall here because recording is unavailable in this browser..."}"
              >${escapeHtml(state.recallText)}</textarea>
            </div>
          </article>

          <article class="panel panel--white current-deck-card">
            <div class="panel-title-row">
              <span class="eyebrow">CURRENT DECK</span>
              ${icon("info")}
            </div>
            <div class="current-deck-card__body">
              <div class="current-deck-thumb" style="background-image:url('${SCREEN_ASSETS.recallDeck}')"></div>
              <div>
                <strong>${escapeHtml(state.source?.title || "Active Deck")}</strong>
                <span>Last activity: ${escapeHtml(formatRelativeTime(state.source?.updatedAt || new Date().toISOString()))}</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  `;
}

function renderFeedbackPage() {
  if (!state.currentSession) {
    return `
      <section class="screen feedback-screen">
        ${renderEmptyPanel("No feedback yet", "Complete a recall attempt to unlock AI feedback.", true)}
      </section>
    `;
  }

  const session = state.currentSession;
  const overallScore = clampNumber(session.scoreTotal ?? 0, 0, 100);
  const metrics = [
    { label: "Recall Velocity", value: clampNumber(session.recallScore ?? overallScore, 0, 100) },
    { label: "Conceptual Accuracy", value: clampNumber(session.accuracyScore ?? overallScore, 0, 100) },
    { label: "Structural Detail", value: clampNumber(session.detailScore ?? overallScore, 0, 100) },
  ];
  const strengths = session.strengths.length
    ? session.strengths
    : ["You maintained the central narrative and remembered the core mechanism."];
  const missing = session.missingPieces.length
    ? session.missingPieces
    : ["Add more concrete details and supporting terminology from the reading."];
  const misconceptions = session.misconceptions.length
    ? session.misconceptions
    : ["No major misconceptions were detected in this attempt."];
  const comparisonRows = buildComparisonRows(session);

  return `
    <section class="screen feedback-screen">
      <div class="feedback-hero-grid">
        <article class="feedback-score-card">
          <span class="eyebrow">OVERALL PERFORMANCE</span>
          <div class="feedback-score-card__score">
            <strong>${overallScore}</strong>
            <span>/100</span>
          </div>
          <div class="feedback-score-card__insight">
            ${icon("trend-up")}
            <p>${escapeHtml(getPerformanceInsight(session))}</p>
          </div>
        </article>

        <div class="feedback-metrics">
          ${metrics
            .map(
              (metric) => `
                <article class="feedback-metric-card">
                  <div class="feedback-metric-card__row">
                    <strong>${escapeHtml(metric.label)}</strong>
                    <span>${metric.value}%</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-track__fill" style="width:${metric.value}%"></div>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>

      <div class="feedback-bento-grid">
        <article class="feedback-bento feedback-bento--positive">
          <div class="feedback-bento__icon">${icon("check-circle")}</div>
          <h3>What You Nailed</h3>
          <ul class="feedback-bullet-list">
            ${strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>

        <article class="feedback-bento feedback-bento--warning">
          <div class="feedback-bento__icon">${icon("target")}</div>
          <h3>Missed Concepts</h3>
          <ul class="feedback-bullet-list">
            ${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>

        <article class="feedback-bento feedback-bento--danger">
          <div class="feedback-bento__icon">${icon("alert-circle")}</div>
          <h3>Misconceptions</h3>
          <ul class="feedback-bullet-list">
            ${misconceptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>

      <article class="feedback-comparison-card">
        <h3>Detailed Misconception Analysis</h3>
        <div class="feedback-comparison-list">
          ${comparisonRows
            .map(
              (row) => `
                <div class="feedback-comparison-row">
                  <div>
                    <span class="feedback-comparison-row__label feedback-comparison-row__label--input">Your Input</span>
                    <p>${escapeHtml(row.input)}</p>
                  </div>
                  <div>
                    <span class="feedback-comparison-row__label feedback-comparison-row__label--truth">The Ground Truth</span>
                    <p>${escapeHtml(row.truth)}</p>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <div class="feedback-footer">
        <div class="feedback-footer__copy">
          <span class="feedback-footer__icon">${icon("sparkles")}</span>
          <div>
            <strong>Adaptive Next Steps</strong>
            <p>AI can prepare a refined note focused on your missed concepts and weak areas.</p>
          </div>
        </div>
        <div class="feedback-footer__actions">
          <button class="button button--soft" data-action="retry-recall">Retry Session</button>
          <button class="button button--solid" data-action="generate-note">${icon("document")}Generate Note</button>
        </div>
      </div>
    </section>
  `;
}

function renderNotePage() {
  if (!state.currentNote) {
    return `
      <section class="screen note-screen">
        ${renderEmptyPanel("No note available", "Generate a note from feedback to open the refined note view.", true)}
      </section>
    `;
  }

  const note = state.currentNote;
  const session = state.currentSession;
  const contentBlocks = getNoteContentBlocks(note);
  const reviewQuestions = getReviewQuestions(note, session);
  const takeaways = getKeyTakeaways(note, session);
  const termCards = getTermCards(note, session);

  return `
    <section class="screen note-screen">
      <div class="note-header-row">
        <div class="note-header-row__copy">
          <div class="breadcrumbs">
            <span>LIBRARY</span>
            ${icon("chevron-right")}
            <span>${escapeHtml((deriveSubject(state.source) || "Knowledge Base").toUpperCase())}</span>
            ${icon("chevron-right")}
            <strong>${escapeHtml(note.title.toUpperCase())}</strong>
          </div>
          <h1>${escapeHtml(note.title)}</h1>
        </div>

        <div class="note-meta-pills">
          <div class="note-meta-pill note-meta-pill--positive">
            ${icon("check-circle")}
            <div>
              <span>Score</span>
              <strong>${session?.scoreTotal ?? 0}%</strong>
            </div>
          </div>
          <div class="note-meta-pill">
            ${icon("timer")}
            <div>
              <span>Last reviewed</span>
              <strong>${escapeHtml(formatRelativeTime(note.updatedAt))}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="note-grid">
        <div class="note-main-column">
          <article class="note-summary-card">
            <div class="note-summary-card__header">
              <div>
                <span class="note-summary-card__icon">${icon("note")}</span>
                <h2>Conceptual Summary</h2>
              </div>
              <span class="note-chip">AI REFINED</span>
            </div>
            <div class="note-summary-card__content">
              ${contentBlocks.map((block) => `<p>${renderNoteParagraph(block)}</p>`).join("")}
            </div>
            <div class="note-summary-card__callout">
              <div class="note-summary-card__avatars">
                <span>${icon("bulb")}</span>
                <span>${icon("target")}</span>
              </div>
              <p>${escapeHtml(getNoteCallout(note, session))}</p>
            </div>
          </article>

          <section class="note-terms-section">
            <div class="section-row">
              <h2>Critical Terms</h2>
              <button class="text-link" data-action="nav-library">View All ${termCards.length}</button>
            </div>
            <div class="note-terms-grid">
              ${termCards
                .map(
                  (term) => `
                    <article class="term-card ${term.emphasis ? `term-card--${term.emphasis}` : ""}">
                      <div class="term-card__header">
                        <strong>${escapeHtml(term.title)}</strong>
                        ${term.emphasis === "danger" ? `<span class="term-card__flag">${icon("alert-circle")}</span>` : ""}
                      </div>
                      <p>${escapeHtml(term.summary)}</p>
                    </article>
                  `
                )
                .join("")}
            </div>
          </section>
        </div>

        <aside class="note-side-column">
          <article class="note-side-card note-side-card--takeaways">
            <div class="panel-title-row">
              <span class="panel-glyph panel-glyph--warning">${icon("bolt")}</span>
              <h3>Key Takeaways</h3>
            </div>
            <div class="takeaway-list">
              ${takeaways
                .map(
                  (takeaway) => `
                    <div class="takeaway-item ${takeaway.tone ? `takeaway-item--${takeaway.tone}` : ""}">
                      <span class="takeaway-item__dot">${renderTakeawayDot(takeaway.tone)}</span>
                      <div>
                        ${takeaway.label ? `<small>${escapeHtml(takeaway.label)}</small>` : ""}
                        <p>${escapeHtml(takeaway.text)}</p>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>

          <article class="note-side-card note-side-card--questions">
            <div class="panel-title-row">
              <span class="panel-glyph panel-glyph--green">${icon("question")}</span>
              <h3>Review Questions</h3>
            </div>
            <div class="review-question-list">
              ${reviewQuestions
                .map(
                  (question) => `
                    <article class="review-question-card">
                      <p>${escapeHtml(question.question)}</p>
                      <button class="review-question-card__toggle" data-action="reveal-question" data-value="${question.id}">
                        <span>${state.reviewOpen[question.id] ? "Hide Answer" : "Reveal Answer"}</span>
                        ${icon("chevron-down")}
                      </button>
                      ${state.reviewOpen[question.id] ? `<div class="review-question-card__answer">${escapeHtml(question.answer)}</div>` : ""}
                    </article>
                  `
                )
                .join("")}
            </div>
            <button class="button button--ghost button--wide" data-action="generate-more-questions">Generate More Questions</button>
          </article>

          <div class="note-action-stack">
            <button class="button button--solid button--wide" data-action="save-note">${icon("library")}Save to Library</button>
            <button class="button button--soft button--wide" data-action="retry-from-note">${icon("refresh")}Retry for Better Score</button>
          </div>
        </aside>
      </div>

      <button class="floating-edit-button" type="button" aria-label="Quick edit">
        ${icon("edit")}
      </button>
    </section>
  `;
}

function renderModal() {
  if (!state.importModalOpen) {
    return "";
  }

  const importDisabled = state.busy || (!state.importForm.file && !state.importForm.manualText.trim());
  const modeLabel = state.importMode === "file" ? "Paste text instead" : "Upload a file instead";

  return `
    <div class="modal-overlay" data-action="close-import">
      <div class="import-modal" role="dialog" aria-modal="true" aria-label="Import document" onclick="event.stopPropagation()">
        <div class="import-modal__header">
          <div>
            <h2>Import Document</h2>
            <p>Add PDFs to your library for AI-powered active recall.</p>
          </div>
          <button class="icon-ghost" data-action="close-import" aria-label="Close import modal">${icon("x")}</button>
        </div>

        <div class="import-modal__body">
          <button class="dropzone ${state.importMode === "text" ? "dropzone--text" : ""}" data-action="open-file-picker" type="button">
            <div class="dropzone__orb">${icon(state.importMode === "file" ? "document" : "edit")}</div>
            <strong>${state.importMode === "file" ? "Click to upload or drag and drop" : "Paste source material to create a deck"}</strong>
            <span>${state.importMode === "file" ? "PDF (MAX 25MB)" : "Plain text, lecture notes, or transcripts"}</span>
            ${
              state.importForm.fileName
                ? `<small class="dropzone__filename">${escapeHtml(state.importForm.fileName)}</small>`
                : ""
            }
          </button>

          <div class="import-form-grid">
            <label class="import-field">
              <span>DOCUMENT TITLE</span>
              <input type="text" data-field="import-title" value="${escapeHtml(state.importForm.title)}" placeholder="e.g. Molecular Biology 101" />
            </label>
            <label class="import-field">
              <span>SUBJECT</span>
              <input type="text" data-field="import-subject" value="${escapeHtml(state.importForm.subject)}" placeholder="e.g. Biology, Science" />
            </label>
          </div>

          ${
            state.importMode === "text"
              ? `
                <label class="import-field import-field--textarea">
                  <span>DOCUMENT TEXT</span>
                  <textarea rows="8" data-field="import-text" placeholder="Paste your document, lecture transcript, or notes here...">${escapeHtml(state.importForm.manualText)}</textarea>
                </label>
              `
              : ""
          }

          <div class="import-alt-row">
            <button class="text-link" data-action="toggle-import-mode">${modeLabel}</button>
            <button class="text-link" data-action="load-sample">Use Sample Deck</button>
          </div>

          <div class="import-actions">
            <button class="button button--solid button--wide" data-action="import-submit" ${importDisabled ? "disabled" : ""}>
              ${icon("sparkles")}Import Document
            </button>
            <button class="button button--ghost" data-action="close-import">Cancel</button>
          </div>
        </div>

        <div class="import-modal__footer">
          ${icon("info")}
          <p>Documents are processed into sections, key terms, and recall prompts once they reach the backend.</p>
        </div>
      </div>
    </div>
  `;
}

function renderToast() {
  if (!state.statusMessage) {
    return "";
  }

  return `
    <div class="status-toast status-toast--${state.statusTone}">
      ${state.busy ? `<span class="status-toast__spinner"></span>` : icon(state.statusTone === "error" ? "alert-circle" : state.statusTone === "positive" ? "check-circle" : "info")}
      <span>${escapeHtml(state.statusMessage)}</span>
    </div>
  `;
}

function openImportModal() {
  state.importModalOpen = true;
  state.importMode = "file";
  renderApp();
}

function handleFilePicked(event) {
  const [file] = Array.from(event.target.files || []);
  state.importForm.file = file || null;
  state.importForm.fileName = file?.name || "";
  renderApp();
}

function bindDropzone() {
  const zone = refs.app.querySelector(".dropzone");
  if (!zone) {
    return;
  }

  zone.ondragover = (event) => {
    event.preventDefault();
    zone.classList.add("dropzone--drag");
  };
  zone.ondragleave = () => zone.classList.remove("dropzone--drag");
  zone.ondrop = (event) => {
    event.preventDefault();
    zone.classList.remove("dropzone--drag");
    const [file] = Array.from(event.dataTransfer?.files || []);
    if (!file) {
      return;
    }
    state.importForm.file = file;
    state.importForm.fileName = file.name;
    state.importMode = "file";
    renderApp();
  };
}

async function handleLoadSample() {
  state.importMode = "text";
  state.importForm.title = "Working Memory & The Central Executive";
  state.importForm.subject = "Cognitive Psychology";
  state.importForm.manualText = SAMPLE_DOCUMENT;
  state.importForm.file = null;
  state.importForm.fileName = "";
  renderApp();
}

async function submitImport() {
  const rawText = state.importForm.manualText.trim();
  if (!state.importForm.file && !rawText) {
    setStatus("Add a file or paste text before importing.", "warning");
    renderApp();
    return;
  }

  setBusy(true, "Importing and processing your document...");
  try {
    const formData = new FormData();
    if (state.importForm.file) {
      formData.append("document_file", state.importForm.file, state.importForm.file.name);
    }
    if (rawText) {
      formData.append("raw_text", rawText);
    }
    if (state.importForm.title.trim()) {
      formData.append("title", state.importForm.title.trim());
    }
    if (state.importForm.subject.trim()) {
      formData.append("subtitle", state.importForm.subject.trim());
    }

    const imported = normalizeDocument(await apiRequest("/documents/import", { method: "POST", body: formData }));
    upsertDocument(imported);
    state.source = imported;
    state.selectedSectionId = imported.sections[0]?.id || null;
    state.importModalOpen = false;
    state.page = "sessionSetup";
    state.reflectionText = "";
    state.recallText = "";
    await refreshCollections({ preserveSource: true });
    setStatus(`Imported "${imported.title}" successfully.`, "positive");
  } catch (error) {
    setStatus(error.message || "Import failed.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

async function refreshCollections({ preserveSource = true } = {}) {
  const [documents, notes, sessions] = await Promise.all([
    apiRequest("/documents"),
    apiRequest("/notes"),
    apiRequest("/sessions"),
  ]);

  state.documents = documents.map((item) => normalizeDocument(item));
  state.notes = notes.map((item) => normalizeNote(item));
  state.sessions = sessions.map((item) => normalizeSession(item));

  if (state.currentSession?.id) {
    try {
      state.currentSession = normalizeSession(await apiRequest(`/sessions/${state.currentSession.id}`));
    } catch (_error) {
      state.currentSession = null;
    }
  }

  if (state.currentNote?.id) {
    try {
      state.currentNote = normalizeNote(await apiRequest(`/notes/${state.currentNote.id}`));
    } catch (_error) {
      state.currentNote = null;
    }
  }

  if (preserveSource && state.source?.id) {
    try {
      state.source = normalizeDocument(await apiRequest(`/documents/${state.source.id}`));
      state.selectedSectionId = ensureSelectedSectionId(state.source, state.selectedSectionId);
      return;
    } catch (_error) {
      state.source = null;
    }
  }

  if (state.documents[0]?.id) {
    state.source = normalizeDocument(await apiRequest(`/documents/${state.documents[0].id}`));
    state.selectedSectionId = ensureSelectedSectionId(state.source, state.selectedSectionId);
  } else {
    state.source = null;
    state.selectedSectionId = null;
  }
}

async function openDomainDocument(documentId) {
  await openSessionSetup(documentId);
}

async function openSessionSetup(documentId) {
  if (!documentId) {
    openImportModal();
    return;
  }

  setBusy(true, "Loading deck details...");
  try {
    state.source = normalizeDocument(await apiRequest(`/documents/${documentId}`));
    state.selectedSectionId = ensureSelectedSectionId(state.source, state.selectedSectionId);
    state.page = "sessionSetup";
    setStatus(`Loaded "${state.source.title}".`, "positive");
  } catch (error) {
    setStatus(error.message || "Could not open that deck.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

async function handleContinueSession() {
  const primary = getPrimarySession();
  if (!primary?.id) {
    if (state.source?.id || state.documents[0]?.id) {
      await openSessionSetup(state.source?.id || state.documents[0].id);
    } else {
      openImportModal();
    }
    return;
  }

  setBusy(true, "Resuming your latest session...");
  try {
    const session = normalizeSession(await apiRequest(`/sessions/${primary.id}`));
    state.currentSession = session;
    if (session.documentId) {
      state.source = normalizeDocument(await apiRequest(`/documents/${session.documentId}`));
      state.selectedSectionId = session.sectionId || ensureSelectedSectionId(state.source, null);
    }

    if (session.noteId) {
      state.currentNote = normalizeNote(await apiRequest(`/notes/${session.noteId}`));
      state.page = "note";
    } else if (session.scoreTotal != null || session.status === "evaluated") {
      state.page = "feedback";
    } else if (session.recallTranscript) {
      state.page = "recall";
      state.recallText = session.recallTranscript || "";
      state.recallBaseMs = 0;
      state.recallStartedAt = Date.now();
    } else {
      state.page = "reading";
      state.readingBaseMs = (session.actualReadSeconds || 0) * 1000;
      state.readingStartedAt = Date.now();
    }

    setStatus("Session restored.", "positive");
  } catch (error) {
    setStatus(error.message || "Could not restore the session.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

async function createSessionFromSelection() {
  if (!state.source?.id || !state.selectedSectionId) {
    setStatus("Choose a document section before launching the session.", "warning");
    renderApp();
    return;
  }

  setBusy(true, "Creating your study session...");
  try {
    const session = normalizeSession(
      await apiRequest("/sessions", {
        method: "POST",
        body: JSON.stringify({
          document_id: state.source.id,
          section_id: state.selectedSectionId,
          mode: state.recallMode,
        }),
      })
    );

    state.currentSession = session;
    state.currentNote = null;
    state.page = "reading";
    state.readingBaseMs = 0;
    state.readingStartedAt = Date.now();
    state.recallBaseMs = 0;
    state.recallStartedAt = null;
    state.recallText = "";
    state.recordedBlob = null;
    await refreshCollections({ preserveSource: true });
    setStatus("Session launched. Read through the material first.", "positive");
  } catch (error) {
    setStatus(error.message || "Could not create the study session.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

function advanceToRecall() {
  if (!state.currentSession) {
    setStatus("Launch a session first.", "warning");
    renderApp();
    return;
  }

  stopReadingClock();
  state.recallBaseMs = 0;
  state.recallStartedAt = Date.now();
  state.page = "recall";
  setStatus("Recall mode is live. Explain the material in your own words.", "neutral");
  renderApp();
}

async function evaluateRecallAttempt() {
  if (!state.currentSession?.id) {
    setStatus("No active session found.", "error");
    renderApp();
    return;
  }

  setBusy(true, "Evaluating your recall...");
  try {
    if (state.recordingActive) {
      await stopRecording();
    }

    const actualReadSeconds = Math.max(
      state.currentSession.actualReadSeconds || 0,
      Math.round(getReadingElapsedMs() / 1000)
    );

    let response;
    if (state.recordedBlob && countWords(state.recallText) < 6) {
      const formData = new FormData();
      formData.append("audio", state.recordedBlob, "recall.webm");
      formData.append("actual_read_seconds", String(actualReadSeconds));
      response = await apiRequest(`/sessions/${state.currentSession.id}/evaluate-audio`, {
        method: "POST",
        body: formData,
      });
    } else {
      const transcript = state.recallText.trim();
      if (!transcript) {
        throw new Error("Record or type a recall before evaluation.");
      }
      response = await apiRequest(`/sessions/${state.currentSession.id}/evaluate`, {
        method: "POST",
        body: JSON.stringify({
          recall_transcript: transcript,
          actual_read_seconds: actualReadSeconds,
        }),
      });
    }

    state.currentSession = normalizeSession(response);
    ensureSessionSummary(state.currentSession);
    stopRecallClock();
    await refreshCollections({ preserveSource: true });
    state.page = "feedback";
    setStatus(
      state.currentSession.passedThreshold
        ? "Recall passed. Your feedback is ready."
        : "Feedback is ready. Improve the weak spots and try again.",
      state.currentSession.passedThreshold ? "positive" : "warning"
    );
  } catch (error) {
    setStatus(error.message || "Evaluation failed.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

async function requestGeneratedNote() {
  if (!state.currentSession?.id) {
    setStatus("Complete a recall before generating a note.", "warning");
    renderApp();
    return;
  }

  if (!state.currentSession.passedThreshold) {
    setStatus("The note unlocks after you pass the recall threshold.", "warning");
    renderApp();
    return;
  }

  setBusy(true, "Generating your refined note...");
  try {
    const response = await apiRequest(`/sessions/${state.currentSession.id}/generate-note`, { method: "POST" });
    state.currentSession = normalizeSession(response.session);
    state.currentNote = normalizeNote(response.note);
    ensureSessionSummary(state.currentSession);
    ensureNoteSummary(state.currentNote);
    await refreshCollections({ preserveSource: true });
    state.page = "note";
    setStatus("Generated note is ready.", "positive");
  } catch (error) {
    setStatus(error.message || "Could not generate the note.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

async function openSavedNote(noteId) {
  if (!noteId) {
    return;
  }

  setBusy(true, "Opening the saved note...");
  try {
    const note = normalizeNote(await apiRequest(`/notes/${noteId}`));
    state.currentNote = note;
    const sessionSummary = state.sessions.find((item) => item.noteId === noteId);
    if (sessionSummary?.id) {
      state.currentSession = normalizeSession(await apiRequest(`/sessions/${sessionSummary.id}`));
      if (state.currentSession.documentId) {
        state.source = normalizeDocument(await apiRequest(`/documents/${state.currentSession.documentId}`));
        state.selectedSectionId = ensureSelectedSectionId(state.source, state.currentSession.sectionId);
      }
    }
    state.page = "note";
    setStatus(`Opened "${note.title}".`, "positive");
  } catch (error) {
    setStatus(error.message || "Could not open the note.", "error");
  } finally {
    setBusy(false);
    renderApp();
  }
}

function retryRecall() {
  if (!state.currentSession) {
    state.page = "sessionSetup";
    renderApp();
    return;
  }

  cleanupRecorder();
  state.recordedBlob = null;
  state.recallText = "";
  state.recallBaseMs = 0;
  state.recallStartedAt = Date.now();
  state.page = "recall";
  setStatus("Take another recall attempt.", "neutral");
  renderApp();
}

function retryFromSavedSession() {
  if (state.currentSession) {
    retryRecall();
    return;
  }

  if (state.source?.id) {
    openSessionSetup(state.source.id);
    return;
  }

  openImportModal();
}

function generateMoreQuestions() {
  if (!state.currentNote) {
    setStatus("Generate a note first to expand the review questions.", "warning");
    renderApp();
    return;
  }

  const extra = state.currentNote.keyTerms
    .slice(0, 2)
    .map((term) => `How would you teach "${term}" using a concrete example?`);
  state.currentNote.reviewQuestions = [...state.currentNote.reviewQuestions, ...extra];
  setStatus("Added a few extra review questions from the key terms.", "positive");
  renderApp();
}

async function toggleRecording() {
  if (!state.recordingSupported) {
    setStatus("Recording is not available in this browser. Use typed recall instead.", "warning");
    renderApp();
    return;
  }

  if (state.recordingActive) {
    await stopRecording();
    setStatus("Recording captured. You can evaluate now.", "positive");
    renderApp();
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.start();
    state.recordingActive = true;
    state.recordedBlob = null;
    if (!state.recallStartedAt) {
      state.recallStartedAt = Date.now();
    }
    setStatus("Recording your recall...", "neutral");
  } catch (error) {
    setStatus(error.message || "Could not access the microphone.", "error");
  }

  renderApp();
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    state.recordingActive = false;
    return;
  }

  await new Promise((resolve) => {
    mediaRecorder.addEventListener(
      "stop",
      () => {
        state.recordedBlob = recordedChunks.length ? new Blob(recordedChunks, { type: "audio/webm" }) : null;
        state.recordingActive = false;
        cleanupRecorder();
        resolve();
      },
      { once: true }
    );
    mediaRecorder.stop();
  });
}

function cleanupRecorder() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  mediaRecorder = null;
  mediaStream = null;
  recordedChunks = [];
  state.recordingActive = false;
}

function stopReadingClock() {
  state.readingBaseMs = getReadingElapsedMs();
  state.readingStartedAt = null;
}

function stopRecallClock() {
  state.recallBaseMs = getRecallElapsedMs();
  state.recallStartedAt = null;
}

function getReadingElapsedMs() {
  return state.readingBaseMs + (state.readingStartedAt ? Date.now() - state.readingStartedAt : 0);
}

function getRecallElapsedMs() {
  return state.recallBaseMs + (state.recallStartedAt ? Date.now() - state.recallStartedAt : 0);
}

function syncTimers() {
  const readingTime = formatDuration(getReadingElapsedMs());
  const recallTime = formatDuration(getRecallElapsedMs());

  refs.app.querySelectorAll('[data-live="reading-topbar-time"]').forEach((node) => {
    node.textContent = readingTime;
  });
  refs.app.querySelectorAll('[data-live="recall-timer"], [data-live="recall-center-timer"]').forEach((node) => {
    node.textContent = recallTime;
  });
}

function syncRecallLive() {
  if (state.page !== "recall") {
    return;
  }

  const conceptList = refs.app.querySelector('[data-live="concept-list"]');
  if (conceptList) {
    conceptList.innerHTML = renderRecallConcepts();
  }
}

function applyHashStateOverride() {
  const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  if (!hash) {
    return;
  }

  const firstDocument = state.source || state.documents[0] || null;

  if (hash === "dashboard") {
    state.page = "dashboard";
    state.importModalOpen = false;
    return;
  }

  if (hash === "library") {
    state.page = "library";
    state.importModalOpen = false;
    return;
  }

  if (hash === "import") {
    state.page = "library";
    state.importModalOpen = true;
    return;
  }

  if ((hash === "setup" || hash === "session-setup") && firstDocument) {
    state.source = firstDocument;
    state.selectedSectionId = firstDocument.sections[0]?.id || null;
    state.page = "sessionSetup";
  }
}

function setBusy(busy, message = state.statusMessage) {
  state.busy = busy;
  if (busy && statusHideHandle) {
    window.clearTimeout(statusHideHandle);
    statusHideHandle = null;
  }
  if (message) {
    state.statusMessage = message;
  }
  if (busy && state.statusTone === "error") {
    state.statusTone = "neutral";
  }
  if (!busy && state.statusMessage) {
    setStatus(state.statusMessage, state.statusTone);
  }
}

function setStatus(message, tone = "neutral", durationMs = tone === "error" ? 5200 : 3200) {
  state.statusMessage = message;
  state.statusTone = tone;
  if (statusHideHandle) {
    window.clearTimeout(statusHideHandle);
    statusHideHandle = null;
  }
  if (!message || durationMs <= 0 || state.busy) {
    return;
  }
  statusHideHandle = window.setTimeout(() => {
    if (state.statusMessage === message && !state.busy) {
      state.statusMessage = "";
      renderApp();
    }
  }, durationMs);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.detail || payload?.message || JSON.stringify(payload);
    throw new Error(detail || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function normalizeDocument(document) {
  const sections = Array.isArray(document.sections)
    ? document.sections
        .slice()
        .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
        .map((section) => ({
          id: section.id,
          title: section.title,
          pageLabel: section.page_label || "Section",
          orderIndex: section.order_index ?? 0,
          text: section.extracted_text || "",
          estimatedReadMinutes: section.estimated_read_minutes || 0,
          difficulty: section.difficulty || "moderate",
          conceptCount: section.concept_count || 0,
          excerpt: createExcerpt(section.extracted_text || "", 72),
          keyConcepts: extractKeyConcepts(section.extracted_text || ""),
        }))
    : [];

  const subject = document.subtitle || deriveSubjectFromTitle(document.title || "");

  return {
    id: document.id,
    title: document.title || "Untitled Document",
    subtitle: document.subtitle || subject,
    subject,
    sourceType: document.source_type || "text",
    rawText: document.raw_text || sections.map((item) => item.text).join("\n\n"),
    sectionCount: document.section_count || sections.length,
    sections,
    createdAt: document.created_at || new Date().toISOString(),
    updatedAt: document.updated_at || new Date().toISOString(),
  };
}

function normalizeSession(session) {
  return {
    id: session.id,
    documentId: session.document_id,
    sectionId: session.section_id,
    noteId: session.note_id || null,
    documentTitle: session.document_title || "",
    sectionTitle: session.section_title || "",
    sectionPageLabel: session.section_page_label || "",
    mode: session.mode || "assisted",
    status: session.status || "created",
    actualReadSeconds: session.actual_read_seconds || 0,
    attemptCount: session.attempt_count || 0,
    thresholdScore: session.threshold_score || 70,
    passedThreshold: Boolean(session.passed_threshold),
    recallTranscript: session.recall_transcript || "",
    scoreTotal: session.score_total,
    recallScore: session.recall_score,
    accuracyScore: session.accuracy_score,
    detailScore: session.detail_score,
    missingConceptCount: session.missing_concept_count || 0,
    misconceptionCount: session.misconception_count || 0,
    strengths: Array.isArray(session.strengths) ? session.strengths : [],
    specificFeedback: Array.isArray(session.specific_feedback) ? session.specific_feedback : [],
    missingPieces: Array.isArray(session.missing_pieces) ? session.missing_pieces : [],
    misconceptions: Array.isArray(session.misconceptions) ? session.misconceptions : [],
    errorMessage: session.error_message || null,
    updatedAt: session.updated_at || new Date().toISOString(),
  };
}

function normalizeNote(note) {
  return {
    id: note.id,
    title: note.title || "Generated Note",
    summary: note.summary || "",
    cleanedContent: note.cleaned_content || "",
    rawTranscript: note.raw_transcript || "",
    keyTerms: Array.isArray(note.key_terms) ? note.key_terms : [],
    reviewQuestions: Array.isArray(note.review_questions) ? note.review_questions : [],
    tags: Array.isArray(note.tags) ? note.tags : [],
    folderTitle: note.folder_title || "",
    processingStatus: note.processing_status || "ready",
    updatedAt: note.updated_at || new Date().toISOString(),
  };
}

function ensureSelectedSectionId(document, currentId) {
  if (!document?.sections?.length) {
    return null;
  }
  return document.sections.find((item) => item.id === currentId)?.id || document.sections[0].id;
}

function ensureSessionSummary(session) {
  const index = state.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    state.sessions[index] = { ...state.sessions[index], ...session };
  } else {
    state.sessions.unshift(session);
  }
}

function ensureNoteSummary(note) {
  const index = state.notes.findIndex((item) => item.id === note.id);
  if (index >= 0) {
    state.notes[index] = { ...state.notes[index], ...note };
  } else {
    state.notes.unshift(note);
  }
}

function upsertDocument(document) {
  const index = state.documents.findIndex((item) => item.id === document.id);
  if (index >= 0) {
    state.documents[index] = { ...state.documents[index], ...document };
  } else {
    state.documents.unshift(document);
  }
}

function getSelectedSection() {
  if (!state.source?.sections?.length) {
    return null;
  }
  return state.source.sections.find((item) => item.id === state.selectedSectionId) || state.source.sections[0];
}

function getPrimarySession() {
  if (state.currentSession?.id) {
    return state.currentSession;
  }
  return [...state.sessions].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;
}

function getContinueModel(session) {
  const activeSession = session || getPrimarySession();
  const fallbackDocument = state.source || state.documents[0] || null;

  if (!activeSession && !fallbackDocument) {
    return null;
  }

  const title = activeSession?.documentTitle || fallbackDocument?.title || "New Study Deck";
  const subtitle =
    activeSession?.sectionTitle ||
    fallbackDocument?.sections?.[0]?.excerpt ||
    createExcerpt(fallbackDocument?.rawText || "Import a document to begin your first session.", 96);
  const mastered = clampNumber(activeSession?.scoreTotal ?? 68, 0, 100);
  const totalConcepts = getSelectedSection()?.keyConcepts?.length || 12;
  const completedConcepts = Math.max(1, Math.round((mastered / 100) * totalConcepts));

  return {
    title,
    subtitle,
    topic: deriveSubject(activeSession || fallbackDocument),
    modifiedLabel: formatRelativeTime(activeSession?.updatedAt || fallbackDocument?.updatedAt || new Date().toISOString()),
    mastered,
    progressLabel: `${completedConcepts} / ${totalConcepts} Concepts`,
  };
}

function getDashboardStats() {
  const totalReadSeconds = state.sessions.reduce((sum, item) => sum + (item.actualReadSeconds || 0), 0);
  const focusHours = totalReadSeconds ? `${(totalReadSeconds / 3600).toFixed(1)}h` : "1.4h";
  const totalRecalls = state.sessions.reduce((sum, item) => sum + Math.max(item.attemptCount || 1, 1), 0) || 0;
  return {
    focusHours,
    totalRecalls: totalRecalls.toString(),
  };
}

function getWeakConcepts() {
  const pool = [];
  const session = state.currentSession || getPrimarySession();

  session?.missingPieces?.forEach((item) => pool.push(item));
  session?.misconceptions?.forEach((item) => pool.push(item));
  session?.specificFeedback?.forEach((item) => {
    if (item.toLowerCase().includes("review")) {
      pool.push(item);
    }
  });

  if (!pool.length && state.source?.sections?.length) {
    state.source.sections.flatMap((section) => section.keyConcepts).forEach((item) => pool.push(item));
  }

  return uniqueStrings(pool)
    .slice(0, 3)
    .map((item, index) => ({
      title: trimSentence(item),
      accuracy: [28, 42, 48][index] || clampNumber(34 + hashString(item) % 42, 22, 72),
      priority: index === 0 ? "urgent" : "review",
    }));
}

function getStreakModel() {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const activeDates = new Set(
    state.sessions.map((item) => new Date(item.updatedAt).toISOString().slice(0, 10))
  );
  const now = new Date();
  const dayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayOffset);
  const days = labels.map((label, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return {
      label,
      active: activeDates.has(day.toISOString().slice(0, 10)),
    };
  });

  let count = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].active) {
      count += 1;
    } else if (count > 0) {
      break;
    }
  }

  return {
    count: count || Math.min(state.sessions.length, 4),
    days,
  };
}

function getCoachInsight(weakConcepts) {
  if (!weakConcepts.length) {
    return "You are building steady consistency. Start another session to surface the next growth edge.";
  }
  return `Your next highest-leverage review is "${weakConcepts[0].title}". Tighten that concept first to improve recall faster.`;
}

function getDomains() {
  const grouped = new Map();
  state.documents.forEach((document) => {
    const key = deriveSubject(document);
    if (state.searchQuery && !`${document.title} ${key}`.toLowerCase().includes(state.searchQuery)) {
      return;
    }
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(document);
  });

  const tones = ["psychology", "neuroscience", "empty"];
  return Array.from(grouped.entries()).map(([title, documents], index) => ({
    id: slugify(title),
    title,
    description: createExcerpt(documents[0]?.rawText || documents[0]?.title || "", 48),
    deckCount: documents.length,
    documentId: documents[0]?.id || "",
    tone: tones[index % 2],
  }));
}

function renderDomainCard(domain) {
  return `
    <button class="domain-card domain-card--${domain.tone}" data-action="select-domain" data-value="${domain.documentId}">
      <span class="domain-card__icon">${icon(domain.tone === "neuroscience" ? "brain" : "bulb")}</span>
      <strong>${escapeHtml(domain.title)}</strong>
      <p>${escapeHtml(domain.description)}</p>
      <div class="domain-card__footer">
        <span>${domain.deckCount} DECK${domain.deckCount === 1 ? "" : "S"}</span>
        <span class="domain-card__avatars"><i></i><i></i></span>
      </div>
    </button>
  `;
}

function getRecentNotes() {
  return state.notes
    .filter((note) => {
      if (!state.searchQuery) {
        return true;
      }
      return `${note.title} ${note.summary} ${note.tags.join(" ")}`.toLowerCase().includes(state.searchQuery);
    })
    .slice(0, 2)
    .map((note) => {
      const session = state.sessions.find((item) => item.noteId === note.id);
      return {
        ...note,
        subject: deriveSubject(state.source || { subtitle: note.folderTitle || note.tags[0] || "Knowledge Base" }),
        mastery: clampNumber(session?.scoreTotal ?? 82 - hashString(note.title) % 35, 32, 96),
        meta: session
          ? `${session.sectionTitle || "Refined study note"}`
          : note.summary || "Generated from study feedback",
      };
    });
}

function renderRecentNoteRow(note) {
  return `
    <button class="recent-note-row" data-action="open-note" data-value="${note.id}">
      <div class="recent-note-row__mastery">
        <strong>${note.mastery}</strong>
        <span>MASTERY</span>
      </div>
      <div class="recent-note-row__body">
        <div class="recent-note-row__meta">
          <span class="topic-badge">${escapeHtml(note.subject.toUpperCase())}</span>
          <span>${escapeHtml(`Last reviewed ${formatRelativeTime(note.updatedAt)}`)}</span>
        </div>
        <strong>${escapeHtml(note.title)}</strong>
        <p>${escapeHtml(note.meta)}</p>
      </div>
      <div class="recent-note-row__progress">
        <div class="progress-track progress-track--compact">
          <div class="progress-track__fill" style="width:${note.mastery}%"></div>
        </div>
        <span class="ellipsis">${icon("more")}</span>
      </div>
    </button>
  `;
}

function getWeeklyMasteryBars() {
  const base = [51, 83, 70, 102, 89, 122, 77];
  return base.map((height, index) => ({
    height,
    active: index === 5,
  }));
}

function getSessionSummaryModel() {
  const selectedSection = getSelectedSection();
  const allConcepts = state.source?.sections?.reduce((sum, item) => sum + (item.conceptCount || item.keyConcepts.length), 0) || 0;
  const readMinutes = selectedSection?.estimatedReadMinutes || Math.max(15, Math.round((state.source?.rawText?.split(/\s+/).length || 0) / 200));
  const difficultyMap = { easy: 2, moderate: 3, advanced: 4, hard: 5 };
  const difficultyLevel = difficultyMap[selectedSection?.difficulty || "moderate"] || 3;

  return {
    readMinutes,
    difficultyLevel,
    difficultyLabel: `Moderate (Level ${difficultyLevel}/5) - Advanced concepts with dense detail.`,
    totalConcepts: allConcepts || 124,
    predictedQuestions: Math.max(12, Math.round((selectedSection?.keyConcepts.length || 6) * 3.5)),
    complexityIndex: (difficultyLevel * 1.95).toFixed(1),
    lastAccessed: formatRelativeTime(state.source?.updatedAt || new Date().toISOString()),
  };
}

function getReadingProgress() {
  const section = getSelectedSection();
  const totalMinutes = Math.max(section?.estimatedReadMinutes || 12, 8);
  const percent = clampNumber(Math.round((getReadingElapsedMs() / (totalMinutes * 60 * 1000)) * 100), 0, 100);
  return {
    percent,
    label: `${percent}%`,
  };
}

function getReadingOutline(paragraphs) {
  if (paragraphs.length < 4) {
    return ["Overview", "Core Mechanism", "Reflection", "Takeaways"];
  }
  return ["Strategic Positioning", "Competitive Rivalry", "Bargaining Power", "Moats & Entrants"];
}

function buildReadingHighlights() {
  return getSelectedSection()?.keyConcepts?.slice(0, 4) || [];
}

function splitParagraphs(text) {
  const chunks = String(text || "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (chunks.length) {
    return chunks;
  }
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderHighlightedText(text, phrases) {
  let output = escapeHtml(text);
  phrases
    .slice()
    .sort((left, right) => right.length - left.length)
    .forEach((phrase) => {
      if (!phrase) {
        return;
      }
      const pattern = new RegExp(escapeRegExp(escapeHtml(phrase)), "gi");
      output = output.replace(pattern, (match) => `<span class="text-highlight">${match}</span>`);
    });
  return output;
}

function containsPhrase(text, phrase) {
  return normalizeSearchText(text).includes(normalizeSearchText(phrase));
}

function renderRecallConcepts() {
  const concepts = getSelectedSection()?.keyConcepts || [];
  return concepts
    .map((concept) => {
      const covered = containsPhrase(state.recallText, concept);
      return `
        <div class="recall-concept ${covered ? "recall-concept--covered" : ""}">
          <span class="recall-concept__bullet">${covered ? icon("check") : ""}</span>
          <span>${escapeHtml(concept)}</span>
        </div>
      `;
    })
    .join("");
}

function getRecallTip() {
  const concepts = getSelectedSection()?.keyConcepts || [];
  return concepts[0]
    ? `Anchor your explanation around "${concepts[0]}" first, then connect the supporting mechanisms.`
    : "Start with the main idea, then layer in the supporting details.";
}

function renderEmptyPanel(title, message, includeAction) {
  return `
    <article class="empty-panel">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${includeAction ? `<button class="button button--solid" data-action="open-import">${icon("plus")}Import Deck</button>` : ""}
    </article>
  `;
}

function buildComparisonRows(session) {
  const recallChunks = splitParagraphs(session.recallTranscript || "");
  const truthChunks = session.specificFeedback.length ? session.specificFeedback : session.missingPieces;
  const rows = [];

  for (let index = 0; index < Math.max(recallChunks.length, truthChunks.length, 2); index += 1) {
    rows.push({
      input: recallChunks[index] || `Attempt ${index + 1} focused on the concept but missed the sharper distinction.`,
      truth:
        truthChunks[index] ||
        session.misconceptions[index] ||
        "The corrected framing adds the missing detail and separates adjacent concepts more clearly.",
    });
  }

  return rows.slice(0, 2);
}

function getPerformanceInsight(session) {
  if (session.strengths[0]) {
    return session.strengths[0];
  }
  if (session.specificFeedback[0]) {
    return session.specificFeedback[0];
  }
  return "Strong retention on the central narrative, with room to deepen supporting detail.";
}

function getNoteContentBlocks(note) {
  const raw = note.cleanedContent || note.summary || note.rawTranscript || "";
  const blocks = splitParagraphs(raw);
  if (blocks.length) {
    return blocks.slice(0, 2);
  }
  return [note.summary || "Your refined note will appear here after note generation."];
}

function renderNoteParagraph(block) {
  const highlights = (state.currentNote?.keyTerms || []).slice(0, 3);
  return renderHighlightedText(block, highlights);
}

function getNoteCallout(note, session) {
  if (session?.missingPieces?.[0]) {
    return `Your recall leaned on the big picture. This note emphasizes "${trimSentence(session.missingPieces[0])}" to close the biggest gap.`;
  }
  if (note.summary) {
    return note.summary;
  }
  return "This refinement compresses the reading into the highest-yield review points.";
}

function getKeyTakeaways(note, session) {
  const items = [];
  session?.strengths?.slice(0, 1).forEach((item) => items.push({ text: item, tone: "positive" }));
  session?.misconceptions?.slice(0, 1).forEach((item) =>
    items.push({ text: item, tone: "danger" })
  );
  session?.missingPieces?.slice(0, 1).forEach((item) => items.push({ text: item, tone: "neutral" }));
  if (!items.length) {
    note.keyTerms.slice(0, 3).forEach((item, index) => {
      items.push({
        text: `${item} is a term worth rechecking before the next session.`,
        tone: index === 0 ? "positive" : "neutral",
      });
    });
  }
  if (items[2]) {
    items[2].label = "MISSED DURING SESSION";
  }
  return items.slice(0, 4);
}

function getTermCards(note, session) {
  const terms = note.keyTerms.length ? note.keyTerms : extractKeyConcepts(note.cleanedContent || note.summary || "");
  return terms.slice(0, 4).map((term, index) => ({
    title: term,
    summary: createSentenceSummaryForTerm(term, note.cleanedContent || note.summary || state.source?.rawText || ""),
    emphasis: session?.missingPieces?.some((item) => containsPhrase(item, term))
      ? "danger"
      : index === 0
        ? "positive"
        : "",
  }));
}

function getReviewQuestions(note, session) {
  const sourceQuestions = note.reviewQuestions.length
    ? note.reviewQuestions
    : (note.keyTerms.length ? note.keyTerms : extractKeyConcepts(note.cleanedContent || note.summary || "")).map(
        (term) => `Explain the role of ${term} in your own words.`
      );

  return sourceQuestions.slice(0, 2).map((question, index) => ({
    id: `question-${index}`,
    question,
    answer:
      session?.specificFeedback[index] ||
      note.summary ||
      createSentenceSummaryForTerm(note.keyTerms[index] || question, note.cleanedContent || question),
  }));
}

function renderTakeawayDot(tone) {
  if (tone === "positive") {
    return icon("check-circle");
  }
  if (tone === "danger") {
    return icon("alert-circle");
  }
  return icon("dot");
}

function createExcerpt(text, length = 72) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "No description available yet.";
  }
  return clean.length > length ? `${clean.slice(0, length - 1).trim()}...` : clean;
}

function createSentenceSummaryForTerm(term, text) {
  const sentences = splitParagraphs(String(text || "").replace(/\n/g, " "));
  const match = sentences.find((sentence) => containsPhrase(sentence, term));
  return createExcerpt(match || `${term} is one of the core ideas reinforced in this session.`, 84);
}

function extractKeyConcepts(text) {
  const clean = String(text || "");
  if (!clean.trim()) {
    return [];
  }

  const titleMatches = Array.from(clean.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g))
    .map((match) => match[1].trim())
    .filter((item) => item.length > 4 && !stopWords.has(item.toLowerCase()));
  const tokenMatches = tokenizeWords(clean)
    .filter((token) => token.length > 5)
    .filter((token) => !stopWords.has(token))
    .reduce((accumulator, token) => {
      accumulator.set(token, (accumulator.get(token) || 0) + 1);
      return accumulator;
    }, new Map());

  const frequentWords = Array.from(tokenMatches.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([word]) => word.replace(/\b\w/g, (letter) => letter.toUpperCase()));

  return uniqueStrings([...titleMatches, ...frequentWords]).slice(0, 6);
}

function tokenizeWords(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z][a-z-]+/g) || [];
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((item) => trimSentence(item)).filter(Boolean)));
}

function trimSentence(text) {
  return String(text || "")
    .replace(/^["'•\-\s]+|["'\s]+$/g, "")
    .replace(/\.$/, "")
    .trim();
}

function countWords(text) {
  return tokenizeWords(text).length;
}

function deriveSubject(model) {
  if (!model) {
    return "Knowledge Base";
  }
  if (typeof model === "string") {
    return model;
  }
  if (model.subject) {
    return model.subject;
  }
  if (model.subtitle) {
    return model.subtitle.split(/[,-]/)[0].trim();
  }
  if (model.documentTitle) {
    return deriveSubjectFromTitle(model.documentTitle);
  }
  if (model.title) {
    return deriveSubjectFromTitle(model.title);
  }
  return "Knowledge Base";
}

function deriveSubjectFromTitle(title) {
  const lowered = String(title || "").toLowerCase();
  if (lowered.includes("memory") || lowered.includes("cognitive")) {
    return "Cognitive Psychology";
  }
  if (lowered.includes("thermo") || lowered.includes("biology")) {
    return "Biology";
  }
  return "Psychology";
}

function formatRelativeTime(isoString) {
  const value = new Date(isoString).getTime();
  if (Number.isNaN(value)) {
    return "recently";
  }
  const diffMs = Date.now() - value;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSearchText(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value) {
  return Array.from(String(value || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderAvatar(initials = "AR") {
  return `<div class="avatar">${escapeHtml(initials)}</div>`;
}

function iconButton(name) {
  return `<button class="icon-ghost" type="button" aria-label="${escapeHtml(name)}">${icon(name)}</button>`;
}

function icon(name) {
  const paths = {
    dashboard: '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z"/>',
    library: '<path d="M4 4h5a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4zM20 4h-5a3 3 0 0 0-3 3v13a4 4 0 0 1 4-2h4z"/>',
    profile: '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/>',
    settings: '<path d="M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94L14.5 2.5a.49.49 0 0 0-.49-.4h-4a.49.49 0 0 0-.49.4l-.36 2.53a7.28 7.28 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.62 8.55a.5.5 0 0 0 .12.63l2.03 1.58a7.49 7.49 0 0 0-.05.94 7.49 7.49 0 0 0 .05.94l-2.03 1.58a.5.5 0 0 0-.12.63l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.04.71 1.63.94l.36 2.53a.49.49 0 0 0 .49.4h4a.49.49 0 0 0 .49-.4l.36-2.53c.59-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z"/>',
    help: '<path d="M12 18h.01M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4"/><circle cx="12" cy="12" r="9"/>',
    bell: '<path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1z"/>',
    history: '<path d="M12 8v5l3 2"/><path d="M3.05 11A9 9 0 1 1 5 17.94"/><path d="M3 4v5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"/>',
    bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    flame: '<path d="M12 2s4 4.35 4 8a4 4 0 0 1-8 0c0-2.76 4-8 4-8z"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
    note: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    question: '<path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.8 1.1-2 1.6-2 3"/><circle cx="12" cy="17.5" r="1"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
    chart: '<path d="M4 19h16"/><path d="M7 16V9M12 16V5M17 16v-3"/>',
    warning: '<path d="M12 3l9 16H3z"/><path d="M12 9v4"/><circle cx="12" cy="16.5" r=".8"/>',
    sparkles: '<path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8zM19 14l.7 1.8L21.5 16l-1.8.7L19 18.5l-.7-1.8L16.5 16l1.8-.2z"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    share: '<path d="M15 8l-6 4 6 4"/><path d="M4 12h10"/><circle cx="18" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="6" cy="12" r="2"/>',
    bookmark: '<path d="M7 4h10v16l-5-3-5 3z"/>',
    "arrow-up": '<path d="M12 19V5M5 12l7-7 7 7"/>',
    "arrow-right": '<path d="M5 12h14M13 5l7 7-7 7"/>',
    mic: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><circle cx="12" cy="7.5" r=".8"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.36 6.36M3 12A9 9 0 0 1 18.36 5.64"/><path d="M3 16v4h4M17 4h4v4"/>',
    document: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h4M10 17h5"/>',
    library: '<path d="M4 5h14v14H4z"/><path d="M8 5v14M12 9h3M12 13h3"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
    "alert-circle": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><circle cx="12" cy="16.5" r=".8"/>',
    "trend-up": '<path d="M4 16l5-5 4 4 7-7"/><path d="M14 8h6v6"/>',
    more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    brain: '<path d="M10 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.82V11a3 3 0 0 0 1 2.24V14a3 3 0 0 0 3 3h1v-5H8"/><path d="M14 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.82V11a3 3 0 0 1-1 2.24V14a3 3 0 0 1-3 3h-1v-5h2"/><path d="M10 8h4M10 12h4"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M4 20l4.5-1 9-9-3.5-3.5-9 9z"/><path d="M13.5 6.5l3.5 3.5"/>',
  };

  const path = paths[name] || paths.dot;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;
}
