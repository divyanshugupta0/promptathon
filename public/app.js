/**
 * Event Seat Optimizer - Application Controller
 * Handles UI interactions, data management, and optimization workflow
 */

class App {
    constructor() {
        this.venue = { rows: 8, cols: 10, vipRows: 2 };
        this.attendees = [];
        this.weights = { friend: 30, vip: 25, group: 25, distance: 20 };
        this.optimizer = null;
        this.chart = null;
        this.solutionHistory = []; // For comparison

        this.init();
    }

    async init() {
        console.log('Event Seat Optimizer - v2.0 (Firebase + PDF)');
        this.initElements();
        this.initTheme();
        this.bindEvents();
        this.initChart();
        this.updateStats();

        // Wait for optimizer script
        if (window.SeatOptimizer) {
            this.optimizer = new window.SeatOptimizer();
        } else {
            console.error('Optimizer module not loaded');
        }

        // Setup Real-time Database Sync
        this.setupFirebase();

        // Initial render
        this.renderVenue();

        // Re-render venue on window resize for responsive seat sizing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.optimizer && this.optimizer.bestSolution) {
                    const plan = this.optimizer.getSeatingPlan(this.optimizer.bestSolution);
                    this.renderVenue(plan);
                } else {
                    this.renderVenue();
                }
            }, 150);
        });
    }

    checkAuth() {
        // If coming from login, we might have simulated user
        const demoUser = localStorage.getItem('demoUser');
        if (demoUser) {
            const user = JSON.parse(demoUser);
            if (this.userNameEl) this.userNameEl.textContent = user.name || 'User';
            if (this.userAvatarEl) this.userAvatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
        }

        // Firebase auth observer is separate in auth.js if loaded
    }

    initElements() {
        // Theme
        this.themeToggle = document.getElementById('themeToggle');
        this.userNameEl = document.getElementById('userName');
        this.userAvatarEl = document.getElementById('userAvatar');
        this.userMenu = document.getElementById('userMenu');
        this.userDropdown = document.getElementById('userDropdown');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Config Inputs
        this.venueRowsInput = document.getElementById('venueRows');
        this.venueColsInput = document.getElementById('venueCols');
        this.vipRowsInput = document.getElementById('vipRows');
        this.vipRowsVal = document.getElementById('vipRowsVal');
        this.venueNameInput = document.getElementById('venueName');

        // Buttons
        this.generateVenueBtn = document.getElementById('generateVenueBtn');
        this.addAttendeeBtn = document.getElementById('addAttendeeBtn');
        this.generateSampleBtn = document.getElementById('generateSampleBtn');
        this.optimizeBtn = document.getElementById('optimizeBtn');
        this.compareBtn = document.getElementById('compareBtn');
        this.importBtn = document.getElementById('importBtn');
        this.exportBtn = document.getElementById('exportBtn');

        // Comparison Panel
        this.comparisonPanel = document.getElementById('comparisonPanel');
        this.prevScoreEl = document.getElementById('prevScore');
        this.currScoreEl = document.getElementById('currScore');
        this.acceptNewBtn = document.getElementById('acceptNewBtn');
        this.keepOldBtn = document.getElementById('keepOldBtn');

        // Stats
        this.totalAttendeesEl = document.getElementById('totalAttendees');
        this.vipAttendeesEl = document.getElementById('vipAttendees');
        this.groupCountEl = document.getElementById('groupCount');

        // Settings
        this.algorithmMode = document.getElementById('algorithmMode');
        this.weightInputs = {
            friend: document.getElementById('friendWeight'),
            vip: document.getElementById('vipWeight'),
            group: document.getElementById('groupWeight'),
            distance: document.getElementById('distanceWeight')
        };
        this.weightValues = {
            friend: document.getElementById('friendWeightVal'),
            vip: document.getElementById('vipWeightVal'),
            group: document.getElementById('groupWeightVal'),
            distance: document.getElementById('distanceWeightVal')
        };

        // Venue & Results
        this.venueContainer = document.getElementById('venueContainer');
        this.attendeeList = document.getElementById('attendeeList');
        this.searchAttendee = document.getElementById('searchAttendee');
        this.viewBtns = document.querySelectorAll('.view-btn');

        // Scores
        this.scoreRing = document.getElementById('scoreRing');
        this.overallScoreEl = document.getElementById('overallScore');
        this.metricBars = {
            friend: document.getElementById('friendBar'),
            vip: document.getElementById('vipBar'),
            group: document.getElementById('groupBar'),
            distance: document.getElementById('distanceBar')
        };
        this.metricScores = {
            friend: document.getElementById('friendScore'),
            vip: document.getElementById('vipScore'),
            group: document.getElementById('groupScore'),
            distance: document.getElementById('distanceScore')
        };

        // Progress
        this.progressFill = document.getElementById('progressFill');
        this.currentGenEl = document.getElementById('currentGen');
        this.bestFitnessEl = document.getElementById('bestFitness');
        this.resultStatus = document.getElementById('resultStatus');

        // Modal
        this.modal = document.getElementById('addAttendeeModal');
        this.closeModalBtn = document.getElementById('closeModal');
        this.cancelAttendeeBtn = document.getElementById('cancelAttendee');
        this.attendeeForm = document.getElementById('attendeeForm');

        // Loading
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingStatus = document.getElementById('loadingStatus');

        // Parallel Comparison Modal
        this.parallelModal = document.getElementById('parallelCompareModal');
        this.closeParallelModalBtn = document.getElementById('closeParallelModal');
        this.algoScoreEl = document.getElementById('algoScore');
        this.geminiScoreEl = document.getElementById('geminiScore');
        this.algoFriendEl = document.getElementById('algoFriend');
        this.algoVipEl = document.getElementById('algoVip');
        this.algoGroupEl = document.getElementById('algoGroup');
        this.geminiFriendEl = document.getElementById('geminiFriend');
        this.geminiVipEl = document.getElementById('geminiVip');
        this.geminiGroupEl = document.getElementById('geminiGroup');
        this.useAlgoBtn = document.getElementById('useAlgoBtn');
        this.useGeminiBtn = document.getElementById('useGeminiBtn');
        this.geminiStatusEl = document.getElementById('geminiStatus');
        this.algoResultCard = document.getElementById('algoResultCard');
        this.geminiResultCard = document.getElementById('geminiResultCard');

        // Comparison Bottom Panel
        this.comparisonPanel = document.getElementById('comparisonPanel');
        this.prevScoreEl = document.getElementById('prevScore');
        this.currScoreEl = document.getElementById('currScore');
        this.acceptNewBtn = document.getElementById('acceptNewBtn');
        this.keepOldBtn = document.getElementById('keepOldBtn');

        // Store parallel results
        this.parallelResults = { algo: null, gemini: null };
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        this.themeToggle?.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    bindEvents() {
        // User Menu
        this.userMenu?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.userDropdown?.classList.toggle('active');
        });

        document.addEventListener('click', () => {
            this.userDropdown?.classList.remove('active');
        });

        this.logoutBtn?.addEventListener('click', () => {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signOut().then(() => window.location.href = 'auth.html');
            } else {
                localStorage.removeItem('demoUser');
                window.location.href = 'auth.html';
            }
        });

        this.generateVenueBtn.addEventListener('click', () => {
            this.updateVenueConfig();
            this.saveToFirebase();
        });

        this.generateSampleBtn.addEventListener('click', () => {
            this.generateSampleData();
            this.saveToFirebase();
        });

        this.addAttendeeBtn.addEventListener('click', () => this.openModal());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.cancelAttendeeBtn.addEventListener('click', () => this.closeModal());
        this.attendeeForm.addEventListener('submit', (e) => this.handleAttendeeSubmit(e));

        // VIP Rows Slider
        this.vipRowsInput?.addEventListener('input', (e) => {
            if (this.vipRowsVal) this.vipRowsVal.textContent = e.target.value;
        });

        // Venue Name Input
        this.venueNameInput?.addEventListener('change', () => {
            if (this.venue) this.venue.name = this.venueNameInput.value;
            this.saveToFirebase();
        });

        this.optimizeBtn.addEventListener('click', () => this.startOptimization());
        this.compareBtn.addEventListener('click', () => this.compareResults());

        this.acceptNewBtn?.addEventListener('click', () => {
            this.comparisonPanel.classList.remove('active');
            this.saveToFirebase();
        });

        this.keepOldBtn?.addEventListener('click', () => {
            if (this.solutionHistory.length >= 2) {
                const prev = this.solutionHistory[this.solutionHistory.length - 2];

                // Check if it's a Gemini result (has source: 'gemini' or solution is already a plan array)
                if (prev.source === 'gemini' || (Array.isArray(prev.solution) && prev.solution[0]?.attendee)) {
                    // Gemini result - solution is already a plan
                    this.displayGeminiResults(prev.solution, prev.fitness);
                } else {
                    // Algorithm result - need to convert solution to plan
                    this.displayResults(prev.solution, prev.fitness);
                    this.optimizer.bestSolution = prev.solution;
                }

                this.solutionHistory.pop(); // Remove the current (rejected) result
                this.saveToFirebase();
            }
            this.comparisonPanel.classList.remove('active');
        });

        // Weights
        Object.keys(this.weightInputs).forEach(key => {
            this.weightInputs[key]?.addEventListener('change', (e) => {
                const val = e.target.value;
                this.weights[key] = parseInt(val);
                if (this.weightValues[key]) this.weightValues[key].textContent = `${val}%`;
                this.saveToFirebase();
            });
            this.weightInputs[key]?.addEventListener('input', (e) => {
                const val = e.target.value;
                if (this.weightValues[key]) this.weightValues[key].textContent = `${val}%`;
            });
        });

        // Filtering
        this.searchAttendee.addEventListener('input', (e) => this.filterAttendees(e.target.value));

        // Views
        this.viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.view === 'grid') this.renderVenue();
            });
        });

        // Export
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.importBtn.addEventListener('click', () => this.importData());

        // PDF Export
        this.pdfBtn?.addEventListener('click', () => this.generateTicketsPDF());

        // AI Analysis
        this.aiAnalyzeBtn = document.getElementById('btnAiAnalyze');
        this.aiAnalyzeBtn?.addEventListener('click', () => this.generateAIInsights());

        // Parallel Comparison Modal Events
        this.closeParallelModalBtn?.addEventListener('click', () => this.closeParallelModal());
        this.useAlgoBtn?.addEventListener('click', () => this.applyResult('algo'));
        this.useGeminiBtn?.addEventListener('click', () => this.applyResult('gemini'));
    }

    initChart() {
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        // Simple canvas drawing
        this.chart = {
            ctx,
            width: ctx.canvas.width,
            height: ctx.canvas.height,
            data: [],
            draw(data) {
                const { ctx, width, height } = this;
                ctx.clearRect(0, 0, width, height);

                if (data.length < 2) return;

                ctx.beginPath();
                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 2;

                const maxVal = Math.max(...data, 1);
                const stepX = width / (data.length - 1);

                data.forEach((val, i) => {
                    const x = i * stepX;
                    const y = height - (val / maxVal * height * 0.8) - 10;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });

                ctx.stroke();

                // Gradient fill
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

                ctx.lineTo(width, height);
                ctx.lineTo(0, height);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        };
    }

    updateVenueConfig() {
        this.venue.rows = parseInt(this.venueRowsInput.value) || 8;
        this.venue.cols = parseInt(this.venueColsInput.value) || 10;
        this.venue.vipRows = parseInt(this.vipRowsInput.value) || 2;
        this.venue.name = this.venueNameInput?.value || 'Main Auditorium';
        this.renderVenue();
    }

    renderVenue(assignments = []) {
        this.venueContainer.innerHTML = '';

        if (this.venue.rows === 0 || this.venue.cols === 0) return;

        // Create a map for quick lookup of assignments by seat coordinates
        const assignmentMap = new Map();
        if (assignments.length > 0) {
            assignments.forEach(item => {
                if (item.seat) {
                    assignmentMap.set(`${item.seat.row}-${item.seat.col}`, item);
                }
            });
        }

        const grid = document.createElement('div');
        grid.className = 'seating-grid';

        // Calculate optimal seat size based on container and venue dimensions
        const containerRect = this.venueContainer.getBoundingClientRect();
        const availableWidth = containerRect.width - 40; // padding
        const availableHeight = containerRect.height - 20;

        const cols = this.venue.cols + 1; // +1 for row label
        const rows = this.venue.rows;

        const gapSize = Math.max(2, Math.min(8, availableWidth / (cols * 10)));
        const maxSeatWidth = (availableWidth - (cols * gapSize)) / cols;
        const maxSeatHeight = (availableHeight - (rows * gapSize)) / rows;
        const seatSize = Math.max(20, Math.min(44, Math.min(maxSeatWidth, maxSeatHeight)));

        // Set CSS custom properties for dynamic sizing
        grid.style.setProperty('--seat-size', `${seatSize}px`);
        grid.style.setProperty('--seat-gap', `${gapSize}px`);
        grid.style.setProperty('--cols', this.venue.cols);
        grid.style.setProperty('--rows', this.venue.rows);

        for (let r = 0; r < this.venue.rows; r++) {
            const row = document.createElement('div');
            row.className = 'seat-row';

            const label = document.createElement('div');
            label.className = 'row-label';
            label.textContent = String.fromCharCode(65 + r);
            row.appendChild(label);

            for (let c = 0; c < this.venue.cols; c++) {
                const seat = document.createElement('div');
                const isVip = r < this.venue.vipRows;

                // Lookup assignment
                const planItem = assignmentMap.get(`${r}-${c}`);

                let classes = ['seat'];
                if (isVip) classes.push('vip-seat');
                if (planItem) classes.push('occupied');

                seat.className = classes.join(' ');

                // Show seat number only if seats are big enough
                if (seatSize >= 28) {
                    seat.textContent = c + 1;
                }

                // Create tooltip if occupied
                if (planItem) {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'seat-tooltip';
                    tooltip.innerHTML = `
                        <strong>${planItem.attendee.name}</strong><br>
                        ${planItem.attendee.type ? planItem.attendee.type.toUpperCase() : 'REGULAR'}<br>
                        Priority: ${planItem.attendee.priority || '-'}
                    `;
                    seat.appendChild(tooltip);
                }

                row.appendChild(seat);
            }
            grid.appendChild(row);
        }

        this.venueContainer.appendChild(grid);
    }

    updateStats() {
        this.totalAttendeesEl.textContent = this.attendees.length;
        this.vipAttendeesEl.textContent = this.attendees.filter(a => a.type === 'vip').length;
        const groups = new Set(this.attendees.filter(a => a.group).map(a => a.group));
        this.groupCountEl.textContent = groups.size;
    }

    openModal() {
        this.modal.classList.add('active');
        document.getElementById('attendeeName').focus();
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.attendeeForm.reset();
    }

    handleAttendeeSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const attendee = {
            id: Date.now(),
            name: document.getElementById('attendeeName').value,
            email: document.getElementById('attendeeEmail').value,
            type: document.getElementById('attendeeType').value,
            group: document.getElementById('attendeeGroup').value,
            preference: document.getElementById('attendeePreference').value,
            priority: parseInt(document.getElementById('attendeePriority').value) || 5
        };

        this.attendees.push(attendee);
        this.updateStats();
        this.renderAttendeeList();
        this.saveToFirebase();
        this.closeModal();
    }

    generateSampleData() {
        const count = Math.min(this.venue.rows * this.venue.cols, 50);
        const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
        const groups = ['Team A', 'Marketing', 'Family 1', 'Product', 'Sales'];

        this.attendees = [];

        for (let i = 0; i < count; i++) {
            const isVip = Math.random() < 0.2;
            const hasGroup = Math.random() < 0.4;

            this.attendees.push({
                id: i,
                name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                type: isVip ? 'vip' : 'regular',
                group: hasGroup ? groups[Math.floor(Math.random() * groups.length)] : '',
                preference: ['any', 'front', 'middle', 'back'][Math.floor(Math.random() * 4)],
                priority: isVip ? 8 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 7)
            });
        }

        this.updateStats();
        this.renderAttendeeList();
        this.resultStatus.textContent = "Data Generated";
        this.resultStatus.className = "badge success";
    }

    renderAttendeeList() {
        this.attendeeList.innerHTML = '';

        if (this.attendees.length === 0) {
            this.attendeeList.innerHTML = '<div class="empty-list"><p>No attendees yet</p></div>';
            return;
        }

        this.attendees.forEach(attendee => {
            const card = document.createElement('div');
            card.className = 'attendee-card';

            const avatar = document.createElement('div');
            avatar.className = `attendee-avatar ${attendee.type}`;
            avatar.textContent = attendee.name.charAt(0);

            const info = document.createElement('div');
            info.className = 'attendee-info';

            const name = document.createElement('div');
            name.className = 'attendee-name';
            name.textContent = attendee.name;

            const details = document.createElement('div');
            details.className = 'attendee-seat';
            // If seated, show seat. Logic depends on if we have a solution
            details.textContent = `${attendee.type.toUpperCase()} • Priority: ${attendee.priority}`;

            info.appendChild(name);
            info.appendChild(details);

            if (attendee.group) {
                const groupBadge = document.createElement('span');
                groupBadge.className = 'attendee-group';
                groupBadge.textContent = attendee.group;
                info.appendChild(groupBadge);
            }

            card.appendChild(avatar);
            card.appendChild(info);
            this.attendeeList.appendChild(card);
        });
    }

    filterAttendees(query) {
        const cards = this.attendeeList.querySelectorAll('.attendee-card');
        query = query.toLowerCase();

        cards.forEach(card => {
            const name = card.querySelector('.attendee-name').textContent.toLowerCase();
            const group = card.querySelector('.attendee-group')?.textContent.toLowerCase() || '';

            if (name.includes(query) || group.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async startOptimization() {
        if (this.attendees.length === 0) {
            alert('Please add attendees first');
            return;
        }

        // Show loading
        this.loadingOverlay.classList.add('active');
        this.optimizeBtn.disabled = true;
        this.resultStatus.textContent = "Optimizing...";
        this.resultStatus.className = "badge processing";

        // Reset parallel results
        this.parallelResults = { algo: null, gemini: null };
        this.resetParallelModal();

        // Config optimizer
        this.optimizer.setVenue(this.venue.rows, this.venue.cols, this.venue.vipRows);
        this.optimizer.setAttendees(this.attendees);
        this.optimizer.updateWeights(
            this.weights.friend,
            this.weights.vip,
            this.weights.group,
            this.weights.distance
        );
        this.optimizer.setMode(this.algorithmMode.value);

        try {
            // Run Algorithm Optimization (Promise)
            const algoPromise = this.optimizer.optimize(
                (stats) => this.updateProgress(stats),
                (result) => { }
            ).then(result => {
                this.parallelResults.algo = result;
                this.updateAlgoResult(result);
                return result;
            });

            // Run Gemini API Optimization (Promise)
            const geminiPromise = this.runGeminiOptimization().then(result => {
                this.parallelResults.gemini = result;
                this.updateGeminiResult(result);
                return result;
            }).catch(error => {
                console.error('Gemini optimization failed:', error);
                this.updateGeminiError(error.message);
                return null;
            });

            // Wait for algorithm to complete (essential)
            await algoPromise;

            // Hide main loading, show comparison modal
            this.loadingOverlay.classList.remove('active');
            this.showParallelModal();

            // Continue waiting for Gemini in background (modal already open)
            await geminiPromise;

            // Highlight winner if both completed
            this.highlightWinner();

        } catch (error) {
            console.error(error);
            alert('Optimization failed: ' + error.message);
            this.loadingOverlay.classList.remove('active');
            this.optimizeBtn.disabled = false;
        }
    }

    async runGeminiOptimization() {
        const response = await fetch('/api/gemini/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                venue: this.venue,
                attendees: this.attendees.map(a => ({
                    id: a.id,
                    name: a.name,
                    traits: { group: a.group, type: a.type, priority: a.priority }
                }))
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gemini API failed');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Unknown Gemini error');
        }

        // Convert Gemini result to standard format and calculate fitness
        const geminiPlan = this.convertGeminiResultToPlan(data.solution);
        const fitness = this.calculateFitnessFromPlan(geminiPlan);

        return {
            solution: geminiPlan,
            fitness: fitness,
            source: 'gemini'
        };
    }

    convertGeminiResultToPlan(geminiSolution) {
        // Gemini returns { assignments: [{ seatId: 'r1c1', attendeeId: '...' }, ...] }
        const plan = [];
        const assignments = geminiSolution.assignments || [];

        assignments.forEach(assignment => {
            const attendee = this.attendees.find(a => String(a.id) === String(assignment.attendeeId));
            if (!attendee || !assignment.seatId) return;

            // Parse seat ID like 'r1c1' or 'R1C1'
            const match = assignment.seatId.match(/r(\d+)c(\d+)/i);
            if (!match) return;

            const row = parseInt(match[1]) - 1;
            const col = parseInt(match[2]) - 1;

            plan.push({
                attendee: attendee,
                seat: {
                    row: row,
                    col: col,
                    seatId: `${String.fromCharCode(65 + row)}${col + 1}`
                }
            });
        });

        return plan;
    }

    calculateFitnessFromPlan(plan) {
        // Simple heuristic fitness calculation
        let friendProximity = 0.8;
        let vipPlacement = 0;
        let groupCohesion = 0.7;
        let stageDistance = 0.6;

        const vips = plan.filter(p => p.attendee.type === 'vip');
        const vipInFront = vips.filter(p => p.seat.row < this.venue.vipRows).length;
        vipPlacement = vips.length > 0 ? vipInFront / vips.length : 1;

        // Group cohesion - check if same group members are adjacent
        const groups = {};
        plan.forEach(p => {
            if (p.attendee.group) {
                if (!groups[p.attendee.group]) groups[p.attendee.group] = [];
                groups[p.attendee.group].push(p.seat);
            }
        });

        let totalGroupScore = 0;
        let groupCount = 0;
        Object.values(groups).forEach(seats => {
            if (seats.length <= 1) return;
            let adjacentPairs = 0;
            for (let i = 0; i < seats.length; i++) {
                for (let j = i + 1; j < seats.length; j++) {
                    const dist = Math.abs(seats[i].row - seats[j].row) + Math.abs(seats[i].col - seats[j].col);
                    if (dist <= 2) adjacentPairs++;
                }
            }
            const maxPairs = (seats.length * (seats.length - 1)) / 2;
            totalGroupScore += adjacentPairs / maxPairs;
            groupCount++;
        });
        if (groupCount > 0) groupCohesion = totalGroupScore / groupCount;

        // Stage distance - reward lower row numbers
        const avgRow = plan.reduce((sum, p) => sum + p.seat.row, 0) / (plan.length || 1);
        stageDistance = 1 - (avgRow / this.venue.rows);

        const total = (friendProximity * 0.3 + vipPlacement * 0.25 + groupCohesion * 0.25 + stageDistance * 0.2);

        return {
            total: Math.min(total, 1),
            friendProximity,
            vipPlacement,
            groupCohesion,
            stageDistance
        };
    }

    resetParallelModal() {
        this.algoScoreEl.textContent = '--';
        this.geminiScoreEl.innerHTML = '<div class="gemini-spinner"></div>';
        this.geminiScoreEl.classList.add('gemini-loading');
        this.algoFriendEl.textContent = '--%';
        this.algoVipEl.textContent = '--%';
        this.algoGroupEl.textContent = '--%';
        this.geminiFriendEl.textContent = '--%';
        this.geminiVipEl.textContent = '--%';
        this.geminiGroupEl.textContent = '--%';
        this.useGeminiBtn.disabled = true;
        this.geminiStatusEl.textContent = '⏳ Waiting for Gemini AI...';
        this.geminiStatusEl.className = 'gemini-status';
        this.algoResultCard.classList.remove('winner');
        this.geminiResultCard.classList.remove('winner');
    }

    updateAlgoResult(result) {
        const score = Math.round(result.fitness.total * 100);
        this.algoScoreEl.textContent = score;
        this.algoFriendEl.textContent = `${Math.round(result.fitness.friendProximity * 100)}%`;
        this.algoVipEl.textContent = `${Math.round(result.fitness.vipPlacement * 100)}%`;
        this.algoGroupEl.textContent = `${Math.round(result.fitness.groupCohesion * 100)}%`;
    }

    updateGeminiResult(result) {
        if (!result) return;
        const score = Math.round(result.fitness.total * 100);
        this.geminiScoreEl.classList.remove('gemini-loading');
        this.geminiScoreEl.textContent = score;
        this.geminiFriendEl.textContent = `${Math.round(result.fitness.friendProximity * 100)}%`;
        this.geminiVipEl.textContent = `${Math.round(result.fitness.vipPlacement * 100)}%`;
        this.geminiGroupEl.textContent = `${Math.round(result.fitness.groupCohesion * 100)}%`;
        this.useGeminiBtn.disabled = false;
        this.geminiStatusEl.textContent = '✅ Gemini optimization complete!';
        this.geminiStatusEl.className = 'gemini-status success';
    }

    updateGeminiError(errorMessage) {
        this.geminiScoreEl.classList.remove('gemini-loading');
        this.geminiScoreEl.textContent = '❌';
        this.geminiStatusEl.textContent = `❌ Error: ${errorMessage}`;
        this.geminiStatusEl.className = 'gemini-status error';
        this.useGeminiBtn.disabled = true;
    }

    highlightWinner() {
        if (!this.parallelResults.algo || !this.parallelResults.gemini) return;

        const algoScore = this.parallelResults.algo.fitness.total;
        const geminiScore = this.parallelResults.gemini.fitness.total;

        if (algoScore > geminiScore) {
            this.algoResultCard.classList.add('winner');
        } else if (geminiScore > algoScore) {
            this.geminiResultCard.classList.add('winner');
        }
    }

    showParallelModal() {
        this.parallelModal.classList.add('active');
    }

    closeParallelModal() {
        this.parallelModal.classList.remove('active');
        this.optimizeBtn.disabled = false;
    }

    applyResult(source) {
        const result = this.parallelResults[source];
        if (!result) {
            alert('No result available from ' + source);
            return;
        }

        // Handle Gemini result differently (it's a plan, not a solution array)
        if (source === 'gemini') {
            // Store a pseudo-solution for history
            this.solutionHistory.push(result);
            this.displayGeminiResults(result.solution, result.fitness);

            // Check for comparison
            if (this.solutionHistory.length > 1) {
                this.compareResults();
            }
        } else {
            this.handleOptimizationComplete(result);
        }

        this.closeParallelModal();
        this.resultStatus.textContent = `Applied (${source === 'gemini' ? 'Gemini AI' : 'Algorithm'})`;
        this.resultStatus.className = 'badge success';
    }

    displayGeminiResults(plan, fitness) {
        // Render Scores
        const score = Math.round(fitness.total * 100);
        this.overallScoreEl.textContent = score;

        // Animate ring
        const circumference = 2 * Math.PI * 45;
        this.scoreRing.style.strokeDashoffset = circumference - (score / 100) * circumference;

        // Metric bars
        this.updateMetricBar('friend', fitness.friendProximity);
        this.updateMetricBar('vip', fitness.vipPlacement);
        this.updateMetricBar('group', fitness.groupCohesion);
        this.updateMetricBar('distance', fitness.stageDistance);

        // Render Venue with the Gemini plan
        this.renderVenue(plan);

        // Update attendee list
        this.updateAttendeeListSeats(plan);

        this.saveToFirebase();
    }

    updateProgress(stats) {
        const percent = Math.round(stats.progress * 100);
        this.progressFill.style.width = `${percent}%`;
        this.loadingStatus.textContent = `Generation ${stats.generation} / ${stats.totalGenerations}`;
        this.currentGenEl.textContent = stats.generation;
        this.bestFitnessEl.textContent = stats.bestFitness.total.toFixed(4);

        // Update chart occasionally
        if (stats.generation % 5 === 0) {
            this.chart.draw(this.optimizer.fitnessHistory);
        }
    }

    handleOptimizationComplete(result) {
        this.loadingOverlay.classList.remove('active');
        this.optimizeBtn.disabled = false;
        this.resultStatus.textContent = "Completed";
        this.resultStatus.className = "badge success";

        // Add to comparison history
        this.solutionHistory.push(result);

        this.displayResults(result.solution, result.fitness);

        // If we have previous runs, show comparison button/panel
        if (this.solutionHistory.length > 1) {
            this.compareResults();
        }

        this.saveToFirebase();
    }

    displayResults(solution, fitness) {
        // Render Scores
        const score = Math.round(fitness.total * 100);
        this.overallScoreEl.textContent = score;

        // Animate ring
        const circumference = 2 * Math.PI * 45;
        this.scoreRing.style.strokeDashoffset = circumference - (score / 100) * circumference;

        // Metric bars
        this.updateMetricBar('friend', fitness.friendProximity);
        this.updateMetricBar('vip', fitness.vipPlacement);
        this.updateMetricBar('group', fitness.groupCohesion);
        this.updateMetricBar('distance', fitness.stageDistance);

        // Render Venue
        const plan = this.optimizer.getSeatingPlan(solution);
        this.renderVenue(plan);

        // Update attendee list with seat numbers
        this.updateAttendeeListSeats(plan);
    }

    updateMetricBar(metric, value) {
        const percent = Math.round(value * 100);
        this.metricBars[metric].style.width = `${percent}%`;
        this.metricScores[metric].textContent = `${percent}%`;
    }

    updateAttendeeListSeats(plan) {
        // Map plan to attendees
        const seatMap = new Map();
        plan.forEach(item => {
            seatMap.set(item.attendee.id, item.seat);
        });

        const cards = this.attendeeList.querySelectorAll('.attendee-card');
        cards.forEach((card, index) => {
            if (index >= this.attendees.length) return;
            const attendee = this.attendees[index];
            const seat = seatMap.get(attendee.id);

            const details = card.querySelector('.attendee-seat');
            if (seat) {
                details.textContent = `${seat.seatId} • ${attendee.type.toUpperCase()}`;
            }
        });
    }

    compareResults() {
        if (this.solutionHistory.length < 2) return;

        const current = this.solutionHistory[this.solutionHistory.length - 1];
        const previous = this.solutionHistory[this.solutionHistory.length - 2];

        const currScore = Math.round(current.fitness.total * 100);
        const prevScore = Math.round(previous.fitness.total * 100);

        this.prevScoreEl.textContent = prevScore;
        this.currScoreEl.textContent = currScore;

        this.currScoreEl.className = `comparison-score ${currScore >= prevScore ? 'better' : 'worse'}`;

        this.comparisonPanel.classList.add('active');
    }

    exportData() {
        const data = {
            venue: this.venue,
            attendees: this.attendees,
            weights: this.weights,
            solution: this.optimizer.bestSolution
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'seating-plan.json';
        a.click();
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = JSON.parse(event.target.result);
                if (data.venue) {
                    this.venue = data.venue;
                    this.venueRowsInput.value = this.venue.rows;
                    this.venueColsInput.value = this.venue.cols;
                    this.vipRowsInput.value = this.venue.vipRows;
                }
                if (data.attendees) {
                    this.attendees = data.attendees;
                    this.updateStats();
                    this.renderAttendeeList();
                }
                if (data.weights) {
                    this.weights = data.weights;
                    // update inputs...
                }
                this.renderVenue(); // clear grid
                alert('Data imported successfully');
            };
            reader.readAsText(file);
        };
        input.click();
    }

    setupFirebase() {
        if (!window.firebaseAuth || !window.dbHelpers) {
            console.warn('Firebase not initialized');
            return;
        }

        this.currentEventId = 'default-event';
        this.isSyncing = false;

        window.firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                if (this.userNameEl) this.userNameEl.textContent = user.displayName || user.email.split('@')[0];
                if (this.userAvatarEl) this.userAvatarEl.textContent = (user.email || 'U').charAt(0).toUpperCase();

                // Real-time listener
                const dbRef = window.firebaseDB.ref(`users/${user.uid}/events/${this.currentEventId}`);
                dbRef.on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data && !this.isSyncing) {
                        this.loadFromFirebase(data);
                    } else if (!data) {
                        this.saveToFirebase(); // Init default
                    }
                });
            } else {
                // Force login - redirect to auth page
                window.location.href = 'auth.html';
            }
        });
    }

    loadFromFirebase(data) {
        console.log('Syncing from Firebase...');
        if (data.venue) {
            this.venue = data.venue;
            this.venueRowsInput.value = this.venue.rows;
            this.venueColsInput.value = this.venue.cols;
            this.vipRowsInput.value = this.venue.vipRows;
        }
        if (data.attendees) {
            this.attendees = data.attendees || [];
        }
        if (data.weights) {
            this.weights = data.weights;
            // Update weight sliders UI
            Object.keys(this.weights).forEach(key => {
                if (this.weightInputs[key]) this.weightInputs[key].value = this.weights[key];
                if (this.weightValues[key]) this.weightValues[key].textContent = this.weights[key] + '%';
            });
        }
        if (data.solution) {
            this.optimizer.bestSolution = data.solution;
        }

        this.updateStats();
        this.renderAttendeeList();
        this.renderVenue(data.solution ? this.optimizer.getSeatingPlan(data.solution) : []);
    }

    async saveToFirebase() {
        if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return;

        this.isSyncing = true;
        try {
            const data = {
                venue: this.venue,
                attendees: this.attendees,
                weights: this.weights,
                solution: this.optimizer ? this.optimizer.bestSolution : null,
                updatedAt: Date.now()
            };
            await window.dbHelpers.saveEvent(this.currentEventId, data);
        } catch (e) {
            console.error('Save failed', e);
        } finally {
            setTimeout(() => this.isSyncing = false, 500);
        }
    }

    async generateTicketsPDF() {
        if (!this.optimizer || !this.optimizer.bestSolution) {
            alert("Please optimize the seating first to generate tickets.");
            return;
        }

        if (!window.jspdf) {
            alert("PDF library not loaded");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const plan = this.optimizer.getSeatingPlan(this.optimizer.bestSolution);

        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235); // Primary Blue
        doc.text("Event Seating Chart", 20, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Total Attendees: ${plan.length}`, 20, 30);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 36);

        // Simple List for Chart Page
        let y = 50;
        doc.setFontSize(10);
        doc.setTextColor(0);

        // Add Tickets
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Attendee Tickets", 20, 20);

        let yPos = 40;
        const pageHeight = 290;
        const ticketHeight = 60;

        for (let i = 0; i < plan.length; i++) {
            const item = plan[i];

            // Page break
            if (yPos + ticketHeight > pageHeight) {
                doc.addPage();
                yPos = 20;
            }

            // Ticket Box
            doc.setDrawColor(200);
            doc.setFillColor(250, 250, 255);
            doc.roundedRect(20, yPos, 170, ticketHeight, 3, 3, 'FD');

            // Left Border (Blue)
            doc.setFillColor(37, 99, 235);
            doc.rect(20, yPos, 5, ticketHeight, 'F');

            // Details
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(item.attendee.name, 35, yPos + 15);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(item.attendee.email || "No Email", 35, yPos + 22);

            // Seat Info
            doc.setFontSize(12);
            doc.setTextColor(37, 99, 235);
            doc.text(`SEAT: ${item.seat.seatId}`, 130, yPos + 15);

            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(`Type: ${item.attendee.type.toUpperCase()}`, 130, yPos + 22);
            doc.text(`Row: ${String.fromCharCode(65 + item.seat.row)}`, 130, yPos + 28);

            // QR Code Generation
            const qrDiv = document.createElement('div');
            const qrData = JSON.stringify({
                id: item.attendee.id,
                name: item.attendee.name,
                seat: item.seat.seatId,
                event: this.currentEventId
            });

            // Create QR
            new QRCode(qrDiv, {
                text: qrData,
                width: 100,
                height: 100
            });

            // Wait slightly for canvas (usually sync but just in case)
            const canvas = qrDiv.querySelector('canvas');
            if (canvas) {
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 160, yPos + 5, 25, 25);
            }

            yPos += ticketHeight + 10;
        }

        doc.save("event-tickets.pdf");
    }

    async generateAIInsights() {
        if (!this.optimizer || !this.optimizer.bestSolution) {
            alert("Please optimize the seating first.");
            return;
        }

        const aiResponse = document.getElementById('aiResponse');
        const btn = document.getElementById('btnAiAnalyze');

        btn.disabled = true;
        btn.textContent = "Analyzing...";
        aiResponse.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; margin: 2rem 0;"><div class="loading-spinner"></div><p style="margin-top:1rem; color:var(--text-muted);">Asking Gemini...</p></div>';

        try {
            const venue = this.venue;
            // Get simplified seating plan for prompt
            const fullPlan = this.optimizer.getSeatingPlan(this.optimizer.bestSolution);
            const seatingPlan = fullPlan.map(p => ({
                seat: p.seat.id,
                attendee: p.attendee.name,
                traits: p.attendee.traits
            }));

            const response = await fetch('/api/gemini/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ venue, seatingPlan })
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server endpoint not found. Please RESTART your server (npm start) to enable AI features.");
            }

            const data = await response.json();

            if (data.success) {
                // Formatting markdown-ish text
                let html = data.analysis
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/### (.*?)/g, '<h4 style="margin-top:1rem; margin-bottom:0.5rem; color:var(--primary);">$1</h4>')
                    .replace(/- (.*?)/g, '<div style="display:flex; gap:0.5rem; margin-bottom:0.25rem;"><span style="color:var(--primary);">•</span><span>$1</span></div>');

                aiResponse.innerHTML = html;
            } else {
                throw new Error(data.error || 'Failed to get analysis');
            }
        } catch (error) {
            console.error(error);
            aiResponse.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
        } finally {
            btn.disabled = false;
            btn.textContent = "Regenerate";
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
