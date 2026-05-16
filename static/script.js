document.addEventListener('DOMContentLoaded', () => {
    const EASTER_EGG_ORDER = ["emerald", "gold", "lazurit", "redstone", "diamond", "macan"];
    const TOTAL_EASTER_EGGS = EASTER_EGG_ORDER.length;
    // Updated Rank Thresholds
    const RANKS = { 1: "🥉", 5: "🥈", 12: "🥇", 20: "🏆", 30: "💎" };
    const NAMES = { 1: "Nováček", 5: "Učedník", 12: "Znalec", 20: "Mistr", 30: "Polyglot" };


    const app = {
        state: {
            currentUser: null,
            viewingUser: null,
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

            globalSearchAbortController: null,
            globalSearchTimeout: null,

            isTransitioning: false,
            screenHistory: [], // ДОДАНО ДЛЯ СТРІЛКИ НАЗАД

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

            audio: {
                emerald: document.getElementById('music-emerald'),
                diamond: document.getElementById('music-diamond'),
                gold: document.getElementById('music-gold'),
                lazurit: document.getElementById('music-lazurit'),
                redstone: document.getElementById('music-redstone'),
                macan: document.getElementById('music-macan'),
            }
        },

        init() {
            this.initTheme();
            this.loadVolume();
            this.addEventListeners();
            this.checkSession();
        },

        addEventListeners() {
            document.body.addEventListener('click', (e) => {
                if (this.state.isTransitioning) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const target = e.target.closest('#global-back-btn, [data-screen], [data-action], [data-lang], [data-egg], .char-btn, .shift-btn, .leaderboard-item, .macan-egg-item');

                if (!target) {
                    if (!this.elements.langSwitcher.contains(e.target)) {
                        this.elements.langOptions.classList.remove('visible');
                    }
                    return;
                }

                if (target.id === 'global-back-btn') {
                    if (this.state.screenHistory.length > 0) {
                        const prevScreen = this.state.screenHistory.pop();
                        this.navigateTo(prevScreen, true);
                    }
                    return;
                }

                const dataset = target.dataset;

                if (target === this.elements.profileButton && target.disabled) {
                   return;
                }

                if (target.matches('.leaderboard-item') && target.classList.contains('current-user')) {
                    if (!document.getElementById('leaderboard-screen-active')) {
                       return;
                    }
                }

                if (dataset.screen) this.navigateTo(dataset.screen);
                else if (dataset.action) this.handleAction(dataset.action, dataset);
                else if (dataset.lang) {
                    this.setLanguage(dataset.lang);
                    this.elements.langOptions.classList.remove('visible');
                }
                else if (dataset.egg) {
                    e.stopPropagation();
                    const isProfileIcon = target.closest('#easter-egg-icons');
                    const isFound = target.classList.contains('found');

                    const isViewingOtherProfile = document.getElementById('view-profile-screen-active');
                    if (isViewingOtherProfile && isProfileIcon) {
                        return;
                    }

                    if (isProfileIcon && !isFound) {
                        return;
                    }
                    this.playMusic(dataset.egg);
                }
                else if (target.matches('.char-btn')) this.insertChar(target.textContent);
                else if (target.matches('.shift-btn')) this.toggleShift();
                else if (target.matches('.leaderboard-item') && target.dataset.username) {
                   this.handleViewUserProfile(target.dataset.username);
                }
            });

            document.body.addEventListener('input', (e) => {
                const target = e.target;
                 if (target.id === 'volume-slider-settings') {
                    this.setVolume(target.value);
                    this.saveVolume(target.value);
                 }
                 else if (target.id === 'global-search-input') {
                     clearTimeout(this.state.globalSearchTimeout);
                     const searchTerm = target.value.trim();

                     if (searchTerm.length > 0) {
                         this.hideLectureButtons();
                         this.state.globalSearchTimeout = setTimeout(() => {
                            this.handleGlobalSearch(searchTerm);
                         }, 300);
                     } else {
                         this.showLectureButtons();
                         this.renderSearchResults([]);
                     }
                 }
                 else if (target.id === 'dict-search-input') {
                     const searchTerm = target.value.trim();
                     this.filterDictionaryView(searchTerm);
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
            document.documentElement.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
            if (this.elements.themeToggle) {
                this.elements.themeToggle.checked = false;
            }
            this.updateMusicButtonForTheme(false);
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

        navigateTo(screenId, isBack = false) {
            if (this.state.isTransitioning) {
                 return;
            }
            this.state.isTransitioning = true;

            const oldScreen = this.elements.appContainer.querySelector('.screen');
            const currentScreenId = oldScreen ? oldScreen.id.replace('-active', '') : null;

            // Логіка для глобальної стрілочки "Назад"
            const noHistoryScreens = ['welcome-screen', 'login-screen', 'register-screen', 'main-menu-screen'];
            if (!isBack && currentScreenId && !noHistoryScreens.includes(currentScreenId)) {
                this.state.screenHistory.push(currentScreenId);
            }
            if (noHistoryScreens.includes(screenId)) {
                this.state.screenHistory = []; // Очищуємо історію, якщо ми в головному меню
            }

            const globalBackBtn = document.getElementById('global-back-btn');
            if (globalBackBtn) {
                if (noHistoryScreens.includes(screenId) || this.state.screenHistory.length === 0) {
                    globalBackBtn.style.display = 'none';
                } else {
                    globalBackBtn.style.display = 'block';
                }
            }

            if (this.elements.profileButton) {
                this.elements.profileButton.disabled = (screenId === 'profile-screen' || screenId === 'view-profile-screen');
            }
            if (screenId !== 'view-profile-screen') {
                this.state.viewingUser = null;
            }

            if (document.getElementById('lecture-selection-screen-active') && screenId !== 'lecture-selection-screen') {
                this.showLectureButtons();
                const searchInput = document.getElementById('global-search-input');
                if(searchInput) searchInput.value = '';
                this.renderSearchResults([]);
            }

            let oldScreenRemoved = false;
            let newScreenEntered = false;

            const checkTransitionDone = () => {
                if (oldScreenRemoved && newScreenEntered) {
                    this.state.isTransitioning = false;
                }
            };

            if (oldScreen) {
                oldScreen.classList.remove('entering');
                oldScreen.classList.add('exiting');
                oldScreen.addEventListener('animationend', () => {
                    oldScreen.remove();
                    oldScreenRemoved = true;
                    checkTransitionDone();
                }, { once: true });
            } else {
                oldScreenRemoved = true;
            }

            const template = this.elements.templates.querySelector(`#${screenId}`);
            if (template) {
                const newScreen = document.createElement('div');
                newScreen.className = 'screen entering';
                newScreen.id = `${screenId}-active`;
                newScreen.innerHTML = template.innerHTML;

                newScreen.addEventListener('animationend', (e) => {
                    if (e.animationName === 'fadeIn') {
                        newScreenEntered = true;
                        checkTransitionDone();
                    }
                }, { once: true });

                this.elements.appContainer.appendChild(newScreen);
                this.onScreenLoad(screenId);
            } else {
                newScreenEntered = true;
                checkTransitionDone();
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
                 '#back-to-my-profile-btn': () => this.navigateTo('profile-screen')
            };
            for (const selector in clickActions) {
                 const btn = activeScreen.querySelector(selector);
                 if (btn) btn.addEventListener('click', clickActions[selector]);
            }

            switch (screenId) {
                case 'main-menu-screen':
                    this.updateMusicButtonForTheme(localStorage.getItem('theme') === 'light');
                    const continueBtn = activeScreen.querySelector('[data-action="continue-saved-training"]');
                    if (continueBtn) {
                        continueBtn.style.display = (this.state.currentUser && this.state.currentUser.saved_session) ? 'block' : 'none';
                    }
                    break;
                case 'profile-screen':
                    this.renderProfile(this.state.currentUser);
                    this.renderAvatarUI(this.state.currentUser, false);
                    this.renderEasterEggs(this.state.currentUser);
                    break;
                case 'settings-screen':
                    this.renderGenderSlider();
                    this.renderVolumeSlider();
                    break;
                case 'lecture-selection-screen':
                    this.renderLectureSelection();
                    this.showLectureButtons();
                    const searchInput = activeScreen.querySelector('#global-search-input');
                    if (searchInput && searchInput.value.length > 0) {
                        this.hideLectureButtons();
                        this.handleGlobalSearch(searchInput.value);
                    } else {
                        this.renderSearchResults([]);
                    }
                    break;
                case 'dictionary-view-screen':
                    this.renderDictionary();
                    if (this.state.selectedLectureForView === '0') {
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
                 case 'view-profile-screen':
                     if (this.state.viewingUser) {
                         this.renderProfile(this.state.viewingUser, true);
                         this.renderAvatarUI(this.state.viewingUser, true);
                         this.renderEasterEggs(this.state.viewingUser);
                     } else {
                         this.navigateTo('main-menu-screen');
                     }
                    break;
                 case 'macan-easter-egg-screen':
                    break;
                 case 'leaderboard-screen':
                    this.renderLeaderboardStandalone();
                    break;

            }
        },

        hideLectureButtons() {
            const container = document.getElementById('lecture-buttons-container');
            const actions = document.getElementById('lecture-actions-container');
            const resultsContainer = document.getElementById('global-search-results');
            if (container) container.style.display = 'none';
            if (actions) actions.style.display = 'none';
            if (resultsContainer) resultsContainer.style.display = 'flex';
        },

        showLectureButtons() {
            const container = document.getElementById('lecture-buttons-container');
            const actions = document.getElementById('lecture-actions-container');
            const resultsContainer = document.getElementById('global-search-results');
            if (container) container.style.display = 'grid';
            if (actions) actions.style.display = 'block';
            if (resultsContainer) resultsContainer.style.display = 'none';
        },

        async handleGlobalSearch(searchTerm) {
            if (this.state.globalSearchAbortController) {
                this.state.globalSearchAbortController.abort();
            }
            this.state.globalSearchAbortController = new AbortController();

            try {
                const response = await fetch('/api/global_search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ term: searchTerm }),
                    signal: this.state.globalSearchAbortController.signal
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const results = await response.json();
                this.renderSearchResults(results);
            } catch (error) {
                 if (error.name === 'AbortError') {
                     console.log('Search request aborted');
                 } else {
                     console.error("Помилка глобального пошуку:", error);
                     this.renderSearchResults([]);
                 }
            } finally {
                 this.state.globalSearchAbortController = null;
            }
        },

        renderSearchResults(results) {
            const container = document.getElementById('global-search-results');
            if (!container) return;
            container.innerHTML = '';

            if (results.length === 0) {
                 return;
            }

            const langKey = this.state.currentLang.toUpperCase();
            results.forEach((word, index) => {
                const item = document.createElement('div');
                item.className = 'dict-item';
                
                let lectureLabel = '';
                if (word.lecture === '0') {
                    lectureLabel = this.state.texts[this.state.currentLang]?.notebook_lecture || 'Записник';
                } else {
                    // Форматування для пошуку: якщо A1.1 -> (A1) L1, якщо 1 -> L1
                    const match = word.lecture.match(/^([A-Z0-9]+)\.(\d+)$/);
                    if (match) {
                         lectureLabel = `(${match[1]}) L${match[2]}`;
                    } else {
                         lectureLabel = `L${word.lecture}`;
                    }
                }
                
                item.innerHTML = `<span class="search-result-lecture">[${lectureLabel}]</span> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[langKey] || word.UA}</span>`;
                container.appendChild(item);
            });
        },

        displayMacanEasterEgg() {
        },

        hideMacanEasterEgg() {
        },

        filterDictionaryView(searchTerm) {
            const container = document.getElementById('dictionary-words-container');
            if (!container) return;

            const lectureId = this.state.selectedLectureForView;
            if (lectureId === null) return;

            const words = this.state.loadedWords[lectureId] || [];
            const langKey = this.state.currentLang.toUpperCase();
            const term = searchTerm.toLowerCase();

            const filteredWords = words.filter(word => {
                if (word.is_macan_easter_egg && lectureId === '0') return true;
                if (word.is_macan_easter_egg && lectureId !== '0') return false;
                return word.CZ.toLowerCase().includes(term) ||
                       (word[langKey] || word.UA).toLowerCase().includes(term);
            });

            container.innerHTML = '';
            const regularWordsInLecture = words.filter(w => !w.is_macan_easter_egg);
            const macanWord = words.find(w => w.is_macan_easter_egg);

            filteredWords.forEach((word) => {
                const item = document.createElement('div');
                item.className = 'dict-item';

                if (word.is_macan_easter_egg) {
                    item.classList.add('macan-egg-item');
                    item.dataset.action = 'activate-macan-egg';

                    const macanPosition = Math.min(49, regularWordsInLecture.length);
                    const translationString = `${macanWord.UA}, ${macanWord.RU}, ${macanWord.EN}`;
                    item.innerHTML = `<b>${macanPosition + 1}.</b> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${translationString}</span>`;
                } else {
                    const displayIndex = regularWordsInLecture.indexOf(word);
                    item.innerHTML = `<b>${displayIndex + 1}.</b> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[langKey] || word.UA}</span>`;
                }
                container.appendChild(item);
            });
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
                    const lectureNum = ds.lecture; 
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
                'finish-training': () => {
                    this.clearTrainingProgress(); // ТЕПЕР ПРОЦЕС ПОВНІСТЮ ОЧИЩУЄТЬСЯ ПРИ ЗАВЕРШЕННІ
                    this.navigateTo('results-screen');
                },
                'save-and-exit': () => this.saveTrainingProgress(),
                'continue-saved-training': () => {
                    if (this.state.currentUser && this.state.currentUser.saved_session) {
                        try {
                            this.state.currentTraining = JSON.parse(this.state.currentUser.saved_session);
                            this.navigateTo('training-screen');
                        } catch(e) {
                            console.error("Помилка відновлення сесії", e);
                        }
                    }
                },
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
                'activate-macan-egg': () => {
                    this.navigateTo('macan-easter-egg-screen');
                },
                'activate-macan-music': () => {
                    this.playMusic('macan');
                },
            };
            if (actions[action]) actions[action](dataset);
        },

        async handleViewUserProfile(username) {
            try {
                const response = await fetch(`/api/user/${username}`);
                if (response.ok) {
                    const userData = await response.json();
                    userData.found_easter_eggs = JSON.parse(userData.found_easter_eggs || '[]');
                    this.state.viewingUser = userData;
                    this.navigateTo('view-profile-screen');
                } else {
                    console.error('Failed to load user profile:', await response.text());
                    alert('Не вдалося завантажити профіль користувача.');
                }
            } catch (e) {
                console.error('Error fetching user profile:', e);
                alert('Помилка при завантаженні профілю.');
            }
        },

        setLanguage(lang) {
            this.state.currentLang = lang;
            const flagClasses = { ua: 'flag-ua', en: 'flag-us', ru: 'flag-ru' };
            this.elements.currentLangBtn.className = `flag-icon ${flagClasses[lang]}`;
            this.updateAllTexts();
            if (document.getElementById('settings-screen-active')) {
                this.renderGenderSlider();
                this.renderVolumeSlider();
            }
            const dictInput = document.getElementById('dict-search-input');
            if (document.getElementById('dictionary-view-screen-active') && dictInput) {
                 this.filterDictionaryView(dictInput.value);
            }
             if (document.getElementById('leaderboard-screen-active')) {
                  this.renderLeaderboardStandalone();
             }
        },

        updateAllTexts() {
            if (!this.state.texts || Object.keys(this.state.texts).length === 0) return;
            const texts = this.state.texts[this.state.currentLang];
            if (!texts) return;

            document.querySelectorAll('[data-i18n]').forEach(el => { if (texts[el.dataset.i18n]) el.textContent = texts[el.dataset.i18n]; });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { if (texts[el.dataset.i18nPlaceholder]) el.placeholder = texts[el.dataset.i18nPlaceholder]; });
            document.querySelectorAll('[data-lecture-title]').forEach(el => {
                const lectureId = el.dataset.lectureTitle;
                if (lectureId === '0') {
                    el.textContent = texts.notebook_lecture || 'Мій записник';
                } else {
                    // Нова логіка парсингу назви лекції
                    // Перевіряємо формат A1.1 (ЛітериЦифри.Цифри)
                    const match = lectureId.match(/^([A-Z0-9]+)\.(\d+)$/);
                    if (match) {
                        const level = match[1];
                        const num = match[2];
                        // Формуємо рядок: (A1) Лекція 1
                        el.textContent = `(${level}) ${texts.lecture || 'Лекція'} ${num}`;
                    } else {
                        // Стандартний формат для сумісності або якщо ім'я просте "1"
                        el.textContent = `${texts.lecture || 'Лекція'} ${lectureId}`;
                    }
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
            } catch (e) {
                console.error("Error checking session:", e);
                this.state.currentUser = null;
            }
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

        async loadWordsForLectures(lectureIds, excludeMacan = false) {
            // Фільтруємо 'random', але НЕ парсимо інші ID в int, бо вони можуть бути "A1.1"
            const filteredLectureIds = lectureIds.filter(id => id !== 'random');
            const hasRandom = lectureIds.includes('random');

            const lecturesToFetch = filteredLectureIds.filter(id => !this.state.loadedWords[id]);
            const fetchRandom = hasRandom && !this.state.loadedWords['random'];

            if (lecturesToFetch.length > 0 || fetchRandom) {
                const requestBody = { lectures: fetchRandom ? ['random'] : lecturesToFetch };
                try {
                     const response = await fetch('/api/get_words', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify(requestBody)
                     });
                     if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                     const words = await response.json();

                     if (fetchRandom) {
                         this.state.loadedWords['random'] = words;
                     } else {
                         lecturesToFetch.forEach(id => {
                             this.state.loadedWords[id] = words.filter(w => w.lecture === id);
                         });
                     }
                } catch (error) {
                     console.error("Помилка завантаження слів:", error);
                     return [];
                }
            }

            let allWords = [];
            if (hasRandom) {
                allWords = [...(this.state.loadedWords['random'] || [])];
            } else {
                filteredLectureIds.forEach(id => {
                    allWords.push(...(this.state.loadedWords[id] || []));
                });
            }

            if (excludeMacan) {
                allWords = allWords.filter(word => !word.is_macan_easter_egg);
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
            const currentScreenId = this.elements.appContainer.querySelector('.screen')?.id;
             if (this.elements.profileButton) {
                 this.elements.profileButton.disabled = (currentScreenId === 'profile-screen-active' || currentScreenId === 'view-profile-screen-active');
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

        renderProfile(userData, isViewing = false) {
             const screen = document.getElementById(isViewing ? 'view-profile-screen-active' : 'profile-screen-active');
             if (!screen) return;
             const detailsContainer = screen.querySelector(isViewing ? '#profile-details-view' : '#profile-details');

             if (!detailsContainer || !userData) return;

             const xp = userData.xp;
             const { level, progress, needed } = this.xpToLevel(xp);
             const { emoji, name } = this.getRank(level);
             const T = this.state.texts[this.state.currentLang];

             detailsContainer.innerHTML = `<div class="username">${userData.username}</div>
                 <div class="rank"><span class="emoji">${emoji}</span> ${name}</div>
                 <div class="level-info">${T.level} ${level}</div>
                 <div class="xp-bar"><div class="xp-bar-fill" style="width: ${(progress / needed) * 100}%;"></div></div>
                 <div>${progress} / ${needed} XP</div>`;
        },

        renderLeaderboardStandalone() {
            const leaderboardContainer = document.getElementById('leaderboard-container-standalone');
            if (!leaderboardContainer) return;

            leaderboardContainer.innerHTML = '';

            if (!this.state.leaderboard || this.state.leaderboard.length === 0) {
                 leaderboardContainer.innerHTML = '<p>Рейтинг порожній.</p>';
                 return;
            }

            (this.state.leaderboard || []).forEach((user, index) => {
                 const userLevel = this.xpToLevel(user.xp).level;
                 const userRank = this.getRank(userLevel);
                 const item = document.createElement('div');
                 item.className = 'leaderboard-item';
                 item.dataset.username = user.username;

                 let userEggs = [];
                 try {
                     userEggs = JSON.parse(user.found_easter_eggs || '[]');
                 } catch (e) { console.error("Error parsing easter eggs for leaderboard user", user.username, e); }
                 const hasAllEggs = userEggs.length >= TOTAL_EASTER_EGGS;
                 const crown = hasAllEggs ? '<span class="crown-icon">👑</span>' : '';

                 if (this.state.currentUser && user.username === this.state.currentUser.username) {
                      item.classList.add('current-user');
                 }

                 item.innerHTML = `<span class="lb-pos">${index + 1}.</span>
                     <span class="lb-rank">${userRank.emoji}</span>
                     <span class="lb-name">${user.username}${crown}</span>
                     <span class="lb-xp">(${user.xp} XP)</span>`;
                 leaderboardContainer.appendChild(item);
            });
        },


        renderEasterEggs(userData) {
             const screen = document.getElementById(this.state.viewingUser ? 'view-profile-screen-active' : 'profile-screen-active');
             if (!screen) return;
             const container = screen.querySelector('#easter-egg-icons');
             if (!container || !userData) return;

             const foundEggs = userData.found_easter_eggs || [];
             container.querySelectorAll('.easter-egg-icon').forEach(icon => {
                  icon.classList.toggle('found', foundEggs.includes(icon.dataset.egg));
             });
        },


        renderAvatarUI(userData, isReadonly = false) {
             const screen = document.getElementById(isReadonly ? 'view-profile-screen-active' : 'profile-screen-active');
             if (!screen) return;
             const wrapper = screen.querySelector(isReadonly ? '#avatar-image-wrapper-view' : '#avatar-image-wrapper');
             const controls = screen.querySelector(isReadonly ? '#avatar-controls-view' : '#avatar-controls');
             const nameEl = screen.querySelector(isReadonly ? '#avatar-name-view' : '#avatar-name');

             if (!wrapper || !userData) return;

             const T = this.state.texts[this.state.currentLang];
             const { gender, avatar } = userData;

             if (controls) {
                  controls.style.display = isReadonly ? 'none' : 'flex';
             }
             if (nameEl) {
                 nameEl.style.display = isReadonly ? 'none' : 'block';
             }

             if (gender === 'N' || !gender || !avatar) {
                 wrapper.innerHTML = `<span>${T.avatar_unavailable}</span>`;
                 if (controls) controls.classList.add('hidden');
                 if (nameEl) nameEl.textContent = '';
                 return;
             }

             const avatarList = this.state.avatars[gender] || [];
             if (avatarList.length === 0 || !avatarList.includes(avatar)) {
                 wrapper.innerHTML = `<span>${T.avatar_unavailable}</span>`;
                 if (controls) controls.classList.add('hidden');
                 if (nameEl) nameEl.textContent = '';
                 return;
             }

             if (controls) controls.classList.remove('hidden');

             if (!isReadonly && this.state.currentUser && userData.username === this.state.currentUser.username) {
                 this.state.currentAvatarIndex = avatarList.indexOf(avatar);
             }

             wrapper.innerHTML = `<img src="/avatars/${avatar}" alt="Avatar">`;
             if (nameEl && !isReadonly) nameEl.textContent = avatar.replace(`${gender}_`, '').replace('.png', '').replace('.jpg', '');
        },


        async handleAvatarChange(direction) {
            if (this.state.viewingUser) return;

            const { gender } = this.state.currentUser;
            const avatarList = this.state.avatars[gender];
            if (!avatarList || avatarList.length === 0) return;

            let newIndex = this.state.currentAvatarIndex + direction;
            if (newIndex < 0) newIndex = avatarList.length - 1;
            if (newIndex >= avatarList.length) newIndex = 0;

            const newAvatar = avatarList[newIndex];
            this.state.currentAvatarIndex = newIndex;
            this.state.currentUser.avatar = newAvatar;

            this.renderAvatarUI(this.state.currentUser, false);

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

         renderVolumeSlider() {
             const container = document.getElementById('volume-slider-container');
             if (!container) return;

             container.style.display = 'block';

             const savedVolume = parseFloat(localStorage.getItem('volumeLevel') || '1');

             container.innerHTML = `
                 <input type="range" id="volume-slider-settings" min="0" max="1" step="0.01" value="${savedVolume}">
             `;
             this.setVolume(savedVolume);
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
                this.renderAvatarUI(this.state.currentUser, false);
            }
        },

        renderLazuritEasterEgg() {
            const container = document.getElementById('lazurit-easter-egg-container');
            if (!container) return;
            container.innerHTML = '';

            const T = this.state.texts[this.state.currentLang];
            const found = this.state.currentUser && this.state.currentUser.found_easter_eggs.includes('lazurit');

            const eggEl = document.createElement('div');
            eggEl.id = 'lazurit-easter-egg';
            eggEl.dataset.egg = 'lazurit';
            if (found) eggEl.classList.add('found');

            container.appendChild(eggEl);
        },


        renderLectureSelection() {
            const container = document.getElementById('lecture-buttons-container');
            const actionsContainer = document.getElementById('lecture-actions-container');
            if (!container || !actionsContainer) return;

            this.state.currentTraining.selectedLectures = [];
            container.innerHTML = '';
            actionsContainer.innerHTML = '';

            this.state.lectures.forEach(lectureNum => {
                const button = document.createElement('button');
                button.className = 'btn btn-lecture';
                button.dataset.action = 'select-lecture';
                button.dataset.lecture = lectureNum;
                button.dataset.lectureTitle = lectureNum;
                container.appendChild(button);
            });

            if (this.state.viewMode === 'training') {
                const startBtn = document.createElement('button');
                startBtn.className = 'btn btn-start-training';
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
            searchInput.value = '';

            const lectureId = this.state.selectedLectureForView;
            if (lectureId === null) return;

            let words = this.state.loadedWords[lectureId];
            if (!words) {
                words = await this.loadWordsForLectures([lectureId]);
                this.state.loadedWords[lectureId] = words;
            }

            this.filterDictionaryView('');
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

            wordsToTrain = await this.loadWordsForLectures(lectureIds, true);

            if (wordsToTrain.length === 0) {
                alert("Для цього режиму немає слів.");
                this.state.isTransitioning = false;
                return;
            }

            wordsToTrain.sort(() => Math.random() - 0.5);

            this.state.currentTraining.words = wordsToTrain;
            this.state.currentTraining.index = 0;
            this.state.currentTraining.results = [];

            this.navigateTo('training-screen');
        },

        async saveTrainingProgress() {
            const sessionData = this.state.currentTraining;
            try {
                const response = await fetch('/api/training/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_data: sessionData })
                });
                if (response.ok) {
                    if (this.state.currentUser) {
                        this.state.currentUser.saved_session = JSON.stringify(sessionData);
                    }
                    alert(this.state.texts[this.state.currentLang].progress_saved || "Прогрес збережено!");
                    this.navigateTo('main-menu-screen');
                }
            } catch (e) {
                console.error("Помилка збереження", e);
            }
        },

        async clearTrainingProgress() {
            if (!this.state.currentUser || !this.state.currentUser.saved_session) return;
            try {
                await fetch('/api/training/clear', { method: 'POST' });
                this.state.currentUser.saved_session = null;
            } catch (e) {
                console.error("Помилка очищення", e);
            }
        },

        renderCurrentWord() {
            const screen = document.getElementById('training-screen-active');
            if (!screen) return;

            if (this.state.currentTraining.index >= this.state.currentTraining.words.length) {
                this.clearTrainingProgress();
                this.navigateTo('results-screen');
                return;
            }

            this.state.isCheckingAnswer = false;

            const T = this.state.texts[this.state.currentLang];
            const { index, words, direction, results } = this.state.currentTraining;
            const wordData = words[index];

            // Оновлення прогресу та рахунку в реальному часі
            screen.querySelector('.training-progress').textContent = `${T.word} ${index + 1} ${T.of} ${words.length}`;
            
            const correctAnswersCount = results.filter(r => r.isCorrect).length;
            screen.querySelector('.training-score-display').textContent = `${T.correct_score_label} ${correctAnswersCount}/${words.length}`;

            const langKey = this.state.currentLang.toUpperCase();
            const questionWordRaw = direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA);
            const questionWordClean = questionWordRaw.replace(/\s*\(.*?\)\s*/g, '').trim();

            let displayHtml = questionWordClean;

            if (direction === 'lang_to_cz' && questionWordRaw.toLowerCase().includes('(adj.)')) {
                displayHtml += ` <span class="adj-marker">(adj.)</span>`;
            }

            screen.querySelector('.training-word').innerHTML = displayHtml;

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
                     if (this.state.currentUser) {
                          this.state.currentUser.xp = data.new_xp;
                     }
                }
            } else {
                feedbackEl.innerHTML = `${T.mistake} <br> <span style="opacity: 0.7">${T.correct_is} ${correctAnswers[0]}</span>`;
            }

            results.push({
                question: (direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA)).replace(/\s*\(.*?\)\s*/g, '').trim(),
                userAnswer,
                isCorrect,
                correctAnswer: correctAnswers[0],
                xp_earned
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
            html += ` <span style="opacity: 0.7">( ${correct} )</span>`;
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
                html += `<button type="button" class="char-btn btn">${char}</button>`;
                if (index === 7) {
                    html += '</div><div class="keyboard-row">';
                }
            });
            html += '</div>';
            html += `<div class="keyboard-row"><button type="button" class="shift-btn btn btn-secondary">Shift</button></div>`;
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
            let rankEmoji = RANKS[1];
            let rankName = NAMES[1];
            for (const lvl in RANKS) {
                if (level >= parseInt(lvl, 10)) {
                    rankEmoji = RANKS[lvl];
                    rankName = NAMES[lvl];
                } else {
                    break;
                }
            }
            return { emoji: rankEmoji, name: rankName };
        },


         playMusic(eggName) {
            const isViewingOtherProfile = document.getElementById('view-profile-screen-active');
            const clickedElement = event?.target;
             const isProfileEggIcon = clickedElement?.closest('#easter-egg-icons');

            if (isViewingOtherProfile && isProfileEggIcon) {
                return;
            }

            const newPlayer = this.elements.audio[eggName];
            if (!newPlayer) return;

            if (this.state.currentMusicPlayer === newPlayer && this.state.isMusicPlaying) {
                this.stopAllMusic();
                return;
            }

            this.stopAllMusic();

            this.state.currentMusicPlayer = newPlayer;
            const savedVolume = parseFloat(localStorage.getItem('volumeLevel') || '1');
            this.state.currentMusicPlayer.volume = savedVolume;
            this.state.currentMusicPlayer.play();
            this.state.isMusicPlaying = true;
            this.state.currentParticleType = eggName;

            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                const currentEggType = musicBtn.dataset.egg;
                 musicBtn.classList.toggle('playing', eggName === currentEggType);
            }

             if (document.getElementById('settings-screen-active')) {
                 this.renderVolumeSlider();
             }

            this.startParticleRain(eggName);

            if (this.state.currentUser && !this.state.currentUser.found_easter_eggs.includes(eggName)) {
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

             if (document.getElementById('settings-screen-active')) {
                 this.renderVolumeSlider();
             }

            this.stopParticleRain();
        },

        async saveFoundEasterEggs() {
            if (!this.state.currentUser) return;
            try {
                await fetch('/api/settings/save_easter_eggs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eggs: this.state.currentUser.found_easter_eggs })
                });
             } catch (error) {
                 console.error("Помилка збереження пасхалок:", error);
             }
        },


        updateEasterEggIcon(eggName) {
             const currentScreen = document.querySelector('.screen.entering, .screen:not(.exiting)');
             if (currentScreen) {
                 const profileIcon = currentScreen.querySelector(`#easter-egg-icons .easter-egg-icon[data-egg="${eggName}"]`);
                  if (profileIcon) {
                     profileIcon.classList.add('found');
                  }
             }

             const specificIcon = document.querySelector(`[data-egg="${eggName}"]:not(.easter-egg-icon)`);
              if (specificIcon && specificIcon.offsetParent !== null) {
                 specificIcon.classList.add('found');
             }
        },

        setVolume(volume) {
            const vol = parseFloat(volume);
            for (const key in this.elements.audio) {
                this.elements.audio[key].volume = vol;
            }
        },

        saveVolume(volume) {
            localStorage.setItem('volumeLevel', volume);
        },

        loadVolume() {
            const savedVolume = localStorage.getItem('volumeLevel') || '1';
            this.setVolume(savedVolume);
             const settingsSlider = document.getElementById('volume-slider-settings');
             if (settingsSlider) {
                 settingsSlider.value = savedVolume;
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