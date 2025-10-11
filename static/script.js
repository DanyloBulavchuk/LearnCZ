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
                mode: '',
                direction: '',
                selectedLectures: [],
            }
        },

        elements: {
            appContainer: document.getElementById('app-container'),
            templates: document.getElementById('templates'),
            mainHeader: document.getElementById('main-header'),
            profileButton: document.getElementById('profile-button'),
            langSwitcher: document.getElementById('lang-switcher'),
            currentLangBtn: document.getElementById('current-lang-btn'),
            langOptions: document.getElementById('lang-options'),
        },

        init() {
            this.addEventListeners();
            this.checkSession();
        },

        addEventListeners() {
            document.body.addEventListener('click', (e) => {
                const target = e.target.closest('[data-screen], [data-action], [data-lang]');
                if (target) {
                    if (target.dataset.screen) this.navigateTo(target.dataset.screen);
                    else if (target.dataset.action) this.handleAction(target.dataset.action, target.dataset);
                    else if (target.dataset.lang) {
                        this.setLanguage(target.dataset.lang);
                        this.elements.langOptions.classList.remove('visible');
                    }
                }
                if (!this.elements.langSwitcher.contains(e.target)) {
                    this.elements.langOptions.classList.remove('visible');
                }
            });

            this.elements.currentLangBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.elements.langOptions.classList.toggle('visible');
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
                '.training-form': (e) => { e.preventDefault(); this.checkAnswer(); }
            };
            for (const selector in formActions) {
                const form = activeScreen.querySelector(selector);
                if (form) form.addEventListener('submit', formActions[selector]);
            }
            if (activeScreen.querySelector('#logout-btn')) activeScreen.querySelector('#logout-btn').addEventListener('click', () => this.handleLogout());
            if (activeScreen.querySelector('.training-check-btn')) activeScreen.querySelector('.training-check-btn').addEventListener('click', () => this.checkAnswer());
            if (screenId === 'profile-screen') this.renderProfile();
        },

        handleAction(action, dataset) {
            const actions = {
                'start-random-training': () => {
                    this.state.currentTraining.mode = 'random';
                    this.navigateTo('direction-selection-screen');
                },
                'start-specific-training': () => {
                    this.state.currentTraining.mode = 'specific';
                    this.showLectureSelection('training');
                },
                'show-dictionary': () => this.showLectureSelection('dictionary'),
                'select-lecture': (ds) => {
                    const btn = document.querySelector(`#lecture-buttons-container [data-lecture="${ds.lecture}"]`);
                    if (btn) {
                        const lectureNum = parseInt(ds.lecture, 10);
                        const index = this.state.currentTraining.selectedLectures.indexOf(lectureNum);
                        if (index > -1) {
                            this.state.currentTraining.selectedLectures.splice(index, 1);
                            btn.classList.remove('selected');
                        } else {
                            this.state.currentTraining.selectedLectures.push(lectureNum);
                            btn.classList.add('selected');
                        }
                    }
                },
                'start-selected-lectures-training': () => {
                    if (this.state.currentTraining.selectedLectures.length > 0) {
                        this.state.currentTraining.mode = 'specific_selected';
                        this.navigateTo('direction-selection-screen');
                    } else {
                        alert('Будь ласка, оберіть хоча б одну лекцію.');
                    }
                },
                'select-lecture-for-dictionary': (ds) => this.showDictionaryForLecture(ds.lecture),
                'set-direction': (ds) => {
                    this.state.currentTraining.direction = ds.direction;
                    const mode = this.state.currentTraining.mode;
                    let words = [];
                    if (mode === 'random' || mode === 'specific_all') {
                        words = this.state.words;
                    } else if (mode === 'specific_selected') {
                        const selected = this.state.currentTraining.selectedLectures;
                        words = this.state.words.filter(w => selected.includes(w.lecture));
                    }
                    this.startTraining(words, true);
                },
                'show-results': () => this.showResults(),
            };
            if (actions[action]) actions[action](dataset);
        },

        setLanguage(lang) {
            this.state.currentLang = lang;
            const flags = { ua: '🇺🇦', en: '🇬🇧', ru: '🇷🇺' };
            this.elements.currentLangBtn.textContent = flags[lang];
            this.updateAllTexts();
        },

        updateAllTexts() {
            if (!this.state.texts || Object.keys(this.state.texts).length === 0) return;
            const texts = this.state.texts[this.state.currentLang];
            if (!texts) return;

            document.querySelectorAll('[data-i18n]').forEach(el => {
                if (texts[el.dataset.i18n]) el.textContent = texts[el.dataset.i18n];
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                if (texts[el.dataset.i18nPlaceholder]) el.placeholder = texts[el.dataset.i18nPlaceholder];
            });
            document.querySelectorAll('[data-lecture-title]').forEach(el => {
                 el.textContent = `${texts.lecture || 'Лекція'} №${el.dataset.lectureTitle}`;
            });
        },

        async checkSession() {
            try {
                await this.loadInitialData();
                const response = await fetch('/api/session');
                const data = await response.json();
                if (data.user) {
                    this.state.currentUser = data.user;
                    this.navigateTo('main-menu-screen');
                } else {
                    this.navigateTo('welcome-screen');
                }
                this.updateHeader();
            } catch (e) { 
                this.navigateTo('welcome-screen');
                this.updateHeader();
            }
        },
        
        async loadInitialData() {
            try {
                const response = await fetch('/api/data/initial');
                const data = await response.json();
                this.state.words = data.words;
                this.state.lectures = data.lectures;
                this.state.leaderboard = data.leaderboard;
                this.state.texts = data.texts;
                this.setLanguage(this.state.currentLang);
            } catch (e) {
                console.error("Could not load initial data:", e);
            }
        },

        updateHeader() {
            if (this.state.currentUser) {
                this.elements.profileButton.textContent = this.state.currentUser.username;
                this.elements.profileButton.style.display = 'flex';
            } else {
                this.elements.profileButton.style.display = 'none';
            }
        },

        async handleLoginSubmit(e, screen) {
            e.preventDefault();
            const response = await fetch('/api/login', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: screen.querySelector('#login-username').value, pin: screen.querySelector('#login-pin').value }),
            });
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                this.updateHeader(); this.navigateTo('main-menu-screen');
            } else { alert('Неправильний нікнейм або PIN-код.'); }
        },

        async handleRegisterSubmit(e, screen) {
             const response = await fetch('/api/register', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: screen.querySelector('#register-username').value, pin: screen.querySelector('#register-pin').value }),
            });
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                this.updateHeader(); this.navigateTo('main-menu-screen');
            } else { alert(`Помилка реєстрації: ${await response.text()}`); }
        },
        
        async handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            this.state.currentUser = null;
            this.updateHeader();
            this.navigateTo('welcome-screen');
        },

        renderProfile() {
            const detailsContainer = document.getElementById('profile-details');
            if (!detailsContainer || !this.state.currentUser) return;
            const xp = this.state.currentUser.xp;
            const { level, progress, needed } = this.xpToLevel(xp);
            const { emoji, name } = this.getRank(level);
            const T = this.state.texts[this.state.currentLang];

            detailsContainer.innerHTML = `<div class="username">${this.state.currentUser.username}</div>
                <div class="rank"><span class="emoji">${emoji}</span> ${name}</div>
                <div class="level-info">${T.level} ${level}</div>
                <div class="xp-bar"><div class="xp-bar-fill" style="width: ${(progress / needed) * 100}%;"></div></div>
                <div>${progress} / ${needed} XP</div>`;

            const leaderboardContainer = document.getElementById('leaderboard-container');
            leaderboardContainer.innerHTML = '';
            (this.state.leaderboard || []).forEach((user, index) => {
                const userLevel = this.xpToLevel(user.xp).level;
                const userRank = this.getRank(userLevel);
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                if (user.username === this.state.currentUser.username) item.classList.add('current-user');
                item.innerHTML = `<span class="lb-pos">${index + 1}.</span>
                    <span class="lb-rank">${userRank.emoji}</span>
                    <span class="lb-name">⏹️${user.username}⏹️</span>
                    <span class="lb-xp">(${user.xp} XP)</span>`;
                leaderboardContainer.appendChild(item);
            });
        },

        showLectureSelection(mode) {
            this.navigateTo('lecture-selection-screen');
            this.state.currentTraining.selectedLectures = [];
            const container = document.getElementById('lecture-buttons-container');
            const actionsContainer = document.getElementById('lecture-actions-container');
            container.innerHTML = '';
            actionsContainer.innerHTML = '';
            
            if (mode === 'training') {
                const allBtn = document.createElement('button');
                allBtn.className = 'glow-on-hover';
                allBtn.dataset.action = 'set-direction';
                allBtn.dataset.i18n = 'all_lectures';
                this.state.currentTraining.mode = 'specific_all';
                container.appendChild(allBtn);
            }
            
            this.state.lectures.forEach(lectureNum => {
                const button = document.createElement('button');
                button.className = 'glow-on-hover';
                button.dataset.action = mode === 'training' ? 'select-lecture' : 'select-lecture-for-dictionary';
                button.dataset.lecture = lectureNum;
                button.dataset.lectureTitle = lectureNum;
                container.appendChild(button);
            });

            if (mode === 'training') {
                const startBtn = document.createElement('button');
                startBtn.className = 'glow-on-hover';
                startBtn.dataset.action = 'start-selected-lectures-training';
                startBtn.dataset.i18n = 'start_training';
                actionsContainer.appendChild(startBtn);
            }
            this.updateAllTexts();
        },
        
        showDictionaryForLecture(lectureNum) {
            this.navigateTo('dictionary-view-screen');
            const container = document.getElementById('dictionary-words-container');
            container.innerHTML = '';
            const langKey = this.state.currentLang.toUpperCase();
            const words = this.state.words.filter(w => w.lecture == lectureNum);
            words.forEach((word, index) => {
                const item = document.createElement('div');
                item.className = 'dict-item';
                item.innerHTML = `<b>${index + 1}.</b> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[langKey] || word.UA}</span>`;
                container.appendChild(item);
            });
        },

        startTraining(words, isRandom) {
            if (!words || words.length === 0) { alert("Для цього режиму немає слів."); return; }
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
                this.showResults(); return;
            }
            const T = this.state.texts[this.state.currentLang];
            const { index, words, direction } = this.state.currentTraining;
            const wordData = words[index];
            screen.querySelector('.training-progress').textContent = `${T.word} ${index + 1} ${T.of} ${words.length}`;
            const langKey = this.state.currentLang.toUpperCase();
            screen.querySelector('.training-word').textContent = direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA);
            const inputEl = screen.querySelector('.training-input');
            inputEl.value = ''; inputEl.disabled = false; inputEl.focus();
            screen.querySelector('.training-feedback').innerHTML = '';
        },

        async checkAnswer() {
            const screen = document.getElementById('training-screen-active');
            const { index, words, direction, results } = this.state.currentTraining;
            const wordData = words[index];
            const inputEl = screen.querySelector('.training-input');
            const feedbackEl = screen.querySelector('.training-feedback');
            const T = this.state.texts[this.state.currentLang];
            const langKey = this.state.currentLang.toUpperCase();
            const userAnswer = inputEl.value.trim();
            const correctAnswersRawWithParen = direction === 'cz_to_lang' ? (wordData[langKey] || wordData.UA) : wordData.CZ;
            const correctAnswersRaw = correctAnswersRawWithParen.replace(/\s*\(.*?\)\s*/g, '');
            const correctAnswers = correctAnswersRaw.toLowerCase().split(',').map(s => s.trim()).filter(s => s);
            const isCorrect = correctAnswers.includes(userAnswer.toLowerCase());
            results.push({
                question: direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA),
                userAnswer, isCorrect, correctAnswer: correctAnswers[0]
            });
            if (isCorrect) {
                feedbackEl.innerHTML = `<span class="xp-gain">${T.correct} +10 XP</span>`;
                const response = await fetch('/api/update_xp', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ xp: 10 })
                });
                if(response.ok) {
                    const data = await response.json();
                    this.state.currentUser.xp = data.new_xp;
                }
            } else {
                feedbackEl.innerHTML = `${T.mistake} <br> <span style="opacity: 0.7">${T.correct_is} ${correctAnswers[0]}</span>`;
            }
            feedbackEl.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';
            inputEl.disabled = true;
            setTimeout(() => {
                this.state.currentTraining.index++;
                this.renderCurrentWord();
            }, isCorrect ? 1000 : 2000);
        },

        showResults() {
            this.navigateTo('results-screen');
            const summaryEl = document.getElementById('results-summary');
            const listEl = document.getElementById('results-list');
            const { results } = this.state.currentTraining;
            const correctCount = results.filter(r => r.isCorrect).length;
            summaryEl.innerHTML = `Ваш результат: <b>${correctCount} з ${results.length}</b> (+${correctCount * 10} XP)`;
            listEl.innerHTML = '';
            results.forEach((res, index) => {
                const item = document.createElement('div');
                item.className = `result-item ${res.isCorrect ? 'correct' : 'incorrect'}`;
                const answerHTML = this.generateDiffHtml(res.correctAnswer, res.userAnswer);
                item.innerHTML = `<b>${index + 1}.</b> ${res.question} - ${answerHTML} <span>(${res.isCorrect ? '+10' : '0'} XP)</span>`;
                listEl.appendChild(item);
            });
            this.loadInitialData();
        },
        
        generateDiffHtml(correct, user) {
            let html = '';
            const userLower = user.toLowerCase();
            const correctLower = correct.toLowerCase();
            for (let i = 0; i < user.length; i++) {
                if (userLower[i] === (correctLower[i] || '')) {
                    html += `<span class="diff-correct">${user[i]}</span>`;
                } else {
                    html += `<span class="diff-incorrect">${user[i]}</span>`;
                }
            }
            return html || '(пусто)';
        },

        xpToLevel(xp) {
            let level = 1, startXp = 0, needed = 100;
            while (xp >= startXp + needed) {
                startXp += needed; level++;
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