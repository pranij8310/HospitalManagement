/**
 * MediCare Pro — Hospital Management System
 * Enhanced Vanilla JS Application v2.0
 * ─────────────────────────────────────────
 * Architecture: Modular, Event-Driven, State-Managed
 * Features: Real-time search, animations, persistent storage,
 *           sorting, pagination, card/table views, notifications
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. APP STATE
═══════════════════════════════════════════════════════════ */

const AppState = {
  patients:     [],
  doctors:      [],
  appointments: [],

  currentPage:         'dashboard',
  editingPatientId:    null,
  editingDoctorId:     null,
  editingAppointmentId: null,
  confirmCallback:     null,

  patientView:      'table',   // 'table' | 'cards'
  patientSortCol:   'name',
  patientSortDir:   'asc',
  patientPage:      1,
  patientPageSize:  10,
  patientFilter:    { search: '', status: '', gender: '' },

  doctorAvailFilter: '',
  doctorSpecFilter:  '',
  doctorSearch:      '',

  appointmentFilter: { search: '', status: '' },

  isDark: true,

  /* ── Init ── */
  init() {
    this._load();
    this._applyTheme();
  },

  _load() {
    this.patients     = JSON.parse(localStorage.getItem('mc_patients'))     || [];
    this.doctors      = JSON.parse(localStorage.getItem('mc_doctors'))      || [];
    this.appointments = JSON.parse(localStorage.getItem('mc_appointments')) || [];
    this.isDark       = localStorage.getItem('mc_theme') !== 'light';
  },

  save() {
    localStorage.setItem('mc_patients',     JSON.stringify(this.patients));
    localStorage.setItem('mc_doctors',      JSON.stringify(this.doctors));
    localStorage.setItem('mc_appointments', JSON.stringify(this.appointments));
  },

  _applyTheme() {
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
    localStorage.setItem('mc_theme', this.isDark ? 'dark' : 'light');
    const btn = Q('#themeToggle');
    if (btn) {
      btn.querySelector('.theme-label').textContent = this.isDark ? 'Light Mode' : 'Dark Mode';
      btn.querySelector('.theme-icon--dark').style.display  = this.isDark  ? 'flex' : 'none';
      btn.querySelector('.theme-icon--light').style.display = !this.isDark ? 'flex' : 'none';
    }
  },

  toggleTheme() {
    this.isDark = !this.isDark;
    this._applyTheme();
  }
};

/* ═══════════════════════════════════════════════════════════
   2. TINY DOM HELPERS
═══════════════════════════════════════════════════════════ */

const Q   = (s, ctx = document) => ctx.querySelector(s);
const QA  = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const $id = id => document.getElementById(id);

function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls)  e.className   = cls;
  if (html) e.innerHTML   = html;
  return e;
}

function on(target, event, selectorOrHandler, handler) {
  if (typeof selectorOrHandler === 'function') {
    target.addEventListener(event, selectorOrHandler);
  } else {
    target.addEventListener(event, e => {
      const match = e.target.closest(selectorOrHandler);
      if (match) handler.call(match, e, match);
    });
  }
}

function sanitize(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ── Animated number counter ── */
function countUp(el, target, duration = 700) {
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  if (diff === 0) return;
  const startTime = performance.now();
  const tick = (now) => {
    const pct  = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = Math.round(start + diff * ease);
    if (pct < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════
   3. TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════ */

const Toast = {
  _icons: {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },

  show(title, message = '', type = 'success', duration = 3500) {
    const stack = $id('toastStack');
    const t = el('div', `toast toast--${type}`);
    t.innerHTML = `
      <div class="toast-icon-wrap">${this._icons[type] || this._icons.info}</div>
      <div class="toast-body">
        <p class="toast-title">${sanitize(title)}</p>
        ${message ? `<p class="toast-msg">${sanitize(message)}</p>` : ''}
      </div>
      <button class="toast-dismiss" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    stack.appendChild(t);

    const dismiss = () => {
      t.classList.add('removing');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    };

    t.querySelector('.toast-dismiss').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }
};

/* ═══════════════════════════════════════════════════════════
   4. MODAL MANAGER
═══════════════════════════════════════════════════════════ */

const Modal = {
  open(id) {
    const m = $id(id);
    if (!m) return;
    m.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    // Focus first focusable element
    const first = m.querySelector('input, select, textarea, button:not(.modal-close-btn)');
    if (first) setTimeout(() => first.focus(), 50);
  },

  close(id) {
    const m = $id(id);
    if (!m) return;
    m.setAttribute('hidden', '');
    document.body.style.overflow = '';
  },

  closeAll() {
    QA('.modal').forEach(m => { m.setAttribute('hidden', ''); });
    document.body.style.overflow = '';
  },

  init() {
    // Close via backdrop or [data-close-modal]
    on(document, 'click', '[data-close-modal]', (e, btn) => {
      const id = btn.dataset.closeModal;
      this.close(id);
      const form = $id(id)?.querySelector('form');
      if (form) form.reset();
      FormValidator.clearAll(form);
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAll();
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   5. FORM VALIDATOR
═══════════════════════════════════════════════════════════ */

const FormValidator = {
  validate(form) {
    this.clearAll(form);
    let valid = true;
    QA('[required]', form).forEach(input => {
      if (!input.value.trim()) {
        this.setError(input, 'This field is required');
        valid = false;
      }
    });
    // Phone pattern
    const phone = form.querySelector('input[type="tel"]');
    if (phone && phone.value && !/^[\d\s\+\-\(\)]{7,15}$/.test(phone.value.trim())) {
      this.setError(phone, 'Enter a valid phone number');
      valid = false;
    }
    // Age range
    const age = form.querySelector('input#patientAge, input[type="number"][min]');
    if (age && age.value) {
      const v = parseInt(age.value);
      if (v < parseInt(age.min || 1) || v > parseInt(age.max || 120)) {
        this.setError(age, `Age must be ${age.min}–${age.max}`);
        valid = false;
      }
    }
    return valid;
  },

  setError(input, msg) {
    const group = input.closest('.form-group');
    if (!group) return;
    group.classList.add('has-error');
    const err = group.querySelector('.form-error');
    if (err) err.textContent = msg;
  },

  clearAll(form) {
    if (!form) return;
    QA('.form-group.has-error', form).forEach(g => g.classList.remove('has-error'));
    QA('.form-error', form).forEach(e => e.textContent = '');
  }
};

/* ═══════════════════════════════════════════════════════════
   6. CONFIRM DIALOG
═══════════════════════════════════════════════════════════ */

const Confirm = {
  show(message, callback) {
    $id('confirmMessage').textContent = message;
    const btn = $id('confirmActionBtn');
    btn.onclick = () => {
      callback();
      Modal.close('confirmModal');
    };
    Modal.open('confirmModal');
  }
};

/* ═══════════════════════════════════════════════════════════
   7. NAVIGATION
═══════════════════════════════════════════════════════════ */

const Navigation = {
  _pageLabels: {
    dashboard:    'Dashboard',
    patients:     'Patients',
    doctors:      'Doctors',
    appointments: 'Appointments',
    billing:      'Billing',
    inventory:    'Inventory',
    reports:      'Reports'
  },

  init() {
    on(document, 'click', '.nav-item[data-page]', (e, link) => {
      e.preventDefault();
      this.goTo(link.dataset.page);
    });

    on(document, 'click', '[data-page-link]', (e, a) => {
      e.preventDefault();
      this.goTo(a.dataset.pageLink);
    });

    // Mobile sidebar toggle
    on($id('sidebarToggle'), 'click', () => {
      $id('sidebar').classList.toggle('mobile-open');
    });

    // Sidebar collapse (desktop)
    on($id('sidebarCollapseBtn'), 'click', () => {
      $id('sidebar').classList.toggle('collapsed');
    });

    // Close mobile sidebar when clicking outside
    on(document, 'click', (e) => {
      const sidebar = $id('sidebar');
      const toggle  = $id('sidebarToggle');
      if (sidebar.classList.contains('mobile-open') &&
          !sidebar.contains(e.target) &&
          !toggle.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    });
  },

  goTo(page) {
    if (!this._pageLabels[page]) return;

    // Hide all pages
    QA('.page').forEach(p => p.setAttribute('hidden', ''));

    // Show target
    const target = $id(page + '-page');
    if (target) target.removeAttribute('hidden');

    // Update nav links
    QA('.nav-item[data-page]').forEach(l => l.classList.remove('active'));
    const active = Q(`.nav-item[data-page="${page}"]`);
    if (active) active.classList.add('active');

    // Update breadcrumb
    const bc = $id('breadcrumbCurrent');
    if (bc) bc.textContent = this._pageLabels[page];

    AppState.currentPage = page;

    // Render module
    const modules = { dashboard: Dashboard, patients: Patients, doctors: Doctors, appointments: Appointments };
    modules[page]?.render();
  }
};

/* ═══════════════════════════════════════════════════════════
   8. SIDEBAR CLOCK
═══════════════════════════════════════════════════════════ */

function startClock() {
  const clockEl = $id('sidebarClock');
  const dateEl  = $id('todayDate');
  if (!clockEl && !dateEl) return;

  const tick = () => {
    const now  = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (clockEl) clockEl.textContent = time;
    if (dateEl)  dateEl.textContent  = date;
  };
  tick();
  setInterval(tick, 30000);
}

/* ═══════════════════════════════════════════════════════════
   9. TOPBAR DROPDOWNS
═══════════════════════════════════════════════════════════ */

function initTopbarDropdowns() {
  // Notification panel
  const notifBtn   = $id('notifBtn');
  const notifPanel = $id('notifPanel');
  const userEl     = $id('topbarUser');
  const userDrop   = $id('userDropdown');

  if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !notifPanel.hidden;
      notifPanel.hidden = open;
      notifBtn.setAttribute('aria-expanded', !open);
      if (userDrop) userDrop.hidden = true;
    });
  }

  if (userEl && userDrop) {
    userEl.addEventListener('click', e => {
      e.stopPropagation();
      const open = !userDrop.hidden;
      userDrop.hidden = open;
      if (notifPanel) notifPanel.hidden = true;
    });
  }

  // Clear all notifications
  const clearBtn = $id('clearAllNotif');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      QA('.notif-item--unread').forEach(n => n.classList.remove('notif-item--unread'));
      const badge = $id('notifCount');
      if (badge) badge.textContent = '0';
    });
  }

  // Close on outside click
  document.addEventListener('click', () => {
    if (notifPanel) notifPanel.hidden = true;
    if (userDrop)   userDrop.hidden = true;
  });
}

/* ═══════════════════════════════════════════════════════════
   10. GLOBAL SEARCH
═══════════════════════════════════════════════════════════ */

const GlobalSearch = {
  init() {
    const input    = $id('globalSearch');
    const dropdown = $id('searchDropdown');
    if (!input || !dropdown) return;

    // ⌘K / Ctrl+K shortcut
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    input.addEventListener('input', () => this._search(input.value.trim(), dropdown));
    input.addEventListener('focus', () => {
      if (input.value.trim()) this._search(input.value.trim(), dropdown);
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
      }
    });

    on(dropdown, 'click', '.search-result-item', (e, item) => {
      const page = item.dataset.page;
      const id   = item.dataset.id;
      dropdown.hidden = true;
      input.value = '';
      Navigation.goTo(page);
    });
  },

  _search(term, dropdown) {
    if (!term) { dropdown.hidden = true; return; }
    const t = term.toLowerCase();
    const results = [];

    AppState.patients.forEach(p => {
      if (p.name.toLowerCase().includes(t) || (p.disease || '').toLowerCase().includes(t)) {
        results.push({ type: 'Patient', name: p.name, sub: p.disease || '', page: 'patients', id: p.id });
      }
    });
    AppState.doctors.forEach(d => {
      if (d.name.toLowerCase().includes(t) || (d.specialization || '').toLowerCase().includes(t)) {
        results.push({ type: 'Doctor', name: d.name, sub: d.specialization || '', page: 'doctors', id: d.id });
      }
    });
    AppState.appointments.forEach(a => {
      const pName = AppState.patients.find(p => p.id === a.patientId)?.name || '';
      if (pName.toLowerCase().includes(t) || (a.reason || '').toLowerCase().includes(t)) {
        results.push({ type: 'Appointment', name: pName, sub: a.reason || '', page: 'appointments', id: a.id });
      }
    });

    if (!results.length) {
      dropdown.innerHTML = `<div class="search-result-item" style="color:var(--text-muted);cursor:default">No results for "<strong>${sanitize(term)}</strong>"</div>`;
    } else {
      dropdown.innerHTML = results.slice(0, 8).map(r => `
        <div class="search-result-item" data-page="${r.page}" data-id="${r.id}">
          <span class="search-result-type">${r.type}</span>
          <div>
            <div class="search-result-name">${sanitize(r.name)}</div>
            ${r.sub ? `<div class="search-result-sub">${sanitize(r.sub)}</div>` : ''}
          </div>
        </div>`).join('');
    }
    dropdown.hidden = false;
  }
};

/* ═══════════════════════════════════════════════════════════
   11. DASHBOARD MODULE
═══════════════════════════════════════════════════════════ */

const Dashboard = {
  render() {
    this._stats();
    this._recentPatients();
    this._activeAppointments();
    this._doctorStatus();
    this._updateBadges();
    this._injectSvgDefs();
  },

  _stats() {
    const available = AppState.doctors.filter(d => d.availability === 'Available').length;
    const today = new Date().toISOString().split('T')[0];
    const todayAppts = AppState.appointments.filter(a => a.date === today && a.status === 'scheduled').length;

    countUp($id('totalPatients'),    AppState.patients.length);
    countUp($id('doctorsOnDuty'),    available);
    countUp($id('appointmentsToday'), todayAppts);
    countUp($id('availableBeds'),    15);
  },

  _recentPatients() {
    const container = $id('recentPatientsPreview');
    if (!container) return;
    const recent = [...AppState.patients].reverse().slice(0, 4);

    if (!recent.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <p>No patients recorded yet</p><span>Add your first patient to get started</span></div>`;
      return;
    }

    container.innerHTML = recent.map((p, i) => `
      <div class="dash-list-item" style="animation-delay:${i * 0.06}s" data-patient-id="${p.id}">
        <div class="dash-item-avatar" style="background:${this._avatarGrad(p.name)}">${initials(p.name)}</div>
        <div class="dash-item-body">
          <div class="dash-item-name">${sanitize(p.name)}</div>
          <div class="dash-item-meta">${sanitize(p.disease || '—')} · Age ${p.age}</div>
        </div>
        <div class="dash-item-end"><span class="badge badge--active">Active</span></div>
      </div>`).join('');
  },

  _activeAppointments() {
    const container = $id('activeAppointmentsPreview');
    if (!container) return;
    const active = AppState.appointments.filter(a => a.status === 'scheduled').slice(-4).reverse();

    if (!active.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <p>No appointments scheduled</p><span>Book an appointment to see it here</span></div>`;
      return;
    }

    container.innerHTML = active.map((a, i) => {
      const patient = AppState.patients.find(p => p.id === a.patientId);
      const doctor  = AppState.doctors.find(d => d.id === a.doctorId);
      return `
        <div class="dash-list-item" style="animation-delay:${i * 0.06}s">
          <div class="dash-item-avatar" style="background:var(--grad-violet)">${initials(patient?.name || '?')}</div>
          <div class="dash-item-body">
            <div class="dash-item-name">${sanitize(patient?.name || 'Unknown')}</div>
            <div class="dash-item-meta">Dr. ${sanitize(doctor?.name?.replace(/^Dr\.?\s*/i,'') || 'Unknown')} · ${a.time}</div>
          </div>
          <div class="dash-item-end" style="font-size:0.72rem;color:var(--text-muted)">${formatDate(a.date)}</div>
        </div>`;
    }).join('');
  },

  _doctorStatus() {
    const container = $id('doctorStatusPreview');
    if (!container) return;
    const docs = AppState.doctors.slice(0, 4);

    if (!docs.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <p>No doctors on record</p><span>Add doctors to track availability</span></div>`;
      return;
    }

    const availMap = { Available: 'available', Busy: 'busy', 'On Leave': 'on-leave' };
    container.innerHTML = docs.map((d, i) => `
      <div class="dash-list-item" style="animation-delay:${i * 0.06}s">
        <div class="dash-item-avatar" style="background:var(--grad-teal)">${initials(d.name)}</div>
        <div class="dash-item-body">
          <div class="dash-item-name">${sanitize(d.name)}</div>
          <div class="dash-item-meta">${sanitize(d.specialization)}</div>
        </div>
        <div class="dash-item-end"><span class="badge badge--${availMap[d.availability] || 'available'}">${d.availability}</span></div>
      </div>`).join('');
  },

  _updateBadges() {
    const b = (id, val) => { const e = $id(id); if (e) e.textContent = val; };
    b('patientBadge',     AppState.patients.length);
    b('doctorBadge',      AppState.doctors.length);
    b('appointmentBadge', AppState.appointments.filter(a => a.status === 'scheduled').length);
  },

  _avatarGrad(name = '') {
    const grads = ['var(--grad-brand)', 'var(--grad-teal)', 'var(--grad-violet)', 'var(--grad-amber)'];
    return grads[name.charCodeAt(0) % grads.length];
  },

  _injectSvgDefs() {
    if ($id('mc-svg-defs')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mc-svg-defs';
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = `<defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0ea5e9"/>
        <stop offset="100%" stop-color="#0d9488"/>
      </linearGradient>
      <linearGradient id="brandGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0ea5e9"/>
        <stop offset="1" stop-color="#0d9488"/>
      </linearGradient>
    </defs>`;
    document.body.appendChild(svg);
  }
};

/* ═══════════════════════════════════════════════════════════
   12. PATIENT MODULE
═══════════════════════════════════════════════════════════ */

const Patients = {
  render() {
    this._renderTable();
    this._renderCards();
    this._updateCountLabel();
    this._setupListeners();
  },

  /* ── Get filtered + sorted patients ── */
  _filtered() {
    const { search, status, gender } = AppState.patientFilter;
    const s = search.toLowerCase();
    return [...AppState.patients]
      .filter(p => {
        const matchSearch = !s || p.name.toLowerCase().includes(s) || p.phone.includes(s) || (p.disease||'').toLowerCase().includes(s);
        const matchStatus = !status || (status === 'active');
        const matchGender = !gender || p.gender === gender;
        return matchSearch && matchStatus && matchGender;
      })
      .sort((a, b) => {
        const col = AppState.patientSortCol;
        const va = (a[col] || '').toString().toLowerCase();
        const vb = (b[col] || '').toString().toLowerCase();
        const cmp = AppState.patientSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return cmp;
      });
  },

  /* ── Paginated slice ── */
  _paginated(list) {
    const ps   = AppState.patientPageSize;
    const page = AppState.patientPage;
    const start = (page - 1) * ps;
    return list.slice(start, start + ps);
  },

  _totalPages(list) {
    return Math.max(1, Math.ceil(list.length / AppState.patientPageSize));
  },

  _renderTable() {
    const tbody = $id('patientTableBody');
    if (!tbody) return;

    const all  = this._filtered();
    const rows = this._paginated(all);

    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-table-row"><td colspan="9"><div class="table-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <p>${all.length === 0 ? 'No patients found' : 'No results match your search'}</p>
        <span>${all.length === 0 ? 'Click "Add Patient" to register your first patient' : 'Try adjusting your search or filters'}</span>
      </div></td></tr>`;
    } else {
      tbody.innerHTML = rows.map(p => `
        <tr data-patient-id="${p.id}">
          <td><input type="checkbox" aria-label="Select ${sanitize(p.name)}"></td>
          <td>
            <div class="cell-name-wrap">
              <div class="cell-avatar" style="background:${Dashboard._avatarGrad(p.name)}">${initials(p.name)}</div>
              <div>
                <div class="cell-name">${sanitize(p.name)}</div>
                ${p.bloodGroup ? `<div class="cell-sub">Blood: ${sanitize(p.bloodGroup)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>${p.age}</td>
          <td>${p.gender}</td>
          <td><span style="font-family:var(--font-mono);font-size:0.82rem">${sanitize(p.phone)}</span></td>
          <td>${sanitize(p.disease)}</td>
          <td>${formatDate(p.admissionDate)}</td>
          <td><span class="badge badge--active">Active</span></td>
          <td>
            <div class="action-btn-group">
              <button class="action-btn action-btn--view" data-view-patient="${p.id}" title="View details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="action-btn action-btn--edit" data-edit-patient="${p.id}" title="Edit patient">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-btn action-btn--delete" data-delete-patient="${p.id}" title="Delete patient">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('');
    }

    this._updatePagination(all);
  },

  _renderCards() {
    const grid = $id('patientCardsGrid');
    if (!grid) return;
    const rows = this._paginated(this._filtered());

    if (!rows.length) {
      grid.innerHTML = `<div class="table-empty-state full-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <p>No patients found</p></div>`;
    } else {
      grid.innerHTML = rows.map((p, i) => `
        <div class="doctor-card" style="animation-delay:${i * 0.05}s;text-align:left">
          <div style="display:flex;align-items:center;gap:14px;width:100%;margin-bottom:14px">
            <div class="doctor-card-avatar" style="width:50px;height:50px;font-size:1rem;background:${Dashboard._avatarGrad(p.name)}">${initials(p.name)}</div>
            <div>
              <div class="doctor-card-name" style="text-align:left">${sanitize(p.name)}</div>
              <div class="doctor-card-spec" style="text-align:left">${sanitize(p.disease)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:0.78rem;color:var(--text-secondary)">
            <div><span style="color:var(--text-muted)">Age</span> <strong>${p.age}</strong></div>
            <div><span style="color:var(--text-muted)">Gender</span> <strong>${p.gender}</strong></div>
            <div><span style="color:var(--text-muted)">Phone</span> <strong style="font-family:var(--font-mono);font-size:0.75rem">${sanitize(p.phone)}</strong></div>
            <div><span style="color:var(--text-muted)">Admitted</span> <strong>${formatDate(p.admissionDate)}</strong></div>
          </div>
          <div class="doctor-card-footer">
            <span class="badge badge--active">Active</span>
            <div class="action-btn-group">
              <button class="action-btn action-btn--view" data-view-patient="${p.id}" title="View">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="action-btn action-btn--edit" data-edit-patient="${p.id}" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-btn action-btn--delete" data-delete-patient="${p.id}" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>`).join('');
    }
  },

  _updateCountLabel() {
    const lbl = $id('patientCountLabel');
    if (lbl) {
      const n = this._filtered().length;
      lbl.innerHTML = `Showing <strong>${n}</strong> patient${n !== 1 ? 's' : ''}`;
    }
  },

  _updatePagination(list) {
    const bar     = $id('patientPagination');
    const info    = $id('patientPageInfo');
    const prevBtn = $id('patientPrevPage');
    const nextBtn = $id('patientNextPage');
    if (!bar) return;

    const total = this._totalPages(list);
    if (total <= 1) { bar.setAttribute('hidden', ''); return; }
    bar.removeAttribute('hidden');

    info.textContent = `Page ${AppState.patientPage} of ${total}`;
    prevBtn.disabled = AppState.patientPage === 1;
    nextBtn.disabled = AppState.patientPage >= total;
  },

  _setupListeners() {
    // Guard: don't re-attach. Use a flag on the section.
    const section = $id('patients-page');
    if (section._listenersAttached) return;
    section._listenersAttached = true;

    // Add button
    on($id('addPatientBtn'), 'click', e => { e.preventDefault(); this.openAddModal(); });

    // View patient
    on(document, 'click', '[data-view-patient]', (e, btn) => { this._showDetail(btn.dataset.viewPatient); });

    // Edit patient
    on(document, 'click', '[data-edit-patient]', (e, btn) => { this.openEditModal(btn.dataset.editPatient); });

    // Delete patient
    on(document, 'click', '[data-delete-patient]', (e, btn) => { this._delete(btn.dataset.deletePatient); });

    // Search
    const search = $id('patientSearch');
    if (search) {
      search.addEventListener('input', () => {
        AppState.patientFilter.search = search.value;
        AppState.patientPage = 1;
        this.render();
      });
    }

    // Status filter
    const filter = $id('patientFilter');
    if (filter) {
      filter.addEventListener('change', () => {
        AppState.patientFilter.status = filter.value;
        AppState.patientPage = 1;
        this.render();
      });
    }

    // Gender filter
    const genderFilter = $id('patientGenderFilter');
    if (genderFilter) {
      genderFilter.addEventListener('change', () => {
        AppState.patientFilter.gender = genderFilter.value;
        AppState.patientPage = 1;
        this.render();
      });
    }

    // Table/Card view toggle
    QA('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        QA('.view-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed','true');
        AppState.patientView = btn.dataset.view;
        const tableWrap = $id('patientTableWrap');
        const cardsGrid = $id('patientCardsGrid');
        if (AppState.patientView === 'table') {
          tableWrap?.removeAttribute('hidden');
          cardsGrid?.setAttribute('hidden','');
        } else {
          tableWrap?.setAttribute('hidden','');
          cardsGrid?.removeAttribute('hidden');
        }
        this.render();
      });
    });

    // Sorting
    QA('.th-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (AppState.patientSortCol === col) {
          AppState.patientSortDir = AppState.patientSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          AppState.patientSortCol = col;
          AppState.patientSortDir = 'asc';
        }
        QA('.th-sortable').forEach(t => t.classList.remove('asc','desc'));
        th.classList.add(AppState.patientSortDir);
        this._renderTable();
      });
    });

    // Pagination
    $id('patientPrevPage')?.addEventListener('click', () => {
      if (AppState.patientPage > 1) { AppState.patientPage--; this.render(); }
    });
    $id('patientNextPage')?.addEventListener('click', () => {
      AppState.patientPage++;
      this.render();
    });

    // Select all checkbox
    const selectAll = $id('selectAllPatients');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        QA('#patientTableBody input[type="checkbox"]').forEach(cb => cb.checked = selectAll.checked);
      });
    }

    // Form submit
    $id('patientForm')?.addEventListener('submit', e => { e.preventDefault(); this._submit(); });
  },

  openAddModal() {
    AppState.editingPatientId = null;
    $id('patientModalTitle').textContent = 'Add New Patient';
    $id('patientForm').reset();
    FormValidator.clearAll($id('patientForm'));
    // Default date to today
    $id('patientAdmissionDate').value = new Date().toISOString().split('T')[0];
    Modal.open('patientModal');
  },

  openEditModal(patientId) {
    const p = AppState.patients.find(x => x.id === patientId);
    if (!p) return;
    AppState.editingPatientId = patientId;
    $id('patientModalTitle').textContent = 'Edit Patient';
    FormValidator.clearAll($id('patientForm'));
    $id('patientName').value          = p.name;
    $id('patientAge').value           = p.age;
    $id('patientGender').value        = p.gender;
    $id('patientPhone').value         = p.phone;
    $id('patientDisease').value       = p.disease;
    $id('patientAdmissionDate').value = p.admissionDate;
    $id('patientBloodGroup').value    = p.bloodGroup || '';
    $id('patientNotes').value         = p.notes || '';
    Modal.open('patientModal');
  },

  _showDetail(patientId) {
    const p = AppState.patients.find(x => x.id === patientId);
    if (!p) return;
    const appts = AppState.appointments.filter(a => a.patientId === patientId);
    $id('patientDetailTitle').textContent = p.name;
    $id('patientDetailBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px">
        <div class="doctor-card-avatar" style="width:64px;height:64px;font-size:1.3rem;background:${Dashboard._avatarGrad(p.name)}">${initials(p.name)}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${sanitize(p.name)}</div>
          <div style="color:var(--text-muted);font-size:0.82rem;margin-top:4px">${sanitize(p.disease)}</div>
          <span class="badge badge--active" style="margin-top:8px">Active Patient</span>
        </div>
      </div>
      <div class="detail-grid">
        ${this._detailField('Age', p.age)}
        ${this._detailField('Gender', p.gender)}
        ${this._detailField('Phone', p.phone)}
        ${this._detailField('Blood Group', p.bloodGroup || '—')}
        ${this._detailField('Admitted', formatDate(p.admissionDate))}
        ${this._detailField('Total Appointments', appts.length)}
        ${p.notes ? `<div class="detail-field" style="grid-column:1/-1">${this._detailField('Notes', p.notes)}</div>` : ''}
      </div>
      ${appts.length ? `
        <div style="margin-top:24px">
          <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">Appointment History</div>
          ${appts.map(a => {
            const doc = AppState.doctors.find(d => d.id === a.doctorId);
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:8px;font-size:0.84rem">
              <span style="color:var(--text-primary)">${doc ? sanitize(doc.name) : 'Unknown Doctor'}</span>
              <span style="color:var(--text-muted)">${formatDate(a.date)} · ${a.time}</span>
              <span class="badge badge--${a.status}">${capitalize(a.status)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}`;
    Modal.open('patientDetailModal');
  },

  _detailField(label, value) {
    return `<div class="detail-field">
      <div class="detail-field-label">${label}</div>
      <div class="detail-field-value">${sanitize(String(value))}</div>
    </div>`;
  },

  _submit() {
    const form = $id('patientForm');
    if (!FormValidator.validate(form)) return;

    const data = {
      name:          $id('patientName').value.trim(),
      age:           $id('patientAge').value,
      gender:        $id('patientGender').value,
      phone:         $id('patientPhone').value.trim(),
      disease:       $id('patientDisease').value.trim(),
      admissionDate: $id('patientAdmissionDate').value,
      bloodGroup:    $id('patientBloodGroup')?.value || '',
      notes:         $id('patientNotes')?.value.trim() || ''
    };

    if (AppState.editingPatientId) {
      const i = AppState.patients.findIndex(p => p.id === AppState.editingPatientId);
      if (i > -1) { AppState.patients[i] = { ...AppState.patients[i], ...data }; }
      Toast.show('Patient updated', `${data.name}'s record has been updated.`, 'success');
    } else {
      AppState.patients.push({ id: 'p_' + Date.now(), ...data });
      Toast.show('Patient added', `${data.name} has been registered.`, 'success');
    }

    AppState.save();
    Modal.close('patientModal');
    this.render();
    Dashboard.render();
  },

  _delete(patientId) {
    const p = AppState.patients.find(x => x.id === patientId);
    Confirm.show(`Delete ${p?.name || 'this patient'}? All associated appointments will be affected.`, () => {
      AppState.patients     = AppState.patients.filter(x => x.id !== patientId);
      AppState.appointments = AppState.appointments.filter(a => a.patientId !== patientId);
      AppState.save();
      Toast.show('Patient deleted', '', 'info');
      this.render();
      Dashboard.render();
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   13. DOCTORS MODULE
═══════════════════════════════════════════════════════════ */

const Doctors = {
  render() {
    this._renderGrid();
    this._setupListeners();
  },

  _filtered() {
    const s    = AppState.doctorSearch.toLowerCase();
    const avail = AppState.doctorAvailFilter;
    const spec  = AppState.doctorSpecFilter;
    return AppState.doctors.filter(d => {
      const ms = !s    || d.name.toLowerCase().includes(s) || (d.specialization||'').toLowerCase().includes(s);
      const ma = !avail || d.availability === avail;
      const msp= !spec  || d.specialization === spec;
      return ms && ma && msp;
    });
  },

  _renderGrid() {
    const grid = $id('doctorsGrid');
    if (!grid) return;
    const list = this._filtered();

    if (!list.length) {
      grid.innerHTML = `<div class="table-empty-state full-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <p>${AppState.doctors.length ? 'No results found' : 'No doctors added yet'}</p>
        <span>${AppState.doctors.length ? 'Try adjusting your filters' : 'Click "Add Doctor" to register your first doctor'}</span>
      </div>`;
      return;
    }

    const availMap = { Available: 'available', Busy: 'busy', 'On Leave': 'on-leave' };
    grid.innerHTML = list.map((d, i) => `
      <div class="doctor-card" style="animation-delay:${i * 0.05}s">
        <div class="doctor-card-avatar">${initials(d.name)}</div>
        <div class="doctor-card-name">${sanitize(d.name)}</div>
        <div class="doctor-card-spec">${sanitize(d.specialization)}</div>
        ${d.experience ? `<div class="doctor-card-exp">${d.experience} years experience</div>` : '<div class="doctor-card-exp" style="opacity:0;height:18px"></div>'}
        <span class="badge badge--${availMap[d.availability] || 'available'}">${d.availability}</span>
        <div class="doctor-card-footer">
          ${d.phone ? `<span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted)">${sanitize(d.phone)}</span>` : '<span></span>'}
          <div class="action-btn-group">
            <button class="action-btn action-btn--edit" data-edit-doctor="${d.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn action-btn--delete" data-delete-doctor="${d.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`).join('');
  },

  _setupListeners() {
    const section = $id('doctors-page');
    if (section._listenersAttached) return;
    section._listenersAttached = true;

    on($id('addDoctorBtn'), 'click', e => { e.preventDefault(); this.openAddModal(); });
    on(document, 'click', '[data-edit-doctor]',   (e, btn) => { this.openEditModal(btn.dataset.editDoctor); });
    on(document, 'click', '[data-delete-doctor]', (e, btn) => { this._delete(btn.dataset.deleteDoctor); });

    // Quick tabs
    on(document, 'click', '.quick-tab[data-avail]', (e, tab) => {
      QA('.quick-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      AppState.doctorAvailFilter = tab.dataset.avail;
      this._renderGrid();
    });

    $id('doctorSearch')?.addEventListener('input', e => {
      AppState.doctorSearch = e.target.value;
      this._renderGrid();
    });
    $id('doctorSpecFilter')?.addEventListener('change', e => {
      AppState.doctorSpecFilter = e.target.value;
      this._renderGrid();
    });

    $id('doctorForm')?.addEventListener('submit', e => { e.preventDefault(); this._submit(); });
  },

  openAddModal() {
    AppState.editingDoctorId = null;
    $id('doctorModalTitle').textContent = 'Add New Doctor';
    $id('doctorForm').reset();
    FormValidator.clearAll($id('doctorForm'));
    Modal.open('doctorModal');
  },

  openEditModal(doctorId) {
    const d = AppState.doctors.find(x => x.id === doctorId);
    if (!d) return;
    AppState.editingDoctorId = doctorId;
    $id('doctorModalTitle').textContent = 'Edit Doctor';
    FormValidator.clearAll($id('doctorForm'));
    $id('doctorName').value             = d.name;
    $id('doctorSpecialization').value   = d.specialization;
    $id('doctorAvailability').value     = d.availability;
    $id('doctorExperience').value       = d.experience || '';
    $id('doctorPhone').value            = d.phone || '';
    Modal.open('doctorModal');
  },

  _submit() {
    const form = $id('doctorForm');
    if (!FormValidator.validate(form)) return;

    const data = {
      name:           $id('doctorName').value.trim(),
      specialization: $id('doctorSpecialization').value,
      availability:   $id('doctorAvailability').value,
      experience:     $id('doctorExperience')?.value || '',
      phone:          $id('doctorPhone')?.value.trim() || ''
    };

    if (AppState.editingDoctorId) {
      const i = AppState.doctors.findIndex(d => d.id === AppState.editingDoctorId);
      if (i > -1) AppState.doctors[i] = { ...AppState.doctors[i], ...data };
      Toast.show('Doctor updated', `${data.name}'s profile has been updated.`, 'success');
    } else {
      AppState.doctors.push({ id: 'd_' + Date.now(), ...data });
      Toast.show('Doctor added', `${data.name} has been registered.`, 'success');
    }

    AppState.save();
    Modal.close('doctorModal');
    this.render();
    Dashboard.render();
    Appointments._refreshDropdowns();
  },

  _delete(doctorId) {
    const d = AppState.doctors.find(x => x.id === doctorId);
    Confirm.show(`Delete ${d?.name || 'this doctor'}? Their appointments will remain but won't be linked.`, () => {
      AppState.doctors = AppState.doctors.filter(x => x.id !== doctorId);
      AppState.save();
      Toast.show('Doctor deleted', '', 'info');
      this.render();
      Dashboard.render();
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   14. APPOINTMENTS MODULE
═══════════════════════════════════════════════════════════ */

const Appointments = {
  render() {
    this._refreshDropdowns();
    this._renderTable();
    this._setupListeners();
  },

  _filtered() {
    const { search, status } = AppState.appointmentFilter;
    const s = search.toLowerCase();
    return AppState.appointments.filter(a => {
      const pName = AppState.patients.find(p => p.id === a.patientId)?.name || '';
      const dName = AppState.doctors.find(d => d.id === a.doctorId)?.name || '';
      const ms = !s || pName.toLowerCase().includes(s) || dName.toLowerCase().includes(s) || (a.reason||'').toLowerCase().includes(s);
      const mst= !status || a.status === status;
      return ms && mst;
    });
  },

  _renderTable() {
    const tbody = $id('appointmentTableBody');
    if (!tbody) return;
    const list = this._filtered();

    if (!list.length) {
      tbody.innerHTML = `<tr class="empty-table-row"><td colspan="6"><div class="table-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>${AppState.appointments.length ? 'No results match your search' : 'No appointments scheduled'}</p>
        <span>${AppState.appointments.length ? 'Try adjusting your search or filters' : 'Click "Book Appointment" to schedule one'}</span>
      </div></td></tr>`;
      return;
    }

    const statusMap = { scheduled: 'scheduled', completed: 'completed', cancelled: 'cancelled' };
    tbody.innerHTML = list.map(a => {
      const patient = AppState.patients.find(p => p.id === a.patientId);
      const doctor  = AppState.doctors.find(d => d.id === a.doctorId);
      return `<tr>
        <td>
          <div class="cell-name-wrap">
            <div class="cell-avatar" style="background:${Dashboard._avatarGrad(patient?.name||'?')}">${initials(patient?.name||'?')}</div>
            <div class="cell-name">${sanitize(patient?.name || 'Unknown')}</div>
          </div>
        </td>
        <td>${sanitize(doctor?.name || 'Unknown')}</td>
        <td>
          <div style="font-weight:500;color:var(--text-primary)">${formatDate(a.date)}</div>
          <div style="font-family:var(--font-mono);font-size:0.74rem;color:var(--text-muted)">${a.time}</div>
        </td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${sanitize(a.reason)}">${sanitize(a.reason)}</td>
        <td><span class="badge badge--${statusMap[a.status] || 'scheduled'}">${capitalize(a.status)}</span></td>
        <td>
          <div class="action-btn-group">
            ${a.status === 'scheduled' ? `
              <button class="action-btn action-btn--view" data-complete-appointment="${a.id}" title="Mark Complete" style="background:rgba(16,185,129,0.1);color:var(--brand-green)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="action-btn action-btn--delete" data-cancel-appointment="${a.id}" title="Cancel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>` : ''}
            <button class="action-btn action-btn--delete" data-delete-appointment="${a.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  _refreshDropdowns() {
    const fillSelect = (id, items, labelFn, defaultText) => {
      const sel = $id(id);
      if (!sel) return;
      const val = sel.value;
      sel.innerHTML = `<option value="">${defaultText}</option>` +
        items.map(i => `<option value="${i.id}">${sanitize(labelFn(i))}</option>`).join('');
      sel.value = val;
    };
    fillSelect('appointmentPatient', AppState.patients, p => p.name, 'Select a patient…');
    fillSelect('appointmentDoctor',  AppState.doctors,  d => `${d.name} — ${d.specialization}`, 'Select a doctor…');
  },

  _setupListeners() {
    const section = $id('appointments-page');
    if (section._listenersAttached) return;
    section._listenersAttached = true;

    on($id('addAppointmentBtn'), 'click', e => { e.preventDefault(); this.openAddModal(); });

    on(document, 'click', '[data-complete-appointment]', (e, btn) => {
      const id = btn.dataset.completeAppointment;
      Confirm.show('Mark this appointment as completed?', () => {
        const a = AppState.appointments.find(x => x.id === id);
        if (a) { a.status = 'completed'; AppState.save(); Toast.show('Appointment completed', '', 'success'); this.render(); Dashboard.render(); }
      });
    });

    on(document, 'click', '[data-cancel-appointment]', (e, btn) => {
      Confirm.show('Cancel this appointment?', () => {
        const a = AppState.appointments.find(x => x.id === btn.dataset.cancelAppointment);
        if (a) { a.status = 'cancelled'; AppState.save(); Toast.show('Appointment cancelled', '', 'warning'); this.render(); Dashboard.render(); }
      });
    });

    on(document, 'click', '[data-delete-appointment]', (e, btn) => {
      Confirm.show('Permanently delete this appointment record?', () => {
        AppState.appointments = AppState.appointments.filter(x => x.id !== btn.dataset.deleteAppointment);
        AppState.save();
        Toast.show('Appointment deleted', '', 'info');
        this.render();
        Dashboard.render();
      });
    });

    $id('appointmentSearch')?.addEventListener('input', e => {
      AppState.appointmentFilter.search = e.target.value;
      this._renderTable();
    });
    $id('appointmentFilter')?.addEventListener('change', e => {
      AppState.appointmentFilter.status = e.target.value;
      this._renderTable();
    });

    $id('appointmentForm')?.addEventListener('submit', e => { e.preventDefault(); this._submit(); });
  },

  openAddModal() {
    if (!AppState.patients.length) {
      Toast.show('No patients registered', 'Please add a patient first before booking an appointment.', 'warning');
      return;
    }
    if (!AppState.doctors.length) {
      Toast.show('No doctors registered', 'Please add a doctor first before booking an appointment.', 'warning');
      return;
    }
    $id('appointmentModalTitle').textContent = 'Book Appointment';
    $id('appointmentForm').reset();
    FormValidator.clearAll($id('appointmentForm'));
    $id('appointmentDate').min = new Date().toISOString().split('T')[0];
    this._refreshDropdowns();
    Modal.open('appointmentModal');
  },

  _submit() {
    const form = $id('appointmentForm');
    if (!FormValidator.validate(form)) return;

    const data = {
      id:        'a_' + Date.now(),
      patientId: $id('appointmentPatient').value,
      doctorId:  $id('appointmentDoctor').value,
      date:      $id('appointmentDate').value,
      time:      $id('appointmentTime').value,
      reason:    $id('appointmentReason').value.trim(),
      status:    'scheduled'
    };

    const patient = AppState.patients.find(p => p.id === data.patientId);
    AppState.appointments.push(data);
    AppState.save();
    Toast.show('Appointment booked', `Scheduled for ${patient?.name || 'patient'} on ${formatDate(data.date)} at ${data.time}.`, 'success');
    Modal.close('appointmentModal');
    this.render();
    Dashboard.render();
  }
};

/* ═══════════════════════════════════════════════════════════
   15. DEMO DATA
═══════════════════════════════════════════════════════════ */

function seedDemoData() {
  AppState.doctors = [
    { id: 'd_1', name: 'Dr. Arjun Mehra',   specialization: 'Cardiology',    availability: 'Available', experience: '12', phone: '+91 98765 11111' },
    { id: 'd_2', name: 'Dr. Priya Sharma',  specialization: 'Neurology',     availability: 'Busy',      experience: '8',  phone: '+91 98765 22222' },
    { id: 'd_3', name: 'Dr. Rahul Verma',   specialization: 'Orthopedics',   availability: 'Available', experience: '15', phone: '+91 98765 33333' },
    { id: 'd_4', name: 'Dr. Sneha Patel',   specialization: 'Pediatrics',    availability: 'On Leave',  experience: '6',  phone: '+91 98765 44444' },
    { id: 'd_5', name: 'Dr. Vikram Singh',  specialization: 'Dermatology',   availability: 'Available', experience: '10', phone: '+91 98765 55555' },
  ];

  AppState.patients = [
    { id: 'p_1', name: 'Aanya Krishnamurthy', age: '38', gender: 'Female', phone: '+91 99001 11111', disease: 'Hypertension',     admissionDate: '2026-02-01', bloodGroup: 'A+', notes: 'Allergic to penicillin' },
    { id: 'p_2', name: 'Rohan Desai',         age: '52', gender: 'Male',   phone: '+91 99001 22222', disease: 'Type 2 Diabetes',  admissionDate: '2026-02-05', bloodGroup: 'O+', notes: '' },
    { id: 'p_3', name: 'Meera Joshi',         age: '29', gender: 'Female', phone: '+91 99001 33333', disease: 'Migraine',         admissionDate: '2026-02-10', bloodGroup: 'B-', notes: '' },
    { id: 'p_4', name: 'Aryan Kapoor',        age: '67', gender: 'Male',   phone: '+91 99001 44444', disease: 'Coronary Artery',  admissionDate: '2026-02-12', bloodGroup: 'AB+',notes: 'Post-op monitoring' },
    { id: 'p_5', name: 'Divya Nair',          age: '44', gender: 'Female', phone: '+91 99001 55555', disease: 'Appendicitis',     admissionDate: '2026-02-15', bloodGroup: 'O-', notes: '' },
  ];

  const today = new Date().toISOString().split('T')[0];
  AppState.appointments = [
    { id: 'a_1', patientId: 'p_1', doctorId: 'd_1', date: today, time: '09:30', reason: 'Routine blood pressure checkup', status: 'scheduled' },
    { id: 'a_2', patientId: 'p_2', doctorId: 'd_2', date: today, time: '11:00', reason: 'Diabetes management consultation', status: 'scheduled' },
    { id: 'a_3', patientId: 'p_3', doctorId: 'd_3', date: '2026-02-20', time: '14:30', reason: 'Follow-up on migraine medication', status: 'scheduled' },
    { id: 'a_4', patientId: 'p_4', doctorId: 'd_1', date: '2026-02-10', time: '10:00', reason: 'Post-operative cardiac review', status: 'completed' },
  ];

  AppState.save();
}

/* ═══════════════════════════════════════════════════════════
   16. APP BOOT
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // State
  AppState.init();

  // Seed demo if empty
  if (!AppState.patients.length && !AppState.doctors.length) {
    seedDemoData();
  }

  // Core systems
  Modal.init();
  Navigation.init();
  GlobalSearch.init();
  startClock();
  initTopbarDropdowns();

  // Theme toggle
  $id('themeToggle')?.addEventListener('click', () => AppState.toggleTheme());

  // Greeting based on time
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const h1 = Q('.page-h1');
  if (h1 && h1.textContent.includes('Good morning')) {
    h1.innerHTML = h1.innerHTML.replace('Good morning', greeting);
  }

  // Navigate to dashboard
  Navigation.goTo('dashboard');
});