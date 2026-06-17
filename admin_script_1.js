

            // ============================================================
            // UTILITY FUNCTIONS & GLOBAL STATE (Global Scope)
            // ============================================================

            var requestsData = [];
            var requestsPage = 1;

            function getNow() { return new Date(); }

            function renderPagination(containerId, currentPage, totalPages, onPageChange) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';
                if (totalPages <= 0) return;

                const maxVisible = 3;
                let startPage = Math.max(1, currentPage - 1);
                let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                if (endPage - startPage + 1 < maxVisible) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                }

                if (startPage > 1) {
                    const p1 = document.createElement('button');
                    p1.className = 'page-num flex items-center justify-center';
                    p1.textContent = '1';
                    p1.onclick = () => onPageChange(1);
                    container.appendChild(p1);
                    if (startPage > 2) {
                        const dots = document.createElement('div');
                        dots.className = 'page-dot flex items-center justify-center';
                        dots.textContent = '...';
                        container.appendChild(dots);
                    }
                }

                for (let i = startPage; i <= endPage; i++) {
                    const p = document.createElement('button');
                    p.className = `page-num flex items-center justify-center ${i === currentPage ? 'active' : ''}`;
                    p.textContent = i;
                    p.onclick = () => onPageChange(i);
                    container.appendChild(p);
                }

                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        const dots = document.createElement('div');
                        dots.className = 'page-dot flex items-center justify-center';
                        dots.textContent = '...';
                        container.appendChild(dots);
                    }
                    const plast = document.createElement('button');
                    plast.className = 'page-num flex items-center justify-center';
                    plast.textContent = totalPages;
                    plast.onclick = () => onPageChange(totalPages);
                    container.appendChild(plast);
                }
            }

            function renderInputPagination(containerId, currentPage, totalPages, onPageChange) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';
                if (totalPages <= 0) return;

                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-center gap-2 px-3 py-1';

                const input = document.createElement('input');
                input.type = 'number';
                input.value = currentPage;
                input.min = 1;
                input.max = totalPages;
                input.className = 'w-10 h-8 rounded-lg bg-slate-50 border-none text-center font-black text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none transition-all text-xs';

                input.onchange = (e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) val = 1;
                    if (val > totalPages) val = totalPages;
                    onPageChange(val);
                };

                const ofLabel = document.createElement('span');
                ofLabel.className = 'text-[9px] font-black uppercase tracking-widest text-slate-400';
                ofLabel.textContent = `/ ${totalPages}`;

                wrapper.appendChild(input);
                wrapper.appendChild(ofLabel);
                container.appendChild(wrapper);
            }

            window.loadRequests = async function loadRequests() {
                const tbody = document.getElementById('requestsTableBody');
                const badge = document.getElementById('requestBadge');
                if (!tbody) return;
                if (tbody.innerHTML === '') {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-slate-400 font-bold">Loading requests...</td></tr>';
                }

                try {
                    const r = await fetch('backend/attendance.php?action=getPendingRequests');
                    const d = await r.json();
                    if (d.status === 'success') {
                        requestsData = d.requests || [];
                        requestsPage = 1;
                        if (badge) {
                            if (requestsData.length > 0) {
                                badge.textContent = requestsData.length;
                                badge.classList.remove('hidden');
                            } else {
                                badge.classList.add('hidden');
                            }
                        }

                        renderRequests();
                    }
                } catch (e) {
                    console.error("Fetch requests failed", e);
                }
            }

            function renderRequests() {
                const tbody = document.getElementById('requestsTableBody');
                if (!tbody) return;

                const query = document.getElementById('searchRequests')?.value.toLowerCase() || '';
                const filtered = requestsData.filter(req => req.full_name.toLowerCase().includes(query));

                const btnAcceptAll = document.getElementById('btnAcceptAllRequests');
                const btnRejectAll = document.getElementById('btnRejectAllRequests');

                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-slate-400 font-bold">No pending requests found.</td></tr>';
                    const container = document.getElementById('pagesRequests');
                    if (container) container.innerHTML = '';
                    if (document.getElementById('prevPageRequests')) document.getElementById('prevPageRequests').disabled = true;
                    if (document.getElementById('nextPageRequests')) document.getElementById('nextPageRequests').disabled = true;
                    if (btnAcceptAll) btnAcceptAll.classList.add('hidden');
                    if (btnRejectAll) btnRejectAll.classList.add('hidden');
                    return;
                }

                if (btnAcceptAll) btnAcceptAll.classList.remove('hidden');
                if (btnRejectAll) btnRejectAll.classList.remove('hidden');

                const start = (requestsPage - 1) * itemsPerPage;
                const paginated = filtered.slice(start, start + itemsPerPage);

                tbody.innerHTML = paginated.map(req => `
                    <tr class="hover:bg-slate-50/50 transition-all border-b border-slate-50">
                        <td class="px-6 py-6">
                            <div class="font-black text-black text-lg">${req.full_name}</div>
                        </td>
                        <td class="px-6 py-6 text-center font-black text-slate-600">${new Date(req.requested_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                        <td class="px-6 py-6 text-center">
                            ${req.request_type === 'delete' ? `
                                <span class="px-4 py-1.5 bg-rose-100 text-rose-700 rounded-full font-black text-xs tracking-wider uppercase border border-rose-200 shadow-sm animate-pulse">DELETE RECORD</span>
                            ` : `
                                <div class="flex items-center justify-center gap-3">
                                    <span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">${req.formatted_time_in}</span>
                                    <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                    <span class="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-black text-xs">${req.formatted_time_out}</span>
                                </div>
                            `}
                        </td>
                        <td class="px-6 py-6 max-w-xs">
                            <p class="text-sm text-slate-500 font-medium italic">"${req.reason || 'No reason provided'}"</p>
                        </td>
                        <td class="px-6 py-6 text-right">
                            <div id="actions-${req.id}" class="flex justify-end gap-3 items-center min-h-[48px]">
                                <button onclick="handleAdjustment(${req.id}, 'approved')" class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </button>
                                <button onclick="handleAdjustment(${req.id}, 'rejected')" class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');

                const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                renderPagination('pagesRequests', requestsPage, totalPages, (p) => {
                    requestsPage = p;
                    renderRequests();
                });
                if (document.getElementById('prevPageRequests')) document.getElementById('prevPageRequests').disabled = requestsPage === 1;
                if (document.getElementById('nextPageRequests')) document.getElementById('nextPageRequests').disabled = requestsPage >= totalPages;
            }

            window.handleAdjustment = async function (id, decision) {
                const performAction = async (remarks) => {
                    const actionsContainer = document.getElementById(`actions-${id}`);
                    let originalHTML = '';
                    if (actionsContainer) {
                        originalHTML = actionsContainer.innerHTML;
                        actionsContainer.innerHTML = `<svg class="animate-spin h-6 w-6 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sending...</span>`;
                    }
                    try {
                        const r = await fetch('backend/attendance.php?action=handleAdjustment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id, decision, remarks })
                        });
                        const d = await r.json();
                        if (d.status === 'success') {
                            if (typeof window.loadRequests === 'function') window.loadRequests();
                            if (typeof loadActivity === 'function') loadActivity();
                            if (typeof window.showCustomConfirm === 'function') {
                                window.showCustomConfirm("Success", `Request has been ${decision} successfully, and the intern was notified.`, "success");
                            } else {
                                alert(`Request has been ${decision} successfully.`);
                            }
                        } else {
                            if (actionsContainer) actionsContainer.innerHTML = originalHTML;
                            if (typeof window.showCustomConfirm === 'function') {
                                window.showCustomConfirm("Error", d.message, "error");
                            } else {
                                alert(d.message);
                            }
                        }
                    } catch (e) {
                        if (actionsContainer) actionsContainer.innerHTML = originalHTML;
                        if (typeof window.showCustomConfirm === 'function') {
                            window.showCustomConfirm("Error", "Operation failed.", "error");
                        } else {
                            alert("Operation failed.");
                        }
                    }
                };

                if (decision === 'rejected') {
                    if (typeof window.showCustomPrompt === 'function') {
                        window.showCustomPrompt(
                            "Reject Request",
                            "Please enter a reason for rejection (optional):",
                            "Reason for rejection...",
                            (remarks) => {
                                performAction(remarks);
                            }
                        );
                    } else {
                        const remarks = prompt("Please enter a reason for rejection (optional):");
                        if (remarks !== null) {
                            performAction(remarks);
                        }
                    }
                } else {
                    performAction('');
                }
            }

            document.addEventListener('DOMContentLoaded', async () => {
                const btnA = document.getElementById('btnViewActivity');
                const btnH = document.getElementById('btnViewHistory');
                const btnI = document.getElementById('btnViewInterns');
                const btnR = document.getElementById('btnViewRequests');
                const vA = document.getElementById('viewActivity');
                const vH = document.getElementById('viewReports');
                const vI = document.getElementById('viewInterns');
                const vR = document.getElementById('viewRequests');

                function setActiveTab(activeBtn, activeView) {
                    [btnA, btnH, btnI, btnR].forEach(btn => {
                        if (!btn) return;
                        btn.classList.remove('bg-white/80', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
                        btn.classList.add('text-slate-500', 'hover:bg-white/80');
                    });
                    if (activeBtn) {
                        activeBtn.classList.remove('text-slate-500', 'hover:bg-white/80');
                        activeBtn.classList.add('bg-white/80', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
                    }
                    [vA, vH, vI, vR].forEach(v => v ? v.classList.add('hidden') : null);
                    if (activeView) activeView.classList.remove('hidden');
                }

                if (btnA) btnA.onclick = () => { setActiveTab(btnA, vA); activityPage = 1; loadActivity(); };
                if (btnH) btnH.onclick = () => { setActiveTab(btnH, vH); historyPage = 1; loadHistory(); };
                if (btnI) btnI.onclick = () => { setActiveTab(btnI, vI); internsPage = 1; loadInterns(); };
                if (btnR) btnR.onclick = () => { setActiveTab(btnR, vR); loadRequests(); };

                window.handleBulkAdjustment = async function (decision) {
                    const query = document.getElementById('searchRequests')?.value.toLowerCase() || '';
                    const filtered = requestsData.filter(req => req.full_name.toLowerCase().includes(query));
                    
                    if (filtered.length === 0) {
                        if (typeof window.showCustomConfirm === 'function') {
                            window.showCustomConfirm("No Requests", "There are no pending requests to process.", "info");
                        } else {
                            alert("There are no pending requests to process.");
                        }
                        return;
                    }

                    const ids = filtered.map(req => req.id);

                    const performBulkAction = async (remarks) => {
                        const btnAccept = document.getElementById('btnAcceptAllRequests');
                        const btnReject = document.getElementById('btnRejectAllRequests');
                        const originalAcceptText = btnAccept ? btnAccept.innerHTML : '';
                        const originalRejectText = btnReject ? btnReject.innerHTML : '';

                        if (btnAccept) {
                            btnAccept.disabled = true;
                            btnAccept.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;
                        }
                        if (btnReject) {
                            btnReject.disabled = true;
                            btnReject.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;
                        }

                        // Store original HTML of each row's action container in case of error
                        const originalActionsHTML = {};
                        filtered.forEach(req => {
                            const actionsContainer = document.getElementById(`actions-${req.id}`);
                            if (actionsContainer) {
                                originalActionsHTML[req.id] = actionsContainer.innerHTML;
                                actionsContainer.innerHTML = `<svg class="animate-spin h-6 w-6 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sending...</span>`;
                            }
                        });

                        try {
                            const r = await fetch('backend/attendance.php?action=handleBulkAdjustment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids, decision, remarks })
                            });
                            const d = await r.json();
                            if (d.status === 'success') {
                                if (typeof window.loadRequests === 'function') window.loadRequests();
                                if (typeof loadActivity === 'function') loadActivity();
                                if (typeof window.showCustomConfirm === 'function') {
                                    window.showCustomConfirm("Success", `Bulk requests have been ${decision} successfully, and the interns were notified.`, "success");
                                } else {
                                    alert(`Bulk requests have been ${decision} successfully.`);
                                }
                            } else {
                                if (typeof window.showCustomConfirm === 'function') {
                                    window.showCustomConfirm("Error", d.message, "error");
                                } else {
                                    alert(d.message);
                                }
                            }
                        } catch (e) {
                            if (typeof window.showCustomConfirm === 'function') {
                                window.showCustomConfirm("Error", "Bulk operation failed.", "error");
                            } else {
                                alert("Bulk operation failed.");
                            }
                        } finally {
                            if (btnAccept) {
                                btnAccept.disabled = false;
                                btnAccept.innerHTML = originalAcceptText;
                            }
                            if (btnReject) {
                                btnReject.disabled = false;
                                btnReject.innerHTML = originalRejectText;
                            }
                            // Restore original HTML if error occurred and requests weren't reloaded
                            filtered.forEach(req => {
                                const actionsContainer = document.getElementById(`actions-${req.id}`);
                                if (actionsContainer && originalActionsHTML[req.id]) {
                                    actionsContainer.innerHTML = originalActionsHTML[req.id];
                                }
                            });
                        }
                    };

                    const confirmTitle = decision === 'approved' ? "Approve All Requests?" : "Reject All Requests?";
                    const confirmMsg = `Are you sure you want to ${decision} all ${filtered.length} pending request(s)?`;

                    if (decision === 'rejected') {
                        if (typeof window.showCustomPrompt === 'function') {
                            window.showCustomPrompt(
                                confirmTitle,
                                "Please enter a reason for rejection (optional) for all selected requests:",
                                "Reason for rejection...",
                                (remarks) => {
                                    performBulkAction(remarks);
                                }
                            );
                        } else {
                            const remarks = prompt("Please enter a reason for rejection (optional) for all selected requests:");
                            if (remarks !== null) {
                                performBulkAction(remarks);
                            }
                        }
                    } else {
                        if (typeof window.showCustomConfirm === 'function') {
                            window.showCustomConfirm(
                                confirmTitle,
                                confirmMsg,
                                "confirm",
                                () => {
                                    performBulkAction('');
                                }
                            );
                        } else {
                            if (confirm(confirmMsg)) {
                                performBulkAction('');
                            }
                        }
                    }
                };





                const fpActivity = flatpickr("#dateFilterActivity", {
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "F j, Y",
                    defaultDate: "today",
                    maxDate: "today",
                    disable: [
                        function (date) {
                            return (date.getDay() === 0 || date.getDay() === 6);
                        }
                    ],
                    onReady: function (selectedDates, dateStr, instance) {
                        instance.altInput.style.cursor = 'pointer';
                    },
                    onChange: (d, str) => { activityPage = 1; loadActivity(); }
                });
                // Removed History date filter flatpickr as requested






                setInterval(async () => {
                    try {
                        const r = await fetch('backend/attendance.php?action=getPendingRequests');
                        const d = await r.json();
                        if (d.status === 'success') {
                            const badge = document.getElementById('requestBadge');
                            if (badge) {
                                if (d.requests.length > 0) {
                                    badge.textContent = d.requests.length;
                                    badge.classList.remove('hidden');
                                } else {
                                    badge.classList.add('hidden');
                                }
                            }
                        }
                    } catch (e) { console.error("Badge update failed", e); }
                }, 30000); // Check every 30s


                async function loadActivity() {
                    const now = getNow();
                    const date = document.getElementById('dateFilterActivity').value;
                    let url = `backend/attendance.php?action=history&year=${now.getFullYear()}`;
                    if (date) url += `&date=${date}`;
                    else url += `&month=${String(now.getMonth() + 1).padStart(2, '0')}`;

                    const r = await fetch(url);
                    const d = await r.json();
                    activityData = d.status === 'success' ? d.history : [];
                    renderActivity();
                    updateMetrics();
                }

                function renderActivity() {
                    const body = document.getElementById('adminActivityFeed');
                    const searchTerm = document.getElementById('searchActivityFeed')?.value.toLowerCase() || '';
                    const filtered = activityData.filter(row => row.full_name && row.full_name.toLowerCase().includes(searchTerm));
                    const start = (activityPage - 1) * itemsPerPage;
                    const paginated = filtered.slice(start, start + itemsPerPage);
                    body.innerHTML = '';
                    paginated.forEach(row => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-50 transition-colors';

                        let durText = '--';
                        let durClass = 'text-emerald-600';
                        let durDataAttr = '';

                        if (row.is_absent == 1) {
                            durText = '';
                            durClass = 'text-rose-600 font-black';
                            tr.classList.add('bg-rose-50/10');
                        } else if (row.total_seconds) {
                            durText = formatSecondsToText(row.total_seconds);
                            if (parseInt(row.total_seconds) >= 43200) {
                                durClass = 'text-rose-600 font-black flex items-center justify-center gap-1';
                                durText = `<span>${formatSecondsToText(row.total_seconds)}</span><svg class="w-5 h-5 text-rose-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Forgot to Time Out (Auto Timed Out)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
                            }
                        } else if (row.formatted_time_in && !row.raw_time_out) {
                            const startTime = new Date(row.raw_date + ' ' + row.raw_time_in).getTime();
                            const now = Date.now();
                            let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

                            if (diffSeconds >= 0) {
                                durText = formatSecondsToText(diffSeconds, true);
                                durClass = 'text-indigo-600 live-duration animate-pulse';
                                tr.classList.add('bg-indigo-50/10');
                                durDataAttr = `data-start="${startTime}"`;
                            } else {
                                durText = 'Starting...';
                            }
                        }

                        tr.innerHTML = `
                        <td class="px-6 py-6 font-bold text-slate-800">${row.full_name}</td>
                        <td class="px-6 py-6 text-sm font-bold text-slate-400">${row.formatted_date}</td>
                        <td class="px-6 py-6 text-center text-emerald-600 font-black">${row.is_absent == 1 && !row.raw_time_in ? '--' : row.formatted_time_in}</td>
                        <td class="px-6 py-6 text-center text-rose-600 font-black">${row.is_absent == 1 ? '--' : row.formatted_time_out}</td>
                        <td class="px-6 py-6 text-center ${durClass} font-black text-lg" ${durDataAttr}>${durText}</td>
                    `;
                        body.appendChild(tr);
                    });
                    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                    renderPagination('pagesActivity', activityPage, totalPages, (p) => {
                        activityPage = p;
                        renderActivity();
                    });
                    document.getElementById('prevPageActivity').disabled = activityPage === 1;
                    document.getElementById('nextPageActivity').disabled = activityPage >= totalPages;
                }

                async function loadHistory() {
                    const now = getNow();

                    // Fetch all users first
                    const uRes = await fetch('backend/get_users.php');
                    const uData = await uRes.json();
                    if (uData.status !== 'success') return;

                    // Fetch ALL history records ever for everyone
                    let historyUrl = `backend/attendance.php?action=history&month=all`;

                    const hRes = await fetch(historyUrl);
                    const hData = await hRes.json();
                    const allHistory = hData.status === 'success' ? hData.history : [];

                    // Filter out archived users
                    const activeUsers = uData.users.filter(u => u.is_archived != 1);

                    // Group by user
                    historyData = activeUsers.map(u => {
                        const userLogs = allHistory.filter(log => log.user_id == u.id);
                        let totalSec = 0;
                        userLogs.forEach(log => totalSec += parseInt(log.total_seconds || 0));
                        return {
                            ...u,
                            activeDays: userLogs.length,
                            totalSec: totalSec
                        };
                    });

                    renderHistory();
                }

                function renderHistory() {
                    const body = document.getElementById('adminSummaryTable');
                    const start = (historyPage - 1) * itemsPerPage;
                    const paginated = historyData.slice(start, start + itemsPerPage);
                    body.innerHTML = '';
                    paginated.forEach(u => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-50 transition-colors';
                        tr.innerHTML = `
                        <td class="px-6 py-8">${u.full_name}</td>
                        <td class="px-6 py-8 text-center font-black text-slate-400">${u.activeDays} Days</td>
                        <td class="px-6 py-8 text-right font-black text-indigo-600 text-2xl">${formatSecondsToText(u.totalSec)}</td>
                        <td class="px-6 py-8 text-center">
                            <button onclick="openUserReport('${u.id}', '${u.full_name}')" class="px-8 py-3 bg-black text-white text-xs font-black rounded-2xl hover:scale-105 transition-all">View</button>
                        </td>
                    `;
                        body.appendChild(tr);
                    });
                    const totalPages = Math.ceil(historyData.length / itemsPerPage) || 1;
                    renderPagination('pagesHistory', historyPage, totalPages, (p) => {
                        historyPage = p;
                        renderHistory();
                    });
                    document.getElementById('prevPageHistory').disabled = historyPage === 1;
                    document.getElementById('nextPageHistory').disabled = historyPage >= totalPages;
                }

                async function updateMetrics() {
                    try {
                        const now = getNow();
                        const usersRes = await fetch('backend/get_users.php');
                        const usersData = await usersRes.json();
                        if (usersData.status !== 'success') return;

                        if (document.getElementById('totalInterns')) {
                            const activeInterns = (usersData.users || []).filter(u => u.is_archived != 1);
                            document.getElementById('totalInterns').textContent = activeInterns.length;
                        }

                        const today = now.toISOString().split('T')[0];
                        const res = await fetch(`backend/attendance.php?action=history&date=${today}`);
                        const data = await res.json();
                        if (document.getElementById('activeToday')) {
                            const activeCount = (data && data.history) ? data.history.filter(h => h.raw_time_in !== null).length : 0;
                            document.getElementById('activeToday').textContent = activeCount;
                        }

                        const mRes = await fetch(`backend/attendance.php?action=history&month=${String(now.getMonth() + 1).padStart(2, '0')}&year=${now.getFullYear()}`);
                        const mData = await mRes.json();
                        let totalS = 0;
                        if (mData && mData.history) {
                            mData.history.forEach(h => { if (h && h.total_seconds && parseInt(h.total_seconds) !== 43200) totalS += parseInt(h.total_seconds); });
                        }
                        if (document.getElementById('totalHours')) {
                            document.getElementById('totalHours').textContent = (totalS / 3600).toFixed(1);
                        }
                    } catch (e) {
                        console.error("Failed to update metrics", e);
                    }
                }

                document.getElementById('searchActivityFeed')?.addEventListener('input', () => {
                    activityPage = 1;
                    renderActivity();
                });

                document.getElementById('prevPageActivity').onclick = () => { if (activityPage > 1) { activityPage--; renderActivity(); } };
                document.getElementById('nextPageActivity').onclick = () => { if (activityPage * itemsPerPage < activityData.length) { activityPage++; renderActivity(); } };
                document.getElementById('prevPageHistory').onclick = () => { if (historyPage > 1) { historyPage--; renderHistory(); } };
                document.getElementById('nextPageHistory').onclick = () => { if (historyPage * itemsPerPage < historyData.length) { historyPage++; renderHistory(); } };

                document.getElementById('prevPageModal').onclick = () => { if (window.modalPage > 1) { window.modalPage--; renderModal(); } };
                document.getElementById('nextPageModal').onclick = () => {
                    const totalPages = Math.ceil((window.modalRawData || []).length / 3) || 1;
                    if (window.modalPage < totalPages) { window.modalPage++; renderModal(); }
                };

                // Requests View Pagination & Search Listeners
                const prevReqBtn = document.getElementById('prevPageRequests');
                if (prevReqBtn) {
                    prevReqBtn.onclick = () => { if (requestsPage > 1) { requestsPage--; renderRequests(); } };
                }
                const nextReqBtn = document.getElementById('nextPageRequests');
                if (nextReqBtn) {
                    nextReqBtn.onclick = () => {
                        const query = document.getElementById('searchRequests')?.value.toLowerCase() || '';
                        const filtered = requestsData.filter(req => req.full_name.toLowerCase().includes(query));
                        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                        if (requestsPage < totalPages) { requestsPage++; renderRequests(); }
                    };
                }
                const searchReqInput = document.getElementById('searchRequests');
                if (searchReqInput) {
                    searchReqInput.addEventListener('input', () => {
                        requestsPage = 1;
                        renderRequests();
                    });
                }

                let activityData = [];
                let historyData = [];
                let activityPage = 1;
                let historyPage = 1;
                let internsPage = 1;
                const itemsPerPage = 5;
                let internsData = [];
                window._internsData = internsData; // expose for global access

                // Auth (Moved down to avoid blocking listeners)
                try {
                    const res = await fetch('backend/auth.php?action=check');
                    const auth = await res.json();
                    if (auth.status !== 'success' || auth.role !== 'admin') { window.location.href = 'login.html'; return; }
                    if (document.getElementById('adminUsername')) document.getElementById('adminUsername').textContent = auth.username;
                } catch (e) { console.error("Auth check failed", e); }

                window.loadInterns = async function loadInterns() {
                    const res = await fetch('backend/get_users.php');
                    const data = await res.json();
                    internsData = data.status === 'success' ? data.users : [];
                    window._internsData = internsData;
                    renderInterns();
                }

                window.renderInterns = function renderInterns() {
                    const body = document.getElementById('adminInternsTable');
                    const query = document.getElementById('searchInterns').value.toLowerCase();
                    const filtered = internsData.filter(u => u.full_name.toLowerCase().includes(query) || (u.serial_number && u.serial_number.toLowerCase().includes(query)));

                    const start = (internsPage - 1) * itemsPerPage;
                    const paginated = filtered.slice(start, start + itemsPerPage);
                    body.innerHTML = '';

                    if (paginated.length === 0) {
                        body.innerHTML = '<tr><td colspan="4" class="text-center py-20 text-slate-400 font-bold">No interns found matching your search.</td></tr>';
                    }

                    paginated.forEach(u => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-50 group';
                        tr.innerHTML = `
                        <td class="px-6 py-6">
                            <div class="font-bold text-slate-900">${u.full_name}</div>
                        </td>
                        <td class="px-6 py-6 font-mono font-bold text-slate-400 tracking-wider text-sm">${u.serial_number || 'N/A'}</td>
                        <td class="px-6 py-6 text-center">
                            <span class="px-4 py-1.5 ${u.serial_number ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'} rounded-full font-black text-[10px] uppercase tracking-widest shadow-sm">
                                ${u.serial_number ? 'READY' : 'PENDING'}
                            </span>
                        </td>
                        <td class="px-6 py-6 text-right">
                            <div class="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button class="print-btn w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-lg shadow-indigo-100">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                </button>
                                <button class="delete-btn w-11 h-11 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                        tr.querySelector('.print-btn').onclick = (e) => { e.stopPropagation(); window.printBarcode(u.id, u.full_name, u.serial_number); };
                        tr.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); window.deleteIntern(u.id, u.full_name); };
                        body.appendChild(tr);
                    });

                    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
                    renderPagination('pagesInternsDir', internsPage, totalPages, (p) => {
                        internsPage = p;
                        renderInterns();
                    });
                    document.getElementById('prevPageInterns').disabled = internsPage === 1;
                    document.getElementById('nextPageInterns').disabled = internsPage >= totalPages;
                }

                window.printBarcode = function (id, name, serial) {
                    if (!serial) {
                        alert("This intern does not have a serial number yet.");
                        return;
                    }
                    window.currentPrintData = { id, name, serial };
                    const photoModal = document.getElementById('photoUploadModal');
                    if (photoModal) {
                        document.getElementById('dropZoneContent').classList.remove('hidden');
                        document.getElementById('photoPreview').classList.add('hidden');
                        document.getElementById('photoInput').value = '';
                        document.getElementById('confirmPrintBtn').disabled = true;
                        photoModal.classList.remove('hidden');
                    }
                };

                window.deleteIntern = async function (id, name) {
                    if (!confirm(`Are you sure you want to completely remove ${name}?\n\nThis will delete their user record, all attendance history, and pending requests.\nThis action CANNOT be undone.`)) return;
                    try {
                        const r = await fetch(`backend/auth.php?action=deleteUser&id=${id}`);
                        const d = await r.json();
                        if (d.status === 'success') {
                            loadInterns();
                            loadHistory();
                            loadActivity();
                            updateMetrics();
                            loadRequests();
                        } else {
                            alert(d.message);
                        }
                    } catch (e) {
                        alert("Deletion failed.");
                    }
                };

                const photoInput = document.getElementById('photoInput');
                const photoDropZone = document.getElementById('photoDropZone');

                photoDropZone.onclick = () => photoInput.click();

                photoInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (f) => {
                            const previewImg = document.querySelector('#photoPreview img');
                            previewImg.src = f.target.result;
                            document.getElementById('photoPreview').classList.remove('hidden');
                            document.getElementById('dropZoneContent').classList.add('hidden');
                            document.getElementById('confirmPrintBtn').disabled = false;
                        };
                        reader.readAsDataURL(file);
                    }
                };

                document.getElementById('cancelPhotoBtn').onclick = () => {
                    document.getElementById('photoUploadModal').classList.add('hidden');
                };

                document.getElementById('confirmPrintBtn').onclick = () => {
                    const photoData = document.querySelector('#photoPreview img').src;

                    // Get Logo as Data URL to ensure it prints
                    const logoImg = new Image();
                    logoImg.crossOrigin = "anonymous";
                    logoImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(logoImg, 0, 0);
                        const logoData = canvas.toDataURL('image/png');
                        generateActualPass(window.currentPrintData.name, window.currentPrintData.serial, photoData, logoData);
                    };
                    logoImg.onerror = () => {
                        // Fallback to path if canvas fails
                        generateActualPass(currentPrintData.name, currentPrintData.serial, photoData, 'assets/logo.png');
                    };
                    logoImg.src = 'assets/logo.png';

                    document.getElementById('photoUploadModal').classList.add('hidden');
                };

                function generateActualPass(name, serial, photo, logo) {
                    const printWindow = window.open('', '_blank', 'width=800,height=1000');
                    if (!printWindow) {
                        alert("Pop-up blocked! Please allow pop-ups to print the ID pass.");
                        return;
                    }

                    printWindow.document.write(`
                    <html>
                        <head>
                            <title>Intern ID Pass - ${name}</title>
                            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                            <style>
                                @page { 
                                    size: portrait;
                                    margin: 0; 
                                }
                                * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                                body { 
                                    margin: 0; 
                                    padding: 0;
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: center; 
                                    height: 100vh; 
                                    background: #f8fafc;
                                    font-family: 'Plus Jakarta Sans', sans-serif;
                                }
                                .id-card {
                                    width: 54mm;
                                    height: 85.6mm;
                                    background: #ffffff;
                                    border-radius: 4mm;
                                    overflow: hidden;
                                    position: relative;
                                    display: flex;
                                    flex-direction: column;
                                    border: 0.2mm solid #e2e8f0;
                                    margin: 0 auto;
                                    box-shadow: 0 10mm 30mm rgba(0,0,0,0.1);
                                }
                                .header-brand {
                                    height: 38mm;
                                    background: linear-gradient(135deg, #002f6c 0%, #004b93 100%);
                                    position: relative;
                                    padding: 5mm;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                }
                                .logo-box { height: 10mm; width: 100%; display: flex; justify-content: center; margin-bottom: 3mm; }
                                .logo-box img { height: 100%; object-fit: contain; filter: brightness(0) invert(1); }
                                
                                .photo-wrap {
                                    position: relative;
                                    z-index: 20;
                                    margin-top: 2mm;
                                }
                                .photo-circle {
                                    width: 28mm;
                                    height: 28mm;
                                    border-radius: 50%;
                                    border: 1.2mm solid #ffffff;
                                    overflow: hidden;
                                    background: #f1f5f9;
                                    box-shadow: 0 3mm 8mm rgba(0,0,0,0.25);
                                }
                                .photo-circle img { width: 100%; height: 100%; object-fit: cover; }

                                .wave-bg {
                                    position: absolute;
                                    bottom: -8mm;
                                    left: -10%;
                                    width: 120%;
                                    height: 16mm;
                                    background: #ffffff;
                                    border-radius: 50% 50% 0 0;
                                    z-index: 10;
                                }
                                
                                .info-content {
                                    flex: 1;
                                    padding: 8mm 3mm 3mm;
                                    text-align: center;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    z-index: 20;
                                }
                                .intern-name { 
                                    margin: 0; 
                                    font-size: 13pt; 
                                    font-weight: 900; 
                                    color: #0f172a;
                                    line-height: 1.1;
                                    letter-spacing: -0.03em;
                                    text-transform: uppercase;
                                }
                                .dept-title {
                                    margin: 1.5mm 0 0.5mm;
                                    font-size: 7pt;
                                    font-weight: 800;
                                    color: #002f6c;
                                    text-transform: uppercase;
                                    letter-spacing: 0.15em;
                                }
                                .internship-tag {
                                    font-size: 6pt;
                                    font-weight: 700;
                                    color: #94a3b8;
                                    text-transform: uppercase;
                                    letter-spacing: 0.4em;
                                    margin-bottom: 4mm;
                                }

                                .barcode-section {
                                    width: 100%;
                                    padding: 2.5mm;
                                    background: #fdfdfd;
                                    border: 0.3mm solid #f1f5f9;
                                    border-radius: 3mm;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    margin-top: auto;
                                }
                                #barcodeCanvas { width: 42mm; height: 12mm; }
                                .serial-label {
                                    margin-top: 1.5mm;
                                    font-family: 'Courier New', monospace;
                                    font-size: 8.5pt;
                                    font-weight: 900;
                                    color: #334155;
                                    letter-spacing: 0.1em;
                                }

                                .footer-decoration {
                                    position: absolute;
                                    bottom: 0;
                                    left: 0;
                                    width: 100%;
                                    height: 2mm;
                                    background: #002f6c;
                                }

                                @media print {
                                    body { background: transparent; }
                                    .id-card { 
                                        box-shadow: none; 
                                        border: 1px solid #eee;
                                        page-break-inside: avoid;
                                    }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="id-card">
                                <div class="header-brand">
                                    <div class="logo-box"><img src="${logo}"></div>
                                    <div class="photo-wrap">
                                        <div class="photo-circle"><img src="${photo}"></div>
                                    </div>
                                    <div class="wave-bg"></div>
                                </div>
                                <div class="info-content">
                                    <h1 class="intern-name">${name}</h1>
                                    <p class="dept-title">Operations Department</p>
                                    <p class="internship-tag">Intern Associate</p>
                                    <div class="barcode-section">
                                        <svg id="barcodeCanvas"></svg>
                                        <div class="serial-label">${serial}</div>
                                    </div>
                                </div>
                                <div class="footer-decoration"></div>
                            </div>
                            
                                function init() {
                                    if (typeof JsBarcode === 'undefined') {
                                        setTimeout(init, 50);
                                        return;
                                    }
                                    JsBarcode("#barcodeCanvas", "${serial}", {
                                        format: "CODE128",
                                        width: 2,
                                        height: 40,
                                        displayValue: false,
                                        margin: 0
                                    });
                                    setTimeout(() => { window.print(); window.close(); }, 1000);
                                }
                                window.onload = init;
                            <\/script>
                        </body>
                    </html>
                `);
                    printWindow.document.close();
                }

                document.getElementById('searchInterns').oninput = () => { internsPage = 1; renderInterns(); };
                document.getElementById('prevPageInterns').onclick = () => { if (internsPage > 1) { internsPage--; renderInterns(); } };
                document.getElementById('nextPageInterns').onclick = () => {
                    const totalPages = Math.ceil(internsData.length / itemsPerPage) || 1;
                    if (internsPage < totalPages) { internsPage++; renderInterns(); }
                };

                document.getElementById('resetActivity').onclick = () => {
                    const svg = document.getElementById('resetActivity').querySelector('svg');
                    svg.classList.add('animate-spin-custom');
                    setTimeout(() => svg.classList.remove('animate-spin-custom'), 800);
                    fpActivity.clear(); activityPage = 1; loadActivity();
                };
                // Removed resetHistory listener

                const logoutBtn = document.getElementById('logoutBtn');
                const logoutModal = document.getElementById('logoutModal');
                const confirmLogout = document.getElementById('confirmLogout');
                const cancelLogout = document.getElementById('cancelLogout');

                if (logoutBtn && logoutModal) {
                    logoutBtn.addEventListener('click', () => {
                        logoutModal.classList.remove('hidden');
                    });

                    cancelLogout.addEventListener('click', () => {
                        logoutModal.classList.add('hidden');
                    });

                    confirmLogout.addEventListener('click', async () => {
                        await fetch('backend/auth.php?action=logout');
                        window.location.href = 'login.html';
                    });
                }
                document.getElementById('closeModalBtn').onclick = () => {
                    document.getElementById('userReportModal').classList.add('hidden');
                    document.getElementById('mainHeader').classList.remove('hidden');
                };

                loadActivity();
                loadHistory();
                loadInterns();
                updateMetrics();
                loadRequests(); // Initial check for request badge

                // Real-time updates for Admin
                setInterval(() => {
                    loadActivity();
                    updateMetrics();
                }, 10000);

                startLiveDurationTimer();

                // Initialize Admin Edit Flatpickrs
                window.fpEditDate = flatpickr("#editDate", { dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y" });
                window.fpEditTimeIn = flatpickr("#editTimeIn", { enableTime: true, noCalendar: true, dateFormat: "H:i", altInput: true, altFormat: "h:i K", time_24hr: false });
                window.fpEditTimeOut = flatpickr("#editTimeOut", { enableTime: true, noCalendar: true, dateFormat: "H:i", altInput: true, altFormat: "h:i K", time_24hr: false });
            });

            window.openAdminEditModal = function (rec) {
                if (!rec.attendance_id) {
                    alert("Cannot edit a record that hasn't been saved to the database (e.g. historical absent days).");
                    return;
                }
                document.getElementById('editAttendanceId').value = rec.attendance_id;
                window.fpEditDate.setDate(rec.raw_date);
                window.fpEditTimeIn.setDate(rec.raw_time_in);
                window.fpEditTimeOut.setDate(rec.raw_time_out || '');

                document.getElementById('adminEditModal').classList.remove('hidden');
            };

            window.closeAdminEditModal = function () {
                document.getElementById('adminEditModal').classList.add('hidden');
            };

            window.saveAdminEdit = async function () {
                const id = document.getElementById('editAttendanceId').value;
                const date = document.getElementById('editDate').value;
                const timeIn = document.getElementById('editTimeIn').value;
                const timeOut = document.getElementById('editTimeOut').value;

                if (!date || !timeIn) {
                    alert("Date and Time In are required.");
                    return;
                }

                try {
                    const r = await fetch('backend/attendance.php?action=adminEditAttendance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, date, time_in: timeIn, time_out: timeOut })
                    });
                    const d = await r.json();
                    if (d.status === 'success') {
                        closeAdminEditModal();
                        // Refresh the current view
                        openUserReport(window.currentReportUserId, window.currentReportUserName);
                    } else {
                        alert(d.message || "Failed to update record.");
                    }
                } catch (e) {
                    alert("An error occurred while saving.");
                }
            };

            window.deleteAttendanceRecord = function (id, date) {
                if (!id) {
                    alert("Cannot delete a record that hasn't been saved to the database (e.g. historical absent days).");
                    return;
                }
                window.showCustomConfirm(
                    "Delete Attendance Log?",
                    `Are you sure you want to permanently delete the attendance record for ${date}? This action cannot be undone.`,
                    "delete",
                    async () => {
                        try {
                            const r = await fetch('backend/attendance.php?action=adminDeleteAttendance', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id })
                            });
                            const d = await r.json();
                            if (d.status === 'success') {
                                // Refresh the report modal
                                openUserReport(window.currentReportUserId, window.currentReportUserName);
                                // Refresh main tables
                                if (typeof loadHistory === 'function') loadHistory();
                                if (typeof loadActivity === 'function') loadActivity();
                            } else {
                                alert(d.message || "Failed to delete record.");
                            }
                        } catch (e) {
                            alert("An error occurred while deleting.");
                        }
                    }
                );
            };




            function calculateBreakOverlap(startTimeMs, endTimeMs) {
                if (!startTimeMs || !endTimeMs || startTimeMs >= endTimeMs) return 0;
                let totalOverlapSec = 0;
                let current = new Date(startTimeMs);
                let end = new Date(endTimeMs);
                
                let iter = new Date(current.getFullYear(), current.getMonth(), current.getDate());
                const endLimit = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
                
                while (iter < endLimit) {
                    const y = iter.getFullYear();
                    const m = iter.getMonth();
                    const d = iter.getDate();
                    
                    // Break 1: 12 MN - 1 AM
                    const b1Start = new Date(y, m, d, 0, 0, 0).getTime();
                    const b1End = new Date(y, m, d, 1, 0, 0).getTime();
                    
                    // Break 2: 12 NN - 1 PM
                    const b2Start = new Date(y, m, d, 12, 0, 0).getTime();
                    const b2End = new Date(y, m, d, 13, 0, 0).getTime();
                    
                    const overlap1 = Math.max(0, Math.min(endTimeMs, b1End) - Math.max(startTimeMs, b1Start));
                    const overlap2 = Math.max(0, Math.min(endTimeMs, b2End) - Math.max(startTimeMs, b2Start));
                    
                    totalOverlapSec += (overlap1 + overlap2) / 1000;
                    
                    iter.setDate(iter.getDate() + 1);
                }
                return Math.floor(totalOverlapSec);
            }

            function formatSecondsToText(s, isLive = false) {
                if (!s || s <= 0) return '0m';
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                const sec = s % 60;

                if (isLive) {
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                }

                return (h > 0 ? `${h}h ` : '') + `${m}m`;
            }

            function startLiveDurationTimer() {
                if (window.liveDurationInterval) clearInterval(window.liveDurationInterval);
                window.liveDurationInterval = setInterval(() => {
                    const now = Date.now();
                    document.querySelectorAll('.live-duration').forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start'));
                        if (startTime) {
                            const now = Date.now();
                            let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

                            if (diffSeconds >= 0) {
                                el.textContent = formatSecondsToText(diffSeconds, true);
                            }
                        }
                    });
                }, 1000);
            }

            window.openUserReport = async function (id, name) {
                window.currentReportUserId = id;
                window.currentReportUserName = name;
                const modal = document.getElementById('userReportModal');
                let url = `backend/attendance.php?action=history&month=all&user_id=${id}`;

                document.getElementById('modalUserName').textContent = name;
                modal.classList.remove('hidden');
                document.getElementById('mainHeader').classList.add('hidden');
                const r = await fetch(url);
                const d = await r.json();

                if (d.status === 'success') {
                    window.modalRawData = d.history;
                    window.modalPage = 1;

                    // Pre-calculate total time including live ones
                    let totalS = 0;
                    d.history.forEach(rec => {
                        if (rec.is_absent == 1) return;
                        if (rec.total_seconds) {
                            if (parseInt(rec.total_seconds) !== 43200) {
                                totalS += parseInt(rec.total_seconds);
                            }
                        } else if (rec.raw_time_in && !rec.raw_time_out) {
                            const startTime = new Date(rec.raw_date + ' ' + rec.raw_time_in).getTime();
                            const now = Date.now();
                            let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
                            totalS += diffSeconds;
                        }
                    });
                    document.getElementById('modalTotalHours').textContent = formatSecondsToText(totalS);
                    renderModal();
                }
            }

             window.renderModal = function () {
                const tbody = document.getElementById('modalTableBody');
                const itemsPerPage = 3;
                const start = (window.modalPage - 1) * itemsPerPage;
                const data = window.modalRawData || [];
                const paginated = data.slice(start, start + itemsPerPage);

                tbody.innerHTML = '';

                // Group the paginated items by date for subtotals (within the current page)
                const grouped = {};
                paginated.forEach(rec => {
                    const date = rec.formatted_date;
                    if (!grouped[date]) grouped[date] = [];
                    grouped[date].push(rec);
                });

                Object.keys(grouped).forEach(date => {
                    let dayTotalS = 0;
                    grouped[date].forEach(rec => {
                        let currentTotalS = parseInt(rec.total_seconds || 0);
                        let durText = formatSecondsToText(currentTotalS);
                        let durClass = currentTotalS >= 43200 ? 'text-rose-600 font-black flex items-center justify-center gap-1' : 'text-emerald-600';
                        if (currentTotalS >= 43200) {
                            durText = `<span>${formatSecondsToText(currentTotalS)}</span><svg class="w-5 h-5 text-rose-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Forgot to Time Out (Auto Timed Out)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
                        }
                        let durDataAttr = '';

                        if (rec.is_absent == 1) {
                            durText = '';
                            durClass = 'text-rose-600 font-black';
                            currentTotalS = 0;
                        } else if (!rec.raw_time_out && rec.raw_time_in) {
                            const startTime = new Date(rec.raw_date + ' ' + rec.raw_time_in).getTime();
                            const now = Date.now();
                            let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

                            if (diffSeconds >= 0) {
                                durText = formatSecondsToText(diffSeconds, true);
                                durClass = 'text-indigo-600 live-duration animate-pulse';
                                durDataAttr = `data-start="${startTime}"`;
                                currentTotalS = diffSeconds;
                            }
                        }

                        dayTotalS += currentTotalS;

                        // JSON escape helper for pre-filling
                        const escapedRec = JSON.stringify(rec).replace(/'/g, "\\'");

                        const actionButtons = rec.attendance_id ? `
                            <div class="flex justify-end gap-2">
                                <button onclick='openAdminEditModal(${escapedRec})' class="p-2 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all" title="Edit">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button onclick='deleteAttendanceRecord(${rec.attendance_id}, "${date}")' class="p-2 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition-all" title="Delete">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        ` : `<span class="text-[10px] text-slate-400 font-black uppercase tracking-widest px-2">Absent</span>`;

                        tbody.innerHTML += `
                        <tr class="hover:bg-slate-50/50">
                            <td class="px-6 py-6 font-bold text-slate-400 text-sm">${date}</td>
                            <td class="px-6 py-6 text-center text-emerald-600 font-black">${rec.is_absent == 1 && !rec.raw_time_in ? '--' : rec.formatted_time_in}</td>
                            <td class="px-6 py-6 text-center text-rose-600 font-black">${rec.is_absent == 1 ? '--' : rec.formatted_time_out}</td>
                            <td class="px-6 py-6 text-right font-black ${durClass}" ${durDataAttr}>${durText}</td>
                            <td class="px-6 py-6 text-right">${actionButtons}</td>
                        </tr>
                    `;
                    });
                    tbody.innerHTML += `
                    <tr class="bg-slate-50/50">
                        <td colspan="3" class="px-6 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Daily Subtotal:</td>
                        <td class="px-6 py-3 text-right font-black text-black text-base border-t border-slate-200">${formatSecondsToText(dayTotalS)}</td>
                        <td class="px-6 py-3 border-t border-slate-200"></td>
                    </tr>
                `;
                });

                const modalItemsPerPage = 3;
                const totalPages = Math.ceil(data.length / modalItemsPerPage) || 1;
                renderInputPagination('pagesModal', window.modalPage, totalPages, (p) => {
                    window.modalPage = p;
                    renderModal();
                });
                document.getElementById('prevPageModal').disabled = window.modalPage === 1;
                document.getElementById('nextPageModal').disabled = window.modalPage >= totalPages;
            }

            // ============================================================
            // TOP-LEVEL GLOBAL FUNCTIONS — outside DOMContentLoaded
            // These MUST be at top level so onclick attributes can call them
            // ============================================================

            // ============================================================
            // TOP-LEVEL GLOBAL FUNCTIONS
            // ============================================================

            window.currentPrintData = null;

            window.printBarcode = function (id, name, serial) {
                if (!serial) {
                    alert("This intern does not have a serial number assigned yet.");
                    return;
                }
                window.currentPrintData = { id: id, name: name, serial: serial };
                const modal = document.getElementById('photoUploadModal');
                const preview = document.getElementById('photoPreview');
                const content = document.getElementById('dropZoneContent');
                const confirmBtn = document.getElementById('confirmPrintBtn');
                const photoInput = document.getElementById('photoInput');

                if (photoInput) photoInput.value = '';
                if (preview) preview.classList.add('hidden');
                if (content) content.classList.remove('hidden');
                if (confirmBtn) confirmBtn.disabled = true;

                modal.classList.remove('hidden');
            };

            window.deleteIntern = function (id, name) {
                const modal = document.getElementById('confirmModal');
                const btn = document.getElementById('confirmBtn');
                const title = document.getElementById('confirmTitle');
                const msg = document.getElementById('confirmMessage');

                if (title) title.textContent = 'Remove Intern?';
                if (msg) msg.textContent = `Are you sure you want to remove ${name}? All attendance logs and account data will be permanently deleted.`;

                if (modal) modal.classList.remove('hidden');

                if (btn) {
                    btn.onclick = async function () {
                        btn.disabled = true;
                        btn.innerHTML = '<span class="flex items-center gap-2">Deleting...</span>';
                        try {
                            const r = await fetch(`backend/auth.php?action=deleteUser&id=${id}`);
                            const d = await r.json();
                            if (d.status === 'success') {
                                 window.closeConfirmModal();
                                 if (typeof window.loadInterns === 'function') window.loadInterns();
                                 if (typeof loadHistory === 'function') loadHistory();
                                 if (typeof loadActivity === 'function') loadActivity();
                                 if (typeof updateMetrics === 'function') updateMetrics();
                                 if (typeof loadRequests === 'function') loadRequests();
                             } else {
                                alert(d.message || 'Failed to delete intern.');
                            }
                        } catch (e) {
                            alert('Network error: ' + e.message);
                        } finally {
                            btn.disabled = false;
                            btn.textContent = 'Delete';
                        }
                    };
                }
            };

            window.closeConfirmModal = function () {
                const modal = document.getElementById('confirmModal');
                if (modal) modal.classList.add('hidden');
            };

        