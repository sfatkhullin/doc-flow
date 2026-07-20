const API_BASE = '';
const FETCH_TIMEOUT = 15000;
const STORAGE_KEY = 'df-chats';

const state = {
  documents: [],
  loading: false,
  chats: [],
  currentChatId: null,
  user: null,
  token: null,
};

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const $ = (sel) => document.querySelector(sel);
const uploadZone = $('#uploadZone');
const fileInput = $('#fileInput');
const documentsList = $('#documentsList');
const docCount = $('#docCount');
const messages = $('#messages');
const questionInput = $('#questionInput');
const sendBtn = $('#sendBtn');
const connectionStatus = $('#connectionStatus');
const toast = $('#toast');
const toastMessage = $('#toastMessage');
const toastIcon = $('#toastIcon');
const emptyMain = $('#emptyMain');
const historyList = $('#historyList');
const newChatBtn = $('#newChatBtn');

const authOverlay = $('#authOverlay');
const authForm = $('#authForm');
const authUsername = $('#authUsername');
const authPassword = $('#authPassword');
const authError = $('#authError');
const authSubmit = $('#authSubmit');
const authTabs = document.querySelectorAll('.auth-tab');
const authUserInfo = $('#authUserInfo');
const authUsernameDisplay = $('#authUsernameDisplay');
const authLogoutBtn = $('#authLogoutBtn');

const confirmOverlay = $('#confirmOverlay');
const confirmText = $('#confirmText');
const confirmCancel = $('#confirmCancel');
const confirmDelete = $('#confirmDelete');

const previewOverlay = $('#previewOverlay');
const previewFilename = $('#previewFilename');
const previewMeta = $('#previewMeta');
const previewBody = $('#previewBody');
const previewClose = $('#previewClose');

const themeToggle = $('#themeToggle');
const savedTheme = localStorage.getItem('df-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('df-theme', next);
  if (userSettings) applySettings(userSettings);
});

let toastTimeout;
function showToast(message, type = 'info') {
  clearTimeout(toastTimeout);
  toast.className = 'toast ' + type;
  toastMessage.textContent = message;
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  toastIcon.innerHTML = icons[type] || icons.info;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3500);
}

async function checkConnection() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`);
    connectionStatus.className = res.ok ? 'connection-status connected' : 'connection-status disconnected';
  } catch {
    connectionStatus.className = 'connection-status disconnected';
  }
}
checkConnection();

const uploadInfoBtn = $('#uploadInfoBtn');
const uploadPopover = $('#uploadPopover');

uploadInfoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadPopover.classList.toggle('hidden');
});

uploadZone.addEventListener('click', (e) => {
  if (e.target.closest('.upload-popover') || e.target === uploadInfoBtn) return;
  uploadPopover.classList.add('hidden');
  fileInput.click();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.upload-zone')) {
    uploadPopover.classList.add('hidden');
  }
});

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleUpload(fileInput.files[0]);
});

async function handleUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx', 'txt', 'md', 'csv'].includes(ext)) {
    showToast('Поддерживаются только PDF и DOCX', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetchWithTimeout(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Ошибка загрузки');
    }
    const data = await res.json();
    const sizeStr = data.file_size ? formatSize(data.file_size) : '';
    showToast(`«${data.filename}» загружен (${sizeStr}, ${data.chunks_count} фр.)`, 'success');
    fileInput.value = '';

    if (state.currentChatId) {
      const chat = getCurrentChat();
      if (chat) {
        chat.documents = chat.documents || [];
        chat.documents.push({ filename: data.filename, size: data.file_size });
        chat.updatedAt = Date.now();
        saveChats();
        renderHistory();
      }
    }
    loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDocuments() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/documents/`);
    if (!res.ok) return;
    const data = await res.json();
    state.documents = data.documents || [];
    renderDocuments();
  } catch {}
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['Б', 'КБ', 'МБ'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return (i === 0 ? size : size.toFixed(1)) + ' ' + units[i];
}

function renderDocuments() {
  const chat = getCurrentChat();
  const chatDocs = chat ? (chat.documents || []) : [];
  const hasChatDocs = chatDocs.length > 0;

  docCount.textContent = hasChatDocs ? chatDocs.length : 0;

  if (!state.currentChatId) {
    const globalHasDocs = state.documents.length > 0;
    emptyMain.style.display = globalHasDocs ? 'none' : 'flex';
    messages.style.display = globalHasDocs ? 'flex' : 'none';
  } else {
    emptyMain.style.display = 'none';
    messages.style.display = 'flex';
  }

  if (!hasChatDocs) {
    documentsList.innerHTML = `<div class="empty-state"><p>Нет документов в этом чате</p></div>`;
    return;
  }
  documentsList.innerHTML = chatDocs.map((doc) => {
    const ext = doc.filename.split('.').pop().toLowerCase();
    return `
      <div class="doc-item">
        <div class="doc-icon">${ext}</div>
        <div class="doc-info">
          <div class="doc-name" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</div>
          <div class="doc-meta">${formatSize(doc.size)}</div>
        </div>
        <button class="doc-preview" data-file="${escapeHtml(doc.filename)}" aria-label="Просмотр">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="doc-delete" data-file="${escapeHtml(doc.filename)}" aria-label="Удалить">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>`;
  }).join('');
  documentsList.querySelectorAll('.doc-preview').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      previewDocument(btn.dataset.file);
    });
  });
  documentsList.querySelectorAll('.doc-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDocument(btn.dataset.file);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function deleteDocument(filename) {
  const chat = getCurrentChat();
  if (!chat) return;
  chat.documents = (chat.documents || []).filter(d => d.filename !== filename);
  chat.updatedAt = Date.now();
  saveChats();
  renderDocuments();
  showToast(`«${filename}» удалён из чата`, 'success');
}

// ─── Preview ───

async function previewDocument(filename) {
  previewOverlay.classList.remove('hidden');
  previewFilename.textContent = filename;
  previewMeta.textContent = 'Загрузка...';
  previewBody.innerHTML = '<div class="preview-loading">Загрузка содержимого...</div>';

  try {
    const res = await fetchWithTimeout(`${API_BASE}/documents/${encodeURIComponent(filename)}/preview`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Ошибка загрузки');
    }
    const data = await res.json();
    previewMeta.textContent = `${formatSize(data.size)} · ${data.chars.toLocaleString('ru-RU')} символов`;
    previewBody.textContent = data.text;
  } catch (err) {
    previewMeta.textContent = '';
    previewBody.innerHTML = `<div class="preview-error">Ошибка: ${escapeHtml(err.message)}</div>`;
  }
}

previewClose.addEventListener('click', () => {
  previewOverlay.classList.add('hidden');
  previewBody.textContent = '';
});

previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) {
    previewOverlay.classList.add('hidden');
    previewBody.textContent = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !previewOverlay.classList.contains('hidden')) {
    previewOverlay.classList.add('hidden');
    previewBody.textContent = '';
  }
});

// ─── Auth ───

const TOKEN_KEY = 'df-token';
const USER_KEY = 'df-user';

function initAuth() {
  state.token = localStorage.getItem(TOKEN_KEY);
  state.user = localStorage.getItem(USER_KEY);

  if (state.token && state.user) {
    fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.token }),
    }).then((res) => {
      if (res.ok) {
        showAuthUser(state.user);
      } else {
        clearAuth();
        showAuthModal();
      }
    }).catch(() => {
      showAuthUser(state.user);
    });
  } else {
    showAuthModal();
  }
}

function showAuthModal() {
  authOverlay.classList.remove('hidden');
}

function hideAuthModal() {
  authOverlay.classList.add('hidden');
}

function showAuthUser(username) {
  state.user = username;
  authUsernameDisplay.textContent = username;
  authUserInfo.style.display = 'block';
  authForm.style.display = 'none';
  document.querySelector('.auth-tabs').style.display = 'none';
  document.querySelector('.auth-subtitle').textContent = 'Вы авторизованы';
  hideAuthModal();
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    authTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    authError.textContent = '';
    authSubmit.textContent = tab.dataset.tab === 'login' ? 'Войти' : 'Зарегистрироваться';
  });
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const isLogin = document.querySelector('.auth-tab.active').dataset.tab === 'login';
  const endpoint = isLogin ? 'login' : 'register';
  const username = authUsername.value.trim();
  const password = authPassword.value;

  authError.textContent = '';
  authSubmit.disabled = true;
  authSubmit.textContent = '...';

  try {
    const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = data.detail || 'Ошибка';
      return;
    }
    state.token = data.token;
    state.user = data.username;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, data.username);
    showAuthUser(data.username);
    showToast(isLogin ? 'Вы вошли в систему' : 'Регистрация прошла успешно', 'success');
  } catch {
    authError.textContent = 'Ошибка соединения с сервером';
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  }
});

authLogoutBtn.addEventListener('click', () => {
  clearAuth();
  authUserInfo.style.display = 'none';
  authForm.style.display = 'flex';
  document.querySelector('.auth-tabs').style.display = 'flex';
  document.querySelector('.auth-subtitle').textContent = 'Войдите, чтобы продолжить';
  document.querySelector('.auth-tab[data-tab="login"]').click();
  authUsername.value = '';
  authPassword.value = '';
  authError.textContent = '';
  showAuthModal();
  showToast('Вы вышли из системы', 'info');
});

// ─── Settings ───

const SETTINGS_KEY = 'df-settings';
const settingsOverlay = $('#settingsOverlay');
const settingsBtn = $('#settingsBtn');
const settingsClose = $('#settingsClose');
const colorOptions = $('#colorOptions');
const sizeOptions = $('#sizeOptions');
const densityOptions = $('#densityOptions');
const settingsReset = $('#settingsReset');

const colorSchemes = {
  gray:   { '--accent': '#555', '--accent-hover': '#777' },
  slate:  { '--accent': '#6b7280', '--accent-hover': '#9ca3af' },
  blue:   { '--accent': '#3b82f6', '--accent-hover': '#60a5fa' },
  green:  { '--accent': '#22c55e', '--accent-hover': '#4ade80' },
  purple: { '--accent': '#8b5cf6', '--accent-hover': '#a78bfa' },
  warm:   { '--accent': '#d97706', '--accent-hover': '#f59e0b' },
};

const colorSchemesLight = {
  gray:   { '--accent': '#999', '--accent-hover': '#bbb' },
  slate:  { '--accent': '#9ca3af', '--accent-hover': '#b0b7c4' },
  blue:   { '--accent': '#3b82f6', '--accent-hover': '#2563eb' },
  green:  { '--accent': '#22c55e', '--accent-hover': '#16a34a' },
  purple: { '--accent': '#8b5cf6', '--accent-hover': '#7c3aed' },
  warm:   { '--accent': '#d97706', '--accent-hover': '#b45309' },
};

const sizeMap = {
  small:  { '--font-size-base': '12px', '--font-size-sm': '10px', '--font-size-lg': '14px', '--message-size': '12.5px', '--input-size': '12.5px', '--chat-padding': '6px', '--sidebar-padding': '4px' },
  medium: { '--font-size-base': '13.5px', '--font-size-sm': '11px', '--font-size-lg': '16px', '--message-size': '13.5px', '--input-size': '13.5px', '--chat-padding': '10px', '--sidebar-padding': '8px' },
  large:  { '--font-size-base': '15px', '--font-size-sm': '12px', '--font-size-lg': '18px', '--message-size': '15px', '--input-size': '15px', '--chat-padding': '14px', '--sidebar-padding': '12px' },
};

const densityMap = {
  compact:  { '--chat-gap': '8px', '--msg-mb': '10px', '--input-pb': '10px', '--sidebar-py': '6px' },
  normal:   { '--chat-gap': '12px', '--msg-mb': '16px', '--input-pb': '18px', '--sidebar-py': '10px' },
  spacious: { '--chat-gap': '16px', '--msg-mb': '22px', '--input-pb': '24px', '--sidebar-py': '14px' },
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved) return saved;
  } catch {}
  return { color: 'gray', size: 'medium', density: 'normal' };
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function applySettings(s) {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const colors = isLight ? colorSchemesLight : colorSchemes;
  const scheme = colors[s.color] || colors.gray;

  const root = document.documentElement;
  Object.entries(scheme).forEach(([k, v]) => root.style.setProperty(k, v));

  if (s.color === 'gray') {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
  }

  const size = sizeMap[s.size] || sizeMap.medium;
  Object.entries(size).forEach(([k, v]) => root.style.setProperty(k, v));

  const density = densityMap[s.density] || densityMap.normal;
  Object.entries(density).forEach(([k, v]) => root.style.setProperty(k, v));

  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === s.color);
  });
  document.querySelectorAll('.size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === s.size || btn.dataset.density === s.density);
  });

  document.querySelectorAll('#densityOptions .size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.density === s.density);
  });
}

let userSettings = loadSettings();
applySettings(userSettings);

settingsBtn.addEventListener('click', () => settingsOverlay.classList.remove('hidden'));
settingsClose.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
});

colorOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.color-btn');
  if (!btn) return;
  userSettings.color = btn.dataset.color;
  saveSettings(userSettings);
  applySettings(userSettings);
});

sizeOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.size-btn');
  if (!btn) return;
  const size = btn.dataset.size;
  if (!size) return;
  userSettings.size = size;
  saveSettings(userSettings);
  applySettings(userSettings);
});

densityOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.size-btn');
  if (!btn) return;
  const density = btn.dataset.density;
  if (!density) return;
  userSettings.density = density;
  saveSettings(userSettings);
  applySettings(userSettings);
});

settingsReset.addEventListener('click', () => {
  userSettings = { color: 'gray', size: 'medium', density: 'normal' };
  saveSettings(userSettings);
  applySettings(userSettings);
  showToast('Настройки сброшены', 'info');
});

// ─── Chat History ───

function loadChats() {
  try {
    state.chats = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { state.chats = []; }
  renderHistory();
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getCurrentChat() {
  return state.chats.find((c) => c.id === state.currentChatId);
}

function renderHistory() {
  const hasHistory = state.chats.length > 0;

  if (!hasHistory) {
    historyList.innerHTML = `<div class="empty-state"><p>Нет диалогов</p></div>`;
    return;
  }

  const sorted = [...state.chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  historyList.innerHTML = sorted.map((chat) => {
    const isActive = chat.id === state.currentChatId;
    const title = chat.title || 'Новый чат';
    const date = new Date(chat.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return `
      <div class="history-item${isActive ? ' active' : ''}${chat.pinned ? ' pinned' : ''}" data-id="${chat.id}">
        <div class="history-item-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="history-item-info">
          <div class="history-item-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          <div class="history-item-meta">${date}</div>
        </div>
        <div class="history-menu">
          <button class="history-menu-btn" data-id="${chat.id}" aria-label="Меню">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  historyList.querySelectorAll('.history-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.history-menu-btn') || e.target.closest('.history-menu-dropdown')) return;
      switchToChat(el.dataset.id);
    });
  });

  historyList.querySelectorAll('.history-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showChatMenu(btn.dataset.id, btn);
    });
  });
}

let activeMenuChatId = null;

function closeChatMenu() {
  const dropdown = document.querySelector('.history-menu-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  activeMenuChatId = null;
}

function showChatMenu(chatId, btnEl) {
  if (activeMenuChatId === chatId) {
    closeChatMenu();
    return;
  }
  closeChatMenu();
  const rect = btnEl.getBoundingClientRect();
  let dropdown = document.querySelector('.history-menu-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'history-menu-dropdown';
    dropdown.innerHTML = `
      <button class="menu-item pin-btn">📌 Закрепить</button>
      <button class="menu-item danger delete-btn">🗑 Удалить</button>
    `;
    document.body.appendChild(dropdown);

    dropdown.addEventListener('click', (e) => {
      const id = activeMenuChatId;
      if (!id) return;
      if (e.target.closest('.pin-btn')) togglePin(id);
      if (e.target.closest('.delete-btn')) promptDeleteChat(id);
      closeChatMenu();
    });
  }

  activeMenuChatId = chatId;
  const chat = state.chats.find(c => c.id === chatId);
  const pinBtn = dropdown.querySelector('.pin-btn');
  pinBtn.textContent = chat && chat.pinned ? '📌 Открепить' : '📌 Закрепить';

  dropdown.style.top = rect.bottom + 4 + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
  dropdown.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.history-menu-btn') && !e.target.closest('.history-menu-dropdown')) {
    closeChatMenu();
  }
});

function togglePin(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  chat.pinned = !chat.pinned;
  chat.updatedAt = Date.now();
  saveChats();
  renderHistory();
  showToast(chat.pinned ? 'Чат закреплён' : 'Чат откреплён', 'info');
}

let pendingDeleteChatId = null;

function promptDeleteChat(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  const title = chat ? chat.title : 'этот чат';
  confirmText.textContent = `Удалить чат «${title}» и все его файлы?`;
  pendingDeleteChatId = chatId;
  confirmOverlay.classList.remove('hidden');
}

confirmCancel.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
  pendingDeleteChatId = null;
});

confirmDelete.addEventListener('click', async () => {
  const chatId = pendingDeleteChatId;
  confirmOverlay.classList.add('hidden');
  pendingDeleteChatId = null;
  if (!chatId) return;
  await deleteChatWithFiles(chatId);
});

confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) {
    confirmOverlay.classList.add('hidden');
    pendingDeleteChatId = null;
  }
});

async function deleteChatWithFiles(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;

  const docs = chat.documents || [];
  for (const doc of docs) {
    try {
      await fetchWithTimeout(`${API_BASE}/documents/${encodeURIComponent(doc.filename)}`, {
        method: 'DELETE',
      });
    } catch {}
  }

  state.chats = state.chats.filter((c) => c.id !== chatId);
  if (state.currentChatId === chatId) {
    state.currentChatId = null;
    clearChat();
  }
  saveChats();
  renderHistory();
  loadDocuments();
  showToast('Чат и файлы удалены', 'success');
}

function switchToChat(chatId) {
  const chat = state.chats.find((c) => c.id === chatId);
  if (!chat) return;
  state.currentChatId = chatId;
  renderHistory();
  messages.innerHTML = '';
  emptyMain.style.display = 'none';
  messages.style.display = 'flex';
  renderDocuments();

  chat.messages.forEach((msg) => {
    appendMessageDOM(msg.content, msg.role, msg.sources, false);
  });

  messages.scrollTop = messages.scrollHeight;
}

function clearChat() {
  messages.innerHTML = '';
  const chat = getCurrentChat();
  const hasChatDocs = chat ? (chat.documents || []).length > 0 : false;
  emptyMain.style.display = hasChatDocs ? 'none' : 'flex';
  messages.style.display = hasChatDocs ? 'flex' : 'none';
  renderDocuments();

  if (hasChatDocs) {
    const welcome = document.createElement('div');
    welcome.className = 'message welcome';
    welcome.innerHTML = `
      <div class="avatar ai"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
      <div class="message-content"><p>Привет! Я wunderDocs AI — ваш корпоративный помощник по документам. Загрузите документ через боковую панель и задайте любой вопрос по содержанию.</p></div>`;
    messages.appendChild(welcome);
  }
}

newChatBtn.addEventListener('click', () => {
  state.currentChatId = null;
  clearChat();
  renderHistory();
});

// ─── Chat ───

function appendMessageDOM(content, role, sources = null, animate = true) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (!animate) div.style.animation = 'none';

  const avatarHtml = role === 'ai'
    ? `<div class="avatar ai"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>`
    : `<div class="avatar user-avatar">U</div>`;

  let contentHtml = `<div class="message-content"><p>${content}</p>`;

  if (sources && sources.length) {
    const uniqSources = [];
    const seen = new Set();
    for (const s of sources) {
      const key = s.source + '-' + s.chunk_index;
      if (!seen.has(key)) { seen.add(key); uniqSources.push(s); }
    }
    const sourcesHtml = uniqSources
      .map((s) => `<span class="source"><strong>${escapeHtml(s.source)}</strong> — ${s.chunk_index + 1}</span>`)
      .join('');
    contentHtml += `
      <div class="sources-toggle" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        Источники (${uniqSources.length})
      </div>
      <div class="sources-body">${sourcesHtml}</div>`;
  }

  contentHtml += '</div>';
  div.innerHTML = avatarHtml + contentHtml;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addMessage(content, role, sources = null) {
  appendMessageDOM(content, role, sources, true);

  if (!state.currentChatId) {
    const chat = {
      id: generateId(),
      title: role === 'user' ? content.slice(0, 60) : content.slice(0, 60),
      messages: [],
      documents: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.chats.push(chat);
    state.currentChatId = chat.id;
    emptyMain.style.display = 'none';
    messages.style.display = 'flex';
    renderDocuments();
  }

  const chat = getCurrentChat();
  if (chat) {
    chat.messages.push({ role, content, sources });
    if (chat.messages.length === 1 && role === 'user') {
      chat.title = content.slice(0, 60);
    }
    chat.updatedAt = Date.now();
    saveChats();
    renderHistory();
  }
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message ai typing';
  div.innerHTML = `
    <div class="avatar ai"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
    <div class="message-content">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.remove();
}

async function askQuestion(question) {
  state.loading = true;
  sendBtn.disabled = true;

  addMessage(question, 'user');
  const typingEl = addTypingIndicator();

  try {
    const chat = getCurrentChat();
    const sources = chat ? (chat.documents || []).map(d => d.filename) : [];

    const res = await fetchWithTimeout(`${API_BASE}/chat/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        n_results: 5,
        sources: sources.length ? sources : undefined,
      }),
    });

    removeTypingIndicator(typingEl);

    if (!res.ok) {
      let detail = 'Ошибка запроса';
      try { const err = await res.json(); detail = err.detail; } catch {}
      addMessage('❌ ' + detail, 'ai');
      return;
    }

    const data = await res.json();
    addMessage(data.answer, 'ai', data.sources);
  } catch (err) {
    removeTypingIndicator(typingEl);
    if (err.name === 'AbortError') {
      addMessage('❌ Сервер не отвечает 15 секунд. Возможно, backend не запущен или нет API-ключа.', 'ai');
    } else {
      addMessage('❌ Ошибка соединения с сервером. Проверьте, запущен ли API.', 'ai');
    }
  } finally {
    state.loading = false;
    sendBtn.disabled = !questionInput.value.trim();
  }
}

questionInput.addEventListener('input', () => {
  sendBtn.disabled = !questionInput.value.trim() || state.loading;
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
});

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
  const text = questionInput.value.trim();
  if (!text || state.loading) return;
  questionInput.value = '';
  questionInput.style.height = 'auto';
  sendBtn.disabled = true;
  askQuestion(text);
}

initAuth();
loadChats();
loadDocuments();
