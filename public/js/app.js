'use strict';

const state = {
  csrfToken: null,
  user: null,
  accounts: [],
  selectedHistoryAccount: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setText(el, text) {
  if (el) el.textContent = text == null ? '' : String(text);
}

function fmtCents(cents) {
  const n = Number(cents) | 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole}.${frac}`;
}

function fmtDate(ms) {
  return new Date(ms).toLocaleString();
}

async function api(method, path, body) {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* no json */ }
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

function showAuth() {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
  $('#userbar').classList.add('hidden');
}

function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#userbar').classList.remove('hidden');
  setText($('#userlabel'), state.user.username);
}

function renderAccountSelects() {
  const selects = [
    $('#depositForm select[name="account_id"]'),
    $('#withdrawForm select[name="account_id"]'),
    $('#transferForm select[name="from_account_id"]'),
    $('#historyAccount'),
  ].filter(Boolean);
  for (const sel of selects) {
    const prev = sel.value;
    sel.innerHTML = '';
    for (const acc of state.accounts) {
      const opt = document.createElement('option');
      opt.value = String(acc.id);
      opt.textContent = `${acc.name} · ${acc.account_number} · ${fmtCents(acc.balance_cents)}`;
      sel.appendChild(opt);
    }
    if (prev && state.accounts.some((a) => String(a.id) === prev)) sel.value = prev;
  }
}

function renderAccounts() {
  const list = $('#accountList');
  list.innerHTML = '';
  if (state.accounts.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No accounts yet. Open one to get started.';
    li.className = 'meta';
    list.appendChild(li);
  } else {
    for (const acc of state.accounts) {
      const li = document.createElement('li');
      const left = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = acc.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `#${acc.account_number}`;
      left.appendChild(name);
      left.appendChild(meta);
      const right = document.createElement('div');
      right.className = 'num';
      right.textContent = fmtCents(acc.balance_cents);
      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    }
  }
  renderAccountSelects();
  if (state.accounts.length > 0) {
    if (!state.selectedHistoryAccount || !state.accounts.some((a) => a.id === state.selectedHistoryAccount)) {
      state.selectedHistoryAccount = state.accounts[0].id;
    }
    $('#historyAccount').value = String(state.selectedHistoryAccount);
    loadHistory();
  } else {
    $('#txBody').innerHTML = '';
  }
}

async function loadAccounts() {
  const { accounts } = await api('GET', '/api/accounts');
  state.accounts = accounts;
  renderAccounts();
}

async function loadHistory() {
  if (!state.selectedHistoryAccount) return;
  const { transactions } = await api('GET', `/api/transactions/account/${state.selectedHistoryAccount}`);
  const body = $('#txBody');
  body.innerHTML = '';
  for (const tx of transactions) {
    const tr = document.createElement('tr');
    const sign = (tx.type === 'deposit' || tx.type === 'transfer_in') ? '+' : '-';
    tr.innerHTML = '';
    const cells = [
      fmtDate(tx.created_at),
      tx.type.replace('_', ' '),
      `${sign}${fmtCents(tx.amount_cents)}`,
      fmtCents(tx.balance_after_cents),
      tx.description || '',
    ];
    cells.forEach((val, idx) => {
      const td = document.createElement('td');
      td.textContent = val;
      if (idx === 1) td.classList.add(`tx-type-${tx.type}`);
      if (idx === 2 || idx === 3) td.classList.add('num');
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

function formToJson(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string' && v.length > 0) obj[k] = v;
  }
  return obj;
}

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
    } catch (err) {
      setText($('#loginError'),
        err.status === 423 ? 'Account temporarily locked. Try again later.' :
        err.status === 429 ? 'Too many attempts. Please wait.' :
        'Invalid username or password.');
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
    } catch (err) {
      const msg = err.data && err.data.message ? err.data.message :
        err.status === 409 ? 'That username or email is unavailable.' :
        err.status === 429 ? 'Too many attempts. Please wait.' :
        'Could not create account. Check your input and try again.';
      setText($('#registerError'), msg);
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('POST', '/api/auth/logout'); } catch { /* ignore */ }
    state.user = null; state.accounts = []; state.csrfToken = null;
    await fetchCsrfToken();
    showAuth();
  });
}

function bindAccountActions() {
  const dialog = $('#newAccountDialog');
  $('#newAccountBtn').addEventListener('click', () => {
    setText($('#newAccountError'), '');
    $('#newAccountForm').reset();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  });

  $('#newAccountForm').addEventListener('submit', async (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    try {
      const data = formToJson(e.target);
      await api('POST', '/api/accounts', data);
      dialog.close();
      await loadAccounts();
    } catch (err) {
      setText($('#newAccountError'),
        err.status === 409 ? 'You’ve reached the account limit.' : 'Could not create account.');
    }
  });

  const movementForms = [
    { form: '#depositForm', path: '/api/transactions/deposit', err: '#depositError' },
    { form: '#withdrawForm', path: '/api/transactions/withdraw', err: '#withdrawError' },
  ];
  for (const { form, path, err } of movementForms) {
    $(form).addEventListener('submit', async (e) => {
      e.preventDefault();
      setText($(err), '');
      try {
        const data = formToJson(e.target);
        if (data.account_id) data.account_id = Number(data.account_id);
        await api('POST', path, data);
        e.target.reset();
        await loadAccounts();
      } catch (ex) {
        setText($(err),
          ex.status === 400 && ex.data && ex.data.error === 'insufficient_funds' ? 'Insufficient funds.' :
          ex.status === 400 ? 'Invalid amount.' :
          ex.status === 429 ? 'Too many requests. Slow down.' :
          'Operation failed.');
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
      e.target.reset();
      await loadAccounts();
    } catch (ex) {
      const code = ex.data && ex.data.error;
      setText($('#transferError'),
        code === 'insufficient_funds' ? 'Insufficient funds.' :
        code === 'same_account' ? 'Cannot transfer to the same account.' :
        ex.status === 404 ? 'Destination account not found.' :
        ex.status === 429 ? 'Too many requests. Slow down.' :
        'Transfer failed.');
    }
  });

  $('#historyAccount').addEventListener('change', (e) => {
    state.selectedHistoryAccount = Number(e.target.value);
    loadHistory();
  });
}

async function init() {
  bindTabs();
  bindAuth();
  bindAccountActions();
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
