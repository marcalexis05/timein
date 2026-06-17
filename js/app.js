let barcodeInputBuffer = '';
let lastKeyTimestamp = Date.now();
let activePortalType = null; // Tracks which portal is waiting for a scan

// Base API URL depending on deployment. Empty string if in same directory.
const API_BASE = 'backend/';

let notifCallback = null;

// ── Global custom notification (replaces all browser alert()) ──
function showNotif(msg, type = 'error', callback = null) {
    const modal = document.getElementById('notifModal');
    const iconEl = document.getElementById('notifIcon');
    const iconSvg = document.getElementById('notifIconSvg');
    const titleEl = document.getElementById('notifTitle');
    const msgEl = document.getElementById('notifMsg');
    if (!modal) { console.warn(msg); return; }

    notifCallback = callback;

    if (type === 'error') {
        iconEl.className = 'w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 bg-rose-50';
        iconSvg.className = 'w-8 h-8 text-rose-500';
        iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>';
        titleEl.textContent = 'Oops!';
    } else if (type === 'success') {
        iconEl.className = 'w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 bg-emerald-50';
        iconSvg.className = 'w-8 h-8 text-emerald-500';
        iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>';
        titleEl.textContent = 'Success!';
    } else {
        iconEl.className = 'w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 bg-indigo-50';
        iconSvg.className = 'w-8 h-8 text-indigo-500';
        iconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/>';
        titleEl.textContent = 'Notice';
    }
    msgEl.textContent = msg;
    modal.style.display = 'flex';
}

window.closeNotifModal = function () {
    const modal = document.getElementById('notifModal');
    if (modal) modal.style.display = 'none';
    if (typeof notifCallback === 'function') {
        const cb = notifCallback;
        notifCallback = null;
        cb();
    }
};

function showStatus(elId, message, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'bg-emerald-100', 'text-emerald-700', 'bg-rose-100', 'text-rose-700', 'bg-indigo-100', 'text-indigo-700');

    if (type === 'success') {
        el.classList.add('bg-emerald-100', 'text-emerald-700');
    } else if (type === 'error') {
        el.classList.add('bg-rose-100', 'text-rose-700');
    } else {
        el.classList.add('bg-indigo-100', 'text-indigo-700');
    }
}

// ----------------------------------------------------
// DASHBOARD STATE
// ----------------------------------------------------
let logsData = [];
let logsPage = 1;
const logsPerPage = 5;

let dashboardPage = 1;
const dashboardPerPage = 5;
let dashboardSearchTerm = '';

let personalHistoryData = [];
let personalHistoryPage = 1;
const personalHistoryPerPage = 5;

let internsData = [];
let internsPage = 1;
const internsPerPage = 6;

// ----------------------------------------------------
// UTILITIES
// ----------------------------------------------------

/**
 * Collapse duplicate attendance rows for the same date into one.
 * Keeps: earliest time_in, latest time_out, highest total_seconds.
 */
function deduplicateByDate(rows) {
    const seen = new Map();
    (rows || []).forEach(row => {
        const key = row.raw_date || row.formatted_date;
        if (!seen.has(key)) {
            seen.set(key, { ...row });
        } else {
            const ex = seen.get(key);
            if (row.raw_time_in && (!ex.raw_time_in || row.raw_time_in < ex.raw_time_in)) {
                ex.raw_time_in = row.raw_time_in;
                ex.formatted_time_in = row.formatted_time_in;
            }
            if (row.raw_time_out && (!ex.raw_time_out || row.raw_time_out > ex.raw_time_out)) {
                ex.raw_time_out = row.raw_time_out;
                ex.formatted_time_out = row.formatted_time_out;
            }
            if (parseInt(row.total_seconds) > parseInt(ex.total_seconds || 0)) {
                ex.total_seconds = row.total_seconds;
            }
        }
    });
    return Array.from(seen.values());
}

function formatSecondsToText(totalSeconds, isLive = false) {
    if (!totalSeconds || totalSeconds <= 0) return '--';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (isLive) {
        // HH:MM:SS format for live display to feel more "real-time"
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    let timeText = '';
    if (hours > 0) timeText += hours + (hours === 1 ? ' hr ' : ' hrs ');
    if (minutes > 0 || (hours === 0 && !isLive)) timeText += minutes + (minutes === 1 ? ' min' : ' mins');
    return timeText.trim() || '0 min';
}

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

window.renderPagination = function (containerId, currentPage, totalPages, onPageChange) {
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
        const p1 = document.createElement('div');
        p1.className = 'page-num';
        p1.textContent = '1';
        p1.onclick = () => onPageChange(1);
        container.appendChild(p1);
        if (startPage > 2) {
            const dots = document.createElement('div');
            dots.className = 'page-dot';
            dots.textContent = '...';
            container.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const p = document.createElement('div');
        p.className = `page-num ${i === currentPage ? 'active' : ''}`;
        p.textContent = i;
        p.onclick = () => onPageChange(i);
        container.appendChild(p);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('div');
            dots.className = 'page-dot';
            dots.textContent = '...';
            container.appendChild(dots);
        }
        const plast = document.createElement('div');
        plast.className = 'page-num';
        plast.textContent = totalPages;
        plast.onclick = () => onPageChange(totalPages);
        container.appendChild(plast);
    }
}

function startLiveDurationTimer() {
    if (window.liveDurationInterval) clearInterval(window.liveDurationInterval);

    window.liveDurationInterval = setInterval(() => {
        const now = Date.now();
        document.querySelectorAll('.live-duration').forEach(el => {
            const startTime = parseInt(el.getAttribute('data-start'));
            if (startTime) {
                let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

                if (diffSeconds >= 0) {
                    el.textContent = formatSecondsToText(diffSeconds, true);
                }
            }
        });
    }, 1000);
}

// ----------------------------------------------------
// DASHBOARD LOGIC
// ----------------------------------------------------
window.initDashboard = async function () {
    console.log("Initializing Barcode Dashboard...");
    try {
        updateActivityDateLabel();
        await window.fetchHistory();

        // Wire up dashboard search bar
        const dashSearch = document.getElementById('dashboardSearch');
        if (dashSearch) {
            dashSearch.addEventListener('input', () => {
                dashboardSearchTerm = dashSearch.value.trim();
                dashboardPage = 1;
                renderLogs();
            });
        }

        // Start Live Systems
        if (window.dashboardInterval) clearInterval(window.dashboardInterval);
        window.dashboardInterval = setInterval(window.fetchHistory, 10000);
    } catch (e) {
        console.error("Dashboard init error:", e);
    } finally {
        if (document.getElementById('globalLoading')) document.getElementById('globalLoading').classList.add('hidden');
        startLiveDurationTimer();
    }

    // Attach Event Listeners
    const btnTimeIn = document.getElementById('btnTimeIn');
    const btnTimeOut = document.getElementById('btnTimeOut');

    if (btnTimeIn) btnTimeIn.onclick = () => startScanner('in');
    if (btnTimeOut) btnTimeOut.onclick = () => startScanner('out');

    // Manual Entry Modal Toggles
    const manualModal = document.getElementById('manualEntryModal');
    const manualDigitsInput = document.getElementById('manualSerialDigits');
    const manualTitle = document.getElementById('manualModalTitle');

    let manualType = 'in';

    // Manual Entry Modal Toggles
    const manualInBtn = document.getElementById('toggleManualIn');
    console.log("Checking toggleManualIn:", manualInBtn);
    if (manualInBtn) {
        manualInBtn.onclick = (e) => {
            e.preventDefault();
            console.log("CLICK: Manual Time In triggered");
            if (manualModal) {
                manualType = 'in';
                if (manualTitle) manualTitle.textContent = 'Manual Time In';
                manualModal.style.display = 'flex';
                if (manualDigitsInput) {
                    manualDigitsInput.value = '';
                    manualDigitsInput.focus();
                    const submitBtn = document.getElementById('submitManualModal');
                    if (submitBtn) submitBtn.disabled = true;
                }
            } else {
                console.error("CRITICAL: manualEntryModal element missing!");
            }
        };
    }

    const manualOutBtn = document.getElementById('toggleManualOut');
    if (manualOutBtn) {
        manualOutBtn.onclick = (e) => {
            e.preventDefault();
            console.log("Manual Time Out modal triggered");
            if (manualModal) {
                manualType = 'out';
                if (manualTitle) manualTitle.textContent = 'Manual Time Out';
                manualModal.style.display = 'flex';
                if (manualDigitsInput) {
                    manualDigitsInput.value = '';
                    manualDigitsInput.focus();
                    const submitBtn = document.getElementById('submitManualModal');
                    if (submitBtn) submitBtn.disabled = true;
                }
            }
        };
    }

    if (manualDigitsInput) {
        manualDigitsInput.oninput = (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            const submitBtn = document.getElementById('submitManualModal');
            if (submitBtn) {
                submitBtn.disabled = e.target.value.length !== 6;
                if (!submitBtn.disabled) {
                    submitBtn.classList.remove('bg-slate-300');
                    submitBtn.classList.add('bg-slate-900');
                } else {
                    submitBtn.classList.remove('bg-slate-900');
                    submitBtn.classList.add('bg-slate-300');
                }
            }
        };

        manualDigitsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const submitBtn = document.getElementById('submitManualModal');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        });
    }

    document.getElementById('closeManualModal')?.addEventListener('click', () => {
        manualModal.style.display = 'none';
        manualDigitsInput.value = '';
    });

    // Visibility Toggle (Manual Entry)
    document.getElementById('toggleManualSerialVisibility')?.addEventListener('click', () => {
        const type = manualDigitsInput.getAttribute('type') === 'password' ? 'text' : 'password';
        manualDigitsInput.setAttribute('type', type);

        const eyePath = document.getElementById('manualEyePath');
        if (type === 'text') {
            eyePath.setAttribute('d', 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-4.242-4.242m4.242 4.242L5.636 5.636m4.242 4.242L9.878 9.878z');
        } else {
            eyePath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
        }
    });

    // Manual Submission
    document.getElementById('submitManualModal')?.addEventListener('click', () => {
        let digits = manualDigitsInput.value.trim().toUpperCase();
        // If they accidentally typed IT2026, strip it
        if (digits.startsWith('IT2026')) {
            digits = digits.replace('IT2026', '');
        }

        if (digits.length === 6 && /^\d+$/.test(digits)) {
            const fullSerial = 'IT2026' + digits;
            handleManualRecord(fullSerial, manualType);
            manualModal.style.display = 'none';
            manualDigitsInput.value = '';
        } else {
            showNotif('Please enter exactly 6 digits', 'error');
        }
    });

    document.getElementById('cancelTimeIn')?.addEventListener('click', () => stopScanner('in'));
    document.getElementById('cancelTimeOut')?.addEventListener('click', () => stopScanner('out'));



    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            console.log("Manual refresh triggered...");
            const svg = refreshBtn.querySelector('svg');
            if (svg) {
                svg.classList.remove('animate-spin-custom');
                void svg.offsetWidth; // Force reflow
                svg.classList.add('animate-spin-custom');
            }
            fetchHistory();
        };
    }

    document.getElementById('logSearch')?.addEventListener('input', () => { logsPage = 1; renderLogs(); });
    document.getElementById('prevPageLogs')?.addEventListener('click', () => { if (logsPage > 1) { logsPage--; renderLogs(); } });
    document.getElementById('nextPageLogs')?.addEventListener('click', () => {
        const searchTerm = document.getElementById('logSearch')?.value.toLowerCase() || '';
        const filteredCount = logsData.filter(l => l.full_name.toLowerCase().includes(searchTerm)).length;
        const totalPages = Math.ceil(filteredCount / logsPerPage) || 1;
        if (logsPage < totalPages) { logsPage++; renderLogs(); }
    });



    // Logic for physical barcode scanners (USB/Bluetooth HID) is now handled by the global listener at the end of this file.

    if (document.getElementById('logDateFilter')) {
        flatpickr("#logDateFilter", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "F j, Y",
            defaultDate: "today",
            maxDate: "today",
            disable: [
                function(date) {
                    return (date.getDay() === 0 || date.getDay() === 6);
                }
            ],
            onReady: function (selectedDates, dateStr, instance) {
                instance.altInput.style.cursor = 'pointer';
            },
            onChange: () => { logsPage = 1; fetchHistory(); }
        });
    }
    document.getElementById('btnOpenPersonalHistory')?.addEventListener('click', () => {
        document.getElementById('personalHistoryModal').classList.remove('hidden');
        if (window.currentUserSerial) {
            // Pre-fill and auto-load if we have it from session
            const serialDigits = window.currentUserSerial.replace('IT2026', '');
            const input = document.getElementById('personalHistorySerial');
            if (input) {
                input.value = serialDigits;
                const fetchBtn = document.getElementById('btnFetchPersonalHistory');
                if (fetchBtn) fetchBtn.disabled = false;
                fetchPersonalHistory(window.currentUserSerial);
            }
        }
        document.getElementById('personalHistorySerial')?.focus();
    });

    const personalHistoryBtn = document.getElementById('btnFetchPersonalHistory');
    const personalHistoryInput = document.getElementById('personalHistorySerial');

    personalHistoryInput?.addEventListener('input', (e) => {
        if (personalHistoryBtn) {
            personalHistoryBtn.disabled = e.target.value.length !== 6;
        }
    });

    personalHistoryBtn?.addEventListener('click', () => {
        const input = personalHistoryInput.value;
        if (input && input.length === 6) {
            fetchPersonalHistory('IT2026' + input);
        }
    });

    personalHistoryInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const input = e.target.value;
            if (input && input.length === 6) {
                fetchPersonalHistory('IT2026' + input);
            }
        }
    });

    // Visibility Toggle (Personal History)
    document.getElementById('togglePersonalSerialVisibility')?.addEventListener('click', () => {
        const type = personalHistoryInput.getAttribute('type') === 'password' ? 'text' : 'password';
        personalHistoryInput.setAttribute('type', type);

        const eyePath = document.getElementById('personalEyePath');
        if (type === 'text') {
            eyePath.setAttribute('d', 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-4.242-4.242m4.242 4.242L5.636 5.636m4.242 4.242L9.878 9.878z');
        } else {
            eyePath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
        }
    });

    document.getElementById('prevPersonalPage')?.addEventListener('click', () => {
        if (personalHistoryPage > 1) { personalHistoryPage--; renderPersonalHistory(); }
    });

    document.getElementById('nextPersonalPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(personalHistoryData.length / personalHistoryPerPage) || 1;
        if (personalHistoryPage < totalPages) { personalHistoryPage++; renderPersonalHistory(); }
    });

    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const confirmLogout = document.getElementById('confirmLogout');
    const cancelLogout = document.getElementById('cancelLogout');

    if (logoutBtn && logoutModal) {
        logoutBtn.addEventListener('click', () => {
            logoutModal.classList.remove('hidden');
        });

        cancelLogout?.addEventListener('click', () => {
            logoutModal.classList.add('hidden');
        });

        confirmLogout?.addEventListener('click', async () => {
            await fetch('backend/auth.php?action=logout');
            window.location.href = 'login.html';
        });
    }

    // View Switching
    const btnD = document.getElementById('btnViewDashboard');
    const btnH = document.getElementById('btnViewHistory');
    const btnDir = document.getElementById('btnViewDirectory');
    const vD = document.getElementById('viewDashboard');
    const vH = document.getElementById('viewHistory');
    const vDir = document.getElementById('viewDirectory');

    function setActiveTab(activeBtn, activeView) {
        [btnD, btnH, btnDir].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
            btn.classList.add('text-slate-500', 'hover:bg-white');
        });
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-500', 'hover:bg-white');
            activeBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
        }
        [vD, vH, vDir].forEach(v => v ? v.classList.add('hidden') : null);
        if (activeView) activeView.classList.remove('hidden');
    }

    if (btnD) btnD.onclick = () => setActiveTab(btnD, vD);
    if (btnH) btnH.onclick = () => { setActiveTab(btnH, vH); fetchHistory(); };
    if (btnDir) btnDir.onclick = () => { setActiveTab(btnDir, vDir); loadInternDirectory(); };

    // Intern Directory Logic
    const searchDir = document.getElementById('searchInternsDir');
    if (searchDir) {
        searchDir.oninput = () => { internsPage = 1; renderInternDirectory(); };
    }
    const prevDir = document.getElementById('prevPageInternsDir');
    if (prevDir) {
        prevDir.onclick = () => { if (internsPage > 1) { internsPage--; renderInternDirectory(); } };
    }
    const nextDir = document.getElementById('nextPageInternsDir');
    if (nextDir) {
        nextDir.onclick = () => {
            const q = searchDir?.value.toLowerCase() || '';
            const filteredCount = internsData.filter(u => u.full_name.toLowerCase().includes(q)).length;
            const totalPages = Math.ceil(filteredCount / internsPerPage) || 1;
            if (internsPage < totalPages) { internsPage++; renderInternDirectory(); }
        };
    }

    // Visibility Toggle (Edit Verification)
    const editSerialInput = document.getElementById('editVerificationSerial');
    const verifyEditBtn = document.getElementById('btnVerifyEdit');

    document.getElementById('toggleEditSerialVisibility')?.addEventListener('click', () => {
        if (!editSerialInput) return;
        const type = editSerialInput.getAttribute('type') === 'password' ? 'text' : 'password';
        editSerialInput.setAttribute('type', type);

        const eyePath = document.getElementById('editEyePath');
        if (type === 'text') {
            eyePath.setAttribute('d', 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-4.242-4.242m4.242 4.242L5.636 5.636m4.242 4.242L9.878 9.878z');
        } else {
            eyePath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
        }
    });

    editSerialInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (verifyEditBtn) {
            verifyEditBtn.disabled = e.target.value.length !== 6;
        }
        // Clear inline error when user re-types
        const errEl = document.getElementById('editVerifyError');
        if (errEl) errEl.classList.add('hidden');
    });

    editSerialInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (verifyEditBtn && !verifyEditBtn.disabled) {
                verifyEditBtn.click();
            }
        }
    });

    verifyEditBtn?.addEventListener('click', () => {
        window.submitEditVerification();
    });
};

async function loadInternDirectory() {
    const list = document.getElementById('internDirectoryList');
    if (!list) return;
    list.innerHTML = '<p class="col-span-full text-center py-10 text-slate-400 font-bold">Loading interns...</p>';
    try {
        const res = await fetch('backend/get_users.php');
        const data = await res.json();
        if (data.status === 'success') {
            internsData = (data.users || []).filter(u => u.is_archived != 1);
            renderInternDirectory();
        }
    } catch (e) { console.error(e); }
}

function renderInternDirectory() {
    const list = document.getElementById('internDirectoryList');
    if (!list) return;
    const q = document.getElementById('searchInternsDir')?.value.toLowerCase() || '';
    const filtered = internsData.filter(u => u.full_name.toLowerCase().includes(q));
    
    const totalPages = Math.ceil(filtered.length / internsPerPage) || 1;
    const start = (internsPage - 1) * internsPerPage;
    const paginated = filtered.slice(start, start + internsPerPage);

    list.innerHTML = '';
    if (paginated.length === 0) {
        list.innerHTML = '<p class="col-span-full text-center py-10 text-slate-400 font-bold">No interns found.</p>';
    } else {
        paginated.forEach(u => {
            const card = document.createElement('div');
            card.className = 'bg-slate-50 p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-200 transition-all group';
            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        ${u.full_name.charAt(0)}
                    </div>
                    <div>
                        <h4 class="font-black text-black group-hover:text-indigo-600 transition-all">${u.full_name}</h4>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Intern</p>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }

    renderPagination('pagesInterns', internsPage, totalPages, (p) => {
        internsPage = p;
        renderInternDirectory();
    });
    
    if (document.getElementById('prevPageInternsDir')) document.getElementById('prevPageInternsDir').disabled = internsPage === 1;
    if (document.getElementById('nextPageInternsDir')) document.getElementById('nextPageInternsDir').disabled = internsPage >= totalPages;
}

window.renderLogs = renderLogs;
window.renderPersonalHistory = renderPersonalHistory;

window.toggleHistoryScanMode = function (isActive) {
    if (isActive) {
        startHistoryScanner();
    } else {
        stopHistoryScanner();
    }
};

function startHistoryScanner() {
    activePortalType = 'history';
    document.getElementById('personalManualMode').classList.add('hidden');
    document.getElementById('personalScanMode').classList.remove('hidden');
    document.getElementById('personalHistorySerial').value = '';
}

function stopHistoryScanner() {
    activePortalType = null;
    document.getElementById('personalManualMode').classList.remove('hidden');
    document.getElementById('personalScanMode').classList.add('hidden');
}

// Edit Verification Scan Mode (mirrors Personal History scan mode)
window.toggleEditVerifyScanMode = function(isActive) {
    const manualMode = document.getElementById('editVerifyManualMode');
    const scanMode = document.getElementById('editVerifyScanMode');
    if (isActive) {
        activePortalType = 'editVerify';
        if (manualMode) manualMode.classList.add('hidden');
        if (scanMode) scanMode.classList.remove('hidden');
    } else {
        activePortalType = null;
        if (manualMode) manualMode.classList.remove('hidden');
        if (scanMode) scanMode.classList.add('hidden');
    }
};

window.closePersonalHistory = function () {
    document.getElementById('personalHistoryModal').classList.add('hidden');
    document.getElementById('personalSerialEntry').classList.remove('hidden');
    document.getElementById('personalHistoryResults').classList.add('hidden');
    document.getElementById('personalHistorySerial').value = '';
    toggleHistoryScanMode(false); // Ensure scan mode is off
    personalHistoryData = [];
    personalHistoryPage = 1;
};

async function fetchPersonalHistory(serial) {
    try {
        const response = await fetch(API_BASE + `attendance.php?action=getHistoryBySerial&serial=${serial}`);
        const res = await response.json();

        if (res.status === 'success') {
            personalHistoryData = deduplicateByDate(res.history);
            personalHistoryPage = 1;
            document.getElementById('personalHistoryInternName').innerText = `Records for: ${res.intern_name}`;
            document.getElementById('personalSerialEntry').classList.add('hidden');
            document.getElementById('personalHistoryResults').classList.remove('hidden');
            window.currentHistorySerial = serial;
            window.currentHistoryName = res.intern_name;
            renderPersonalHistory();
            stopHistoryScanner(); // Reset buttons
        } else {
            showNotif(res.message, 'error');
        }
    } catch (e) {
        console.error("Failed to fetch personal history", e);
        showNotif("Network error. Please try again.", "error");
    }
}

function renderPersonalHistory() {
    const tbody = document.getElementById('personalHistoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const totalPages = Math.ceil(personalHistoryData.length / personalHistoryPerPage) || 1;
    const start = (personalHistoryPage - 1) * personalHistoryPerPage;
    const paginated = personalHistoryData.slice(start, start + personalHistoryPerPage);

    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 font-black italic">No records found.</td></tr>';
    } else {
        paginated.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/50 transition-all';

            let durText = '--';
            let durClass = row.total_seconds > 0 ? 'text-indigo-600' : 'text-slate-300';
            let durDataAttr = '';

            if (row.is_absent == 1) {
                durText = '';
                durClass = 'text-rose-600 font-black';
                tr.classList.add('bg-rose-50/10');
            } else if (row.raw_time_in) {
                const hasTimeOut = !!row.raw_time_out;
                const startTime = new Date(row.raw_date + ' ' + row.raw_time_in).getTime();

                if (hasTimeOut) {
                    durText = formatSecondsToText(row.total_seconds);
                    if (parseInt(row.total_seconds) >= 43200) {
                        durClass = 'text-rose-600 font-black flex items-center justify-center gap-1';
                        durText = `<span>${formatSecondsToText(row.total_seconds)}</span><svg class="w-5 h-5 text-rose-500 cursor-pointer animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" onclick="window.openAutoTimeoutAdjustment('${row.raw_date}', '${row.raw_time_in}', '${row.raw_time_out}', '${window.currentHistorySerial || ''}', '${(window.currentHistoryName || '').replace(/'/g, "\\'")}')" title="Forgot to Time Out? Click to request adjustment"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
                    } else if (parseInt(row.total_seconds) > 0) {
                        durClass = 'text-indigo-600';
                    }
                } else {
                    const now = Date.now();
                    let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

                    durText = formatSecondsToText(diffSeconds, true);
                    durClass = 'text-indigo-600 live-duration animate-pulse';
                    durDataAttr = `data-start="${startTime}"`;
                }
            }

            tr.innerHTML = `
                <td class="px-6 py-6 font-bold text-black">${row.formatted_date}</td>
                <td class="px-6 py-6 text-center text-emerald-600 font-black">${row.is_absent == 1 && !row.raw_time_in ? '--' : row.formatted_time_in}</td>
                <td class="px-6 py-6 text-center ${row.formatted_time_out !== '--:--' || row.is_absent == 1 ? 'text-rose-600' : 'text-slate-300'} font-black">${row.is_absent == 1 ? '--' : row.formatted_time_out}</td>
                <td class="px-6 py-6 text-center ${durClass} font-black text-lg" ${durDataAttr}>${durText}</td>
                <td class="px-6 py-6 text-right">
                    <button onclick="window.openAdjustmentModal('${row.raw_date}', '${row.raw_time_in || ''}', '${row.raw_time_out || ''}', '${window.currentHistorySerial || ''}', '${(window.currentHistoryName || '').replace(/'/g, "\\'")}')" 
                        class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100 ml-auto" title="Request Edit">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderPagination('pagesPersonal', personalHistoryPage, totalPages, (p) => {
        personalHistoryPage = p;
        renderPersonalHistory();
    });
    if (document.getElementById('prevPersonalPage')) document.getElementById('prevPersonalPage').disabled = personalHistoryPage === 1;
    if (document.getElementById('nextPersonalPage')) document.getElementById('nextPersonalPage').disabled = personalHistoryPage >= totalPages;


}

window.printPersonalHistory = function (providedName, providedData, forDate = null) {
    const nameEl = document.getElementById('personalHistoryInternName');
    const name = providedName || (nameEl ? nameEl.innerText.replace(/Records for:\s*/i, '').trim() : 'Unknown Intern');
    const data = providedData || personalHistoryData;
    // isSingleDay if explicitly told (via forDate), or data has exactly 1 row
    const isSingleDay = !!(forDate || data.length === 1);
    const mainTitle = isSingleDay ? 'Daily Attendance Report' : 'Attendance History Report';
    // Use forDate as fallback if data is empty
    const reportDate = isSingleDay
        ? (data.length > 0 ? data[0].formatted_date : (forDate ? new Date(forDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''))
        : 'Cumulative History';

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    const dedupedData = deduplicateByDate(data);

    let rows = '';
    let totalSeconds = 0;
    dedupedData.forEach(row => {
        let dur = '--';
        if (row.total_seconds) {
            const totalSecs = parseInt(row.total_seconds);
            if (totalSecs !== 43200) {
                totalSeconds += totalSecs;
            }
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            dur = (h > 0 ? `${h}h ` : "") + `${m}m`;
        }
        rows += `
            <tr>
                <td style="font-weight: 600;">${row.formatted_date}</td>
                <td style="color: #059669;">${row.formatted_time_in || '--:--'}</td>
                <td style="color: #dc2626;">${row.formatted_time_out || '--:--'}</td>
                <td style="font-weight: 700; text-align: right;">${dur}</td>
            </tr>
        `;
    });

    const totalH = Math.floor(totalSeconds / 3600);
    const totalM = Math.floor((totalSeconds % 3600) / 60);
    const totalStr = `${totalH} Hours, ${totalM} Minutes`;

    printWindow.document.write(`
        <html>
            <head>
                <title>${mainTitle} - ${name}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { 
                        font-family: 'Segoe UI', Tahoma, Helvetica, Arial, sans-serif; 
                        padding: 10mm 15mm; 
                        color: #1a202c; 
                        margin: 0; 
                        background: white;
                    }
                    .header { text-align: center; padding-bottom: 20px; margin-bottom: 25px; border-bottom: 4px solid #002f6c; }
                    .header img { height: 7rem !important; margin-bottom: 5px; object-fit: contain; }
                    .header h1 { color: #002f6c; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; }
                    .header .subtitle { margin: 5px 0 0; color: #718096; text-transform: uppercase; letter-spacing: 4px; font-size: 11px; font-weight: 700; }
                    
                    .info-bar { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 25px; 
                        font-size: 13px; 
                        color: #1e293b; 
                        background: #f1f5f9; 
                        padding: 15px 20px; 
                        border-radius: 10px; 
                        border: 1px solid #e2e8f0;
                    }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { text-align: left; padding: 12px 10px; background: #002f6c; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                    .total-row td { background: #f8fafc; font-weight: 800; color: #002f6c; border-top: 3px solid #002f6c; padding: 15px 10px; }
                    
                    .footer { 
                        margin-top: 40px; 
                        text-align: center; 
                        font-size: 11px; 
                        color: #94a3b8; 
                        border-top: 2px solid #f1f5f9; 
                        padding-top: 20px; 
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="assets/logo.png" alt="Concentrix">
                    <h1>${mainTitle}</h1>
                    <div class="subtitle">${isSingleDay ? name : reportDate + ' &bull; ' + name}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th style="text-align: right;">Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right; text-transform: uppercase; font-size: 10px;">Total Journey Duration:</td>
                            <td style="text-align: right; font-size: 15px;">${totalStr}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top: 60px;">
                    <div style="width: 250px; text-align: center;">
                        <div style="border-bottom: 2px solid #1a202c; margin-bottom: 8px; height: 40px;"></div>
                        <div style="font-weight: 800; text-transform: uppercase; font-size: 11px; color: #1a202c; letter-spacing: 1px;">Signature over Printed Name</div>
                    </div>
                </div>
                
                <div class="footer">
                    Concentrix IT Department &bull; &copy; ${new Date().getFullYear()}
                </div>
                <script>
                    window.onload = () => {
                        setTimeout(() => { window.print(); }, 500);
                    };
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

function floor(val) { return Math.floor(val); }

function updateActivityDateLabel() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const el = document.getElementById('activityDateLabel');
    if (el) el.textContent = now.toLocaleDateString('en-US', options);
}

async function startScanner(type) {
    const btnId = type === 'in' ? 'btnTimeIn' : 'btnTimeOut';
    const cancelBtnId = type === 'in' ? 'cancelTimeIn' : 'cancelTimeOut';
    const statusId = type === 'in' ? 'statusIn' : 'statusOut';
    const placeholderId = type === 'in' ? 'placeholderIn' : 'placeholderOut';

    const btn = document.getElementById(btnId);
    const cancelBtn = document.getElementById(cancelBtnId);

    // Deactivate other scanner if active
    if (activePortalType && activePortalType !== type) {
        stopScanner(activePortalType);
    }

    activePortalType = type;
    btn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');

    const statusEl = document.getElementById(statusId);
    const placeholderEl = document.getElementById(placeholderId);

    statusEl.innerText = 'READY TO SCAN';
    statusEl.classList.add('animate-pulse');
    placeholderEl.classList.add('border-emerald-500', 'bg-emerald-50/30');
    document.getElementById(type === 'in' ? 'laserIn' : 'laserOut')?.classList.remove('hidden');
    if (type === 'out') {
        placeholderEl.classList.remove('border-emerald-500', 'bg-emerald-50/30');
        placeholderEl.classList.add('border-rose-500', 'bg-rose-50/30');
    }

    // Global listener for Cancel button
    if (!cancelBtn.onclick) {
        cancelBtn.onclick = () => stopScanner(type);
    }
}

function stopScanner(type, isSuccess = false) {
    const btnId = type === 'in' ? 'btnTimeIn' : 'btnTimeOut';
    const cancelBtnId = type === 'in' ? 'cancelTimeIn' : 'cancelTimeOut';
    const statusId = type === 'in' ? 'statusIn' : 'statusOut';
    const placeholderId = type === 'in' ? 'placeholderIn' : 'placeholderOut';
    const overlayId = type === 'in' ? 'scanOverlayIn' : 'scanOverlayOut';

    const btn = document.getElementById(btnId);
    const cancelBtn = document.getElementById(cancelBtnId);
    const statusEl = document.getElementById(statusId);
    const placeholderEl = document.getElementById(placeholderId);

    activePortalType = null;
    btn.classList.remove('hidden');
    cancelBtn.classList.add('hidden');

    statusEl.innerText = 'SYSTEM READY';
    statusEl.classList.remove('animate-pulse');
    placeholderEl.classList.remove('border-emerald-500', 'bg-emerald-50/30', 'border-rose-500', 'bg-rose-50/30');
    document.getElementById(type === 'in' ? 'laserIn' : 'laserOut')?.classList.add('hidden');

    if (isSuccess) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.classList.add('hidden');
            }, 4000); // 4 seconds for better visibility
        }
    }
}

async function handleManualRecord(serial, type) {
    const statusId = type === 'in' ? 'statusIn' : 'statusOut';
    await recordAttendanceBySerial(serial, type, statusId);
}

async function recordAttendanceBySerial(serial, type, statusId) {
    try {
        showStatus(statusId, 'Processing...', 'info');
        const response = await fetch(API_BASE + 'attendance.php?action=recordBySerial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial_number: serial, type: type })
        });
        const res = await response.json();
        if (res.status === 'success') {
            stopScanner(type, true);
            showNotif(res.message, 'success');
            fetchHistory(); // Refresh logs
        } else {
            showNotif(res.message, 'error');
            showStatus(statusId, res.message, 'error');
        }
    } catch (e) {
        console.error("Attendance failed", e);
        showStatus(statusId, 'Network error. Please try again.', 'error');
    }
}

window.fetchHistory = async function () {
    try {
        const dateInput = document.getElementById('logDateFilter');
        let dateStr = "";
        if (dateInput && dateInput.value) {
            dateStr = dateInput.value;
        } else {
            const now = new Date();
            dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        const res = await fetch(API_BASE + `attendance.php?action=history&date=${dateStr}`);
        const data = await res.json();
        if (data.status === 'success') {
            logsData = data.history || [];
            renderLogs();
        } else {
            console.warn("Server returned error:", data.message);
            logsData = [];
            renderLogs();
        }
    } catch (e) {
        console.error("Failed to fetch logs", e);
        logsData = [];
        renderLogs();
    }
}

function renderLogs() {
    const historyTbody = document.getElementById('historyTableBody');
    const dashboardTbody = document.getElementById('dashboardRecentLogs');

    if (!historyTbody && !dashboardTbody) return;

    const searchTerm = document.getElementById('logSearch')?.value.toLowerCase() || '';
    const filtered = (logsData || []).filter(l => l && l.full_name && l.full_name.toLowerCase().includes(searchTerm));

    // Detailed History Rendering
    if (historyTbody) {
        historyTbody.innerHTML = '';
        const totalPages = Math.ceil(filtered.length / logsPerPage) || 1;
        const start = (logsPage - 1) * logsPerPage;
        const paginated = filtered.slice(start, start + logsPerPage);

        if (paginated.length === 0) {
            historyTbody.innerHTML = `<tr><td colspan="6" class="py-20 text-center text-slate-300 font-bold italic">No activity found for this selection.</td></tr>`;
        } else {
            paginated.forEach(row => historyTbody.appendChild(createLogRow(row, true)));
        }
        if (document.getElementById('pageInfoLogs')) document.getElementById('pageInfoLogs').textContent = `Page ${logsPage} of ${totalPages}`;
        
        if (document.getElementById('pagesLogs')) {
            window.renderPagination('pagesLogs', logsPage, totalPages, (p) => {
                logsPage = p;
                renderLogs();
            });
        }

        if (document.getElementById('prevPageLogs')) document.getElementById('prevPageLogs').disabled = logsPage === 1;
        if (document.getElementById('nextPageLogs')) document.getElementById('nextPageLogs').disabled = logsPage >= totalPages;
    }

    // Dashboard Quick View Rendering (Paginated, 5 per page)
    if (dashboardTbody) {
        dashboardTbody.innerHTML = '';

        // Filter by dashboard search term (independent from history search)
        const dashSearch = dashboardSearchTerm.toLowerCase();
        const dashFiltered = dashSearch
            ? (logsData || []).filter(l => l && l.full_name && l.full_name.toLowerCase().includes(dashSearch))
            : filtered;

        const totalPagesDash = Math.ceil(dashFiltered.length / dashboardPerPage) || 1;
        if (dashboardPage > totalPagesDash) dashboardPage = 1;
        const startDash = (dashboardPage - 1) * dashboardPerPage;
        const quickLogs = dashFiltered.slice(startDash, startDash + dashboardPerPage);

        if (quickLogs.length === 0) {
            dashboardTbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-slate-300 font-bold italic">No activity found.</td></tr>`;
        } else {
            quickLogs.forEach(row => dashboardTbody.appendChild(createLogRow(row, false)));
        }

        // Render dashboard pagination
        if (document.getElementById('pagesDashboard')) {
            window.renderPagination('pagesDashboard', dashboardPage, totalPagesDash, (p) => {
                dashboardPage = p;
                renderLogs();
            });
        }
        const prevDash = document.getElementById('prevPageDashboard');
        const nextDash = document.getElementById('nextPageDashboard');
        if (prevDash) {
            prevDash.disabled = dashboardPage === 1;
            prevDash.onclick = () => { if (dashboardPage > 1) { dashboardPage--; renderLogs(); } };
        }
        if (nextDash) {
            nextDash.disabled = dashboardPage >= totalPagesDash;
            nextDash.onclick = () => { if (dashboardPage < totalPagesDash) { dashboardPage++; renderLogs(); } };
        }
    }
}

function createLogRow(row, showDate) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-50 hover:bg-slate-50/50 transition-all';

    let durText = '--';
    let durClass = 'text-slate-300';
    let durDataAttr = '';

    if (row.raw_time_in) {
        const hasTimeOut = !!row.raw_time_out;
        const startTime = new Date(row.raw_date + ' ' + row.raw_time_in).getTime();

        if (row.is_absent == 1) {
            durText = '';
            durClass = 'text-rose-600 font-black';
            tr.classList.add('bg-rose-50/10');
        } else if (hasTimeOut) {
            durText = formatSecondsToText(row.total_seconds);
            if (parseInt(row.total_seconds) >= 43200) {
                durClass = 'text-rose-600 font-black flex items-center justify-center gap-1';
                durText = `<span>${formatSecondsToText(row.total_seconds)}</span><svg class="w-5 h-5 text-rose-500 cursor-pointer animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" onclick="window.openAutoTimeoutAdjustment('${row.raw_date}', '${row.raw_time_in}', '${row.raw_time_out}', '${row.serial_number || ''}', '${(row.full_name || '').replace(/'/g, "\\'")}')" title="Forgot to Time Out? Click to request adjustment"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            } else {
                durClass = 'text-emerald-600';
            }
        } else {
            const now = Date.now();
            let diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

            durText = formatSecondsToText(diffSeconds, true);
            durClass = 'text-indigo-600 live-duration animate-pulse';
            tr.classList.add('bg-indigo-50/10');
            // Store the start time for the live timer
            durDataAttr = `data-start="${startTime}"`;
        }
    }

    tr.innerHTML = `
        <td class="px-6 py-6 font-black text-slate-800">${row.full_name}</td>
        ${showDate ? `<td class="px-6 py-6 text-center text-slate-400 font-bold">${row.formatted_date}</td>` : ''}
        <td class="px-6 py-6 text-center text-emerald-600 font-black">${row.is_absent == 1 && !row.raw_time_in ? '--' : row.formatted_time_in}</td>
        <td class="px-6 py-6 text-center text-rose-600 font-black">${row.is_absent == 1 ? '--' : row.formatted_time_out}</td>
        <td class="px-6 py-6 text-center ${durClass} font-black text-lg" ${durDataAttr || ''}>${durText}</td>
        <td class="px-6 py-6 text-right">
            <div class="flex justify-end gap-3">
                <button onclick="window.sendInternEmail(this, '${row.serial_number || ''}', '${row.raw_date}')" title="Send to registered Gmail" class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </button>
                <button onclick="window.openAdjustmentModal('${row.raw_date}', '${row.raw_time_in || ''}', '${row.raw_time_out || ''}', '${row.serial_number || ''}', '${(row.full_name || '').replace(/'/g, "\\'")}')" title="Request Edit" class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button onclick='printInternReport("${row.serial_number}", "${row.full_name}", "${row.raw_date}")' title="Print Daily Record" class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                </button>
            </div>
        </td>
    `;
    return tr;
}

window.sendInternEmail = async function (btn, serial, date = null) {
    if (!serial) return;
    const originalHtml = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';

        const response = await fetch(API_BASE + 'attendance.php?action=send_history_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial: serial, date: date })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotif(res.message, 'success');
        } else {
            showNotif(res.message || 'Failed to send report.', 'error');
        }
    } catch (e) {
        console.error("Email send failed", e);
        showNotif("Network error. Could not send email.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

window.printInternReport = async function (serial, name, date) {
    if (!serial || !date) return;
    try {
        showNotif("Preparing print document...", "info");
        const response = await fetch(API_BASE + 'attendance.php?action=getHistoryBySerial&serial=' + encodeURIComponent(serial) + '&date=' + encodeURIComponent(date));
        const res = await response.json();
        if (res.status === 'success') {
            let history = res.history;
            // If no record exists for this date yet, inject a placeholder row
            if (!history || history.length === 0) {
                const d = new Date(date);
                const formatted = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                history = [{ formatted_date: formatted, formatted_time_in: null, formatted_time_out: null, total_seconds: 0 }];
            } else {
                // Deduplicate by date before printing
                history = deduplicateByDate(history);
            }
            printPersonalHistory(name, history, date);
        } else {
            showNotif(res.message || 'Could not load attendance data.', 'error');
        }
    } catch (e) {
        console.error("Print failed", e);
        showNotif("Failed to generate print report.", "error");
    }
};



// ----------------------------------------------------
// GLOBAL HISTORY EXPORT (DAILY)
// ----------------------------------------------------
document.getElementById('btnPrintGlobalReport')?.addEventListener('click', async () => {
    const date = document.getElementById('logDateFilter')?.value || new Date().toISOString().split('T')[0];
    const searchTerm = document.getElementById('logSearch')?.value.toLowerCase() || '';

    // For printing the global list, we'll use the already loaded logsData but filtered
    const filteredLogs = logsData.filter(l => l.full_name.toLowerCase().includes(searchTerm));

    if (filteredLogs.length === 0) {
        showNotif("No records found to print.", "error");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    let rows = '';
    filteredLogs.forEach(row => {
        const durText = formatSecondsToText(row.total_seconds);
        rows += `
            <tr>
                <td style="font-weight: 600;">${row.full_name}</td>
                <td style="color: #059669;">${row.formatted_time_in || '--:--'}</td>
                <td style="color: #dc2626;">${row.formatted_time_out || '--:--'}</td>
                <td style="font-weight: 700; text-align: right;">${durText}</td>
            </tr>
        `;
    });

    const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    printWindow.document.write(`
        <html>
            <head>
                <title>Daily Attendance Report - ${formattedDate}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { font-family: 'Segoe UI', Tahoma, Helvetica, Arial, sans-serif; padding: 10mm 15mm; color: #1a202c; margin: 0; background: white; }
                    .header { text-align: center; padding-bottom: 20px; margin-bottom: 25px; border-bottom: 4px solid #002f6c; }
                    .header img { height: 6rem !important; margin-bottom: 5px; object-fit: contain; }
                    .header h1 { color: #002f6c; margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; }
                    .header .subtitle { margin: 5px 0 0; color: #718096; text-transform: uppercase; letter-spacing: 4px; font-size: 10px; font-weight: 700; }
                    .info-bar { display: flex; justify-content: center; margin-bottom: 25px; font-size: 13px; color: #1e293b; background: #f1f5f9; padding: 15px 20px; border-radius: 10px; border: 1px solid #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; }
                    th { text-align: left; padding: 12px 10px; background: #002f6c; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 2px solid #f1f5f9; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="assets/logo.png" alt="Concentrix">
                    <h1>Daily Attendance Report</h1>
                    <div class="subtitle">Official Team Documentation</div>
                </div>
                <div class="info-bar">
                    <span><strong>REPORT FOR DATE:</strong> ${formattedDate}</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Intern Name</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th style="text-align: right;">Duration</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="footer">Concentrix IT Department &bull; &copy; ${new Date().getFullYear()}</div>
                <script>window.onload = () => { window.print(); window.close(); };</script>
            </body>
        </html>
    `);
    printWindow.document.close();
});

document.getElementById('btnSendGlobalEmail')?.addEventListener('click', async () => {
    const date = document.getElementById('logDateFilter')?.value || new Date().toISOString().split('T')[0];
    const targetEmail = prompt("Enter the email address where you'd like to send this daily report:");

    if (!targetEmail || !targetEmail.includes('@')) {
        if (targetEmail) showNotif("Please enter a valid email address.", "error");
        return;
    }

    const btn = document.getElementById('btnSendGlobalEmail');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Sending...';

    try {
        const response = await fetch(API_BASE + 'attendance.php?action=send_daily_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, email: targetEmail })
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotif(res.message, 'success');
        } else {
            showNotif(res.message, 'error');
        }
    } catch (e) {
        console.error("Global email error:", e);
        showNotif("Network error. Could not send daily report.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

async function handleManualRecord(serial, type) {
    try {
        const response = await fetch(`${API_BASE}attendance.php?action=recordBySerial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial_number: serial, type: type })
        });
        const result = await response.json();

        if (result.status === 'success') {
            showNotif(result.message, 'success');
            const overlayId = type === 'in' ? 'scanOverlayIn' : 'scanOverlayOut';
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                overlay.classList.remove('hidden');
                setTimeout(() => { overlay.classList.add('hidden'); }, 2000);
            }
            await fetchHistory();
        } else {
            showNotif(result.message, 'error');
        }
    } catch (error) {
        showNotif('System Error. Please try again.', 'error');
    }
}


window.openEditVerificationModal = function(name = null) {
    const modal = document.getElementById('editVerificationModal');
    const subtitle = document.getElementById('editVerifySubtitle');
    if (subtitle) {
        subtitle.textContent = name ? `Verification for: ${name}` : 'Adjustment Verification';
    }
    const input = document.getElementById('editVerificationSerial');
    const btn = document.getElementById('btnVerifyEdit');
    if (input) {
        input.value = '';
        input.setAttribute('type', 'password');
        const eyePath = document.getElementById('editEyePath');
        if (eyePath) eyePath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
    }
    if (btn) {
        btn.disabled = true;
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
};

window.closeEditVerificationModal = function() {
    const modal = document.getElementById('editVerificationModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    // Reset scan mode if active
    window.toggleEditVerifyScanMode(false);
    window.pendingAdjustment = null;
};


window.submitEditVerification = async function() {
    const input = document.getElementById('editVerificationSerial');
    const btn = document.getElementById('btnVerifyEdit');
    const errEl = document.getElementById('editVerifyError');
    if (!input) return;

    // Always hide inline error on each attempt
    if (errEl) errEl.classList.add('hidden');

    const enteredDigits = input.value.trim();
    if (!enteredDigits || enteredDigits.length !== 6) return;

    // Snapshot pendingAdjustment BEFORE any close calls (closeEditVerificationModal clears it)
    const pending = window.pendingAdjustment ? { ...window.pendingAdjustment } : null;
    const targetSerial = pending ? pending.serial : null;

    // Debug: log what we're comparing (check browser console)
    console.log('[Verify] enteredDigits:', enteredDigits);
    console.log('[Verify] targetSerial:', targetSerial);
    console.log('[Verify] currentHistorySerial:', window.currentHistorySerial);

    // Helper: show inline error inside the modal
    function showInlineError(msg) {
        if (errEl) {
            errEl.textContent = '❌ ' + msg;
            errEl.classList.remove('hidden');
        }
        showNotif(msg, 'error');
    }

    // If no specific serial to verify against, use currentHistorySerial
    if (!targetSerial) {
        if (window.currentHistorySerial) {
            const curDigits = window.currentHistorySerial.replace(/^[A-Za-z]+\d{4}/, '');
            console.log('[Verify] curDigits from currentHistorySerial:', curDigits);
            if (enteredDigits === curDigits) {
                window.closeEditVerificationModal();
                window.showAdjustmentForm(pending?.date || '', pending?.timeIn || '', pending?.timeOut || '', window.currentHistorySerial);
            } else {
                showInlineError('Invalid serial number');
            }
        } else {
            showInlineError('Invalid serial number');
        }
        return;
    }

    // Extract last 6 digits from stored serial (handles IT2025XXXX, IT2026XXXX, any year)
    // Serial format: letters + 4-digit-year + 6-digit-number  e.g. IT2026651515
    const storedDigits = targetSerial.replace(/^[A-Za-z]+\d{4}/, '').trim();
    console.log('[Verify] storedDigits extracted:', storedDigits);

    if (enteredDigits === storedDigits || enteredDigits === targetSerial) {
        // Correct — proceed
        window.currentHistorySerial = targetSerial;
        window.closeEditVerificationModal();
        window.showAdjustmentForm(pending.date, pending.timeIn, pending.timeOut, targetSerial);
    } else {
        showInlineError('Invalid serial number');
    }
};

window.toggleCustomSelect = function(e) {
    if (e) e.stopPropagation();
    const optionsPanel = document.getElementById('adjTypeOptions');
    const chevron = document.getElementById('adjTypeChevron');
    if (!optionsPanel || !chevron) return;
    
    if (optionsPanel.classList.contains('hidden')) {
        optionsPanel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        optionsPanel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
};

window.selectCustomOption = function(val, text) {
    const input = document.getElementById('adjType');
    const btnText = document.getElementById('adjTypeBtnText');
    const iconPath = document.getElementById('adjTypeIconPath');
    const checkEdit = document.getElementById('check-edit');
    const checkDelete = document.getElementById('check-delete');
    
    if (input) input.value = val;
    if (btnText) btnText.textContent = text;
    
    if (iconPath) {
        if (val === 'delete') {
            iconPath.setAttribute('d', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');
        } else {
            iconPath.setAttribute('d', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2');
        }
    }
    
    if (checkEdit) checkEdit.classList.toggle('hidden', val !== 'edit');
    if (checkDelete) checkDelete.classList.toggle('hidden', val !== 'delete');
    
    // Close dropdown
    const optionsPanel = document.getElementById('adjTypeOptions');
    const chevron = document.getElementById('adjTypeChevron');
    if (optionsPanel) optionsPanel.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
    
    window.toggleAdjustmentTypeFields();
};

// Document listener to close dropdown on click outside
document.addEventListener('click', function(e) {
    const optionsPanel = document.getElementById('adjTypeOptions');
    const triggerBtn = document.getElementById('adjTypeBtn');
    const chevron = document.getElementById('adjTypeChevron');
    if (optionsPanel && triggerBtn && !triggerBtn.contains(e.target) && !optionsPanel.contains(e.target)) {
        optionsPanel.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }
});

window.toggleAdjustmentTypeFields = function() {
    const adjTypeSelect = document.getElementById('adjType');
    if (!adjTypeSelect) return;
    const type = adjTypeSelect.value;
    
    const timeInContainer = document.getElementById('adjTimeInContainer');
    const timeOutContainer = document.getElementById('adjTimeOutContainer');
    const dateContainer = document.getElementById('adjDateContainer');
    const dateLabel = document.getElementById('adjDateLabel');
    const reasonLabel = document.getElementById('adjReasonLabel');
    const reasonInput = document.getElementById('adjReason');
    
    if (type === 'delete') {
        if (timeInContainer) timeInContainer.classList.add('hidden');
        if (timeOutContainer) timeOutContainer.classList.add('hidden');
        if (dateContainer) {
            dateContainer.classList.remove('md:col-span-1');
            dateContainer.classList.add('md:col-span-3');
        }
        if (dateLabel) dateLabel.textContent = 'Date to Delete';
        if (reasonLabel) reasonLabel.textContent = 'Reason for Deletion';
        if (reasonInput) reasonInput.placeholder = 'e.g. This shift was entered by mistake, double entry, etc.';
    } else {
        if (timeInContainer) timeInContainer.classList.remove('hidden');
        if (timeOutContainer) timeOutContainer.classList.remove('hidden');
        if (dateContainer) {
            dateContainer.classList.remove('md:col-span-3');
            dateContainer.classList.add('md:col-span-1');
        }
        if (dateLabel) dateLabel.textContent = 'Requested Date';
        if (reasonLabel) reasonLabel.textContent = 'Reason for Adjustment';
        if (reasonInput) reasonInput.placeholder = 'e.g. Forgot to scan, System was down, etc.';
    }
};

window.showAdjustmentForm = function(date = '', timeIn = '', timeOut = '', serial = null) {
    const modal = document.getElementById('adjustmentRequestModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    
    // Reset request type to edit and restore labels/icons
    const adjTypeInput = document.getElementById('adjType');
    if (adjTypeInput) {
        adjTypeInput.value = 'edit';
        const btnText = document.getElementById('adjTypeBtnText');
        if (btnText) btnText.textContent = 'Adjust Shift (Edit Time In / Time Out)';
        const iconPath = document.getElementById('adjTypeIconPath');
        if (iconPath) iconPath.setAttribute('d', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2');
        const checkEdit = document.getElementById('check-edit');
        if (checkEdit) checkEdit.classList.remove('hidden');
        const checkDelete = document.getElementById('check-delete');
        if (checkDelete) checkDelete.classList.add('hidden');
    }
    window.toggleAdjustmentTypeFields();
    
    // Update global context if serial provided
    if (serial) window.currentHistorySerial = serial;

    // Initialize flatpickr pickers if not already done
    const dateInput = document.getElementById('adjDate');
    const timeInInput = document.getElementById('adjTimeIn');
    const timeOutInput = document.getElementById('adjTimeOut');

    if (!dateInput._flatpickr) {
        flatpickr("#adjDate", {
            dateFormat: "Y-m-d",
            maxDate: "today",
            altInput: true,
            altFormat: "F j, Y",
            altInputClass: "w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold focus:border-indigo-500 outline-none transition-all cursor-pointer text-black",
            disableMobile: true,
            disable: [function(d) { return (d.getDay() === 0 || d.getDay() === 6); }]
        });
    }
    if (!timeInInput._flatpickr) {
        flatpickr("#adjTimeIn", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            altInput: true,
            altFormat: "h:i K",
            altInputClass: "w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold focus:border-indigo-500 outline-none transition-all cursor-pointer text-black",
            disableMobile: true
        });
    }
    if (!timeOutInput._flatpickr) {
        flatpickr("#adjTimeOut", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            altInput: true,
            altFormat: "h:i K",
            altInputClass: "w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold focus:border-indigo-500 outline-none transition-all cursor-pointer text-black",
            disableMobile: true
        });
    }

    // Set values if provided
    if (date) dateInput._flatpickr.setDate(date);
    if (timeIn) timeInInput._flatpickr.setDate(timeIn);
    if (timeOut) timeOutInput._flatpickr.setDate(timeOut);
};

window.openAdjustmentModal = function (date = '', timeIn = '', timeOut = '', serial = null, name = null) {
    // Sanitize: template literals may pass the literal string 'null' or 'undefined'
    const cleanSerial = (serial && serial !== 'null' && serial !== 'undefined' && serial.trim() !== '') ? serial.trim() : null;
    const targetSerial = cleanSerial || window.currentHistorySerial || null;
    const cleanName = (name && name !== 'null' && name !== 'undefined' && name.trim() !== '') ? name.trim() : null;

    if (targetSerial && targetSerial === window.currentHistorySerial) {
        // Already verified for this intern — go straight to form
        window.showAdjustmentForm(date, timeIn, timeOut, targetSerial);
    } else {
        // Need serial verification first
        window.pendingAdjustment = { date, timeIn, timeOut, serial: targetSerial, name: cleanName };
        window.openEditVerificationModal(cleanName);
    }
};

window.closeAdjustmentModal = function () {
    const modal = document.getElementById('adjustmentRequestModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

window.submitAdjustmentRequest = async function () {
    const date = document.getElementById('adjDate').value;
    const timeIn = document.getElementById('adjTimeIn').value;
    const timeOut = document.getElementById('adjTimeOut').value;
    const reason = document.getElementById('adjReason').value;
    const requestType = document.getElementById('adjType')?.value || 'edit';

    if (requestType === 'delete') {
        if (!date) {
            showNotif("Please select a date to delete.", "error");
            return;
        }
    } else {
        if (!date || !timeIn || !timeOut) {
            showNotif("Please fill in all date and time fields.", "error");
            return;
        }
    }

    if (!reason || reason.trim() === '') {
        showNotif("Please provide a detailed reason.", "error");
        return;
    }

    try {
        const payload = { 
            date, 
            time_in: requestType === 'delete' ? '00:00' : timeIn, 
            time_out: requestType === 'delete' ? '00:00' : timeOut, 
            reason, 
            request_type: requestType,
            serial: window.currentHistorySerial 
        };

        const response = await fetch(API_BASE + 'attendance.php?action=submitAdjustment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === 'success') {
            showNotif(res.message, "success");
            closeAdjustmentModal();
            // Reset fields
            document.getElementById('adjDate').value = '';
            document.getElementById('adjTimeIn').value = '';
            document.getElementById('adjTimeOut').value = '';
            document.getElementById('adjReason').value = '';
            const adjTypeSelect = document.getElementById('adjType');
            if (adjTypeSelect) adjTypeSelect.value = 'edit';
            window.toggleAdjustmentTypeFields();
        } else {
            showNotif(res.message, "error");
        }
    } catch (e) {
        showNotif("Failed to submit request.", "error");
    }
};

// Global Listener for Physical Barcode Scanners (USB/Wireless HID)
window.addEventListener('keydown', async (e) => {
    // Ignore if typing in a text field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Only process if we are expecting a scan
    if (!activePortalType) return;

    const now = Date.now();
    // Reset buffer if delay > 100ms (manual typing vs scanner)
    if (now - lastKeyTimestamp > 100) {
        barcodeInputBuffer = '';
    }
    lastKeyTimestamp = now;

    if (e.key === 'Enter') {
        if (barcodeInputBuffer.length > 3) {
            const serial = barcodeInputBuffer.trim();
            barcodeInputBuffer = '';

            console.log("Physical scan detected:", serial);

            if (activePortalType === 'history') {
                fetchPersonalHistory(serial);
            } else if (activePortalType === 'editVerify') {
                // Barcode scan for Verify Identity modal — auto-verify
                const pending = window.pendingAdjustment ? { ...window.pendingAdjustment } : null;
                const targetSerial = pending ? pending.serial : null;
                if (!targetSerial || serial === targetSerial) {
                    window.currentHistorySerial = targetSerial || serial;
                    window.toggleEditVerifyScanMode(false);
                    window.closeEditVerificationModal();
                    window.showAdjustmentForm(pending?.date || '', pending?.timeIn || '', pending?.timeOut || '', targetSerial || serial);
                } else {
                    window.toggleEditVerifyScanMode(false);
                    showNotif('Invalid serial number', 'error');
                }
            } else {
                const type = activePortalType;
                const statusId = type === 'in' ? 'statusIn' : 'statusOut';
                await recordAttendanceBySerial(serial, type, statusId);
            }
        }
        barcodeInputBuffer = '';
    } else if (e.key.length === 1) {
        barcodeInputBuffer += e.key;
    }
});

window.openAutoTimeoutAdjustment = function (date, timeIn, timeOut, serial, name) {
    showNotif(
        "You were auto timed-out because you forgot to Time Out. Please request an adjustment with your actual Time Out and a reason.",
        "info",
        () => {
            window.openAdjustmentModal(date, timeIn, '', serial, name);
            const reasonInput = document.getElementById('adjReason');
            if (reasonInput) {
                reasonInput.value = "";
                reasonInput.focus();
            }
        }
    );
};
