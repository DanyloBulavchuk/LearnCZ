document.addEventListener('DOMContentLoaded', () => {
    const app = {
        state: {
            currentUser: null,
            words: [],
            lectures: [],
            leaderboard: [],
            texts: {},
            currentLang: 'ua',
            currentTraining: {
                words: [],
                index: 0,
                results: [],
                mode: '', // 'random' or 'specific'
                direction: '', // 'cz_to_lang' or 'lang_to_cz'
            }
        },

        elements: {
            appContainer: document.getElementById('app-container'),
            templates: document.getElementById('templates'),
            mainHeader: document.getElementById('main-header'),
            profileButton: document.getElementById('profile-button'),
            langSwitcher: document.getElementById('lang-switcher'),
        },

        init() {
            this.addEventListeners();
            this.checkSession();
        },

        // --- Core Navigation and Listeners ---
        addEventListeners() {
            document.body.addEventListener('click', (e) => {
                const target = e.target;
                if (target.matches('[data-screen]')) this.navigateTo(target.dataset.screen);
                if (target.matches('[data-action]')) this.handleAction(target.dataset.action, target.dataset);
            });
            this.elements.profileButton.addEventListener('click', () => this.navigateTo('profile-screen'));
            this.elements.langSwitcher.addEventListener('click', (e) => {
                if (e.target.matches('[data-lang]')) this.setLanguage(e.target.dataset.lang);
            });
        },

        navigateTo(screenId) {
            const template = this.elements.templates.querySelector(`#${screenId}`);
            if (template) {
                this.elements.appContainer.innerHTML = `<div class="screen" id="${screenId}-active">${template.innerHTML}</div>`;
                this.onScreenLoad(screenId);
                this.updateAllTexts();
            }
        },

        onScreenLoad(screenId) {
            const activeScreen = document.getElementById(`${screenId}-active`);
            if (!activeScreen) return;

            const formActions = {
                '#login-form': (e) => this.handleLoginSubmit(e, activeScreen),
                '#register-form': (e) => this.handleRegisterSubmit(e, activeScreen),
                '.training-form': (e) => {
                    e.preventDefault();
                    this.checkAnswer(activeScreen);
                }
            };

            for (const selector in formActions) {
                const form = activeScreen.querySelector(selector);
                if (form) form.addEventListener('submit', formActions[selector]);
            }
            
            if (activeScreen.querySelector('#logout-btn')) {
                activeScreen.querySelector('#logout-btn').addEventListener('click', () => this.handleLogout());
            }
             if (activeScreen.querySelector('.training-check-btn')) {
                activeScreen.querySelector('.training-check-btn').addEventListener('click', () => this.checkAnswer(activeScreen));
            }


            if (screenId === 'profile-screen') this.renderProfile();
        },

        handleAction(action, dataset) {
            const actions = {
                'start-random-training': () => { this.state.currentTraining.mode = 'random'; this.navigateTo('direction-selection-screen'); },
                'start-specific-training': () => { this.state.currentTraining.mode = 'specific'; this.showLectureSelection('training'); },
                'show-dictionary': () => this.showLectureSelection('dictionary'),
                'select-lecture-for-training': () => this.startTrainingForLecture(dataset.lecture),
                'select-lecture-for-dictionary': () => this.showDictionaryForLecture(dataset.lecture),
                'set-direction': () => {
                    this.state.currentTraining.direction = dataset.direction;
                    if (this.state.currentTraining.mode === 'random') {
                        this.startTraining(this.state.words, true);
                    } else { // From specific lecture
                        this.startTrainingForLecture(this.state.currentTraining.lecture);
                    }
                }
            };
            if (actions[action]) actions[action]();
        },

        // --- Localization ---
        setLanguage(lang) {
            this.state.currentLang = lang;
            this.elements.langSwitcher.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
            this.updateAllTexts();
        },

        updateAllTexts() {
            const texts = this.state.texts[this.state.currentLang];
            if (!texts) return;

            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.dataset.i18n;
                if (texts[key]) el.textContent = texts[key];
            });
             document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.dataset.i18nPlaceholder;
                if (texts[key]) el.placeholder = texts[key];
            });
        },

        // --- Authentication & Data Loading ---
        async checkSession() {
            try {
                const response = await fetch('/api/session');
                const data = await response.json();
                if (data.user) {
                    this.state.currentUser = data.user;
                    await this.loadInitialData();
                    this.updateHeader();
                    this.navigateTo('main-menu-screen');
                } else {
                    await this.loadInitialData(); // Load texts even for guests
                    this.navigateTo('welcome-screen');
                }
            } catch (e) {
                console.error("Session check failed:", e);
                this.navigateTo('welcome-screen');
            }
        },
        
        async loadInitialData() {
            const response = await fetch('/api/data/initial');
            const data = await response.json();
            this.state.words = data.words;
            this.state.lectures = data.lectures;
            this.state.leaderboard = data.leaderboard;
            this.state.texts = data.texts;
            this.setLanguage(this.state.currentLang);
        },

        updateHeader() {
            if (this.state.currentUser) {
                this.elements.profileButton.textContent = this.state.currentUser.username;
                this.elements.mainHeader.classList.remove('hidden');
            } else {
                this.elements.mainHeader.classList.add('hidden');
            }
        },

        async handleLoginSubmit(e, screen) {
            e.preventDefault();
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    username: screen.querySelector('#login-username').value, 
                    pin: screen.querySelector('#login-pin').value 
                }),
            });
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                await this.loadInitialData();
                this.updateHeader();
                this.navigateTo('main-menu-screen');
            } else { alert('Неправильний нікнейм або PIN-код.'); }
        },

        async handleRegisterSubmit(e, screen) {
             const response = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    username: screen.querySelector('#register-username').value,
                    pin: screen.querySelector('#register-pin').value
                }),
            });
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                await this.loadInitialData();
                this.updateHeader();
                this.navigateTo('main-menu-screen');
            } else { alert(`Помилка реєстрації: ${await response.text()}`); }
        },
        
        async handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            this.state.currentUser = null;
            this.updateHeader();
            this.navigateTo('welcome-screen');
        },

        // --- Profile & Leaderboard ---
        renderProfile() {
            const detailsContainer = document.getElementById('profile-details');
            if (!detailsContainer) return;
            
            const xp = this.state.currentUser.xp;
            const { level, progress, needed } = this.xpToLevel(xp);
            const { emoji, name } = this.getRank(level);

            detailsContainer.innerHTML = `
                <div class="username">${this.state.currentUser.username}</div>
                <div class="rank"><span class="emoji">${emoji}</span> ${name}</div>
                <div class="level-info" data-i18n="level">Рівень ${level}</div>
                <div class="xp-bar"><div class="xp-bar-fill" style="width: ${(progress / needed) * 100}%;"></div></div>
                <div>${progress} / ${needed} XP</div>
            `;

            const leaderboardContainer = document.getElementById('leaderboard-container');
            leaderboardContainer.innerHTML = '';
            this.state.leaderboard.forEach((user, index) => {
                const userLevel = this.xpToLevel(user.xp).level;
                const userRank = this.getRank(userLevel);
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                if (user.username === this.state.currentUser.username) item.classList.add('current-user');
                item.innerHTML = `
                    <span class="lb-pos">${index + 1}.</span>
                    <span class="lb-rank">${userRank.emoji}</span>
                    <span class="lb-name">⏹️${user.username}⏹️</span>
                    <span class="lb-xp">(${user.xp} XP)</span>
                `;
                leaderboardContainer.appendChild(item);
            });
        },

        // --- Training and Dictionary Logic ---
        showLectureSelection(mode) {
            this.navigateTo('lecture-selection-screen');
            const container = document.getElementById('lecture-buttons-container');
            container.innerHTML = '';
            this.state.lectures.forEach(lectureNum => {
                const button = document.createElement('button');
                button.textContent = `Лекція №${lectureNum}`;
                button.dataset.action = `select-lecture-for-${mode}`;
                button.dataset.lecture = lectureNum;
                container.appendChild(button);
            });
        },
        
        startTrainingForLecture(lectureNum) {
            this.state.currentTraining.lecture = lectureNum;
            this.navigateTo('direction-selection-screen');
        },

        showDictionaryForLecture(lectureNum) {
            this.navigateTo('dictionary-view-screen');
            const container = document.getElementById('dictionary-words-container');
            container.innerHTML = '';
            const words = this.state.words.filter(w => w.lecture == lectureNum);
            words.forEach(word => {
                const item = document.createElement('div');
                item.className = 'dict-item';
                item.innerHTML = `<span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[this.state.currentLang.toUpperCase()]}</span>`;
                container.appendChild(item);
            });
        },

        startTraining(words, isRandom) {
            if (!words || words.length === 0) {
                alert("Для цього режиму немає слів.");
                return;
            }
            let trainingWords = [...words];
            if (isRandom) trainingWords.sort(() => Math.random() - 0.5);
            this.state.currentTraining.words = trainingWords;
            this.state.currentTraining.index = 0;
            this.state.currentTraining.results = [];
            this.navigateTo('training-screen');
            this.renderCurrentWord();
        },

        renderCurrentWord() {
            const screen = document.getElementById('training-screen-active');
            if (!screen || this.state.currentTraining.index >= this.state.currentTraining.words.length) {
                this.showResults();
                return;
            }
            const T = this.state.texts[this.state.currentLang];
            const training = this.state.currentTraining;
            const wordData = training.words[training.index];
            
            const progressEl = screen.querySelector('.training-progress');
            const wordEl = screen.querySelector('.training-word');
            const inputEl = screen.querySelector('.training-input');
            const feedbackEl = screen.querySelector('.training-feedback');
            
            progressEl.textContent = `${T.word} ${training.index + 1} ${T.of} ${training.words.length}`;
            
            const isCzToLang = training.direction === 'cz_to_lang';
            wordEl.textContent = isCzToLang ? wordData.CZ : wordData[this.state.currentLang.toUpperCase()];
            
            inputEl.value = '';
            inputEl.disabled = false;
            inputEl.focus();
            feedbackEl.innerHTML = '';
        },

        checkAnswer(screen) {
            const training = this.state.currentTraining;
            const wordData = training.words[training.index];
            const inputEl = screen.querySelector('.training-input');
            const feedbackEl = screen.querySelector('.training-feedback');
            const T = this.state.texts[this.state.currentLang];

            const userAnswer = inputEl.value.trim().toLowerCase();
            const isCzToLang = training.direction === 'cz_to_lang';
            
            const correctAnswersRaw = isCzToLang ? wordData[this.state.currentLang.toUpperCase()] : wordData.CZ;
            const correctAnswers = correctAnswersRaw.toLowerCase().split(',').map(s => s.trim());

            const isCorrect = correctAnswers.includes(userAnswer);
            
            training.results.push({ wordData, userAnswer, isCorrect });
            
            if (isCorrect) {
                feedbackEl.textContent = T.correct + " +10 XP";
                feedbackEl.style.color = 'var(--success-color)';
                fetch('/api/update_xp', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ xp: 10 })
                }).then(res => res.json()).then(data => {
                    this.state.currentUser.xp = data.new_xp;
                });
            } else {
                feedbackEl.innerHTML = `${T.mistake} <br> <span style="opacity: 0.7">${T.correct_is} ${correctAnswers[0]}</span>`;
                feedbackEl.style.color = 'var(--danger-color)';
            }

            inputEl.disabled = true;
            setTimeout(() => {
                training.index++;
                this.renderCurrentWord();
            }, 1500);
        },

        showResults() {
            this.navigateTo('results-screen');
            const summaryEl = document.getElementById('results-summary');
            const listEl = document.getElementById('results-list');
            const results = this.state.currentTraining.results;
            const correctCount = results.filter(r => r.isCorrect).length;
            summaryEl.textContent = `Ваш результат: ${correctCount} з ${results.length}`;

            listEl.innerHTML = '';
            results.forEach(res => {
                const item = document.createElement('div');
                item.className = `result-item ${res.isCorrect ? 'correct' : 'incorrect'}`;
                const question = this.state.currentTraining.direction === 'cz_to_lang' ? res.wordData.CZ : res.wordData[this.state.currentLang.toUpperCase()];
                item.innerHTML = `<span>${question}</span> -> <span>${res.userAnswer || "(пусто)"}</span>`;
                listEl.appendChild(item);
            });
        },

        // --- Helper Functions ---
        xpToLevel(xp) {
            let level = 1, startXp = 0, needed = 100;
            while (xp >= startXp + needed) {
                startXp += needed;
                level++;
                needed = Math.floor(100 * (1.2 ** (level - 1)));
            }
            return { level, progress: xp - startXp, needed };
        },
        getRank(level) {
            const RANKS = { 1: "🥉", 6: "🥈", 16: "🥇", 31: "🏆", 51: "💎" };
            const NAMES = { 1: "Nováček", 6: "Učedník", 16: "Znalec", 31: "Mistr", 51: "Polyglot" };
            let rankEmoji = "🥉", rankName = "Nováček";
            for (const lvl in RANKS) {
                if (level >= parseInt(lvl, 10)) {
                    rankEmoji = RANKS[lvl];
                    rankName = NAMES[lvl];
                }
            }
            return { emoji: rankEmoji, name: rankName };
        }
    };

    app.init();
});