// report-system.js
// The Daily Work Report system, shared by every workspace page. Include
// this AFTER roles-data.js + astra-auth.js. Each page just needs:
//
//   <button onclick="AstraReports.open('event-head', 'Event Head', 'Events')">Send Report</button>
//
// Reports are written to the shared 'reports' Firestore collection via
// /api/data — the same generic endpoint every other collection uses.
// Server-side authorization (see api/data.js canEditReports) makes sure a
// person can only edit their OWN report, while Joint Secretary/President/
// VP can edit any of them (that's how review/approval works).

(function () {
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function open(roleId, roleName, department) {
    const m = (typeof getMember === 'function') ? getMember() : null;
    if (!m) { showToast('Please log in first.', 'error'); return; }

    openModal(`Send ${esc(roleName)} Report`, `
      <form onsubmit="AstraReports.save(event, '${roleId}', '${esc(roleName).replace(/'/g, "\\'")}', '${esc(department || '').replace(/'/g, "\\'")}')" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Date</label><input id="rp-date" type="date" value="${todayStr()}" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></div>
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Priority</label><select id="rp-priority" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"><option>Low</option><option selected>Medium</option><option>High</option></select></div>
        </div>
        <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Work Title</label><input id="rp-title" required placeholder="e.g. Annual Function preparation" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></div>
        <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Work Description</label><textarea id="rp-desc" rows="3" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tasks Completed</label><textarea id="rp-completed" rows="2" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tasks Pending</label><textarea id="rp-pending" rows="2" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Achievements</label><textarea id="rp-achievements" rows="2" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
          <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Problems / Issues</label><textarea id="rp-issues" rows="2" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
        </div>
        <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Event Related <span class="normal-case text-slate-400">(optional)</span></label><input id="rp-event" placeholder="Event/project name, if any" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></div>
        <div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Next Day Plan</label><textarea id="rp-next" rows="2" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"></textarea></div>
        <p class="text-[11px] text-slate-400">Submitted as ${esc(m.name)} (${esc(roleName)}) — goes straight to the Joint Secretary's Central Report Center for review.</p>
        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md">Submit Report</button>
        </div>
      </form>
    `);
  }

  async function save(e, roleId, roleName, department) {
    e.preventDefault();
    const m = getMember();
    const id = `report_${Date.now()}`;
    const data = {
      reportType: `${roleName} Daily Report`,
      date: document.getElementById('rp-date').value,
      priority: document.getElementById('rp-priority').value,
      title: document.getElementById('rp-title').value.trim(),
      description: document.getElementById('rp-desc').value.trim(),
      tasksCompleted: document.getElementById('rp-completed').value.trim(),
      tasksPending: document.getElementById('rp-pending').value.trim(),
      achievements: document.getElementById('rp-achievements').value.trim(),
      issues: document.getElementById('rp-issues').value.trim(),
      eventRelated: document.getElementById('rp-event').value.trim(),
      nextPlan: document.getElementById('rp-next').value.trim(),
      role: roleId,
      roleName: roleName,
      department: department || '',
      submittedBy: m.name,
      submittedByUid: m.uid,
      submittedByEmail: m.email,
      status: 'Submitted',
      submittedAt: Date.now(),
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null
    };
    try {
      const resp = await fetch('/api/data?collection=reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ id, data })
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(result.error || 'Could not submit report.');
      closeModal();
      showToast('Report submitted to the Joint Secretary.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  window.AstraReports = { open, save };
})();
