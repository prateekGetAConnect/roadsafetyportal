/**
 * India Transport Analytics POC — Application Controller
 * Manages all UI interactions, chart rendering, map initialisation, and data binding.
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    //  GLOBALS & STATE
    // ═══════════════════════════════════════════════════════════════
    const state = {
        currentTab: 'command-center',
        selectedState: 'All',
        selectedRole: 'commissioner',
        selectedRTO: null,
        accidentFilters: { timeOfDay: 'All', season: 'All', severity: 'All', district: 'All', area: 'All', cause: 'All', mapState: 'All' },
        charts: {},
        map: null,
        mapMarkers: [],
        lastHotspotAnalysis: null,
        alerts: JSON.parse(localStorage.getItem('transport-alerts') || '[]'),
        globalDateFilter: '365',
        customStartDate: '',
        customEndDate: '',
        driverViolationFilter: 'All',
        vehicleViolationFilter: 'All',
        driverRiskFilter: 'All',
        vehicleTypeFilter: 'All',
        vehicleRiskFilter: 'High',
        exportData: {
            drivers: [],
            vehicles: [],
            revenue: []
        }
    };

    const CHART_COLORS = {
        indigo: '#6366f1',
        teal: '#14b8a6',
        amber: '#f59e0b',
        red: '#ef4444',
        emerald: '#10b981',
        sky: '#0ea5e9',
        violet: '#8b5cf6',
        rose: '#f43f5e',
        slate: '#64748b',
        cyan: '#06b6d4'
    };

    function getApexTheme() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return {
            chart: {
                background: 'transparent',
                foreColor: isLight ? '#475569' : '#94a3b8',
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false },
                animations: { enabled: true, easing: 'easeinout', speed: 600 }
            },
            grid: { borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(99,102,241,0.1)', strokeDashArray: 3 },
            tooltip: {
                theme: isLight ? 'light' : 'dark',
                style: { fontSize: '12px' },
                x: { show: true },
                marker: { show: true }
            },
            legend: { labels: { colors: isLight ? '#475569' : '#94a3b8' }, fontSize: '12px' },
            states: {
                hover: { filter: { type: 'lighten', value: 0.1 } },
                active: { filter: { type: 'darken', value: 0.1 } }
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  INITIALISATION
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
        initLogin();
        lucide.createIcons();
        initClock();
        initNavigation();
        initRoleSelector();
        initStateFilter();
        initThemeToggle();
        initMapFilters();
        initExports();
        initDataFilters();
        initSearch('driver');
        initSearch('vehicle');
        initAccidentFilters();
        initStaffSlider();
        initDrilldown();
        initMapDrilldown();
        initProfileBackButtons();
        populateRTOSelector();
        renderCommandCenter();
        renderTopRiskDrivers();
        renderTopRiskVehicles();
        initSettingsAlerts();
    });

    // ═══════════════════════════════════════════════════════════════
    //  CLOCK
    // ═══════════════════════════════════════════════════════════════
    function initClock() {
        const el = document.getElementById('sidebar-clock');
        function tick() {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
        }
        tick();
        setInterval(tick, 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LOGIN LOGIC
    // ═══════════════════════════════════════════════════════════════
    function initLogin() {
        const overlay = document.getElementById('login-overlay');
        const loginBtn = document.getElementById('login-btn');
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const errorMsg = document.getElementById('login-error');
        const loginCard = document.querySelector('.login-card');

        // Logout Logic (Must be attached regardless of auth state)
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                sessionStorage.removeItem('isAuthenticated');
                usernameInput.value = '';
                passwordInput.value = '';
                loginBtn.innerHTML = 'Authenticate Session <i data-lucide="arrow-right" style="width: 16px; height: 16px; margin-left: 8px;"></i>';
                lucide.createIcons();
                overlay.classList.remove('fade-out');
                overlay.style.display = 'flex';
            });
        }
        
        // Notification Logic
        const notifBtn = document.getElementById('notification-btn');
        if (notifBtn) {
            notifBtn.addEventListener('click', () => {
                alert("You have 3 unread high-priority AI alerts pending review.");
            });
        }

        // Check if already authenticated
        if (sessionStorage.getItem('isAuthenticated') === 'true') {
            overlay.style.display = 'none';
            return; // Exit early, app loads normally
        }

        // Handle Login Attempt
        const attemptLogin = () => {
            const user = usernameInput.value.trim();
            const pass = passwordInput.value.trim();

            if (user === 'admin' && pass === 'admin') {
                sessionStorage.setItem('isAuthenticated', 'true');
                errorMsg.style.display = 'none';
                loginBtn.innerHTML = 'Authenticated <i data-lucide="check-circle" style="width: 16px; height: 16px; margin-left: 8px;"></i>';
                lucide.createIcons();
                
                // Trigger fade out
                setTimeout(() => {
                    overlay.classList.add('fade-out');
                    setTimeout(() => { overlay.style.display = 'none'; }, 500);
                }, 400);
            } else {
                errorMsg.style.display = 'block';
                loginCard.classList.remove('shake');
                void loginCard.offsetWidth; // Trigger reflow
                loginCard.classList.add('shake');
                passwordInput.value = '';
            }
        };

        loginBtn.addEventListener('click', attemptLogin);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') passwordInput.focus();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    function initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabPanes = document.querySelectorAll('.tab-pane');
        const breadcrumb = document.getElementById('breadcrumb-current');
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;
                state.currentTab = tab;

                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                tabPanes.forEach(p => p.classList.remove('active'));
                document.getElementById('tab-' + tab).classList.add('active');

                breadcrumb.textContent = item.querySelector('span').textContent;

                // Lazy-init views
                if (tab === 'rto-efficiency' && !state.rtoInited) {
                    renderRTOEfficiency();
                    state.rtoInited = true;
                }
                if (tab === 'rto-revenue' && !state.revenueInited) {
                    populateRevenueRTOSelector();
                    populateRevenueSourceSelector();
                    initRevenueVehicleTypeFilter();
                    renderRTORevenue();
                    state.revenueInited = true;
                }
                if (tab === 'driver-risk' && !state.driverRiskInited) {
                    renderDriverOverallAnalysis();
                    state.driverRiskInited = true;
                }
                if (tab === 'vehicle-risk' && !state.vehicleRiskInited) {
                    renderVehicleOverallAnalysis();
                    state.vehicleRiskInited = true;
                }
                if (tab === 'accident-hotspot' && !state.mapInited) {
                    setTimeout(() => {
                        initMap();
                        renderAccidentHotspots();
                        state.mapInited = true;
                    }, 100);
                }

                // Close sidebar on mobile
                if (window.innerWidth < 768) {
                    sidebar.classList.remove('open');
                }
            });
        });

        if (toggle) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }

    function initRoleSelector() {
        document.getElementById('role-selector').addEventListener('change', (e) => {
            state.selectedRole = e.target.value;
            renderCommandCenter();
        });
    }

    function initThemeToggle() {
        const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
        
        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('transport-theme', theme);

            document.querySelectorAll('.theme-icon-sun').forEach(el => {
                el.style.display = theme === 'light' ? 'inline-block' : 'none';
            });
            document.querySelectorAll('.theme-icon-moon').forEach(el => {
                el.style.display = theme === 'light' ? 'none' : 'inline-block';
            });
            document.querySelectorAll('.theme-toggle-label').forEach(el => {
                el.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
            });
        }

        const savedTheme = localStorage.getItem('transport-theme') || 'dark';
        applyTheme(savedTheme);

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(newTheme);
                updateGlobalFiltersAndRender();
            });
        });
    }

    function initStateFilter() {
        document.getElementById('state-filter').addEventListener('change', (e) => {
            state.selectedState = e.target.value;
            renderCommandCenter();
            renderTopRiskDrivers();
            renderTopRiskVehicles();
            if (state.rtoInited) {
                populateRTOSelector();
                renderRTOEfficiency();
            }
            if (state.revenueInited) {
                populateRevenueRTOSelector();
                populateRevenueSourceSelector();
                renderRTORevenue();
            }
            if (state.driverRiskInited) {
                renderDriverOverallAnalysis();
            }
            if (state.vehicleRiskInited) {
                renderVehicleOverallAnalysis();
            }
            if (state.mapInited) {
                renderAccidentHotspots();
            }
        });
    }

    function updateGlobalFiltersAndRender() {
        renderCommandCenter();
        renderTopRiskDrivers();
        renderTopRiskVehicles();
        if (state.rtoInited) {
            populateRTOSelector();
            renderRTOEfficiency();
        }
        if (state.revenueInited) {
            populateRevenueRTOSelector();
            populateRevenueSourceSelector();
            renderRTORevenue();
        }
        if (state.driverRiskInited) {
            renderDriverOverallAnalysis();
        }
        if (state.vehicleRiskInited) {
            renderVehicleOverallAnalysis();
        }
        if (state.mapInited) {
            renderAccidentHotspots();
        }
    }

    function initDataFilters() {
        document.getElementById('global-date-filter').addEventListener('change', (e) => {
            state.globalDateFilter = e.target.value;
            if (state.globalDateFilter === 'custom') {
                document.getElementById('custom-date-container').style.display = 'flex';
            } else {
                document.getElementById('custom-date-container').style.display = 'none';
                updateGlobalFiltersAndRender();
            }
        });

        document.getElementById('custom-start-date').addEventListener('change', (e) => {
            state.customStartDate = e.target.value;
            if (state.customStartDate && state.customEndDate) {
                updateGlobalFiltersAndRender();
            }
        });

        document.getElementById('custom-end-date').addEventListener('change', (e) => {
            state.customEndDate = e.target.value;
            if (state.customStartDate && state.customEndDate) {
                updateGlobalFiltersAndRender();
            }
        });

        document.getElementById('driver-violation-filter').addEventListener('change', (e) => {
            state.driverViolationFilter = e.target.value;
            renderTopRiskDrivers();
        });

        document.getElementById('vehicle-violation-filter').addEventListener('change', (e) => {
            state.vehicleViolationFilter = e.target.value;
            renderTopRiskVehicles();
        });
        document.getElementById('driver-risk-filter').addEventListener('change', (e) => {
            state.driverRiskFilter = e.target.value;
            renderTopRiskDrivers();
        });

        document.getElementById('vehicle-type-filter').addEventListener('change', (e) => {
            state.vehicleTypeFilter = e.target.value;
            renderTopRiskVehicles();
        });

        document.getElementById('vehicle-risk-filter').addEventListener('change', (e) => {
            state.vehicleRiskFilter = e.target.value;
            renderTopRiskVehicles();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════
    function filterByDate(records, dateField) {
        if (state.globalDateFilter === 'all') return records;
        if (state.globalDateFilter === 'custom') {
            if (!state.customStartDate || !state.customEndDate) return records;
            const start = new Date(state.customStartDate);
            const end = new Date(state.customEndDate);
            end.setHours(23, 59, 59, 999);
            return records.filter(r => {
                const d = new Date(r[dateField]);
                return d >= start && d <= end;
            });
        }
        const days = parseInt(state.globalDateFilter, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return records.filter(r => new Date(r[dateField]) >= cutoff);
    }

    function filterByViolation(arr, filterValue, fieldName = 'violationType') {
        if (filterValue === 'All') return arr;
        return arr.filter(x => x[fieldName] === filterValue);
    }

    function filterByState(arr) {
        if (state.selectedState === 'All') return arr;
        return arr.filter(x => x.state === state.selectedState);
    }

    function formatNumber(n) {
        if (typeof n !== 'number') return '--';
        return n.toLocaleString('en-IN');
    }

    function destroyChart(key) {
        if (state.charts[key]) {
            state.charts[key].destroy();
            delete state.charts[key];
        }
    }

    function riskColor(score) {
        if (score >= 67) return CHART_COLORS.red;
        if (score >= 34) return CHART_COLORS.amber;
        return CHART_COLORS.emerald;
    }

    function riskCategory(score) {
        if (score >= 67) return 'High';
        if (score >= 34) return 'Medium';
        return 'Low';
    }

    function riskBadgeClass(score) {
        if (score >= 67) return 'risk-high';
        if (score >= 34) return 'risk-medium';
        return 'risk-low';
    }

    // ═══════════════════════════════════════════════════════════════
    //  DATA TABLE MODAL & CSV EXPORT
    // ═══════════════════════════════════════════════════════════════
    const COLUMNS = {
        challans: [
            { key: 'challanId', label: 'Challan ID' }, { key: 'dateTime', label: 'Date/Time' },
            { key: 'location', label: 'Location' }, { key: 'violationType', label: 'Violation' },
            { key: 'dlNumber', label: 'Driver DL' }, { key: 'regNumber', label: 'Vehicle Reg' },
            { key: 'fineAmount', label: 'Fine (₹)' }, { key: 'paymentStatus', label: 'Status' }
        ],
        accidents: [
            { key: 'accidentId', label: 'Accident ID' }, { key: 'date', label: 'Date' },
            { key: 'time', label: 'Time' }, { key: 'severity', label: 'Severity' },
            { key: 'cause', label: 'Cause' }, { key: 'location', label: 'Location' },
            { key: 'casualties', label: 'Casualties' }, { key: 'injured', label: 'Injured' }
        ],
        drivers: [
            { key: 'dlNumber', label: 'Driver DL' }, { key: 'name', label: 'Name' },
            { key: 'age', label: 'Age' }, { key: 'licenseType', label: 'License' },
            { key: 'violationCount', label: 'Violations' }, { key: 'status', label: 'Status' }
        ],
        rtos: [
            { key: 'rtoName', label: 'RTO Name' }, { key: 'state', label: 'State' },
            { key: 'staffCount', label: 'Staff Count' }, { key: 'efficiencyScore', label: 'Efficiency' }
        ]
    };

    function initExports() {
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.export;
                if (target === 'drivers') downloadCSV(state.exportData.drivers, COLUMNS.drivers, 'Drivers_Report');
                if (target === 'vehicles') downloadCSV(state.exportData.vehicles, COLUMNS.vehicles, 'Vehicles_Report');
                if (target === 'revenue') downloadCSV(state.exportData.revenue, [], 'Revenue_Report');
            });
        });
    }

    function openDataTableModal(title, data, columns) {
        const modal = document.getElementById('data-table-modal');
        const titleEl = document.getElementById('dt-modal-title');
        const thead = document.getElementById('dt-modal-thead');
        const tbody = document.getElementById('dt-modal-tbody');
        const downloadBtn = document.getElementById('dt-modal-download');
        const closeBtn = document.getElementById('dt-modal-close');

        titleEl.textContent = title;

        // Build Header
        thead.innerHTML = columns.map(col => `<th style="text-align: left; padding: 12px; border-bottom: 1px solid var(--border-glass);">${col.label}</th>`).join('');

        // Build Body
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}" style="text-align: center; padding: 20px;">No records found.</td></tr>`;
        } else {
            tbody.innerHTML = data.map(row => {
                return `<tr>${columns.map(col => {
                    let val = row[col.key];
                    if (val && typeof val === 'object') val = JSON.stringify(val);
                    return `<td style="padding: 12px; border-bottom: 1px solid var(--border-glass);">${val !== undefined ? val : '--'}</td>`;
                }).join('')}</tr>`;
            }).join('');
        }

        // Setup Download
        downloadBtn.onclick = () => downloadCSV(data, columns, title);

        // Setup Close
        closeBtn.onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

        modal.style.display = 'flex';
    }

    function downloadCSV(data, columns, filename) {
        if (!data || !data.length) return;
        
        const header = columns.length > 0 ? columns.map(c => `"${c.label}"`).join(',') : Object.keys(data[0]).join(',');
        
        const rows = data.map(row => {
            return columns.length > 0 ? columns.map(c => {
                let val = row[c.key];
                if (val === undefined || val === null) val = '';
                if (typeof val === 'object') val = JSON.stringify(val);
                val = String(val).replace(/"/g, '""');
                return `"${val}"`;
            }).join(',') : Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvString = [header, ...rows].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ═══════════════════════════════════════════════════════════════
    //  COMMAND CENTER (TAB 1)
    // ═══════════════════════════════════════════════════════════════
    function renderCommandCenter() {
        const drivers = filterByState(window.TransportData.drivers);
        const vehicles = filterByState(window.TransportData.vehicles);
        const challans = filterByDate(filterByState(window.TransportData.challans), 'dateTime');
        const accidents = filterByDate(filterByState(window.TransportData.accidents), 'date');

        // KPIs
        document.getElementById('cc-total-drivers').textContent = formatNumber(drivers.length);
        document.getElementById('cc-total-vehicles').textContent = formatNumber(vehicles.length);
        document.getElementById('cc-total-challans').textContent = formatNumber(challans.length);
        document.getElementById('cc-total-accidents').textContent = formatNumber(accidents.length);

        // Violation Distribution Donut
        const violationCounts = {};
        challans.forEach(c => {
            violationCounts[c.violationType] = (violationCounts[c.violationType] || 0) + 1;
        });
        const violationLabels = Object.keys(violationCounts);
        const violationValues = Object.values(violationCounts);

        destroyChart('ccViolations');
        state.charts.ccViolations = new ApexCharts(document.getElementById('cc-chart-violations'), {
            ...getApexTheme(),
            series: violationValues,
            labels: violationLabels,
            chart: { 
                ...getApexTheme().chart, 
                type: 'donut', 
                height: 320,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const selectedType = violationLabels[config.dataPointIndex];
                        const filtered = challans.filter(c => c.violationType === selectedType);
                        openDataTableModal(`Challans - ${selectedType}`, filtered, COLUMNS.challans);
                    }
                }
            },
            colors: [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.indigo, CHART_COLORS.teal, CHART_COLORS.rose, CHART_COLORS.sky, CHART_COLORS.violet, CHART_COLORS.emerald, CHART_COLORS.cyan, CHART_COLORS.slate],
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            name: { color: '#e2e8f0' },
                            value: { color: '#e2e8f0', fontSize: '20px', fontFamily: 'JetBrains Mono' },
                            total: { show: true, label: 'Total', color: '#94a3b8', fontSize: '13px', formatter: () => challans.length }
                        }
                    }
                }
            },
            dataLabels: { enabled: false },
            stroke: { width: 2, colors: ['#0d1425'] }
        });
        state.charts.ccViolations.render();

        // Severity Breakdown Bar
        const severityMap = { Fatal: 0, Grievous: 0, Minor: 0 };
        accidents.forEach(a => { severityMap[a.severity] = (severityMap[a.severity] || 0) + 1; });

        destroyChart('ccSeverity');
        state.charts.ccSeverity = new ApexCharts(document.getElementById('cc-chart-severity'), {
            ...getApexTheme(),
            series: [{ name: 'Accidents', data: [severityMap.Fatal, severityMap.Grievous, severityMap.Minor] }],
            chart: { 
                ...getApexTheme().chart, 
                type: 'bar', 
                height: 320,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const categories = ['Fatal', 'Grievous', 'Minor'];
                        const selectedSev = categories[config.dataPointIndex];
                        const filtered = accidents.filter(a => a.severity === selectedSev);
                        openDataTableModal(`Accidents - ${selectedSev}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', distributed: true } },
            colors: [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.emerald],
            xaxis: { categories: ['Fatal', 'Grievous', 'Minor'], labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            dataLabels: { enabled: true, style: { fontSize: '14px', fontFamily: 'JetBrains Mono' } },
            legend: { show: false }
        });
        state.charts.ccSeverity.render();

        // Driver Risk Distribution Pie
        const allDriverRisks = drivers.map(d => {
            const dChallans = window.TransportData.getChallansByDL(d.dlNumber);
            return window.RiskModels.calculateDriverRisk(d, dChallans);
        });
        const riskDist = { Low: 0, Medium: 0, High: 0 };
        allDriverRisks.forEach(r => { riskDist[r.category]++; });

        destroyChart('ccDriverRisk');
        state.charts.ccDriverRisk = new ApexCharts(document.getElementById('cc-chart-driver-risk'), {
            ...getApexTheme(),
            series: [riskDist.Low, riskDist.Medium, riskDist.High],
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            chart: { 
                ...getApexTheme().chart, 
                type: 'pie', 
                height: 300,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const cats = ['Low', 'Medium', 'High'];
                        const selectedCat = cats[config.dataPointIndex];
                        const filtered = drivers.filter(d => {
                            const dChallans = window.TransportData.getChallansByDL(d.dlNumber);
                            return window.RiskModels.calculateDriverRisk(d, dChallans).category === selectedCat;
                        });
                        openDataTableModal(`Drivers - ${selectedCat} Risk`, filtered, COLUMNS.drivers);
                    }
                }
            },
            colors: [CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.red],
            stroke: { width: 2, colors: ['#0d1425'] },
            dataLabels: { enabled: true, formatter: (val) => Math.round(val) + '%', style: { fontSize: '13px' } }
        });
        state.charts.ccDriverRisk.render();

        // RTO Efficiency Bar Chart
        const rtos = filterByState(window.TransportData.rtoOperations);
        const rtoNames = rtos.map(r => r.rtoName.replace(' RTO', ''));
        const rtoScores = rtos.map(r => r.efficiencyScore);

        destroyChart('ccRTOEfficiency');
        state.charts.ccRTOEfficiency = new ApexCharts(document.getElementById('cc-chart-rto-efficiency'), {
            ...getApexTheme(),
            series: [{ name: 'Efficiency Score', data: rtoScores }],
            chart: { 
                ...getApexTheme().chart, 
                type: 'bar', 
                height: 300,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const selectedRTO = rtoNames[config.dataPointIndex];
                        const filtered = rtos.filter(r => r.rtoName.includes(selectedRTO));
                        openDataTableModal(`RTO - ${selectedRTO}`, filtered, COLUMNS.rtos);
                    }
                }
            },
            plotOptions: {
                bar: { borderRadius: 6, horizontal: true, barHeight: '60%',
                    colors: { ranges: [
                        { from: 0, to: 59, color: CHART_COLORS.red },
                        { from: 60, to: 74, color: CHART_COLORS.amber },
                        { from: 75, to: 89, color: CHART_COLORS.teal },
                        { from: 90, to: 100, color: CHART_COLORS.emerald }
                    ]}
                }
            },
            xaxis: { max: 100, labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#e2e8f0', fontSize: '11px' } } },
            categories: rtoNames,
            labels: rtoNames,
            dataLabels: { enabled: true, style: { fontSize: '12px', fontFamily: 'JetBrains Mono' } }
        });
        // Fix: categories needs to be on xaxis for horizontal
        state.charts.ccRTOEfficiency.updateOptions({ xaxis: { max: 100 }, yaxis: { categories: rtoNames } });
        state.charts.ccRTOEfficiency.render();

        // Alerts Table
        renderAlerts(accidents, challans, rtos);

        // Persona Actionables
        renderPersonaInsights();
    }

    function renderPersonaInsights() {
        const container = document.getElementById('persona-insights-container');
        const roleLabel = document.getElementById('persona-insights-role');
        if (!container || !roleLabel) return;

        const roleMap = {
            'commissioner': 'Transport Commissioner',
            'collector': 'District Collector',
            'sp-traffic': 'SP Traffic',
            'rto-head': 'RTO Head'
        };
        roleLabel.textContent = `for ${roleMap[state.selectedRole]}`;

        const accidents = filterByState(window.TransportData.accidents);
        const challans = filterByState(window.TransportData.challans);
        const overdueCount = challans.filter(c => c.paymentStatus === 'Overdue').length;

        const rtos = filterByState(window.TransportData.rtoOperations);
        const worstRto = rtos.length > 0 ? rtos.reduce((prev, curr) => (prev.efficiencyScore < curr.efficiencyScore) ? prev : curr).rtoName : 'Janakpuri RTO';

        const insights = window.RiskModels.generatePersonaInsights(state.selectedRole, {
            totalAccidents: accidents.length,
            topCause: 'Over Speeding',
            overdueChallans: overdueCount,
            worstRto: worstRto
        });

        container.innerHTML = insights.map(insight => `
            <div class="card" style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h4 style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem; margin: 0;">${insight.title}</h4>
                    <span class="risk-badge risk-${insight.impact === 'High' ? 'high' : 'medium'}" style="font-size: 0.65rem;">${insight.type} • ${insight.impact}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 12px 0;">${insight.description}</p>
                <div style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--accent-emerald); padding: 8px 12px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
                    <strong style="color: var(--accent-emerald); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Recommended Action</strong>
                    <span style="color: var(--text-primary); font-size: 0.85rem;">${insight.action}</span>
                </div>
            </div>
        `).join('');
    }

    function renderAlerts(accidents, challans, rtos) {
        const tbody = document.getElementById('cc-alerts-tbody');
        const alerts = [];

        // Generate dynamic alerts from data
        const fatalAccidents = accidents.filter(a => a.severity === 'Fatal');
        if (fatalAccidents.length > 0) {
            const latest = fatalAccidents[fatalAccidents.length - 1];
            alerts.push({
                priority: 'Critical',
                type: 'Accident',
                desc: `Fatal accident at ${latest.location} — ${latest.cause}`,
                state: latest.state,
                action: 'Deploy emergency unit & investigate'
            });
        }

        const overdueChallans = challans.filter(c => c.paymentStatus === 'Overdue');
        if (overdueChallans.length > 10) {
            alerts.push({
                priority: 'High',
                type: 'Enforcement',
                desc: `${overdueChallans.length} overdue challans pending collection`,
                state: 'Multi-state',
                action: 'Escalate to recovery division'
            });
        }

        const lowEffRTOs = rtos.filter(r => r.efficiencyScore < 65);
        lowEffRTOs.forEach(r => {
            alerts.push({
                priority: 'Medium',
                type: 'Operations',
                desc: `${r.rtoName} efficiency score at ${r.efficiencyScore}% — below benchmark`,
                state: r.state,
                action: 'Review staffing & workflow'
            });
        });

        const drunkDriving = challans.filter(c => c.violationType === 'Drunk Driving');
        if (drunkDriving.length > 5) {
            alerts.push({
                priority: 'High',
                type: 'Safety',
                desc: `${drunkDriving.length} drunk driving violations detected — enforce checkpoints`,
                state: 'Multi-state',
                action: 'Increase night sobriety checks'
            });
        }

        // Always add at least one info alert
        alerts.push({
            priority: 'Info',
            type: 'System',
            desc: 'POC data refresh completed successfully',
            state: 'All',
            action: 'No action required'
        });

        tbody.innerHTML = alerts.map(a => `
            <tr>
                <td><span class="status-dot ${a.priority === 'Critical' ? 'status-critical pulse-dot' : a.priority === 'High' ? 'status-warning' : a.priority === 'Medium' ? 'status-warning' : 'status-active'}"></span> ${a.priority}</td>
                <td>${a.type}</td>
                <td>${a.desc}</td>
                <td>${a.state}</td>
                <td>${a.action}</td>
            </tr>
        `).join('');
    }

    // ═══════════════════════════════════════════════════════════════
    //  RTO EFFICIENCY (TAB 2)
    // ═══════════════════════════════════════════════════════════════
    function populateRTOSelector() {
        const select = document.getElementById('rto-select');
        const rtos = filterByState(window.TransportData.rtoOperations);
        select.innerHTML = rtos.map((r, i) => `<option value="${i}">${r.rtoName} (${r.state})</option>`).join('');
        state.selectedRTO = 0;
        select.addEventListener('change', (e) => {
            state.selectedRTO = parseInt(e.target.value);
            renderRTOEfficiency();
        });
    }

    function renderRTOEfficiency() {
        const rtos = filterByState(window.TransportData.rtoOperations);
        if (rtos.length === 0) return;
        const rto = rtos[state.selectedRTO] || rtos[0];
        const analysis = window.RiskModels.analyzeRTOEfficiency(rto);

        // KPIs
        document.getElementById('rto-efficiency-score').textContent = analysis.overallScore;
        const services = rto.services;
        const totalPending = Object.values(services).reduce((s, v) => s + v.pending, 0);
        const avgDelay = (Object.values(services).reduce((s, v) => s + v.avgProcessingDays, 0) / Object.keys(services).length).toFixed(1);
        document.getElementById('rto-avg-delay').textContent = avgDelay;
        document.getElementById('rto-pending').textContent = formatNumber(totalPending);
        document.getElementById('rto-staff-count').textContent = rto.staffCount;

        // Service-wise Grouped Bar
        const serviceNames = Object.keys(services).map(s => s.replace(/([A-Z])/g, ' $1').trim());
        const received = Object.values(services).map(s => s.received);
        const processed = Object.values(services).map(s => s.processed);
        const pending = Object.values(services).map(s => s.pending);

        destroyChart('rtoServices');
        state.charts.rtoServices = new ApexCharts(document.getElementById('rto-chart-services'), {
            ...getApexTheme(),
            series: [
                { name: 'Received', data: received },
                { name: 'Processed', data: processed },
                { name: 'Pending', data: pending }
            ],
            chart: { 
                ...getApexTheme().chart, 
                type: 'bar', 
                height: 350, 
                stacked: false,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const serviceName = serviceNames[config.dataPointIndex];
                        openDataTableModal(`${rto.rtoName} - ${serviceName}`, [rto], COLUMNS.rtos);
                    }
                }
            },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '65%' } },
            colors: [CHART_COLORS.indigo, CHART_COLORS.teal, CHART_COLORS.red],
            xaxis: { categories: serviceNames, labels: { style: { colors: '#94a3b8', fontSize: '10px' }, rotate: -30 } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            dataLabels: { enabled: false }
        });
        state.charts.rtoServices.render();

        // Bottlenecks
        const bottleneckDiv = document.getElementById('rto-bottlenecks');
        bottleneckDiv.innerHTML = analysis.bottlenecks.map(b => `
            <div class="bottleneck-item">
                <div class="bottleneck-header">
                    <span class="bottleneck-service"><span style="color:var(--text-muted); font-size:0.85rem; margin-right:6px; font-weight:normal;">Category:</span>${b.service}</span>
                    <span class="risk-badge risk-${b.severity.toLowerCase()}">${b.severity} Risk</span>
                </div>
                <div class="bottleneck-detail">
                    <span class="bottleneck-ratio"><span style="color:var(--text-muted); margin-right:4px;">Issue:</span>${b.severity} Backlog (Pending: ${(b.pendingRatio * 100).toFixed(1)}%)</span>
                    <span class="bottleneck-stat" style="font-size:0.85rem; color:var(--text-secondary);"><i data-lucide="clock" style="width:12px;height:12px;margin-right:2px;vertical-align:-2px;"></i>${b.avgDays} days avg</span>
                    <span class="bottleneck-stat" style="font-size:0.85rem; color:var(--text-secondary);"><i data-lucide="alert-circle" style="width:12px;height:12px;margin-right:2px;vertical-align:-2px;"></i>${b.pendingCount} pending</span>
                </div>
                <p class="bottleneck-rec"><i data-lucide="lightbulb" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i><strong style="color:var(--text-primary); margin-right:4px; font-weight:600;">Action:</strong>${b.recommendation}</p>
            </div>
        `).join('');
        lucide.createIcons();

        // Staffing section
        const staffRec = analysis.staffingRecommendation;
        const recDiv = document.getElementById('rto-bottlenecks');
        recDiv.innerHTML += `
            <div class="bottleneck-item staffing-rec">
                <div class="bottleneck-header">
                    <span class="bottleneck-service">Staffing Recommendation</span>
                    <span class="risk-badge risk-medium">AI</span>
                </div>
                <div class="bottleneck-detail">
                    <span class="bottleneck-stat" style="color: var(--accent-emerald); font-weight:500; font-size:0.9rem;">
                        <i data-lucide="users" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px;"></i>
                        Current: ${staffRec.current} &rarr; Optimal: ${staffRec.optimal} (Deficit: ${staffRec.deficit})
                    </span>
                </div>
                <p class="bottleneck-rec"><i data-lucide="users" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i>${staffRec.impact}</p>
            </div>
        `;

        // Reset slider
        document.getElementById('rto-staff-slider').value = 0;
        document.getElementById('rto-staff-slider-value').textContent = '+0';
        updateStaffPredictions(0);

        // Populate Slot Metrics
        const totalSlots = rto.testSlots.total;
        const availableSlots = totalSlots - rto.testSlots.utilized;
        const noShowRate = (rto.rtoName.charCodeAt(0) % 10) + 8; // Stable pseudo-random 8-17%
        
        const totalEl = document.getElementById('slot-total-val');
        if (totalEl) totalEl.textContent = totalSlots;
        
        const availEl = document.getElementById('slot-avail-val');
        if (availEl) availEl.textContent = availableSlots;
        
        const noShowEl = document.getElementById('slot-noshow-val');
        if (noShowEl) noShowEl.textContent = noShowRate + '%';

        // Test slot utilization radial
        destroyChart('rtoSlots');
        state.charts.rtoSlots = new ApexCharts(document.getElementById('rto-chart-slots'), {
            ...getApexTheme(),
            series: [Math.round(rto.testSlots.utilization * 100)],
            chart: { 
                ...getApexTheme().chart, 
                type: 'radialBar', 
                height: 260,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        openDataTableModal(`${rto.rtoName} - Slot Utilisation`, [rto], COLUMNS.rtos);
                    }
                }
            },
            plotOptions: {
                radialBar: {
                    hollow: { size: '65%', background: 'transparent' },
                    track: { background: 'rgba(99,102,241,0.1)', strokeWidth: '100%' },
                    dataLabels: {
                        name: { show: true, color: '#94a3b8', fontSize: '13px', offsetY: -10 },
                        value: { color: '#e2e8f0', fontSize: '28px', fontFamily: 'JetBrains Mono', offsetY: 5, formatter: (val) => val + '%' }
                    }
                }
            },
            fill: { type: 'gradient', gradient: { shade: 'dark', shadeIntensity: 0.2, gradientToColors: [CHART_COLORS.teal], stops: [0, 100] } },
            colors: [CHART_COLORS.indigo],
            labels: ['Slot Utilisation'],
            stroke: { lineCap: 'round' }
        });
        state.charts.rtoSlots.render();
    }

    function initStaffSlider() {
        const slider = document.getElementById('rto-staff-slider');
        const valueLabel = document.getElementById('rto-staff-slider-value');
        const btnMinus = document.getElementById('btn-staff-minus');
        const btnPlus = document.getElementById('btn-staff-plus');

        const updateSlider = () => {
            const val = parseInt(slider.value);
            valueLabel.textContent = (val > 0 ? '+' : '') + val;
            updateStaffPredictions(val);
        };

        slider.addEventListener('input', updateSlider);

        if (btnMinus) {
            btnMinus.addEventListener('click', () => {
                let val = parseInt(slider.value);
                if (val > parseInt(slider.min)) {
                    slider.value = val - 1;
                    updateSlider();
                }
            });
        }

        if (btnPlus) {
            btnPlus.addEventListener('click', () => {
                let val = parseInt(slider.value);
                if (val < parseInt(slider.max)) {
                    slider.value = val + 1;
                    updateSlider();
                }
            });
        }
    }

    function updateStaffPredictions(additionalStaff) {
        const rtos = filterByState(window.TransportData.rtoOperations);
        if (rtos.length === 0) return;
        const rto = rtos[state.selectedRTO] || rtos[0];

        const services = rto.services;
        const avgDelay = Object.values(services).reduce((s, v) => s + v.avgProcessingDays, 0) / Object.keys(services).length;

        // Simple prediction model
        const activeStaff = Math.max(1, rto.staffCount + additionalStaff);
        const staffRatio = rto.staffCount / activeStaff;
        const predictedDelay = (avgDelay * staffRatio * (1 + 0.05 * additionalStaff / rto.staffCount)).toFixed(1);
        const reduction = Math.round((1 - predictedDelay / avgDelay) * 100);
        const utilization = Math.min(98, Math.max(0, Math.round((rto.testSlots.utilization * 100) * (rto.staffCount / activeStaff) + additionalStaff * 1.5)));

        const totalReceived = Object.values(services).reduce((s, v) => s + v.received, 0);
        const totalProcessed = Object.values(services).reduce((s, v) => s + v.processed, 0);
        const currentClearance = Math.round(totalProcessed / totalReceived * 100);
        const predictedClearance = Math.min(100, Math.max(0, currentClearance + additionalStaff * 1.2));

        document.getElementById('rto-predicted-delay').textContent = Math.max(0, predictedDelay) + ' days';
        document.getElementById('rto-delay-change').textContent = additionalStaff !== 0 ? (reduction >= 0 ? `↓ ${Math.abs(reduction)}% reduction` : `↑ ${Math.abs(reduction)}% increase`) : '';
        document.getElementById('rto-delay-change').className = 'prediction-change ' + (reduction >= 0 ? 'positive' : 'negative');

        document.getElementById('rto-predicted-clearance').textContent = predictedClearance.toFixed(1) + '%';
        const clearanceDiff = predictedClearance - currentClearance;
        document.getElementById('rto-clearance-change').textContent = additionalStaff !== 0 ? (clearanceDiff >= 0 ? `↑ ${clearanceDiff.toFixed(1)}%` : `↓ ${Math.abs(clearanceDiff).toFixed(1)}%`) : '';
        document.getElementById('rto-clearance-change').className = 'prediction-change ' + (clearanceDiff >= 0 ? 'positive' : 'negative');

        document.getElementById('rto-predicted-utilization').textContent = utilization + '%';
        document.getElementById('rto-utilization-change').textContent = '';

        // Budget Impact calculation (Assumed ₹45,000 per mo salary)
        const costPerStaff = 45000;
        const totalCostChange = additionalStaff * costPerStaff;
        const formattedCost = new Intl.NumberFormat('en-IN').format(Math.abs(totalCostChange));
        
        document.getElementById('rto-predicted-cost').textContent = additionalStaff === 0 ? '₹0 / mo' : (additionalStaff > 0 ? `+₹${formattedCost} / mo` : `-₹${formattedCost} / mo`);
        document.getElementById('rto-cost-change').textContent = additionalStaff !== 0 ? (additionalStaff > 0 ? `Cost Increase` : `Budget Savings`) : '';
        document.getElementById('rto-cost-change').className = 'prediction-change ' + (additionalStaff > 0 ? 'negative' : 'positive');

        // Update Efficiency Score in Real Time
        const currentEfficiency = rto.efficiencyScore;
        const newEfficiency = Math.min(100, Math.round(currentEfficiency + additionalStaff * 1.5));
        const scoreEl = document.getElementById('rto-efficiency-score');
        if (scoreEl) {
            scoreEl.textContent = newEfficiency;
            scoreEl.style.color = newEfficiency >= 90 ? 'var(--accent-emerald)' :
                                  newEfficiency >= 75 ? 'var(--accent-indigo)' :
                                  newEfficiency >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)';
            scoreEl.style.transition = 'color 0.3s ease';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  RTO REVENUE (TAB 6)
    // ═══════════════════════════════════════════════════════════════
    function populateRevenueRTOSelector() {
        const select = document.getElementById('revenue-rto-filter');
        if (!select) return;
        
        const rtos = filterByState(window.TransportData.rtoOperations);
        const options = ['<option value="All">All RTOs</option>'];
        
        rtos.forEach(r => {
            options.push(`<option value="${r.rtoName}">${r.rtoName}</option>`);
        });
        
        select.innerHTML = options.join('');
        state.revenueRTOFilter = 'All';
        
        // Remove old listeners by cloning
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        
        newSelect.addEventListener('change', (e) => {
            state.revenueRTOFilter = e.target.value;
            renderRTORevenue();
        });
    }

    function populateRevenueSourceSelector() {
        const select = document.getElementById('revenue-source-filter');
        if (!select) return;
        
        let txns = filterByState(window.TransportData.revenueTransactions);
        const sources = [...new Set(txns.map(t => t.source))].sort();
        
        const options = ['<option value="All">All Sources</option>'];
        sources.forEach(s => {
            options.push(`<option value="${s}">${s}</option>`);
        });
        select.innerHTML = options.join('');
        state.revenueSourceFilter = 'All';
        
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        
        newSelect.addEventListener('change', (e) => {
            state.revenueSourceFilter = e.target.value;
            renderRTORevenue();
        });
    }

    function initRevenueVehicleTypeFilter() {
        const select = document.getElementById('revenue-vehicle-type-filter');
        if (!select) return;
        state.revenueVehicleTypeFilter = 'All';
        
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        
        newSelect.addEventListener('change', (e) => {
            state.revenueVehicleTypeFilter = e.target.value;
            renderRTORevenue();
        });
    }

    function renderRTORevenue() {
        if (!window.TransportData.revenueTransactions) return;
        
        let tx = filterByState(window.TransportData.revenueTransactions);
        tx = filterByDate(tx, 'date');
        
        if (state.revenueRTOFilter && state.revenueRTOFilter !== 'All') {
            tx = tx.filter(t => t.rtoOffice === state.revenueRTOFilter);
        }
        if (state.revenueSourceFilter && state.revenueSourceFilter !== 'All') {
            tx = tx.filter(t => t.source === state.revenueSourceFilter);
        }
        if (state.revenueVehicleTypeFilter && state.revenueVehicleTypeFilter !== 'All') {
            tx = tx.filter(t => t.vehicleCategory === state.revenueVehicleTypeFilter);
        }

        state.exportData.revenue = tx;

        if (tx.length === 0) {
            document.getElementById('revenue-total-kpi').textContent = '₹0';
            document.getElementById('revenue-source-kpi').textContent = '--';
            document.getElementById('revenue-rto-kpi').textContent = '--';
            document.getElementById('revenue-tx-kpi').textContent = '0';
            document.getElementById('revenue-table-body').innerHTML = '<tr><td colspan="6" style="text-align: center;">No revenue data for selected filters</td></tr>';
            
            destroyChart('revTrend');
            destroyChart('revSource');
            return;
        }

        // 1. Calculate KPIs
        let totalRevenue = 0;
        let sourceTotals = {};
        let rtoTotals = {};

        tx.forEach(t => {
            totalRevenue += t.amount;
            
            if (!sourceTotals[t.source]) sourceTotals[t.source] = 0;
            sourceTotals[t.source] += t.amount;

            if (!rtoTotals[t.rtoOffice]) rtoTotals[t.rtoOffice] = 0;
            rtoTotals[t.rtoOffice] += t.amount;
        });

        // Format total
        document.getElementById('revenue-total-kpi').textContent = '₹' + formatNumber(totalRevenue);
        document.getElementById('revenue-tx-kpi').textContent = formatNumber(tx.length);

        // Highest Source
        let highestSource = Object.keys(sourceTotals).sort((a, b) => sourceTotals[b] - sourceTotals[a])[0];
        document.getElementById('revenue-source-kpi').textContent = highestSource || '--';

        // Top RTO
        let topRto = Object.keys(rtoTotals).sort((a, b) => rtoTotals[b] - rtoTotals[a])[0];
        document.getElementById('revenue-rto-kpi').textContent = topRto || '--';

        // 2. Prepare Trend Chart Data (Monthly)
        let monthlyData = {};
        tx.forEach(t => {
            let month = t.date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) monthlyData[month] = 0;
            monthlyData[month] += t.amount;
        });
        
        let sortedMonths = Object.keys(monthlyData).sort();
        let trendSeries = sortedMonths.map(m => monthlyData[m]);
        let trendCategories = sortedMonths.map(m => {
            const d = new Date(m + '-01');
            return d.toLocaleString('default', { month: 'short' }) + ' \'' + d.getFullYear().toString().substring(2);
        });

        destroyChart('revTrend');
        state.charts.revTrend = new ApexCharts(document.getElementById('chart-revenue-trend'), {
            ...getApexTheme(),
            series: [{ name: 'Revenue', data: trendSeries }],
            chart: { type: 'area', height: 350, toolbar: { show: false }, background: 'transparent' },
            colors: ['#10b981'],
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 },
            xaxis: { categories: trendCategories },
            yaxis: { 
                labels: { formatter: (val) => '₹' + (val / 1000).toFixed(0) + 'k' }
            },
            tooltip: { y: { formatter: (val) => '₹' + formatNumber(val) } }
        });
        state.charts.revTrend.render();

        // 3. Prepare Source Donut Chart
        let sourceLabels = Object.keys(sourceTotals);
        let sourceSeries = Object.values(sourceTotals);

        destroyChart('revSource');
        state.charts.revSource = new ApexCharts(document.getElementById('chart-revenue-source'), {
            ...getApexTheme(),
            series: sourceSeries,
            chart: { type: 'donut', height: 350, background: 'transparent' },
            labels: sourceLabels,
            colors: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#0ea5e9'],
            dataLabels: { enabled: false },
            legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
            plotOptions: {
                pie: {
                    donut: { size: '70%', labels: { show: true, name: { color: '#94a3b8' }, value: { color: '#e2e8f0', formatter: (val) => '₹' + formatNumber(val) } } }
                }
            },
            tooltip: { y: { formatter: (val) => '₹' + formatNumber(val) } }
        });
        state.charts.revSource.render();

        // 4. Render Table
        const tbody = document.getElementById('revenue-table-body');
        tbody.innerHTML = '';
        
        // Show last 100 transactions max
        let displayTxns = [...txns].reverse().slice(0, 100);
        
        displayTxns.forEach(t => {
            const tr = document.createElement('tr');
            
            // Format source nicely
            let sourceHtml = `<span class="card-badge">${t.source}</span>`;
            
            tr.innerHTML = `
                <td style="font-family: var(--font-mono); font-size: 0.85rem;">${t.transactionId}</td>
                <td>${t.date}</td>
                <td>${t.state}</td>
                <td>${t.rtoOffice}</td>
                <td>${sourceHtml}</td>
                <td>${t.vehicleCategory || '--'}</td>
                <td style="text-align: right; font-weight: 600; color: var(--text-primary);">₹${formatNumber(t.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    //  DRIVER RISK (TAB 3)
    // ═══════════════════════════════════════════════════════════════

    function renderDriverOverallAnalysis() {
        const drivers = filterByState(window.TransportData.drivers);
        const allChallans = filterByDate(window.TransportData.challans, 'dateTime');

        if (drivers.length === 0) return;

        // 1. KPIs
        const totalDrivers = drivers.length;
        
        let totalAge = 0;
        let totalExp = 0;
        let highRiskCount = 0;
        let criticalRiskCount = 0;
        let rtoCriticalCounts = {}; 
        let genderCounts = { 'M': 0, 'F': 0, 'O': 0 };
        let licenseCounts = {};

        drivers.forEach(d => {
            totalAge += d.age;
            totalExp += d.experience;
            
            // normalize gender to M, F, O for cleaner display if data contains full words
            let g = d.gender.toUpperCase().charAt(0);
            if (!['M', 'F', 'O'].includes(g)) g = 'O';
            genderCounts[g] = (genderCounts[g] || 0) + 1;
            
            licenseCounts[d.licenseType] = (licenseCounts[d.licenseType] || 0) + 1;

            const ch = allChallans.filter(c => c.dlNumber === d.dlNumber);
            const scoreObj = window.RiskModels.calculateDriverRisk(d, ch);
            if (scoreObj.category === 'High') {
                highRiskCount++;
                if (scoreObj.score >= 80) { // Critical >= 80
                    criticalRiskCount++;
                    rtoCriticalCounts[d.rtoOffice] = (rtoCriticalCounts[d.rtoOffice] || 0) + 1;
                }
            }
        });

        const avgAge = (totalAge / totalDrivers).toFixed(1);
        const avgExp = (totalExp / totalDrivers).toFixed(1);

        document.getElementById('driver-total-kpi').textContent = formatNumber(totalDrivers);
        document.getElementById('driver-age-kpi').textContent = avgAge + ' yrs';
        document.getElementById('driver-exp-kpi').textContent = avgExp + ' yrs';
        document.getElementById('driver-high-risk-kpi').textContent = formatNumber(highRiskCount);
        document.getElementById('driver-critical-risk-kpi').textContent = formatNumber(criticalRiskCount);

        // 2. Charts
        
        // 2A. License Type
        const licenseLabels = Object.keys(licenseCounts);
        const licenseSeries = Object.values(licenseCounts);
        
        destroyChart('driverLicense');
        state.charts.driverLicense = new ApexCharts(document.getElementById('chart-driver-license'), {
            ...getApexTheme(),
            series: licenseSeries,
            chart: { type: 'donut', height: 250, background: 'transparent' },
            labels: licenseLabels,
            colors: ['#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'], 
            plotOptions: { pie: { donut: { size: '65%' } } },
            legend: { position: 'right', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: false }
        });
        state.charts.driverLicense.render();

        // 2B. Gender
        const genderLabels = Object.keys(genderCounts).map(g => g === 'M' ? 'Male' : (g === 'F' ? 'Female' : 'Other'));
        const genderSeries = Object.values(genderCounts);
        
        destroyChart('driverGender');
        state.charts.driverGender = new ApexCharts(document.getElementById('chart-driver-gender'), {
            ...getApexTheme(),
            series: genderSeries,
            chart: { type: 'donut', height: 250, background: 'transparent' },
            labels: genderLabels,
            colors: ['#3b82f6', '#ec4899', '#94a3b8'], // Blue for M, Pink for F, Gray for O
            plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { show: true }, value: { show: true } } } } },
            legend: { position: 'right', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: false }
        });
        state.charts.driverGender.render();

        // 2C. Critical Risk Drivers by RTO
        let rtoData = Object.keys(rtoCriticalCounts).map(rto => ({
            rto: rto,
            count: rtoCriticalCounts[rto]
        })).sort((a, b) => b.count - a.count).slice(0, 8);
        
        if (rtoData.length === 0) {
            rtoData = [{rto: 'None', count: 0}]; 
        }

        destroyChart('driverRtoRisk');
        state.charts.driverRtoRisk = new ApexCharts(document.getElementById('chart-driver-rto-risk'), {
            ...getApexTheme(),
            series: [{ name: 'Critical Risk Drivers', data: rtoData.map(d => d.count) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false }, background: 'transparent' },
            plotOptions: { bar: { horizontal: true, borderRadius: 4, colors: { ranges: [{ from: 0, to: 9999, color: '#ef4444' }] } } },
            dataLabels: { enabled: true, textAnchor: 'start', offsetX: 0, style: { colors: ['#fff'] } },
            xaxis: { categories: rtoData.map(d => d.rto), labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            grid: { borderColor: 'rgba(99, 102, 241, 0.1)' }
        });
        state.charts.driverRtoRisk.render();
    }

    function initSearch(type) {
        const input = document.getElementById(type + '-search');
        const suggestionsDiv = document.getElementById(type + '-suggestions');

        input.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (q.length < 2) { suggestionsDiv.innerHTML = ''; suggestionsDiv.style.display = 'none'; return; }

            const results = type === 'driver'
                ? window.TransportData.searchDrivers(q)
                : window.TransportData.searchVehicles(q);

            if (results.length === 0) {
                suggestionsDiv.innerHTML = '<div class="suggestion-item no-result">No results found</div>';
                suggestionsDiv.style.display = 'block';
                return;
            }

            suggestionsDiv.innerHTML = results.map(r => {
                if (type === 'driver') {
                    return `<div class="suggestion-item" data-dl="${r.dlNumber}">
                        <i data-lucide="user" style="width:16px;height:16px;"></i>
                        <span class="sugg-name">${r.name}</span>
                        <span class="sugg-id">${r.dlNumber}</span>
                    </div>`;
                } else {
                    return `<div class="suggestion-item" data-reg="${r.regNumber}">
                        <i data-lucide="car" style="width:16px;height:16px;"></i>
                        <span class="sugg-name">${r.make} ${r.model}</span>
                        <span class="sugg-id">${r.regNumber}</span>
                    </div>`;
                }
            }).join('');
            suggestionsDiv.style.display = 'block';
            lucide.createIcons();

            // Click handler for suggestions
            suggestionsDiv.querySelectorAll('.suggestion-item[data-dl], .suggestion-item[data-reg]').forEach(item => {
                item.addEventListener('click', () => {
                    if (type === 'driver') {
                        const dl = item.dataset.dl;
                        input.value = dl;
                        renderDriverProfile(dl);
                    } else {
                        const reg = item.dataset.reg;
                        input.value = reg;
                        renderVehicleProfile(reg);
                    }
                    suggestionsDiv.style.display = 'none';
                });
            });
        });

        // Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = input.value.trim();
                if (type === 'driver') {
                    const driver = window.TransportData.getDriverByDL(q);
                    if (driver) renderDriverProfile(q);
                    else {
                        const results = window.TransportData.searchDrivers(q);
                        if (results.length > 0) {
                            input.value = results[0].dlNumber;
                            renderDriverProfile(results[0].dlNumber);
                        }
                    }
                } else {
                    const vehicle = window.TransportData.getVehicleByReg(q);
                    if (vehicle) renderVehicleProfile(q);
                    else {
                        const results = window.TransportData.searchVehicles(q);
                        if (results.length > 0) {
                            input.value = results[0].regNumber;
                            renderVehicleProfile(results[0].regNumber);
                        }
                    }
                }
                suggestionsDiv.style.display = 'none';
            }
        });

        // Close suggestions on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                suggestionsDiv.style.display = 'none';
            }
        });
    }

    function renderDriverProfile(dlNumber) {
        const driver = window.TransportData.getDriverByDL(dlNumber);
        if (!driver) return;

        document.getElementById('driver-profile-section').style.display = 'block';
        document.getElementById('driver-default-view').style.display = 'none';

        const challans = window.TransportData.getChallansByDL(dlNumber);
        const risk = window.RiskModels.calculateDriverRisk(driver, challans);

        // Profile fields
        document.getElementById('driver-name').textContent = driver.name;
        document.getElementById('driver-dl').textContent = driver.dlNumber;
        document.getElementById('driver-age').textContent = driver.age + ' years';
        document.getElementById('driver-gender').textContent = driver.gender;
        document.getElementById('driver-state').textContent = driver.state;
        document.getElementById('driver-rto').textContent = driver.rtoOffice;
        document.getElementById('driver-license-type').textContent = driver.licenseType;
        document.getElementById('driver-issue-date').textContent = driver.issueDate;
        document.getElementById('driver-expiry-date').textContent = driver.expiryDate;
        document.getElementById('driver-experience').textContent = driver.yearsExperience + ' years';
        document.getElementById('driver-test-attempts').textContent = driver.testAttempts;
        document.getElementById('driver-status').textContent = driver.status;
        document.getElementById('driver-violations').textContent = driver.violationCount;
        document.getElementById('driver-accidents').textContent = driver.accidentCount;

        // Risk badge
        const badge = document.getElementById('driver-risk-badge');
        badge.textContent = risk.category + ' Risk';
        badge.className = 'risk-badge ' + riskBadgeClass(risk.score);

        // Risk gauge
        updateRiskGauge('driver', risk.score, risk.category);

        // XAI Waterfall Chart
        renderXAIChart('driver-xai-chart', risk.factors, 'driverXAI');

        // Challan table
        document.getElementById('driver-challan-count').textContent = challans.length + ' records';
        const tbody = document.getElementById('driver-challans-tbody');
        tbody.innerHTML = challans.map(c => `
            <tr>
                <td><span style="font-family: var(--font-mono); font-size: 0.8rem;">${c.challanId}</span></td>
                <td>${new Date(c.dateTime).toLocaleDateString('en-IN')}</td>
                <td>${c.violationType}</td>
                <td>${c.location}</td>
                <td>₹${formatNumber(c.fineAmount)}</td>
                <td><span class="risk-badge ${c.paymentStatus === 'Paid' ? 'risk-low' : c.paymentStatus === 'Pending' ? 'risk-medium' : 'risk-high'}">${c.paymentStatus}</span></td>
                <td>${c.detectionMode}</td>
            </tr>
        `).join('');
    }

    function renderTopRiskDrivers() {
        const drivers = filterByState(window.TransportData.drivers);
        const allChallans = filterByDate(window.TransportData.challans, 'dateTime');

        let scored = drivers.map(d => {
            const ch = allChallans.filter(c => c.dlNumber === d.dlNumber);
            const score = window.RiskModels.calculateDriverRisk(d, ch);
            const hasViolation = state.driverViolationFilter === 'All' || ch.some(c => c.violationType === state.driverViolationFilter);
            return { ...d, riskScore: score.score, riskCategory: score.category, factors: score.factors, activeChallans: ch.length, hasViolation };
        });

        if (state.driverViolationFilter !== 'All') {
            scored = scored.filter(d => d.hasViolation);
        }

        if (state.driverRiskFilter !== 'All') {
            scored = scored.filter(d => d.riskCategory === state.driverRiskFilter);
        }

        scored.sort((a, b) => b.riskScore - a.riskScore);
        const top20 = scored.slice(0, 20);
        state.exportData.drivers = top20;

        const tbody = document.getElementById('driver-top-risk-tbody');
        tbody.innerHTML = top20.map(d => `
            <tr class="clickable-row" data-dl="${d.dlNumber}">
                <td><span style="font-family: var(--font-mono); font-size: 0.8rem;">${d.dlNumber}</span></td>
                <td>${d.name}</td>
                <td>${d.age}</td>
                <td>${d.state}</td>
                <td>${d.violationCount}</td>
                <td><span style="font-family: var(--font-mono); font-weight: 600; color: ${riskColor(d.riskScore)}">${d.riskScore}</span></td>
                <td><span class="risk-badge ${riskBadgeClass(d.riskScore)}">${d.riskCategory}</span></td>
            </tr>
        `).join('');

        // Click to view profile
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                document.getElementById('driver-search').value = row.dataset.dl;
                renderDriverProfile(row.dataset.dl);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  VEHICLE RISK (TAB 4)
    // ═══════════════════════════════════════════════════════════════
    
    function renderVehicleOverallAnalysis() {
        const vehicles = filterByState(window.TransportData.vehicles);
        const allChallans = filterByDate(window.TransportData.challans, 'dateTime');

        if (vehicles.length === 0) return;

        // 1. KPIs
        const totalVehicles = vehicles.length;
        const commercialCount = vehicles.filter(v => v.commercialUse).length;
        const commercialPct = Math.round((commercialCount / totalVehicles) * 100);
        
        const totalAge = vehicles.reduce((sum, v) => sum + v.vehicleAge, 0);
        const avgAge = (totalAge / totalVehicles).toFixed(1);

        // Calculate Risk for all vehicles to get High/Critical risk counts
        let highRiskCount = 0;
        let criticalRiskCount = 0;
        let rtoCriticalCounts = {}; // For chart

        vehicles.forEach(v => {
            const ch = allChallans.filter(c => c.regNumber === v.regNumber);
            const scoreObj = window.RiskModels.calculateVehicleRisk(v, ch);
            if (scoreObj.category === 'High') {
                highRiskCount++;
                if (scoreObj.score >= 80) { // define Critical as score >= 80
                    criticalRiskCount++;
                    // Try to map back to RTO via owner DL
                    const owner = window.TransportData.getDriverByDL(v.ownerDL);
                    const rto = owner ? owner.rtoOffice : 'Unknown RTO';
                    rtoCriticalCounts[rto] = (rtoCriticalCounts[rto] || 0) + 1;
                }
            }
        });

        document.getElementById('vehicle-total-kpi').textContent = formatNumber(totalVehicles);
        document.getElementById('vehicle-commercial-kpi').textContent = commercialPct + '%';
        document.getElementById('vehicle-age-kpi').textContent = avgAge + ' yrs';
        document.getElementById('vehicle-high-risk-kpi').textContent = formatNumber(highRiskCount);
        document.getElementById('vehicle-critical-risk-kpi').textContent = formatNumber(criticalRiskCount);

        // 2. Charts
        
        // 2A. Fuel Type
        const fuelCounts = {};
        vehicles.forEach(v => {
            fuelCounts[v.fuelType] = (fuelCounts[v.fuelType] || 0) + 1;
        });
        const fuelLabels = Object.keys(fuelCounts);
        const fuelSeries = Object.values(fuelCounts);
        
        destroyChart('vehicleFuel');
        state.charts.vehicleFuel = new ApexCharts(document.getElementById('chart-vehicle-fuel'), {
            ...getApexTheme(),
            series: fuelSeries,
            chart: { type: 'donut', height: 250, background: 'transparent' },
            labels: fuelLabels,
            colors: ['#0ea5e9', '#14b8a6', '#f59e0b', '#8b5cf6'], // Custom colors for fuel
            plotOptions: { pie: { donut: { size: '65%' } } },
            legend: { position: 'right', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: false }
        });
        state.charts.vehicleFuel.render();

        // 2B. Accident Matrix (Vehicles with vs without accidents)
        const accidentVehicles = vehicles.filter(v => v.accidentCount > 0).length;
        const noAccidentVehicles = totalVehicles - accidentVehicles;
        
        destroyChart('vehicleAccident');
        state.charts.vehicleAccident = new ApexCharts(document.getElementById('chart-vehicle-accident'), {
            ...getApexTheme(),
            series: [noAccidentVehicles, accidentVehicles],
            chart: { type: 'donut', height: 250, background: 'transparent' },
            labels: ['Zero Accidents', 'Had Accidents'],
            colors: ['#10b981', '#ef4444'], // Green for zero, Red for accidents
            plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { show: true }, value: { show: true } } } } },
            legend: { position: 'right', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: false }
        });
        state.charts.vehicleAccident.render();

        // 2C. Critical Risk Vahan by RTO (Bar Chart)
        let rtoData = Object.keys(rtoCriticalCounts).map(rto => ({
            rto: rto,
            count: rtoCriticalCounts[rto]
        })).sort((a, b) => b.count - a.count).slice(0, 8); // Top 8 RTOs
        
        if (rtoData.length === 0) {
            rtoData = [{rto: 'None', count: 0}]; // Fallback if no critical risk
        }

        destroyChart('vehicleRtoRisk');
        state.charts.vehicleRtoRisk = new ApexCharts(document.getElementById('chart-vehicle-rto-risk'), {
            ...getApexTheme(),
            series: [{ name: 'Critical Risk Vehicles', data: rtoData.map(d => d.count) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false }, background: 'transparent' },
            plotOptions: { bar: { horizontal: true, borderRadius: 4, colors: { ranges: [{ from: 0, to: 9999, color: '#0ea5e9' }] } } },
            dataLabels: { enabled: true, textAnchor: 'start', offsetX: 0, style: { colors: ['#fff'] } },
            xaxis: { categories: rtoData.map(d => d.rto), labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            grid: { borderColor: 'rgba(99, 102, 241, 0.1)' }
        });
        state.charts.vehicleRtoRisk.render();
    }

    function renderVehicleProfile(regNumber) {
        const vehicle = window.TransportData.getVehicleByReg(regNumber);
        if (!vehicle) return;

        document.getElementById('vehicle-profile-section').style.display = 'block';
        document.getElementById('vehicle-default-view').style.display = 'none';

        const challans = window.TransportData.getChallansByReg(regNumber);
        const risk = window.RiskModels.calculateVehicleRisk(vehicle, challans);

        document.getElementById('vehicle-make-model').textContent = vehicle.make + ' ' + vehicle.model;
        document.getElementById('vehicle-reg').textContent = vehicle.regNumber;
        document.getElementById('vehicle-owner').textContent = vehicle.ownerName;
        document.getElementById('vehicle-type').textContent = vehicle.type;
        document.getElementById('vehicle-status').textContent = vehicle.status || 'Active';
        document.getElementById('vehicle-fuel').textContent = vehicle.fuelType;
        document.getElementById('vehicle-color').textContent = vehicle.color;
        document.getElementById('vehicle-reg-date').textContent = vehicle.registrationDate;
        document.getElementById('vehicle-age').textContent = vehicle.vehicleAge + ' years';
        document.getElementById('vehicle-commercial').textContent = vehicle.commercialUse ? 'Yes' : 'No';
        document.getElementById('vehicle-chassis').textContent = vehicle.chassisNumber || '--';
        document.getElementById('vehicle-engine').textContent = vehicle.engineNumber || '--';
        document.getElementById('vehicle-fitness').textContent = vehicle.fitnessValidTill + (vehicle.fitnessExpired ? ' ⚠️ EXPIRED' : ' ✓');
        document.getElementById('vehicle-pucc').textContent = vehicle.puccValidTill + (vehicle.puccExpired ? ' ⚠️ EXPIRED' : ' ✓');
        document.getElementById('vehicle-insurance').textContent = vehicle.insuranceValidTill;
        document.getElementById('vehicle-ownership').textContent = vehicle.ownershipChanges;
        document.getElementById('vehicle-accidents').textContent = vehicle.accidentCount;

        const badge = document.getElementById('vehicle-risk-badge');
        badge.textContent = risk.category + ' Risk';
        badge.className = 'risk-badge ' + riskBadgeClass(risk.score);

        updateRiskGauge('vehicle', risk.score, risk.category);
        renderXAIChart('vehicle-xai-chart', risk.factors, 'vehicleXAI');

        document.getElementById('vehicle-challan-count').textContent = challans.length + ' records';
        const tbody = document.getElementById('vehicle-challans-tbody');
        tbody.innerHTML = challans.map(c => `
            <tr>
                <td><span style="font-family: var(--font-mono); font-size: 0.8rem;">${c.challanId}</span></td>
                <td>${new Date(c.dateTime).toLocaleDateString('en-IN')}</td>
                <td>${c.violationType}</td>
                <td>${c.location}</td>
                <td>₹${formatNumber(c.fineAmount)}</td>
                <td><span class="risk-badge ${c.paymentStatus === 'Paid' ? 'risk-low' : c.paymentStatus === 'Pending' ? 'risk-medium' : 'risk-high'}">${c.paymentStatus}</span></td>
            </tr>
        `).join('');
    }

    function renderTopRiskVehicles() {
        let vehicles = filterByState(window.TransportData.vehicles);
        if (state.vehicleTypeFilter !== 'All') {
            vehicles = vehicles.filter(v => v.type === state.vehicleTypeFilter);
        }

        const allChallans = filterByDate(window.TransportData.challans, 'dateTime');

        let scored = vehicles.map(v => {
            const ch = allChallans.filter(c => c.regNumber === v.regNumber);
            const score = window.RiskModels.calculateVehicleRisk(v, ch);
            const hasViolation = state.vehicleViolationFilter === 'All' || ch.some(c => c.violationType === state.vehicleViolationFilter);
            return { ...v, riskScore: score.score, riskCategory: score.category, activeChallans: ch.length, hasViolation };
        });

        if (state.vehicleViolationFilter !== 'All') {
            scored = scored.filter(v => v.hasViolation);
        }

        if (state.vehicleRiskFilter !== 'All') {
            scored = scored.filter(v => v.riskCategory === state.vehicleRiskFilter);
        }

        scored.sort((a, b) => b.riskScore - a.riskScore);
        const top20 = scored.slice(0, 20);
        state.exportData.vehicles = top20;

        const tbody = document.getElementById('vehicle-top-risk-tbody');
        tbody.innerHTML = top20.map(v => `
            <tr class="clickable-row" data-reg="${v.regNumber}">
                <td><span style="font-family: var(--font-mono); font-size: 0.8rem;">${v.regNumber}</span></td>
                <td>${v.type}</td>
                <td>${v.make} ${v.model}</td>
                <td>${v.vehicleAge}</td>
                <td><span class="risk-badge ${v.fitnessExpired ? 'risk-high' : 'risk-low'}">${v.fitnessExpired ? 'Expired' : 'Valid'}</span></td>
                <td><span style="font-family: var(--font-mono); font-weight: 600; color: ${riskColor(v.riskScore)}">${v.riskScore}</span></td>
                <td><span class="risk-badge ${riskBadgeClass(v.riskScore)}">${v.riskCategory}</span></td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                document.getElementById('vehicle-search').value = row.dataset.reg;
                renderVehicleProfile(row.dataset.reg);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  RISK GAUGE & XAI CHART (Shared)
    // ═══════════════════════════════════════════════════════════════
    function updateRiskGauge(type, score, category) {
        const gaugeFill = document.getElementById(type + '-gauge-fill');
        const scoreEl = document.getElementById(type + '-risk-score');
        const labelEl = document.getElementById(type + '-risk-label');

        const circumference = 2 * Math.PI * 85;
        const offset = circumference - (score / 100) * circumference;
        gaugeFill.style.strokeDasharray = circumference;
        gaugeFill.style.strokeDashoffset = offset;
        gaugeFill.style.stroke = riskColor(score);

        scoreEl.textContent = score;
        scoreEl.style.color = riskColor(score);
        labelEl.textContent = category + ' Risk';
        labelEl.style.color = riskColor(score);
    }

    function renderXAIChart(containerId, factors, chartKey) {
        destroyChart(chartKey);

        const names = factors.map(f => f.name);
        const values = factors.map(f => f.direction === 'positive' ? f.impact : -f.impact);
        const colors = factors.map(f => f.direction === 'positive' ? CHART_COLORS.red : CHART_COLORS.emerald);

        state.charts[chartKey] = new ApexCharts(document.getElementById(containerId), {
            ...getApexTheme(),
            series: [{ name: 'Impact', data: values }],
            chart: { ...getApexTheme().chart, type: 'bar', height: 320 },
            plotOptions: {
                bar: {
                    horizontal: true, borderRadius: 4, barHeight: '60%',
                    colors: {
                        ranges: [
                            { from: -50, to: 0, color: CHART_COLORS.emerald },
                            { from: 0, to: 100, color: CHART_COLORS.red }
                        ]
                    }
                }
            },
            xaxis: { labels: { style: { colors: '#94a3b8' } }, title: { text: 'Risk Impact (%)', style: { color: '#64748b' } } },
            yaxis: { categories: names, labels: { style: { colors: '#e2e8f0', fontSize: '11px' } } },
            dataLabels: {
                enabled: true,
                formatter: (val) => (val > 0 ? '+' : '') + val + '%',
                style: { fontSize: '11px', fontFamily: 'JetBrains Mono' }
            },
            tooltip: {
                y: {
                    formatter: (val, { dataPointIndex }) => {
                        const f = factors[dataPointIndex];
                        return f.description;
                    }
                }
            }
        });
        state.charts[chartKey].render();
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACCIDENT HOTSPOTS (TAB 5)
    // ═══════════════════════════════════════════════════════════════
    function initMap() {
        if (state.map) return;
        state.map = L.map('accident-map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([22.5, 78.9], 5);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(state.map);

        state.markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true
        });
        state.map.addLayer(state.markerClusterGroup);
    }

    function initAccidentFilters() {
        ['accident-time-filter', 'accident-season-filter', 'accident-severity-filter'].forEach(groupId => {
            const group = document.getElementById(groupId);
            group.querySelectorAll('.filter-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');

                    if (groupId === 'accident-time-filter') state.accidentFilters.timeOfDay = chip.dataset.value;
                    if (groupId === 'accident-season-filter') state.accidentFilters.season = chip.dataset.value;
                    if (groupId === 'accident-severity-filter') state.accidentFilters.severity = chip.dataset.value;

                    renderAccidentHotspots();
                });
            });
        });
    }

    function initMapDrilldown() {
        const stateSelect = document.getElementById('map-state-select');
        const districtSelect = document.getElementById('map-district-select');
        const areaSelect = document.getElementById('map-area-select');
        const geo = window.TransportData.geography;

        // Populate State dropdown
        Object.keys(geo).forEach(stateName => {
            const opt = document.createElement('option');
            opt.value = stateName;
            opt.textContent = stateName;
            stateSelect.appendChild(opt);
        });

        stateSelect.addEventListener('change', () => {
            const s = stateSelect.value;
            districtSelect.innerHTML = '<option value="All">All Districts</option>';
            areaSelect.innerHTML = '<option value="All">All Areas</option>';
            
            if (s === 'All') {
                districtSelect.disabled = true;
                areaSelect.disabled = true;
                state.accidentFilters.district = 'All';
                state.accidentFilters.area = 'All';
                // Reset map bounds to India if possible, or do nothing
            } else {
                districtSelect.disabled = false;
                areaSelect.disabled = true;
                Object.keys(geo[s].districts).forEach(dist => {
                    const opt = document.createElement('option');
                    opt.value = dist;
                    opt.textContent = dist;
                    districtSelect.appendChild(opt);
                });
                
                // Fly to state
                if (state.map && geo[s].center) {
                    state.map.flyTo([geo[s].center.lat, geo[s].center.lng], geo[s].zoom);
                }
            }
            
            // Only update the state filter if we want map state to be independent of global state.
            // Wait, global state is `state.selectedState`. We can use that or a separate map filter.
            // Let's use `state.accidentFilters.state` for map specifically to avoid disrupting other tabs,
            // or just use the global state. Actually, `filterByState` uses `state.selectedState`. 
            // We'll just set map-specific filters in `state.accidentFilters`.
            state.accidentFilters.mapState = s;
            state.accidentFilters.district = 'All';
            state.accidentFilters.area = 'All';
            renderAccidentHotspots();
        });

        districtSelect.addEventListener('change', () => {
            const s = stateSelect.value;
            const d = districtSelect.value;
            areaSelect.innerHTML = '<option value="All">All Areas</option>';
            
            if (d === 'All') {
                areaSelect.disabled = true;
                state.accidentFilters.area = 'All';
                if (state.map && geo[s].center) state.map.flyTo([geo[s].center.lat, geo[s].center.lng], geo[s].zoom);
            } else {
                areaSelect.disabled = false;
                const dData = geo[s].districts[d];
                dData.areas.forEach(areaName => {
                    const opt = document.createElement('option');
                    opt.value = areaName;
                    opt.textContent = areaName;
                    areaSelect.appendChild(opt);
                });
                if (state.map && dData.center) state.map.flyTo([dData.center.lat, dData.center.lng], dData.zoom);
            }
            state.accidentFilters.district = d;
            state.accidentFilters.area = 'All';
            renderAccidentHotspots();
        });

        areaSelect.addEventListener('change', () => {
            state.accidentFilters.area = areaSelect.value;
            renderAccidentHotspots();
        });
    }

    function renderAccidentHotspots() {
        let accidents = filterByDate(filterByState(window.TransportData.accidents), 'date');
        const f = state.accidentFilters;

        if (f.mapState && f.mapState !== 'All') accidents = accidents.filter(a => a.state === f.mapState);
        if (f.district && f.district !== 'All') accidents = accidents.filter(a => a.district === f.district);
        if (f.area && f.area !== 'All') accidents = accidents.filter(a => a.area === f.area);

        if (f.timeOfDay !== 'All') accidents = accidents.filter(a => a.timeOfDay === f.timeOfDay);
        if (f.season !== 'All') accidents = accidents.filter(a => a.season === f.season);
        if (f.severity !== 'All') accidents = accidents.filter(a => a.severity === f.severity);
        if (f.cause && f.cause !== 'All') accidents = accidents.filter(a => a.cause === f.cause);

        const analysis = window.RiskModels.analyzeAccidentHotspots(accidents, f);

        // Store for drill-down access
        state.lastHotspotAnalysis = analysis;

        // KPIs
        document.getElementById('hotspot-total').textContent = analysis.summary.totalAccidents;
        document.getElementById('hotspot-fatal').textContent = analysis.summary.fatalAccidents;
        document.getElementById('hotspot-segments').textContent = analysis.hotspots.filter(h => h.riskLevel === 'Critical' || h.riskLevel === 'High').length;
        document.getElementById('hotspot-peak-time').textContent = analysis.summary.mostDangerousTime || '--';

        // Map markers
        if (state.markerClusterGroup) {
            state.markerClusterGroup.clearLayers();
        } else {
            state.mapMarkers.forEach(m => state.map.removeLayer(m));
        }
        state.mapMarkers = [];

        analysis.hotspots.forEach(h => {
            if (!h.gps) return;
            const color = h.riskLevel === 'Critical' ? '#ef4444' : h.riskLevel === 'High' ? '#f59e0b' : h.riskLevel === 'Moderate' ? '#0ea5e9' : '#10b981';
            const radius = h.riskLevel === 'Critical' ? 18 : h.riskLevel === 'High' ? 14 : 10;

            const marker = L.circleMarker([h.gps.lat, h.gps.lng], {
                radius: radius,
                fillColor: color,
                color: color,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.4
            });

            const segId = h.roadSegment.replace(/[^a-zA-Z0-9]/g, '_');
            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 220px;">
                    <strong style="font-size: 14px;">${h.roadSegment}</strong><br/>
                    <span style="color: ${color}; font-weight: 600;">${h.riskLevel} Risk</span><br/>
                    <hr style="border-color: rgba(255,255,255,0.1); margin: 6px 0;"/>
                    Accidents: <strong>${h.accidentCount}</strong> (Fatal: ${h.fatalCount})<br/>
                    Primary Cause: ${h.primaryCause}<br/>
                    Peak Time: ${h.peakTime}<br/>
                    <hr style="border-color: rgba(255,255,255,0.1); margin: 6px 0;"/>
                    <a href="#" onclick="event.preventDefault(); document.dispatchEvent(new CustomEvent('hotspot-drilldown', {detail: '${segId}'}));"
                       style="color: #6366f1; font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                       ▶ View Full Analysis
                    </a>
                </div>
            `);

            // Store segment ID on the marker for reference
            marker._hotspotSegment = h.roadSegment;

            if (state.markerClusterGroup) {
                state.markerClusterGroup.addLayer(marker);
            } else {
                marker.addTo(state.map);
            }
            state.mapMarkers.push(marker);
        });

        // Fit bounds if we have markers
        if (state.mapMarkers.length > 0) {
            const group = L.featureGroup(state.mapMarkers);
            state.map.fitBounds(group.getBounds().pad(0.2));
        }

        // Hotspot list — clickable
        const listDiv = document.getElementById('hotspot-list');
        listDiv.innerHTML = analysis.hotspots.slice(0, 15).map((h, i) => {
            const color = h.riskLevel === 'Critical' ? 'var(--accent-red)' : h.riskLevel === 'High' ? 'var(--accent-amber)' : 'var(--accent-sky)';
            return `
                <div class="hotspot-item" data-segment="${h.roadSegment}" title="Click to view detailed analysis">
                    <div class="hotspot-rank" style="background: ${color}22; color: ${color};">#${i + 1}</div>
                    <div class="hotspot-info">
                        <span class="hotspot-name">${h.roadSegment}</span>
                        <span class="hotspot-meta">${h.accidentCount} accidents • ${h.fatalCount} fatal • ${h.primaryCause}</span>
                    </div>
                    <span class="risk-badge risk-${h.riskLevel === 'Critical' ? 'high' : h.riskLevel === 'High' ? 'medium' : 'low'}">${h.riskLevel}</span>
                </div>
            `;
        }).join('');

        // Click handlers for hotspot list items
        listDiv.querySelectorAll('.hotspot-item[data-segment]').forEach(item => {
            item.addEventListener('click', () => {
                const seg = item.dataset.segment;
                const hotspot = analysis.hotspots.find(h => h.roadSegment === seg);
                if (hotspot) openHotspotDrilldown(hotspot);
            });
        });

        // Time of Day Chart
        const timeGroups = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
        accidents.forEach(a => { timeGroups[a.timeOfDay] = (timeGroups[a.timeOfDay] || 0) + 1; });

        destroyChart('hotspotTime');
        state.charts.hotspotTime = new ApexCharts(document.getElementById('hotspot-chart-time'), {
            ...getApexTheme(),
            series: [{ name: 'Accidents', data: Object.values(timeGroups) }],
            chart: { 
                ...getApexTheme().chart, 
                type: 'area', 
                height: 300,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const selectedTime = Object.keys(timeGroups)[config.dataPointIndex];
                        const filtered = accidents.filter(a => a.timeOfDay === selectedTime);
                        openDataTableModal(`Hotspots - ${selectedTime}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            xaxis: { categories: Object.keys(timeGroups), labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            colors: [CHART_COLORS.indigo],
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 95, 100] } },
            stroke: { curve: 'smooth', width: 3 },
            dataLabels: { enabled: true, style: { fontSize: '13px', fontFamily: 'JetBrains Mono' } },
            markers: { size: 5, colors: [CHART_COLORS.indigo], strokeColors: '#0d1425', strokeWidth: 2 }
        });
        state.charts.hotspotTime.render();

        // Cause Chart
        const causeGroups = {};
        accidents.forEach(a => { causeGroups[a.cause] = (causeGroups[a.cause] || 0) + 1; });
        const causeLabels = Object.keys(causeGroups);
        const causeValues = Object.values(causeGroups);

        destroyChart('hotspotCause');
        state.charts.hotspotCause = new ApexCharts(document.getElementById('hotspot-chart-cause'), {
            ...getApexTheme(),
            series: causeValues,
            labels: causeLabels,
            chart: { 
                ...getApexTheme().chart, 
                type: 'donut', 
                height: 300,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const selectedCause = causeLabels[config.dataPointIndex];
                        const filtered = accidents.filter(a => a.cause === selectedCause);
                        openDataTableModal(`Hotspots - ${selectedCause}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            colors: [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.violet, CHART_COLORS.sky, CHART_COLORS.teal, CHART_COLORS.rose, CHART_COLORS.emerald],
            plotOptions: { pie: { donut: { size: '60%' } } },
            stroke: { width: 2, colors: ['#0d1425'] },
            dataLabels: { enabled: false }
        });
        state.charts.hotspotCause.render();

        // Fit map bounds if a filter is applied
        if (state.map && state.markerClusterGroup && state.markerClusterGroup.getLayers().length > 0) {
            if (f.mapState !== 'All' || f.district !== 'All' || f.area !== 'All' || f.cause !== 'All' || f.timeOfDay !== 'All' || f.season !== 'All' || f.severity !== 'All') {
                state.map.fitBounds(state.markerClusterGroup.getBounds(), { padding: [30, 30], maxZoom: 14 });
            }
        }

        // Enforcement Recommendations
        renderEnforcementRecommendations(analysis.hotspots);
    }

    function renderEnforcementRecommendations(hotspots) {
        const recDiv = document.getElementById('enforcement-recommendations');
        const allRecs = [];
        const icons = ['shield-alert', 'camera', 'lamp-floor', 'siren', 'eye', 'traffic-cone'];

        hotspots.forEach(h => {
            if (h.recommendations) {
                h.recommendations.forEach(r => {
                    if (!allRecs.find(x => x.text === r)) {
                        allRecs.push({ text: r, segment: h.roadSegment, risk: h.riskLevel });
                    }
                });
            }
        });

        recDiv.innerHTML = allRecs.slice(0, 8).map((r, i) => `
            <div class="recommendation-card">
                <div class="rec-icon"><i data-lucide="${icons[i % icons.length]}"></i></div>
                <div class="rec-content">
                    <span class="rec-text">${r.text}</span>
                    <span class="rec-segment">${r.segment}</span>
                </div>
                <span class="risk-badge risk-${r.risk === 'Critical' ? 'high' : r.risk === 'High' ? 'medium' : 'low'}">${r.risk}</span>
            </div>
        `).join('');
        lucide.createIcons();
    }

    // ═══════════════════════════════════════════════════════════════
    //  HOTSPOT DRILL-DOWN PANEL
    // ═══════════════════════════════════════════════════════════════
    function initDrilldown() {
        const backdrop = document.getElementById('drilldown-backdrop');
        const panel = document.getElementById('drilldown-panel');
        const closeBtn = document.getElementById('drilldown-close');

        if (closeBtn) closeBtn.addEventListener('click', closeHotspotDrilldown);
        if (backdrop) backdrop.addEventListener('click', closeHotspotDrilldown);

        // Listen for custom event from map popup links
        document.addEventListener('hotspot-drilldown', (e) => {
            const segId = e.detail;
            if (!state.lastHotspotAnalysis) return;
            const hotspot = state.lastHotspotAnalysis.hotspots.find(h =>
                h.roadSegment.replace(/[^a-zA-Z0-9]/g, '_') === segId
            );
            if (hotspot) openHotspotDrilldown(hotspot);
        });

        // Escape key closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHotspotDrilldown();
        });
    }

    function openHotspotDrilldown(hotspot) {
        const backdrop = document.getElementById('drilldown-backdrop');
        const panel = document.getElementById('drilldown-panel');

        // Header
        document.getElementById('drilldown-title').textContent = hotspot.roadSegment;
        const badge = document.getElementById('drilldown-risk-badge');
        badge.textContent = hotspot.riskLevel;
        badge.className = 'risk-badge risk-' + (hotspot.riskLevel === 'Critical' ? 'high' : hotspot.riskLevel === 'High' ? 'medium' : 'low');

        // Determine state from accidents
        const accState = hotspot.accidents && hotspot.accidents.length > 0 ? hotspot.accidents[0].state : '--';
        document.getElementById('drilldown-state').textContent = accState;

        // Mini KPIs
        document.getElementById('dd-total').textContent = hotspot.accidentCount;
        document.getElementById('dd-fatal').textContent = hotspot.fatalCount;
        document.getElementById('dd-injured').textContent = hotspot.totalInjured;
        document.getElementById('dd-casualties').textContent = hotspot.totalCasualties;

        // Show panel
        backdrop.classList.add('active');
        panel.classList.add('active');

        // Render charts after panel is visible (slight delay for transition)
        setTimeout(() => {
            renderDrilldownCharts(hotspot);
            renderDrilldownTable(hotspot);
            renderDrilldownRecommendations(hotspot);
            lucide.createIcons();
        }, 80);
    }

    function closeHotspotDrilldown() {
        const backdrop = document.getElementById('drilldown-backdrop');
        const panel = document.getElementById('drilldown-panel');

        backdrop.classList.remove('active');
        panel.classList.remove('active');

        // Destroy drill-down charts
        destroyChart('ddSeverity');
        destroyChart('ddCause');
        destroyChart('ddTime');
        destroyChart('ddWeather');
    }

    function renderDrilldownCharts(hotspot) {
        const accList = hotspot.accidents || [];

        // 1. Severity Distribution — donut
        const sevMap = { Fatal: 0, Grievous: 0, Minor: 0 };
        accList.forEach(a => { sevMap[a.severity] = (sevMap[a.severity] || 0) + 1; });

        destroyChart('ddSeverity');
        state.charts.ddSeverity = new ApexCharts(document.getElementById('dd-chart-severity'), {
            ...getApexTheme(),
            series: [sevMap.Fatal, sevMap.Grievous, sevMap.Minor],
            labels: ['Fatal', 'Grievous', 'Minor'],
            chart: { 
                ...getApexTheme().chart, 
                type: 'donut', 
                height: 180,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const cats = ['Fatal', 'Grievous', 'Minor'];
                        const sel = cats[config.dataPointIndex];
                        const filtered = accList.filter(a => a.severity === sel);
                        openDataTableModal(`${hotspot.location} - ${sel}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            colors: [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.emerald],
            plotOptions: { pie: { donut: { size: '55%', labels: {
                show: true,
                name: { color: '#e2e8f0', fontSize: '11px' },
                value: { color: '#e2e8f0', fontSize: '16px', fontFamily: 'JetBrains Mono' },
                total: { show: true, label: 'Total', color: '#94a3b8', fontSize: '10px', formatter: () => accList.length }
            }}}},
            stroke: { width: 2, colors: ['#0d1425'] },
            legend: { show: false },
            dataLabels: { enabled: false }
        });
        state.charts.ddSeverity.render();

        // 2. Cause Analysis — horizontal bar
        const causes = hotspot.causes || {};
        const causeLabels = Object.keys(causes);
        const causeVals = Object.values(causes);

        destroyChart('ddCause');
        state.charts.ddCause = new ApexCharts(document.getElementById('dd-chart-cause'), {
            ...getApexTheme(),
            series: [{ name: 'Count', data: causeVals }],
            chart: { 
                ...getApexTheme().chart, 
                type: 'bar', 
                height: 180,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const sel = causeLabels[config.dataPointIndex];
                        const filtered = accList.filter(a => a.cause === sel);
                        openDataTableModal(`${hotspot.location} - ${sel}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '55%' } },
            colors: [CHART_COLORS.violet],
            xaxis: { labels: { style: { colors: '#94a3b8', fontSize: '10px' } } },
            yaxis: { categories: causeLabels, labels: { style: { colors: '#e2e8f0', fontSize: '10px' }, maxWidth: 110 } },
            dataLabels: { enabled: true, style: { fontSize: '10px', fontFamily: 'JetBrains Mono' } },
            grid: { borderColor: 'rgba(99,102,241,0.08)' }
        });
        state.charts.ddCause.render();

        // 3. Time of Day — radial bar
        const times = hotspot.times || {};
        const timeLabels = ['Morning', 'Afternoon', 'Evening', 'Night'];
        const maxTime = Math.max(...timeLabels.map(t => times[t] || 0), 1);
        const timePercents = timeLabels.map(t => Math.round(((times[t] || 0) / maxTime) * 100));

        destroyChart('ddTime');
        state.charts.ddTime = new ApexCharts(document.getElementById('dd-chart-time'), {
            ...getApexTheme(),
            series: timePercents,
            labels: timeLabels,
            chart: { 
                ...getApexTheme().chart, 
                type: 'radialBar', 
                height: 180,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const sel = timeLabels[config.dataPointIndex];
                        const filtered = accList.filter(a => a.timeOfDay === sel);
                        openDataTableModal(`${hotspot.location} - ${sel}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            plotOptions: {
                radialBar: {
                    hollow: { size: '25%' },
                    track: { background: 'rgba(99,102,241,0.08)' },
                    dataLabels: {
                        name: { fontSize: '10px', color: '#94a3b8' },
                        value: { fontSize: '12px', fontFamily: 'JetBrains Mono', color: '#e2e8f0',
                            formatter: (val, opts) => {
                                const idx = opts.config.series.indexOf(parseInt(val)) > -1 ? opts.config.series.indexOf(parseInt(val)) : opts.seriesIndex;
                                return (times[timeLabels[idx]] || 0);
                            }
                        },
                        total: { show: true, label: 'Peak', color: '#94a3b8', fontSize: '10px',
                            formatter: () => {
                                let best = 'N/A'; let bestVal = 0;
                                timeLabels.forEach(t => { if ((times[t] || 0) > bestVal) { bestVal = times[t] || 0; best = t; }});
                                return best;
                            }
                        }
                    }
                }
            },
            colors: [CHART_COLORS.sky, CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.indigo],
            legend: { show: false },
            stroke: { lineCap: 'round' }
        });
        state.charts.ddTime.render();

        // 4. Weather Conditions — pie
        const weatherMap = {};
        accList.forEach(a => { weatherMap[a.weather] = (weatherMap[a.weather] || 0) + 1; });
        const wLabels = Object.keys(weatherMap);
        const wValues = Object.values(weatherMap);

        destroyChart('ddWeather');
        state.charts.ddWeather = new ApexCharts(document.getElementById('dd-chart-weather'), {
            ...getApexTheme(),
            series: wValues,
            labels: wLabels,
            chart: { 
                ...getApexTheme().chart, 
                type: 'pie', 
                height: 180,
                events: {
                    dataPointSelection: function(e, chart, config) {
                        if (config.dataPointIndex === undefined) return;
                        const sel = wLabels[config.dataPointIndex];
                        const filtered = accList.filter(a => a.weather === sel);
                        openDataTableModal(`${hotspot.location} - ${sel}`, filtered, COLUMNS.accidents);
                    }
                }
            },
            colors: [CHART_COLORS.sky, CHART_COLORS.teal, CHART_COLORS.slate, CHART_COLORS.amber],
            stroke: { width: 2, colors: ['#0d1425'] },
            legend: { show: true, position: 'bottom', fontSize: '10px', labels: { colors: '#94a3b8' } },
            dataLabels: { enabled: false }
        });
        state.charts.ddWeather.render();
    }

    function renderDrilldownTable(hotspot) {
        const tbody = document.getElementById('dd-accidents-tbody');
        const accList = hotspot.accidents || [];

        const sevBadge = (s) => {
            const cls = s === 'Fatal' ? 'risk-high' : s === 'Grievous' ? 'risk-medium' : 'risk-low';
            return `<span class="risk-badge ${cls}" style="font-size: 0.65rem;">${s}</span>`;
        };

        tbody.innerHTML = accList.slice(0, 50).map(a => `
            <tr>
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${a.accidentId}</td>
                <td>${a.date}</td>
                <td>${a.time}</td>
                <td>${sevBadge(a.severity)}</td>
                <td>${a.cause}</td>
                <td>${(a.vehicleTypes || []).join(', ')}</td>
                <td style="text-align: center;">${a.casualties + a.injured}</td>
            </tr>
        `).join('');
    }

    function renderDrilldownRecommendations(hotspot) {
        const container = document.getElementById('dd-recommendations');
        const recs = hotspot.recommendations || [];
        const icons = ['shield-alert', 'camera', 'lamp-floor', 'siren', 'eye'];

        container.innerHTML = recs.map((r, i) => `
            <div class="drilldown-rec-item">
                <div class="drilldown-rec-icon">
                    <i data-lucide="${icons[i % icons.length]}"></i>
                </div>
                <span class="drilldown-rec-text">${r}</span>
            </div>
        `).join('');
    }

    // ═══════════════════════════════════════════════════════════════
    //  SETTINGS & ALERTS
    // ═══════════════════════════════════════════════════════════════
    function initSettingsAlerts() {
        const stateSelect = document.getElementById('alert-state');
        const districtSelect = document.getElementById('alert-district');
        const areaSelect = document.getElementById('alert-area');
        const form = document.getElementById('alert-form');
        const simBtn = document.getElementById('btn-simulate-accident');

        if (!form) return;

        // Extract unique locations from accidents
        const accs = window.TransportData.accidents;
        const locMap = {}; // { State: { District: Set<Area> } }
        accs.forEach(a => {
            if (!locMap[a.state]) locMap[a.state] = {};
            if (!locMap[a.state][a.district]) locMap[a.state][a.district] = new Set();
            locMap[a.state][a.district].add(a.area);
        });

        // Populate States
        Object.keys(locMap).sort().forEach(st => {
            const opt = document.createElement('option');
            opt.value = st; opt.textContent = st;
            stateSelect.appendChild(opt);
        });

        // Cascade Districts
        stateSelect.addEventListener('change', (e) => {
            const st = e.target.value;
            districtSelect.innerHTML = '<option value="All">All Districts</option>';
            areaSelect.innerHTML = '<option value="All">All Areas</option>';
            if (st === 'All') {
                districtSelect.disabled = true;
                areaSelect.disabled = true;
            } else {
                districtSelect.disabled = false;
                areaSelect.disabled = true;
                Object.keys(locMap[st]).sort().forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d; opt.textContent = d;
                    districtSelect.appendChild(opt);
                });
            }
        });

        // Cascade Areas
        districtSelect.addEventListener('change', (e) => {
            const st = stateSelect.value;
            const dist = e.target.value;
            areaSelect.innerHTML = '<option value="All">All Areas</option>';
            if (dist === 'All') {
                areaSelect.disabled = true;
            } else {
                areaSelect.disabled = false;
                Array.from(locMap[st][dist]).sort().forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a; opt.textContent = a;
                    areaSelect.appendChild(opt);
                });
            }
        });

        // Handle Form Submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const contact = document.getElementById('alert-contact').value.trim();
            if (!contact) return;
            const method = document.querySelector('input[name="alert-method"]:checked').value;
            
            const newAlert = {
                id: 'ALR-' + Date.now(),
                state: stateSelect.value,
                district: districtSelect.value,
                area: areaSelect.value,
                method: method,
                contact: contact,
                created: new Date().toISOString()
            };
            
            state.alerts.push(newAlert);
            localStorage.setItem('transport-alerts', JSON.stringify(state.alerts));
            renderActiveAlerts();
            form.reset();
            stateSelect.value = 'All';
            stateSelect.dispatchEvent(new Event('change'));
            showToast('Alert Configured', `Active monitoring for severe accidents via ${method}`, 'success');
        });

        // Setup Simulation
        simBtn.addEventListener('click', simulateSevereAccident);

        // Initial render of saved alerts
        renderActiveAlerts();
    }

    function renderActiveAlerts() {
        const tbody = document.getElementById('active-alerts-tbody');
        if (state.alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No active alerts configured.</td></tr>';
            return;
        }

        tbody.innerHTML = state.alerts.map(a => {
            const loc = [a.area, a.district, a.state].filter(x => x !== 'All').join(', ') || 'All India';
            return `
                <tr>
                    <td><strong>${loc}</strong><br><small class="text-secondary">Severity: Fatal, Grievous</small></td>
                    <td><span class="risk-badge risk-low">${a.method}</span></td>
                    <td>${a.contact}</td>
                    <td>
                        <button class="btn-icon delete-alert-btn" data-id="${a.id}" style="color: var(--accent-red); cursor: pointer; background: transparent; border: none;">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();

        document.querySelectorAll('.delete-alert-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                state.alerts = state.alerts.filter(al => al.id !== id);
                localStorage.setItem('transport-alerts', JSON.stringify(state.alerts));
                renderActiveAlerts();
            });
        });
    }

    function showToast(title, message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'error' ? 'alert-octagon' : 'check-circle';
        
        toast.innerHTML = `
            <div class="toast-icon"><i data-lucide="${icon}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        lucide.createIcons();

        // Auto remove after 5s
        setTimeout(() => {
            toast.style.animation = 'fadeOutRight 0.3s ease-out forwards';
            setTimeout(() => {
                if (container.contains(toast)) container.removeChild(toast);
            }, 300);
        }, 5000);
    }

    function simulateSevereAccident() {
        if (state.alerts.length === 0) {
            showToast('No Alerts Configured', 'Create an alert first before simulating an accident to see the notification system in action.', 'error');
            return;
        }

        // Pick a random location that matches at least one active alert to guarantee a hit
        const activeAlert = state.alerts[Math.floor(Math.random() * state.alerts.length)];
        
        // Find matching accident data
        const matches = window.TransportData.accidents.filter(a => {
            if (activeAlert.state !== 'All' && a.state !== activeAlert.state) return false;
            if (activeAlert.district !== 'All' && a.district !== activeAlert.district) return false;
            if (activeAlert.area !== 'All' && a.area !== activeAlert.area) return false;
            return true;
        });

        let mockAcc = matches.length > 0 ? { ...matches[Math.floor(Math.random() * matches.length)] } : { ...window.TransportData.accidents[0] };
        
        // Ensure it's severe
        mockAcc.severity = Math.random() > 0.5 ? 'Fatal' : 'Grievous';
        mockAcc.id = 'MOCK-' + Date.now();
        mockAcc.timeOfDay = 'Night';

        // Evaluate Rules
        evaluateAccidentAlerts(mockAcc);
    }

    function evaluateAccidentAlerts(accident) {
        if (accident.severity === 'Minor') return;

        state.alerts.forEach(rule => {
            let match = true;
            if (rule.state !== 'All' && accident.state !== rule.state) match = false;
            if (rule.district !== 'All' && accident.district !== rule.district) match = false;
            if (rule.area !== 'All' && accident.area !== rule.area) match = false;

            if (match) {
                const msg = `SYSTEM ALERT: ${accident.severity} accident reported at ${accident.area}, ${accident.district} (${accident.state}).`;
                
                if (rule.method === 'SMS') {
                    showToast('🚨 TRIGGERING SMS...', `Sending SMS to ${rule.contact}`, 'error');
                    
                    fetch('/api/alerts/sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contact: rule.contact,
                            message: msg
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            showToast('✅ SMS SENT', `Twilio successfully delivered message to ${rule.contact}`, 'success');
                        } else {
                            showToast('❌ SMS FAILED', data.error || 'Failed to send SMS', 'error');
                        }
                    })
                    .catch(err => {
                        showToast('❌ SMS ERROR', err.message, 'error');
                    });
                } else {
                    // Email or other simulated fallback
                    showToast('🚨 SYSTEM ALERT TRIGGERED', `Dispatching ${rule.method} to ${rule.contact}: ${msg}`, 'error');
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  PROFILE BACK BUTTONS
    // ═══════════════════════════════════════════════════════════════
    function initProfileBackButtons() {
        const driverBackBtn = document.getElementById('driver-back-btn');
        if (driverBackBtn) {
            driverBackBtn.addEventListener('click', () => {
                document.getElementById('driver-profile-section').style.display = 'none';
                document.getElementById('driver-default-view').style.display = 'block';
                const searchInput = document.getElementById('driver-search');
                if(searchInput) searchInput.value = '';
            });
        }

        const vehicleBackBtn = document.getElementById('vehicle-back-btn');
        if (vehicleBackBtn) {
            vehicleBackBtn.addEventListener('click', () => {
                document.getElementById('vehicle-profile-section').style.display = 'none';
                document.getElementById('vehicle-default-view').style.display = 'block';
                const searchInput = document.getElementById('vehicle-search');
                if(searchInput) searchInput.value = '';
            });
        }
    }

})();
