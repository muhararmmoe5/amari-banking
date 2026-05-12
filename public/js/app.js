'use strict';

const state = {
  csrfToken: null,
  user: null,
  accounts: [],
  selectedHistoryAccount: null,
};

const ACCOUNT_GRADIENTS = [
  'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #ec4899 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const setText = (el, t) => { if (el) el.textContent = t == null ? '' : String(t); };

function fmtCents(cents) {
  const n = Number(cents) | 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole}.${frac}`;
}

function fmtAccountNumber(num) {
  return String(num).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function fmtDate(ms) {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function gradientFor(account) {
  const idx = (account.id - 1) % ACCOUNT_GRADIENTS.length;
  return ACCOUNT_GRADIENTS[idx];
}

function initial(text) {
  if (!text) return '?';
  return text.charAt(0).toUpperCase();
}

// ===== Toasts =====
function toast(msg, kind = 'ok', title) {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const titleEl = document.createElement('div');
  titleEl.className = 't-title';
  titleEl.textContent = title || (kind === 'err' ? 'Something went wrong' : 'Success');
  const bodyEl = document.createElement('div');
  bodyEl.className = 't-body';
  bodyEl.textContent = msg;
  el.appendChild(titleEl);
  el.appendChild(bodyEl);
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}

// ===== API =====
async function api(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
  const res = await fetch(path, {
    method, headers, credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `http_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function fetchCsrfToken() {
  const data = await api('GET', '/api/auth/csrf-token');
  state.csrfToken = data.csrfToken;
}

async function loadMe() {
  try {
    const { user } = await api('GET', '/api/auth/me');
    state.user = user;
    return true;
  } catch {
    state.user = null;
    return false;
  }
}

// ===== Views =====
function showAuth() {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
}

function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  setText($('#userlabel'), state.user.username);
  $('#userAvatar').textContent = initial(state.user.username);
}

// ===== Rendering =====
function renderAccountCards() {
  const root = $('#accountCards');
  root.innerHTML = '';
  if (state.accounts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'account-card empty';
    empty.textContent = 'No accounts yet. Tap "New account" to open one.';
    empty.addEventListener('click', () => openModal('newAccountDialog'));
    root.appendChild(empty);
    return;
  }
  for (const acc of state.accounts) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.style.background = gradientFor(acc);

    const top = document.createElement('div');
    top.className = 'ac-top';
    const name = document.createElement('div');
    name.className = 'ac-name';
    name.textContent = acc.name;
    const chip = document.createElement('div');
    chip.className = 'ac-chip';
    top.appendChild(name);
    top.appendChild(chip);

    const bottom = document.createElement('div');
    bottom.className = 'ac-bottom';
    const left = document.createElement('div');
    const num = document.createElement('div');
    num.className = 'ac-num';
    num.textContent = fmtAccountNumber(acc.account_number);
    left.appendChild(num);
    const bal = document.createElement('div');
    bal.className = 'ac-balance';
    bal.textContent = fmtCents(acc.balance_cents);
    bottom.appendChild(left);
    bottom.appendChild(bal);

    card.appendChild(top);
    card.appendChild(bottom);
    root.appendChild(card);
  }
}

function renderAccountSelects() {
  const selectors = [
    '#depositForm select[name="account_id"]',
    '#withdrawForm select[name="account_id"]',
    '#transferForm select[name="from_account_id"]',
    '#historyAccount',
  ];
  for (const sel of selectors) {
    const el = $(sel);
    if (!el) continue;
    const prev = el.value;
    el.innerHTML = '';
    for (const acc of state.accounts) {
      const opt = document.createElement('option');
      opt.value = String(acc.id);
      opt.textContent = `${acc.name} · ${fmtCents(acc.balance_cents)}`;
      el.appendChild(opt);
    }
    if (prev && state.accounts.some((a) => String(a.id) === prev)) el.value = prev;
  }
}

function renderTotal() {
  const total = state.accounts.reduce((s, a) => s + a.balance_cents, 0);
  setText($('#totalBalance'), fmtCents(total));
  const n = state.accounts.length;
  setText($('#accountCount'), `${n} ${n === 1 ? 'account' : 'accounts'}`);
}

function txIconSvg(type) {
  if (type === 'deposit' || type === 'transfer_in') {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
}

function txLabel(type) {
  return ({
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    transfer_in: 'Transfer received',
    transfer_out: 'Transfer sent',
  })[type] || type;
}

function renderTransactions(rows) {
  const list = $('#txList');
  list.innerHTML = '';
  if (!rows || rows.length === 0) {
    list.classList.add('hidden');
    $('#txEmpty').classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  $('#txEmpty').classList.add('hidden');
  for (const tx of rows) {
    const isCredit = tx.type === 'deposit' || tx.type === 'transfer_in';
    const li = document.createElement('li');

    const icon = document.createElement('div');
    icon.className = `tx-icon ${isCredit ? 'credit' : 'debit'}`;
    icon.innerHTML = txIconSvg(tx.type);

    const meta = document.createElement('div');
    meta.className = 'tx-meta';
    const t = document.createElement('div');
    t.className = 'tx-title';
    t.textContent = txLabel(tx.type);
    const s = document.createElement('div');
    s.className = 'tx-sub';
    const note = tx.description ? ` · ${tx.description}` : '';
    s.textContent = `${fmtDate(tx.created_at)}${note}`;
    meta.appendChild(t);
    meta.appendChild(s);

    const amt = document.createElement('div');
    amt.className = `tx-amount ${isCredit ? 'credit' : 'debit'}`;
    amt.textContent = `${isCredit ? '+' : '-'}${fmtCents(tx.amount_cents)}`;

    li.appendChild(icon);
    li.appendChild(meta);
    li.appendChild(amt);
    list.appendChild(li);
  }
}

// ===== Data loaders =====
async function loadAccounts() {
  const { accounts } = await api('GET', '/api/accounts');
  state.accounts = accounts;
  renderAccountCards();
  renderAccountSelects();
  renderTotal();
  if (state.accounts.length > 0) {
    if (!state.selectedHistoryAccount || !state.accounts.some((a) => a.id === state.selectedHistoryAccount)) {
      state.selectedHistoryAccount = state.accounts[0].id;
    }
    $('#historyAccount').value = String(state.selectedHistoryAccount);
    await loadHistory();
  } else {
    renderTransactions([]);
  }
}

async function loadHistory() {
  if (!state.selectedHistoryAccount) return;
  try {
    const { transactions } = await api('GET', `/api/transactions/account/${state.selectedHistoryAccount}`);
    renderTransactions(transactions);
  } catch {
    renderTransactions([]);
  }
}

// ===== Form helpers =====
function formToJson(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string' && v.length > 0) obj[k] = v;
  }
  return obj;
}

function explainError(err, fallback) {
  const code = err && err.data && err.data.error;
  if (code === 'insufficient_funds') return 'Insufficient funds in that account.';
  if (code === 'same_account') return 'You cannot transfer to the same account.';
  if (code === 'invalid_amount') return 'Please enter a valid amount.';
  if (code === 'amount_too_large') return 'That amount is too large.';
  if (code === 'invalid_csrf_token') return 'Session expired. Please reload the page.';
  if (err && err.status === 404) return 'Destination account not found.';
  if (err && err.status === 423) return 'Account temporarily locked. Try again later.';
  if (err && err.status === 429) return 'Too many requests. Please slow down.';
  if (err && err.status === 401) return 'Please sign in again.';
  return fallback || 'Operation failed.';
}

function openModal(id) {
  const dlg = document.getElementById(id);
  if (!dlg) return;
  const err = dlg.querySelector('.error');
  if (err) setText(err, '');
  const form = dlg.querySelector('form');
  if (form) form.reset();
  if (typeof dlg.showModal === 'function') dlg.showModal();
}

function closeModal(form) {
  const dlg = form.closest('dialog');
  if (dlg && dlg.open) dlg.close();
}

// ===== Bindings =====
function bindTabs() {
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      $('#loginForm').classList.toggle('hidden', which !== 'login');
      $('#registerForm').classList.toggle('hidden', which !== 'register');
    });
  });
}

function bindAuth() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText($('#loginError'), '');
    try {
      const data = formToJson(e.target);
      const { user } = await api('POST', '/api/auth/login', data);
      state.user = user;
      await fetchCsrfToken();
      await loadAccounts();
      showApp();
      toast(`Welcome back, ${user.username}.`, 'ok', 'Signed in');
    } catch (err) {
      setText($('#loginError'), explainError(err, 'Invalid username or password.'));
    }
  });

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText($('#registerError'), '');
    try {
      const data = formToJson(e.target);
      const { user } = await api('POST', '/api/auth/register', data);
      state.user = user;
      await fetchCsrfToken();
      await loadAccounts();
      showApp();
      toast('Your account is ready. Open your first banking account from the dashboard.', 'ok', 'Account created');
    } catch (err) {
      const msg = err.data && err.data.message ? err.data.message :
        err.status === 409 ? 'That username or email is unavailable.' :
        err.status === 429 ? 'Too many attempts. Please wait.' :
        'Could not create account. Check your input and try again.';
      setText($('#registerError'), msg);
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('POST', '/api/auth/logout'); } catch { /* */ }
    state.user = null;
    state.accounts = [];
    state.csrfToken = null;
    state.selectedHistoryAccount = null;
    await fetchCsrfToken();
    showAuth();
  });
}

function bindHeroActions() {
  $$('.action-btn[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (state.accounts.length === 0 && (action === 'deposit' || action === 'withdraw' || action === 'transfer')) {
        toast('Open an account first.', 'err', 'No accounts');
        return;
      }
      const map = { deposit: 'depositDialog', withdraw: 'withdrawDialog', transfer: 'transferDialog' };
      openModal(map[action]);
    });
  });

  $('#newAccountBtn').addEventListener('click', () => openModal('newAccountDialog'));

  $$('[data-close]').forEach((b) => b.addEventListener('click', (e) => {
    const dlg = e.target.closest('dialog');
    if (dlg && dlg.open) dlg.close();
  }));
}

function bindForms() {
  $('#newAccountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText($('#newAccountError'), '');
    try {
      const data = formToJson(e.target);
      const { account } = await api('POST', '/api/accounts', data);
      closeModal(e.target);
      await loadAccounts();
      toast(`Account "${account.name}" opened with number ${fmtAccountNumber(account.account_number)}.`, 'ok', 'Account created');
    } catch (err) {
      setText($('#newAccountError'), err.status === 409 ? 'You have reached the account limit.' : 'Could not create account.');
    }
  });

  const movement = [
    { form: '#depositForm', path: '/api/transactions/deposit', err: '#depositError', label: 'Deposit', verb: 'deposited' },
    { form: '#withdrawForm', path: '/api/transactions/withdraw', err: '#withdrawError', label: 'Withdrawal', verb: 'withdrew' },
  ];
  for (const { form, path, err, label, verb } of movement) {
    $(form).addEventListener('submit', async (e) => {
      e.preventDefault();
      setText($(err), '');
      try {
        const data = formToJson(e.target);
        if (data.account_id) data.account_id = Number(data.account_id);
        await api('POST', path, data);
        closeModal(e.target);
        await loadAccounts();
        toast(`Successfully ${verb} $${data.amount}.`, 'ok', label);
      } catch (ex) {
        setText($(err), explainError(ex));
      }
    });
  }

  $('#transferForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText($('#transferError'), '');
    try {
      const data = formToJson(e.target);
      if (data.from_account_id) data.from_account_id = Number(data.from_account_id);
      await api('POST', '/api/transactions/transfer', data);
      closeModal(e.target);
      await loadAccounts();
      toast(`Sent $${data.amount} to ${fmtAccountNumber(data.to_account_number)}.`, 'ok', 'Transfer sent');
    } catch (ex) {
      setText($('#transferError'), explainError(ex, 'Transfer failed.'));
    }
  });

  $('#historyAccount').addEventListener('change', (e) => {
    state.selectedHistoryAccount = Number(e.target.value);
    loadHistory();
  });
}

// ===== Init =====
async function init() {
  bindTabs();
  bindAuth();
  bindHeroActions();
  bindForms();
  await fetchCsrfToken();
  const loggedIn = await loadMe();
  if (loggedIn) {
    await loadAccounts();
    showApp();
  } else {
    showAuth();
  }
}

document.addEventListener('DOMContentLoaded', init);
