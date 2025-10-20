document.addEventListener('DOMContentLoaded', () => {
    const app = {
        state: {
            currentUser: null,
            loadedWords: {},
            lectures: [],
            leaderboard: [],
            texts: {},
            avatars: { M: [], F: [] },
            currentAvatarIndex: 0,
            currentLang: 'ua',
            isShiftActive: false,
            viewMode: null,
            selectedLectureForView: null,
            isCheckingAnswer: false,
            
            isMusicPlaying: false,
            currentMusicPlayer: null,
            currentParticleType: null,

            isRaining: false,
            lastParticleTimestamp: 0,
            animationFrameId: null,
            
            currentTraining: {
                words: [], index: 0, results: [], mode: '',
                direction: '', selectedLectures: [],
            },
        },

        elements: {
            appContainer: document.getElementById('app-container'),
            templates: document.getElementById('templates'),
            mainHeader: document.getElementById('main-header'),
            profileButton: document.getElementById('profile-button'),
            langSwitcher: document.getElementById('lang-switcher'),
            currentLangBtn: document.getElementById('current-lang-btn'),
            langOptions: document.getElementById('lang-options'),
            themeToggle: document.getElementById('theme-checkbox'),
            particleRainContainer: document.getElementById('particle-rain-container'),
            volumeSlider: document.getElementById('volume-slider'),
            
            audio: {
                emerald: document.getElementById('music-emerald'),
                diamond: document.getElementById('music-diamond'),
                gold: document.getElementById('music-gold'),
                lazurit: document.getElementById('music-lazurit'),
                redstone: document.getElementById('music-redstone'),
            }
        },

        init() {
            this.initTheme();
            this.addEventListeners();
            this.checkSession();
        },
        
        addEventListeners() {
            document.body.addEventListener('click', (e) => {
                const target = e.target.closest('[data-screen], [data-action], [data-lang], [data-egg], .char-btn, .shift-btn');
                
                if (!target) {
                    if (!this.elements.langSwitcher.contains(e.target)) {
                        this.elements.langOptions.classList.remove('visible');
                    }
                    return;
                }

                const dataset = target.dataset;
                if (dataset.screen) this.navigateTo(dataset.screen);
                else if (dataset.action) this.handleAction(dataset.action, dataset);
                else if (dataset.lang) {
                    this.setLanguage(dataset.lang);
                    this.elements.langOptions.classList.remove('visible');
                }
                else if (dataset.egg) {
                    e.stopPropagation();
                    this.playMusic(dataset.egg);
                }
                else if (target.matches('.char-btn')) this.insertChar(target.textContent);
                else if (target.matches('.shift-btn')) this.toggleShift();
            });

            document.body.addEventListener('input', (e) => {
                const target = e.target;
                if (target.id === 'volume-slider') {
                    this.setVolume(target.value);
                }
            });
            
            document.body.addEventListener('change', (e) => {
                const target = e.target;
                if (target.id === 'theme-checkbox') {
                    this.handleThemeChange();
                } else if (target.id === 'gender-slider') {
                    this.handleGenderChange(target.checked ? 'M' : 'F');
                }
            });

            this.elements.currentLangBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.elements.langOptions.classList.toggle('visible');
            });
        },
        
        initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            if (savedTheme === 'light') {
                document.documentElement.classList.add('light-theme');
                if(this.elements.themeToggle) this.elements.themeToggle.checked = true;
            }
            this.updateMusicButtonForTheme(savedTheme === 'light');
        },

        handleThemeChange() {
            const isLight = this.elements.themeToggle.checked;
            document.documentElement.classList.toggle('light-theme', isLight);
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            this.updateMusicButtonForTheme(isLight);
        },
        
        updateMusicButtonForTheme(isLight) {
            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                musicBtn.dataset.egg = isLight ? 'diamond' : 'emerald';
            }
        },

        navigateTo(screenId) {
            const oldScreen = this.elements.appContainer.querySelector('.screen');
            if (oldScreen) {
                oldScreen.classList.remove('entering');
                oldScreen.classList.add('exiting');
                oldScreen.addEventListener('animationend', () => oldScreen.remove(), { once: true });
            }

            if (screenId !== 'main-menu-screen' && this.state.isMusicPlaying) {
                this.elements.volumeSlider.classList.remove('visible');
            }

            const template = this.elements.templates.querySelector(`#${screenId}`);
            if (template) {
                const newScreen = document.createElement('div');
                newScreen.className = 'screen entering';
                newScreen.id = `${screenId}-active`;
                newScreen.innerHTML = template.innerHTML;
                this.elements.appContainer.appendChild(newScreen);
                
                this.onScreenLoad(screenId);
            }
        },

        onScreenLoad(screenId) {
            this.updateAllTexts(); 
            const activeScreen = document.getElementById(`${screenId}-active`);
            if (!activeScreen) return;
            
            const formActions = {
                '#login-form': (e) => this.handleLoginSubmit(e, activeScreen),
                '#register-form': (e) => this.handleRegisterSubmit(e, activeScreen),
                '#settings-form': (e) => this.handleChangePin(e, activeScreen),
                '.training-form': (e) => { 
                    e.preventDefault(); 
                    this.checkAnswer(); 
                }
            };
            for (const selector in formActions) {
                const form = activeScreen.querySelector(selector);
                if (form) form.addEventListener('submit', formActions[selector]);
            }
            
            const clickActions = {
                 '.training-check-btn': () => this.checkAnswer(),
                 '#stop-music-button': () => this.stopAllMusic(),
            };
            for (const selector in clickActions) {
                 const btn = activeScreen.querySelector(selector);
                 if (btn) btn.addEventListener('click', clickActions[selector]);
            }

            switch (screenId) {
                case 'main-menu-screen':
                    this.updateMusicButtonForTheme(localStorage.getItem('theme') === 'light');
                    if (this.state.isMusicPlaying) {
                        this.elements.volumeSlider.classList.add('visible');
                    }
                    break;
                case 'profile-screen':
                    this.renderProfile();
                    this.renderAvatarUI();
                    this.renderEasterEggs();
                    break;
                case 'settings-screen':
                    this.renderGenderSlider();
                    break;
                case 'lecture-selection-screen':
                    this.renderLectureSelection();
                    break;
                case 'dictionary-view-screen':
                    this.renderDictionary();
                    if (this.state.selectedLectureForView === 0) {
                        this.renderLazuritEasterEgg();
                    }
                    break;
                case 'training-screen':
                    this.renderCurrentWord();
                    this.renderKeyboard();
                    break;
                case 'results-screen':
                    this.renderResults();
                    break;
            }
        },
        
        handleAction(action, dataset) {
            const actions = {
                'start-random-training': () => {
                    this.state.currentTraining.mode = 'random';
                    this.navigateTo('direction-selection-screen');
                },
                'start-specific-training': () => {
                    this.state.viewMode = 'training';
                    this.navigateTo('lecture-selection-screen');
                },
                'show-dictionary': () => {
                    this.state.viewMode = 'dictionary';
                    this.navigateTo('lecture-selection-screen');
                },
                'select-lecture': (ds) => {
                    const lectureNum = (ds.lecture === '0' || ds.lecture === 0) ? 0 : parseInt(ds.lecture, 10);
                    const btn = document.querySelector(`#lecture-buttons-container [data-lecture="${lectureNum}"]`);
                    if (!btn) return;

                    if (this.state.viewMode === 'training') {
                        const index = this.state.currentTraining.selectedLectures.indexOf(lectureNum);
                        if (index > -1) {
                            this.state.currentTraining.selectedLectures.splice(index, 1);
                            btn.classList.remove('selected');
                        } else {
                            this.state.currentTraining.selectedLectures.push(lectureNum);
                            btn.classList.add('selected');
                        }
                    } else if (this.state.viewMode === 'dictionary') {
                        this.state.selectedLectureForView = lectureNum;
                        this.navigateTo('dictionary-view-screen');
                    }
                },
                'start-selected-lectures-training': () => {
                    if (this.state.currentTraining.selectedLectures.length > 0) {
                        this.state.currentTraining.mode = 'specific_selected';
                        this.navigateTo('direction-selection-screen');
                    } else {
                        alert(this.state.texts[this.state.currentLang].select_at_least_one_lecture);
                    }
                },
                'set-direction': (ds) => {
                    this.state.currentTraining.direction = ds.direction;
                    this.startTraining();
                },
                'finish-training': () => this.navigateTo('results-screen'),
                'logout': () => this.handleLogout(),
                'back-to-dict-select': () => {
                    this.state.viewMode = 'dictionary';
                    this.navigateTo('lecture-selection-screen');
                },
                'back-to-train-select': () => {
                    this.state.viewMode = 'training';
                    this.navigateTo('lecture-selection-screen');
                },
                'prev-avatar': () => this.handleAvatarChange(-1),
                'next-avatar': () => this.handleAvatarChange(1),
            };
            if (actions[action]) actions[action](dataset);
        },
        
        setLanguage(lang) {
            this.state.currentLang = lang;
            const flagClasses = { ua: 'flag-ua', en: 'flag-us', ru: 'flag-ru' };
            this.elements.currentLangBtn.className = `flag-icon ${flagClasses[lang]}`;
            this.updateAllTexts();
            if (document.getElementById('settings-screen-active')) {
                this.renderGenderSlider();
            }
        },

        updateAllTexts() {
            if (!this.state.texts || Object.keys(this.state.texts).length === 0) return;
            const texts = this.state.texts[this.state.currentLang];
            if (!texts) return;

            document.querySelectorAll('[data-i18n]').forEach(el => { if (texts[el.dataset.i18n]) el.textContent = texts[el.dataset.i18n]; });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { if (texts[el.dataset.i18nPlaceholder]) el.placeholder = texts[el.dataset.i18nPlaceholder]; });
            document.querySelectorAll('[data-lecture-title]').forEach(el => { 
                const lectureNum = el.dataset.lectureTitle;
                if (lectureNum === '0') {
                    el.textContent = texts.notebook_lecture || 'Мій записник';
                } else {
                    el.textContent = `${texts.lecture || 'Лекція'} №${lectureNum}`;
                }
            });
        },
        
        async checkSession() {
            try {
                await this.loadInitialData();
                const response = await fetch('/api/session');
                const data = await response.json();
                this.state.currentUser = data.user || null;
                if (this.state.currentUser) {
                    this.state.currentUser.found_easter_eggs = JSON.parse(this.state.currentUser.found_easter_eggs || '[]');
                }
            } catch (e) { this.state.currentUser = null; } 
            finally {
                this.updateHeader();
                this.navigateTo(this.state.currentUser ? 'main-menu-screen' : 'welcome-screen');
            }
        },
        
        async loadInitialData() {
            try {
                const response = await fetch('/api/data/initial');
                const data = await response.json();
                this.state.lectures = data.lectures;
                this.state.leaderboard = data.leaderboard;
                this.state.texts = data.texts;
                this.state.avatars = data.avatars;
                this.setLanguage(this.state.currentLang);
            } catch (e) { console.error("Could not load initial data:", e); }
        },
        
        async loadWordsForLectures(lectureIds) {
            const lecturesToFetch = lectureIds.filter(id => !this.state.loadedWords[id]);
            
            if (lecturesToFetch.length > 0 || (lectureIds.includes('random') && !this.state.loadedWords['random'])) {
                const response = await fetch('/api/get_words', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ lectures: lectureIds.includes('random') ? ['random'] : lecturesToFetch })
                });
                const words = await response.json();
                
                if (lectureIds.includes('random')) {
                    this.state.loadedWords['random'] = words;
                } else {
                    lecturesToFetch.forEach(id => {
                        this.state.loadedWords[id] = words.filter(w => w.lecture === id);
                    });
                }
            }
            
            let allWords = [];
            if (lectureIds.includes('random')) {
                allWords = [...this.state.loadedWords['random']];
            } else {
                lectureIds.forEach(id => {
                    allWords.push(...(this.state.loadedWords[id] || []));
                });
            }
            return allWords;
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
                this.state.currentUser.found_easter_eggs = JSON.parse(this.state.currentUser.found_easter_eggs || '[]');
                this.updateHeader(); this.navigateTo('main-menu-screen');
            } else { alert('Неправильний нікнейм або PIN-код.'); }
        },

        async handleRegisterSubmit(e, screen) {
             e.preventDefault();
             const response = await fetch('/api/register', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: screen.querySelector('#register-username').value, pin: screen.querySelector('#register-pin').value }),
            });
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                this.state.currentUser.found_easter_eggs = [];
                this.updateHeader(); this.navigateTo('main-menu-screen');
            } else { alert(`Помилка реєстрації: ${await response.text()}`); }
        },
        
        async handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            this.stopAllMusic();
            this.state.currentUser = null;
            this.state.loadedWords = {};
            this.updateHeader();
            this.navigateTo('welcome-screen');
        },

        async handleChangePin(e, screen) {
            e.preventDefault();
            const newPin = screen.querySelector('#new-pin').value;
            if (!/^\d{4}$/.test(newPin)) {
                alert('PIN-код повинен складатися з 4 цифр.');
                return;
            }
            const response = await fetch('/api/settings/change_pin', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ new_pin: newPin })
            });
            if (response.ok) {
                alert(this.state.texts[this.state.currentLang].pin_changed_success);
                this.navigateTo('profile-screen');
            } else {
                alert('Не вдалося змінити PIN-код.');
            }
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
                    <span class="lb-name">${user.username}</span>
                    <span class="lb-xp">(${user.xp} XP)</span>`;
                leaderboardContainer.appendChild(item);
            });
        },

        renderEasterEggs() {
            const container = document.getElementById('easter-egg-icons');
            if (!container || !this.state.currentUser) return;
            
            const foundEggs = this.state.currentUser.found_easter_eggs || [];
            container.querySelectorAll('.easter-egg-icon').forEach(icon => {
                if (foundEggs.includes(icon.dataset.egg)) {
                    icon.classList.add('found');
                }
            });
        },
        
        renderAvatarUI() {
            const wrapper = document.getElementById('avatar-image-wrapper');
            const controls = document.getElementById('avatar-controls');
            const nameEl = document.getElementById('avatar-name');
            if (!wrapper || !controls || !nameEl) return;

            const T = this.state.texts[this.state.currentLang];
            const { gender, avatar } = this.state.currentUser;

            if (gender === 'N' || !gender) {
                wrapper.innerHTML = `<span>${T.choose_avatar}</span>`;
                controls.classList.add('hidden');
                nameEl.textContent = '';
                return;
            }

            const avatarList = this.state.avatars[gender] || [];
            if (avatarList.length === 0) {
                wrapper.innerHTML = `<span>${T.avatar_unavailable}</span>`;
                controls.classList.add('hidden');
                nameEl.textContent = '';
                return;
            }
            
            controls.classList.remove('hidden');
            let currentAvatar = avatar;
            let currentIndex = avatarList.indexOf(currentAvatar);

            if (currentIndex === -1) {
                currentIndex = 0;
                currentAvatar = avatarList[0];
                this.state.currentUser.avatar = currentAvatar;
            }
            this.state.currentAvatarIndex = currentIndex;
            
            wrapper.innerHTML = `<img src="/avatars/${currentAvatar}" alt="Avatar">`;
            nameEl.textContent = currentAvatar.replace(`${gender}_`, '').replace('.png', '');
        },
        
        async handleAvatarChange(direction) {
            const { gender } = this.state.currentUser;
            const avatarList = this.state.avatars[gender];
            if (!avatarList || avatarList.length === 0) return;

            let newIndex = this.state.currentAvatarIndex + direction;
            if (newIndex < 0) newIndex = avatarList.length - 1;
            if (newIndex >= avatarList.length) newIndex = 0;
            
            const newAvatar = avatarList[newIndex];
            this.state.currentAvatarIndex = newIndex;
            this.state.currentUser.avatar = newAvatar;
            
            this.renderAvatarUI();

            await fetch('/api/settings/save_avatar', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ avatar: newAvatar })
            });
        },
        
        renderGenderSlider() {
            const container = document.getElementById('gender-slider-container');
            if (!container) return;
            const T = this.state.texts[this.state.currentLang];
            
            container.innerHTML = `
                <span class="gender-label">${T.gender_female}</span>
                <label class="gender-switch">
                    <input type="checkbox" id="gender-slider">
                    <span class="slider-track"></span>
                </label>
                <span class="gender-label">${T.gender_male}</span>
            `;
            
            const slider = container.querySelector('#gender-slider');
            if (this.state.currentUser.gender === 'M') {
                slider.checked = true;
            }
        },
        
        async handleGenderChange(gender) {
            this.state.currentUser.gender = gender;
            this.state.currentAvatarIndex = 0; 
            
            const avatarList = this.state.avatars[gender] || [];
            const newAvatar = avatarList.length > 0 ? avatarList[0] : null;
            this.state.currentUser.avatar = newAvatar;

            await fetch('/api/settings/save_avatar', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ gender: gender, avatar: newAvatar })
            });
            
            if (document.getElementById('profile-screen-active')) {
                this.renderAvatarUI();
            }
        },

        renderLazuritEasterEgg() {
            const container = document.getElementById('lazurit-easter-egg-container');
            if (!container) return;
            container.innerHTML = '';
            
            const T = this.state.texts[this.state.currentLang];
            const found = this.state.currentUser.found_easter_eggs.includes('lazurit');
            
            const eggEl = document.createElement('div');
            eggEl.id = 'lazurit-easter-egg';
            eggEl.dataset.egg = 'lazurit';
            if (found) eggEl.classList.add('found');
            
            container.appendChild(eggEl);
        },
        
        renderLectureSelection() {
            this.state.currentTraining.selectedLectures = []; 
            const container = document.getElementById('lecture-buttons-container');
            const actionsContainer = document.getElementById('lecture-actions-container');
            container.innerHTML = '';
            actionsContainer.innerHTML = '';
            
            this.state.lectures.forEach(lectureNum => {
                const button = document.createElement('button');
                button.className = 'glow-on-hover';
                button.dataset.action = 'select-lecture';
                button.dataset.lecture = lectureNum;
                button.dataset.lectureTitle = lectureNum;
                container.appendChild(button);
            });
            
            if (this.state.viewMode === 'training') {
                const startBtn = document.createElement('button');
                startBtn.className = 'glow-on-hover start-training-btn';
                startBtn.dataset.action = 'start-selected-lectures-training';
                startBtn.dataset.i18n = 'start_training';
                actionsContainer.appendChild(startBtn);
            }
            this.updateAllTexts();
        },
        
        async renderDictionary() {
            const container = document.getElementById('dictionary-words-container');
            const searchInput = document.getElementById('dict-search-input');
            if (!container || !searchInput) return;

            container.innerHTML = '';
            const lectureNum = this.state.selectedLectureForView;
            if (lectureNum === null) return;
            
            const words = await this.loadWordsForLectures([lectureNum]);
            const langKey = this.state.currentLang.toUpperCase();

            const renderWords = (wordList) => {
                container.innerHTML = '';
                wordList.forEach((word, index) => {
                    const item = document.createElement('div');
                    item.className = 'dict-item';
                    item.innerHTML = `<b>${index + 1}.</b> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[langKey] || word.UA}</span>`;
                    container.appendChild(item);
                });
            };

            renderWords(words);

            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredWords = words.filter(word => 
                    word.CZ.toLowerCase().includes(searchTerm) || 
                    (word[langKey] || word.UA).toLowerCase().includes(searchTerm)
                );
                renderWords(filteredWords);
            });
        },

        async startTraining() {
            let wordsToTrain = [];
            const { mode, selectedLectures } = this.state.currentTraining;
            let lectureIds = [];

            if (mode === 'random') {
                lectureIds = ['random'];
            } else if (mode === 'specific_selected') {
                lectureIds = selectedLectures;
            }
            
            wordsToTrain = await this.loadWordsForLectures(lectureIds);

            if (wordsToTrain.length === 0) {
                alert("Для цього режиму немає слів.");
                return;
            }

            wordsToTrain.sort(() => Math.random() - 0.5);
            this.state.currentTraining.words = wordsToTrain;
            this.state.currentTraining.index = 0;
            this.state.currentTraining.results = [];
            this.navigateTo('training-screen');
        },
        
        renderCurrentWord() {
            const screen = document.getElementById('training-screen-active');
            if (!screen) return;
            if (this.state.currentTraining.index >= this.state.currentTraining.words.length) {
                this.navigateTo('results-screen'); 
                return;
            }

            this.state.isCheckingAnswer = false;

            const T = this.state.texts[this.state.currentLang];
            const { index, words, direction } = this.state.currentTraining;
            const wordData = words[index];
            screen.querySelector('.training-progress').textContent = `${T.word} ${index + 1} ${T.of} ${words.length}`;
            const langKey = this.state.currentLang.toUpperCase();
            
            const questionWordRaw = direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA);
            const questionWord = questionWordRaw.replace(/\s*\(.*?\)\s*/g, '').trim();
            screen.querySelector('.training-word').textContent = questionWord;

            const inputEl = screen.querySelector('.training-input');
            inputEl.value = ''; 
            inputEl.disabled = false; 
            inputEl.focus();
            screen.querySelector('.training-feedback').innerHTML = '';
        },

        async checkAnswer() {
            if (this.state.isCheckingAnswer) return;
            this.state.isCheckingAnswer = true;

            const screen = document.getElementById('training-screen-active');
            const { index, words, direction, results } = this.state.currentTraining;
            const wordData = words[index];
            const inputEl = screen.querySelector('.training-input');
            const feedbackEl = screen.querySelector('.training-feedback');
            const T = this.state.texts[this.state.currentLang];
            const langKey = this.state.currentLang.toUpperCase();
            const userAnswer = inputEl.value.trim();
            if (userAnswer === '') {
                alert(T.field_cannot_be_empty);
                this.state.isCheckingAnswer = false;
                return;
            }
            
            const correctAnswersRawWithParen = direction === 'cz_to_lang' ? (wordData[langKey] || wordData.UA) : wordData.CZ;
            const correctAnswersRaw = correctAnswersRawWithParen.replace(/\s*\(.*?\)\s*/g, '');
            const correctAnswers = correctAnswersRaw.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(s => s);
            const isCorrect = correctAnswers.includes(userAnswer.toLowerCase());
            
            let xp_earned = 0;
            if (isCorrect) {
                xp_earned = direction === 'lang_to_cz' ? 12 : 5;
                feedbackEl.innerHTML = `<span class="xp-gain">${T.correct} +${xp_earned} XP</span>`;
                const response = await fetch('/api/update_xp', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ xp: xp_earned })
                });
                if(response.ok) {
                    const data = await response.json();
                    this.state.currentUser.xp = data.new_xp;
                }
            } else {
                feedbackEl.innerHTML = `${T.mistake} <br> <span style="opacity: 0.7">${T.correct_is} ${correctAnswers[0]}</span>`;
            }
            
            results.push({
                question: (direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA)).replace(/\s*\(.*?\)\s*/g, '').trim(),
                userAnswer, isCorrect, correctAnswer: correctAnswers[0], xp_earned
            });
            
            feedbackEl.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';
            inputEl.disabled = true;

            setTimeout(() => {
                this.state.currentTraining.index++;
                this.renderCurrentWord();
            }, isCorrect ? 1200 : 2000);
        },
        
        renderResults() {
            const summaryEl = document.getElementById('results-summary');
            const listEl = document.getElementById('results-list');
            if (!summaryEl || !listEl) return;

            const { results } = this.state.currentTraining;
            if (!results || results.length === 0) {
                 summaryEl.innerHTML = "Ви не відповіли на жодне слово.";
                 listEl.innerHTML = '';
                 return;
            }
            
            const correctCount = results.filter(r => r.isCorrect).length;
            const totalXpEarned = results.reduce((sum, res) => sum + (res.xp_earned || 0), 0);

            summaryEl.innerHTML = `Ваш результат: <b>${correctCount} з ${results.length}</b> (+${totalXpEarned} XP)`;
            listEl.innerHTML = '';
            results.forEach((res, index) => {
                const item = document.createElement('div');
                item.className = `result-item ${res.isCorrect ? 'correct' : 'incorrect'}`;
                const answerHTML = res.isCorrect ? `<span class="diff-correct">${res.userAnswer}</span>` : this.generateDiffHtml(res.correctAnswer, res.userAnswer);
                item.innerHTML = `<b>${index + 1}.</b> ${res.question} - ${answerHTML} <span>(+${res.xp_earned || 0} XP)</span>`;
                listEl.appendChild(item);
            });
            
            this.loadInitialData();
        },
        
        generateDiffHtml(correct, user) {
            if (!user) return `<span class="diff-incorrect">(пусто)</span> -> <span class="diff-correct">${correct}</span>`;
            let html = '';
            const userLower = user.toLowerCase();
            const correctLower = correct.toLowerCase();
            for (let i = 0; i < Math.max(user.length, correct.length); i++) {
                if (userLower[i] === correctLower[i]) {
                    html += `<span class="diff-correct">${user[i] || ''}</span>`;
                } else {
                    html += `<span class="diff-incorrect">${user[i] || ''}</span>`;
                }
            }
            return html;
        },
        
        renderKeyboard() {
            const CZECH_LOWER = ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'];
            const CZECH_UPPER = ['Á', 'Č', 'Ď', 'É', 'Ě', 'Í', 'Ň', 'Ó', 'Ř', 'Š', 'Ť', 'Ú', 'Ů', 'Ý', 'Ž'];
            const chars = this.state.isShiftActive ? CZECH_UPPER : CZECH_LOWER;
            const keyboardContainer = document.getElementById('special-chars-keyboard');
            if (!keyboardContainer) return;
            
            let html = '<div class="keyboard-row">';
            chars.forEach((char, index) => {
                html += `<button type="button" class="char-btn glow-on-hover">${char}</button>`;
                if (index === 7) {
                    html += '</div><div class="keyboard-row">';
                }
            });
            html += '</div>';
            html += '<div class="keyboard-row"><button type="button" class="shift-btn glow-on-hover">Shift</button></div>';
            keyboardContainer.innerHTML = html;
        },

        toggleShift() {
            this.state.isShiftActive = !this.state.isShiftActive;
            this.renderKeyboard();
        },

        insertChar(char) {
            const inputEl = document.querySelector('.training-input');
            if (inputEl) {
                const start = inputEl.selectionStart;
                const end = inputEl.selectionEnd;
                inputEl.value = inputEl.value.substring(0, start) + char + inputEl.value.substring(end);
                inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                inputEl.focus();
            }
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
        },

        playMusic(eggName) {
            const newPlayer = this.elements.audio[eggName];
            if (!newPlayer) return;

            if (this.state.currentMusicPlayer === newPlayer && this.state.isMusicPlaying) {
                this.stopAllMusic();
                return;
            }

            this.stopAllMusic();

            this.state.currentMusicPlayer = newPlayer;
            this.state.currentMusicPlayer.volume = this.elements.volumeSlider.value;
            this.state.currentMusicPlayer.play();
            this.state.isMusicPlaying = true;
            this.state.currentParticleType = eggName;

            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                musicBtn.classList.add('playing');
            }
            
            this.elements.volumeSlider.classList.add('visible');

            this.startParticleRain(eggName);
            
            if (!this.state.currentUser.found_easter_eggs.includes(eggName)) {
                this.state.currentUser.found_easter_eggs.push(eggName);
                this.updateEasterEggIcon(eggName);
                this.saveFoundEasterEggs();
            }
        },

        stopAllMusic() {
            if (!this.state.isMusicPlaying && !this.state.isRaining) return;

            for (const key in this.elements.audio) {
                this.elements.audio[key].pause();
                this.elements.audio[key].currentTime = 0;
            }

            this.state.isMusicPlaying = false;
            this.state.currentMusicPlayer = null;
            
            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                musicBtn.classList.remove('playing');
            }
            
            this.elements.volumeSlider.classList.remove('visible');
            this.stopParticleRain();
        },
        
        async saveFoundEasterEggs() {
            await fetch('/api/settings/save_easter_eggs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eggs: this.state.currentUser.found_easter_eggs })
            });
        },
        
        updateEasterEggIcon(eggName) {
            document.querySelectorAll(`.easter-egg-icon[data-egg="${eggName}"]`).forEach(icon => {
                icon.classList.add('found');
            });
            document.querySelectorAll(`[data-egg="${eggName}"]`).forEach(icon => {
                icon.classList.add('found');
            });
        },

        setVolume(volume) {
            if (this.state.currentMusicPlayer) {
                this.state.currentMusicPlayer.volume = volume;
            }
        },

        startParticleRain(particleName) {
            if (this.state.isRaining) this.stopParticleRain();
            this.state.isRaining = true;
            this.state.lastParticleTimestamp = 0;
            this.state.currentParticleType = particleName;
            this.state.animationFrameId = requestAnimationFrame(this.particleRainLoop.bind(this));
        },
        
        particleRainLoop(timestamp) {
            if (!this.state.isRaining) return;

            const PARTICLE_INTERVAL = 120;
            if (timestamp - this.state.lastParticleTimestamp > PARTICLE_INTERVAL) {
                this.state.lastParticleTimestamp = timestamp;
                
                const particle = document.createElement('div');
                particle.classList.add('falling-particle');
                particle.style.backgroundImage = `url('/static/${this.state.currentParticleType}.png')`;
                
                const size = Math.random() * 10 + 10;
                const duration = Math.random() * 5 + 7;
                
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.left = `${Math.random() * 100}vw`;
                particle.style.animationDuration = `${duration}s`;
                particle.style.opacity = Math.random() * 0.4 + 0.4;
                
                this.elements.particleRainContainer.appendChild(particle);

                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }
            
            this.state.animationFrameId = requestAnimationFrame(this.particleRainLoop.bind(this));
        },

        stopParticleRain() {
            this.state.isRaining = false;
            this.state.currentParticleType = null;
            if (this.state.animationFrameId) {
                cancelAnimationFrame(this.state.animationFrameId);
                this.state.animationFrameId = null;
            }
            
            this.elements.particleRainContainer.querySelectorAll('.falling-particle').forEach(el => {
                el.style.transition = 'opacity 0.5s ease-out';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 500);
            });
        }
    };

    app.init();
});