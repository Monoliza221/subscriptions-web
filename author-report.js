(() => {
  'use strict';

  const STORAGE_KEY = 'subscriptions_web_author_reports_v1';
  let selectedReason = '';

  function overlay() { return document.getElementById('authorReportOverlay'); }
  function currentAuthorName() {
    return document.getElementById('authorProfileName')?.textContent?.trim() || 'автора';
  }
  function storageKey() {
    const phone = window.AccountStorage?.getActiveAccountId?.() || localStorage.getItem('subscriptions_web_active_account') || 'guest';
    return `${STORAGE_KEY}:${phone}`;
  }
  function readReports() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); }
    catch { return []; }
  }
  function saveReports(items) {
    localStorage.setItem(storageKey(), JSON.stringify(items));
  }
  function updateSelection() {
    document.querySelectorAll('#authorReportReasons button').forEach(button => {
      const active = button.dataset.reason === selectedReason;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const submit = document.getElementById('authorReportSubmit');
    if (submit) submit.disabled = !selectedReason;
  }

  window.openAuthorReport = function openAuthorReport() {
    const root = overlay();
    if (!root) return;
    selectedReason = '';
    const comment = document.getElementById('authorReportComment');
    if (comment) comment.value = '';
    const subtitle = document.getElementById('authorReportSubtitle');
    if (subtitle) subtitle.textContent = `Жалоба на ${currentAuthorName()}`;
    updateSelection();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('author-report-open');
  };

  window.closeAuthorReport = function closeAuthorReport() {
    const root = overlay();
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('author-report-open');
  };

  function submitReport() {
    if (!selectedReason) return;
    const comment = document.getElementById('authorReportComment')?.value.trim() || '';
    const reports = readReports();
    reports.unshift({
      id: `report_${Date.now()}`,
      author: currentAuthorName(),
      reason: selectedReason,
      comment,
      createdAt: new Date().toISOString()
    });
    saveReports(reports);
    window.closeAuthorReport();
    if (typeof window.toast === 'function') window.toast('Жалоба отправлена');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('authorReportReasons')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-reason]');
      if (!button) return;
      selectedReason = button.dataset.reason || '';
      updateSelection();
    });
    document.getElementById('authorReportSubmit')?.addEventListener('click', submitReport);
    overlay()?.addEventListener('click', event => {
      if (event.target === overlay()) window.closeAuthorReport();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay()?.classList.contains('open')) window.closeAuthorReport();
    });
  });
})();
