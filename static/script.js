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
                    console.log("Transition in progress, click blocked."); // Debug log
                    return;
                }

                const target = e.target.closest('[data-screen], [data-action], [data-lang], [data-egg], .char-btn, .shift-btn, .leaderboard-item, .macan-egg-item');

                if (!target) {
                    if (!this.elements.langSwitcher.contains(e.target)) {
                        this.elements.langOptions.classList.remove('visible');
                    }
                    return;
                }

                const dataset = target.dataset;

                if (target === this.elements.profileButton && target.disabled) {
                   return;
                }

                if (target.matches('.leaderboard-item') && target.classList.contains('current-user')) {
                    return;
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
                     // Видалено перевірку на 'macan' тут
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

        navigateTo(screenId) {
            // Перевірка на початку, щоб ігнорувати кліки під час переходу
            if (this.state.isTransitioning) {
                 console.log(`Navigation to ${screenId} blocked: Transition already in progress.`);
                 return;
            }
            this.state.isTransitioning = true;
            console.log(`Starting navigation to ${screenId}. isTransitioning = true.`);

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
                // Ця функція викликається двічі: після зникнення старого екрана і після появи нового.
                // Тільки коли обидві події відбулися, ми розблоковуємо навігацію.
                if (oldScreenRemoved && newScreenEntered) {
                    console.log(`Navigation to ${screenId} finished. isTransitioning = false.`);
                    this.state.isTransitioning = false;
                }
            };

            const oldScreen = this.elements.appContainer.querySelector('.screen');
            if (oldScreen) {
                oldScreen.classList.remove('entering');
                oldScreen.classList.add('exiting');
                oldScreen.addEventListener('animationend', () => {
                    oldScreen.remove();
                    oldScreenRemoved = true;
                    console.log("Old screen removed.");
                    checkTransitionDone();
                }, { once: true });
            } else {
                oldScreenRemoved = true; // Якщо старого екрана не було, вважаємо його "видаленим".
            }

            const template = this.elements.templates.querySelector(`#${screenId}`);
            if (template) {
                const newScreen = document.createElement('div');
                newScreen.className = 'screen entering';
                newScreen.id = `${screenId}-active`;
                newScreen.innerHTML = template.innerHTML;

                newScreen.addEventListener('animationend', (e) => {
                    // Переконуємося, що це саме анімація появи 'fadeIn'
                    if (e.animationName === 'fadeIn') {
                        newScreenEntered = true;
                        console.log("New screen entered.");
                        checkTransitionDone();
                    }
                }, { once: true });

                this.elements.appContainer.appendChild(newScreen);
                this.onScreenLoad(screenId); // Запускаємо логіку для нового екрана
            } else {
                // Якщо шаблон не знайдено, щось пішло не так, але ми маємо розблокувати навігацію.
                console.error(`Template not found for screenId: ${screenId}`);
                newScreenEntered = true; // Вважаємо новий екран "з'явившимся" (хоча його немає)
                checkTransitionDone(); // Розблоковуємо навігацію
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
                 case 'view-profile-screen':
                     if (this.state.viewingUser) {
                         this.renderProfile(this.state.viewingUser, true);
                         this.renderAvatarUI(this.state.viewingUser, true);
                         this.renderEasterEggs(this.state.viewingUser);
                     } else {
                         this.navigateTo('main-menu-screen'); // Якщо немає даних, повертаємося
                     }
                    break;
                 case 'macan-easter-egg-screen':
                    // Можливо, тут потрібно щось додати, якщо екран має динамічний контент
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
                const lectureLabel = word.lecture === 0 ? (this.state.texts[this.state.currentLang]?.notebook_lecture || 'Записник') : `L${word.lecture}`;
                item.innerHTML = `<span class="search-result-lecture">[${lectureLabel}]</span> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${word[langKey] || word.UA}</span>`;
                container.appendChild(item);
            });
        },

        displayMacanEasterEgg() {
           // Ця функція більше не потрібна для показу, використовується лише стилізація
        },

        hideMacanEasterEgg() {
           // Ця функція більше не потрібна для ховання
        },

        filterDictionaryView(searchTerm) {
            const container = document.getElementById('dictionary-words-container');
            if (!container) return;

            const lectureNum = this.state.selectedLectureForView;
            if (lectureNum === null) return;

            const words = this.state.loadedWords[lectureNum] || [];
            const langKey = this.state.currentLang.toUpperCase();
            const term = searchTerm.toLowerCase();

            const filteredWords = words.filter(word => {
                // Завжди показуємо Macan, якщо він є в поточній лекції (lectureNum === 0)
                if (word.is_macan_easter_egg && lectureNum === 0) return true;
                // Не показуємо Macan в інших лекціях
                if (word.is_macan_easter_egg && lectureNum !== 0) return false;
                // Стандартна логіка фільтрації для інших слів
                return word.CZ.toLowerCase().includes(term) ||
                       (word[langKey] || word.UA).toLowerCase().includes(term);
            });

            container.innerHTML = '';
            // Отримуємо список слів *без* Macan для правильної нумерації
            const regularWordsInLecture = words.filter(w => !w.is_macan_easter_egg);
            const macanWord = words.find(w => w.is_macan_easter_egg); // Знаходимо об'єкт Macan

            filteredWords.forEach((word) => {
                const item = document.createElement('div');
                item.className = 'dict-item';

                if (word.is_macan_easter_egg) {
                    item.classList.add('macan-egg-item'); // Додаємо клас для кліку
                    item.dataset.action = 'activate-macan-egg'; // Додаємо data-action для обробника

                    // Розраховуємо позицію Macan (50 або остання)
                    const macanPosition = Math.min(49, regularWordsInLecture.length);

                    // Формуємо рядок як для звичайного слова
                    // Використовуємо UA, RU, EN з об'єкта macanWord
                    const translationString = `${macanWord.UA}, ${macanWord.RU}, ${macanWord.EN}`;
                    item.innerHTML = `<b>${macanPosition + 1}.</b> <span class="cz-word">${word.CZ}</span> — <span class="ua-word">${translationString}</span>`;
                } else {
                    // Рахуємо індекс *тільки* серед звичайних слів
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
                'activate-macan-egg': () => {
                    this.navigateTo('macan-easter-egg-screen');
                    this.playMusic('macan');
                },
            };
            if (actions[action]) actions[action](dataset);
        },

        async handleViewUserProfile(username) {
             // Видаляємо дублююче isTransitioning = true; navigateTo це зробить
            try {
                const response = await fetch(`/api/user/${username}`);
                if (response.ok) {
                    const userData = await response.json();
                    userData.found_easter_eggs = JSON.parse(userData.found_easter_eggs || '[]');
                    this.state.viewingUser = userData;
                    this.navigateTo('view-profile-screen'); // navigateTo сама встановить isTransitioning
                } else {
                    console.error('Failed to load user profile:', await response.text());
                    alert('Не вдалося завантажити профіль користувача.');
                    // Якщо була помилка, треба зняти блокування вручну (бо navigateTo не викликалась)
                    // this.state.isTransitioning = false; // Не потрібно, бо navigateTo не викликалось, прапор не встановлювався
                }
            } catch (e) {
                console.error('Error fetching user profile:', e);
                alert('Помилка при завантаженні профілю.');
                // this.state.isTransitioning = false; // Те саме
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
            // Оновити словник, якщо він відкритий, щоб переклади оновилися
            const dictInput = document.getElementById('dict-search-input');
            if (document.getElementById('dictionary-view-screen-active') && dictInput) {
                 this.filterDictionaryView(dictInput.value);
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
                await this.loadInitialData(); // Завантажуємо базові дані (лекції, рейтинг, тексти)
                const response = await fetch('/api/session'); // Перевіряємо, чи є активна сесія
                const data = await response.json();
                this.state.currentUser = data.user || null;
                if (this.state.currentUser) {
                    // Якщо користувач залогінений, парсимо його знайдені пасхалки
                    this.state.currentUser.found_easter_eggs = JSON.parse(this.state.currentUser.found_easter_eggs || '[]');
                }
            } catch (e) {
                console.error("Error checking session:", e);
                this.state.currentUser = null; // Якщо помилка, вважаємо, що користувач не залогінений
            }
            finally {
                this.updateHeader(); // Оновлюємо шапку (показуємо/ховаємо кнопку профілю)
                // Визначаємо, куди перейти: якщо є користувач - в меню, якщо ні - на екран привітання
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
                this.setLanguage(this.state.currentLang); // Застосовуємо поточну мову до завантажених текстів
            } catch (e) { console.error("Could not load initial data:", e); }
        },

        async loadWordsForLectures(lectureIds, excludeMacan = false) {
            // Перетворюємо ID лекцій на числа, ігноруючи 'random'
            const numericLectureIds = lectureIds.filter(id => id !== 'random').map(id => parseInt(id, 10));
            const hasRandom = lectureIds.includes('random');

            // Визначаємо, які лекції ще не завантажені
            const lecturesToFetch = numericLectureIds.filter(id => !this.state.loadedWords[id]);
            // Перевіряємо, чи треба завантажити 'random' і чи він ще не завантажений
            const fetchRandom = hasRandom && !this.state.loadedWords['random'];

            // Якщо є що завантажувати (конкретні лекції або 'random')
            if (lecturesToFetch.length > 0 || fetchRandom) {
                // Визначаємо, що саме запитувати у сервера
                const requestBody = { lectures: fetchRandom ? ['random'] : lecturesToFetch };
                try {
                     const response = await fetch('/api/get_words', {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify(requestBody)
                     });
                     if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                     const words = await response.json(); // Отримуємо список слів

                     // Зберігаємо завантажені слова у state
                     if (fetchRandom) {
                         this.state.loadedWords['random'] = words; // Всі слова для 'random'
                     } else {
                         // Розподіляємо слова по конкретних лекціях
                         lecturesToFetch.forEach(id => {
                             this.state.loadedWords[id] = words.filter(w => w.lecture === id);
                         });
                     }
                } catch (error) {
                     console.error("Помилка завантаження слів:", error);
                     return []; // Повертаємо пустий масив у разі помилки
                }
            }

            // Збираємо фінальний список слів
            let allWords = [];
            if (hasRandom) {
                // Якщо обрано 'random', беремо всі слова звідти
                allWords = [...(this.state.loadedWords['random'] || [])];
            } else {
                // Інакше, збираємо слова з усіх обраних лекцій
                numericLectureIds.forEach(id => {
                    allWords.push(...(this.state.loadedWords[id] || []));
                });
            }

            // --- Зміна для Завдання №3 ---
            // Виключаємо слово Macan, тільки якщо викликано з excludeMacan = true (з startTraining)
            if (excludeMacan) {
                allWords = allWords.filter(word => !word.is_macan_easter_egg);
            }
            // --- Кінець зміни ---

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
                this.state.currentUser.found_easter_eggs = []; // Новий користувач, пасхалок немає
                this.updateHeader(); this.navigateTo('main-menu-screen');
            } else { alert(`Помилка реєстрації: ${await response.text()}`); }
        },

        async handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            this.stopAllMusic(); // Зупиняємо музику при виході
            this.state.currentUser = null;
            this.state.loadedWords = {}; // Очищуємо кеш слів
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
                this.navigateTo('profile-screen'); // Повертаємося в профіль після зміни
            } else {
                alert('Не вдалося змінити PIN-код.');
            }
        },

        renderProfile(userData, isViewing = false) {
             const screen = document.getElementById(isViewing ? 'view-profile-screen-active' : 'profile-screen-active');
             if (!screen) return;
             const detailsContainer = screen.querySelector(isViewing ? '#profile-details-view' : '#profile-details');
             const leaderboardContainer = screen.querySelector('#leaderboard-container');

             if (!detailsContainer || !userData) return;

             // Якщо переглядаємо чужий профіль, ховаємо рейтинг
             if (isViewing && leaderboardContainer) {
                  leaderboardContainer.closest('.left-panel')?.remove();
             }

             const xp = userData.xp;
             const { level, progress, needed } = this.xpToLevel(xp);
             const { emoji, name } = this.getRank(level);
             const T = this.state.texts[this.state.currentLang];

             // Формуємо HTML для деталей профілю
             detailsContainer.innerHTML = `<div class="username">${userData.username}</div>
                 <div class="rank"><span class="emoji">${emoji}</span> ${name}</div>
                 <div class="level-info">${T.level} ${level}</div>
                 <div class="xp-bar"><div class="xp-bar-fill" style="width: ${(progress / needed) * 100}%;"></div></div>
                 <div>${progress} / ${needed} XP</div>`;

             // Якщо це наш профіль, рендеримо рейтинг
             if (!isViewing && leaderboardContainer && this.state.currentUser) {
                  leaderboardContainer.innerHTML = ''; // Очищуємо попередній рейтинг
                  (this.state.leaderboard || []).forEach((user, index) => {
                       const userLevel = this.xpToLevel(user.xp).level;
                       const userRank = this.getRank(userLevel);
                       const item = document.createElement('div');
                       item.className = 'leaderboard-item';
                       item.dataset.username = user.username; // Зберігаємо ім'я для можливості кліку

                       let userEggs = [];
                       try {
                           // Обережно парсимо пасхалки, бо може бути помилка
                           userEggs = JSON.parse(user.found_easter_eggs || '[]');
                       } catch (e) { console.error("Error parsing easter eggs for leaderboard user", user.username, e); }
                       const hasAllEggs = userEggs.length >= TOTAL_EASTER_EGGS;
                       const crown = hasAllEggs ? '<span class="crown-icon">👑</span>' : ''; // Додаємо корону, якщо всі зібрані

                       // Виділяємо поточного користувача в рейтингу
                       if (user.username === this.state.currentUser.username) {
                            item.classList.add('current-user');
                       }
                       // Формуємо HTML для рядка рейтингу
                       item.innerHTML = `<span class="lb-pos">${index + 1}.</span>
                           <span class="lb-rank">${userRank.emoji}</span>
                           <span class="lb-name">${user.username}${crown}</span>
                           <span class="lb-xp">(${user.xp} XP)</span>`;
                       leaderboardContainer.appendChild(item);
                  });
             }
        },


        renderEasterEggs(userData) {
             const screen = document.getElementById(this.state.viewingUser ? 'view-profile-screen-active' : 'profile-screen-active');
             if (!screen) return;
             const container = screen.querySelector('#easter-egg-icons');
             if (!container || !userData) return;

             const foundEggs = userData.found_easter_eggs || [];
             // Проходимо по всіх іконках і додаємо/видаляємо клас 'found'
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

             // Ховаємо елементи керування та ім'я, якщо переглядаємо чужий профіль
             if (controls) {
                  controls.style.display = isReadonly ? 'none' : 'flex';
             }
             if (nameEl) {
                 nameEl.style.display = isReadonly ? 'none' : 'block';
             }


             // Якщо стать не обрана або аватара немає
             if (gender === 'N' || !gender || !avatar) {
                 wrapper.innerHTML = `<span>${T.avatar_unavailable}</span>`;
                 if (controls) controls.classList.add('hidden');
                 if (nameEl) nameEl.textContent = '';
                 return;
             }

             // Перевіряємо, чи існує такий аватар для обраної статі
             const avatarList = this.state.avatars[gender] || [];
             if (avatarList.length === 0 || !avatarList.includes(avatar)) {
                 wrapper.innerHTML = `<span>${T.avatar_unavailable}</span>`;
                 if (controls) controls.classList.add('hidden');
                 if (nameEl) nameEl.textContent = '';
                 return;
             }

             // Показуємо стрілки, якщо це наш профіль
             if (controls) controls.classList.remove('hidden');

             // Встановлюємо поточний індекс аватара, якщо це наш профіль
             if (!isReadonly && this.state.currentUser && userData.username === this.state.currentUser.username) {
                 this.state.currentAvatarIndex = avatarList.indexOf(avatar);
             }

             // Показуємо зображення аватара та його ім'я
             wrapper.innerHTML = `<img src="/avatars/${avatar}" alt="Avatar">`;
             if (nameEl && !isReadonly) nameEl.textContent = avatar.replace(`${gender}_`, '').replace('.png', '').replace('.jpg', '');
        },


        async handleAvatarChange(direction) {
            if (this.state.viewingUser) return; // Не дозволяємо змінювати чужий аватар

            const { gender } = this.state.currentUser;
            const avatarList = this.state.avatars[gender];
            if (!avatarList || avatarList.length === 0) return; // Немає аватарів для цієї статі

            // Розраховуємо новий індекс з урахуванням "зациклення"
            let newIndex = this.state.currentAvatarIndex + direction;
            if (newIndex < 0) newIndex = avatarList.length - 1;
            if (newIndex >= avatarList.length) newIndex = 0;

            const newAvatar = avatarList[newIndex];
            this.state.currentAvatarIndex = newIndex; // Зберігаємо новий індекс
            this.state.currentUser.avatar = newAvatar; // Оновлюємо аватар у стані

            this.renderAvatarUI(this.state.currentUser, false); // Перемальовуємо UI

            // Зберігаємо новий аватар на сервері
            await fetch('/api/settings/save_avatar', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ avatar: newAvatar })
            });
        },

        renderGenderSlider() {
            const container = document.getElementById('gender-slider-container');
            if (!container) return;
            const T = this.state.texts[this.state.currentLang];

            // Генеруємо HTML для слайдера статі
            container.innerHTML = `
                <span class="gender-label">${T.gender_female}</span>
                <label class="gender-switch">
                    <input type="checkbox" id="gender-slider">
                    <span class="slider-track"></span>
                </label>
                <span class="gender-label">${T.gender_male}</span>
            `;

            // Встановлюємо стан слайдера відповідно до поточної статі користувача
            const slider = container.querySelector('#gender-slider');
            if (this.state.currentUser.gender === 'M') {
                slider.checked = true;
            }
        },

         renderVolumeSlider() {
             const container = document.getElementById('volume-slider-container');
             if (!container) return;

             container.style.display = 'block'; // Робимо видимим

             // Завантажуємо збережену гучність або ставимо 1 (максимум) за замовчуванням
             const savedVolume = parseFloat(localStorage.getItem('volumeLevel') || '1');

             // Генеруємо HTML для слайдера гучності
             container.innerHTML = `
                 <input type="range" id="volume-slider-settings" min="0" max="1" step="0.01" value="${savedVolume}">
             `;
             this.setVolume(savedVolume); // Встановлюємо початкову гучність
         },


        async handleGenderChange(gender) {
            this.state.currentUser.gender = gender;
            this.state.currentAvatarIndex = 0; // Скидаємо індекс аватара

            // Вибираємо перший аватар для нової статі або null, якщо їх немає
            const avatarList = this.state.avatars[gender] || [];
            const newAvatar = avatarList.length > 0 ? avatarList[0] : null;
            this.state.currentUser.avatar = newAvatar;

            // Зберігаємо нову стать та аватар на сервері
            await fetch('/api/settings/save_avatar', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ gender: gender, avatar: newAvatar })
            });

            // Якщо ми зараз на екрані профілю, оновлюємо UI аватара
            if (document.getElementById('profile-screen-active')) {
                this.renderAvatarUI(this.state.currentUser, false);
            }
        },

        renderLazuritEasterEgg() {
            const container = document.getElementById('lazurit-easter-egg-container');
            if (!container) return;
            container.innerHTML = ''; // Очищуємо

            const T = this.state.texts[this.state.currentLang];
            // Перевіряємо, чи знайдена ця пасхалка
            const found = this.state.currentUser && this.state.currentUser.found_easter_eggs.includes('lazurit');

            const eggEl = document.createElement('div');
            eggEl.id = 'lazurit-easter-egg';
            eggEl.dataset.egg = 'lazurit'; // Додаємо атрибут для обробника кліків
            if (found) eggEl.classList.add('found'); // Додаємо клас, якщо знайдено

            container.appendChild(eggEl);
        },


        renderLectureSelection() {
            const container = document.getElementById('lecture-buttons-container');
            const actionsContainer = document.getElementById('lecture-actions-container');
            if (!container || !actionsContainer) return;

            this.state.currentTraining.selectedLectures = []; // Скидаємо вибір
            container.innerHTML = '';
            actionsContainer.innerHTML = '';

            // Створюємо кнопки для кожної доступної лекції
            this.state.lectures.forEach(lectureNum => {
                const button = document.createElement('button');
                button.className = 'btn btn-lecture';
                button.dataset.action = 'select-lecture'; // Для обробки вибору
                button.dataset.lecture = lectureNum;
                button.dataset.lectureTitle = lectureNum; // Для перекладу назви
                container.appendChild(button);
            });

            // Якщо ми в режимі вибору для тренування, додаємо кнопку "Старт"
            if (this.state.viewMode === 'training') {
                const startBtn = document.createElement('button');
                startBtn.className = 'btn btn-start-training';
                startBtn.dataset.action = 'start-selected-lectures-training';
                startBtn.dataset.i18n = 'start_training';
                actionsContainer.appendChild(startBtn);
            }
            this.updateAllTexts(); // Оновлюємо тексти на всіх кнопках
        },


        async renderDictionary() {
            const container = document.getElementById('dictionary-words-container');
            const searchInput = document.getElementById('dict-search-input');
            if (!container || !searchInput) return;

            container.innerHTML = ''; // Очищуємо список
            searchInput.value = ''; // Очищуємо пошук

            const lectureNum = this.state.selectedLectureForView;
            if (lectureNum === null) return; // Якщо лекція не вибрана, нічого не робимо

            // Завантажуємо слова, якщо їх ще немає в кеші
            let words = this.state.loadedWords[lectureNum];
            if (!words) {
                // Викликаємо БЕЗ excludeMacan = true, щоб Macan був у словнику
                words = await this.loadWordsForLectures([lectureNum]);
                this.state.loadedWords[lectureNum] = words; // Зберігаємо в кеш
            }

            // Рендеримо слова (включаючи Macan, якщо це Записник)
            this.filterDictionaryView('');
        },


        async startTraining() {
            let wordsToTrain = [];
            const { mode, selectedLectures } = this.state.currentTraining;
            let lectureIds = [];

            // Визначаємо, які лекції використовувати
            if (mode === 'random') {
                lectureIds = ['random'];
            } else if (mode === 'specific_selected') {
                lectureIds = selectedLectures;
            }

            // Завантажуємо (або беремо з кешу) слова, ВИКЛЮЧАЮЧИ Macan
            wordsToTrain = await this.loadWordsForLectures(lectureIds, true);

            // Якщо слів немає, повідомляємо користувача
            if (wordsToTrain.length === 0) {
                alert("Для цього режиму немає слів.");
                this.state.isTransitioning = false; // Розблоковуємо навігацію
                return;
            }

            // Перемішуємо слова
            wordsToTrain.sort(() => Math.random() - 0.5);

            // Зберігаємо стан тренування
            this.state.currentTraining.words = wordsToTrain;
            this.state.currentTraining.index = 0;
            this.state.currentTraining.results = [];

            // Переходимо на екран тренування
            this.navigateTo('training-screen');
        },

        renderCurrentWord() {
            const screen = document.getElementById('training-screen-active');
            if (!screen) return;

            // Якщо слова закінчилися, переходимо до результатів
            if (this.state.currentTraining.index >= this.state.currentTraining.words.length) {
                this.navigateTo('results-screen');
                return;
            }

            this.state.isCheckingAnswer = false; // Скидаємо прапорець перевірки

            const T = this.state.texts[this.state.currentLang];
            const { index, words, direction } = this.state.currentTraining;
            const wordData = words[index];

            // Оновлюємо прогрес (Слово X з Y)
            screen.querySelector('.training-progress').textContent = `${T.word} ${index + 1} ${T.of} ${words.length}`;
            const langKey = this.state.currentLang.toUpperCase();

            // Визначаємо слово-питання залежно від напрямку
            const questionWordRaw = direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA);
            // Видаляємо дужки для перевірки відповіді, але зберігаємо оригінал для показу (adj.)
            const questionWordClean = questionWordRaw.replace(/\s*\(.*?\)\s*/g, '').trim();

            let displayHtml = questionWordClean; // Слово для показу

            // --- Нова логіка для Завдання №6 ((adj.)) ---
            // Додаємо маркер ТІЛЬКИ якщо переклад З мови НА чеську І слово містить (adj.)
            if (direction === 'lang_to_cz' && questionWordRaw.toLowerCase().includes('(adj.)')) {
                displayHtml += ` <span class="adj-marker">(adj.)</span>`;
            }
            // --- Кінець нової логіки ---

            screen.querySelector('.training-word').innerHTML = displayHtml; // Показуємо слово (з можливим маркером)

            // Готуємо поле вводу
            const inputEl = screen.querySelector('.training-input');
            inputEl.value = '';
            inputEl.disabled = false;
            inputEl.focus(); // Ставимо фокус
            screen.querySelector('.training-feedback').innerHTML = ''; // Очищуємо фідбек
        },

        async checkAnswer() {
            if (this.state.isCheckingAnswer) return; // Блокуємо повторну перевірку
            this.state.isCheckingAnswer = true;

            const screen = document.getElementById('training-screen-active');
            const { index, words, direction, results } = this.state.currentTraining;
            const wordData = words[index];
            const inputEl = screen.querySelector('.training-input');
            const feedbackEl = screen.querySelector('.training-feedback');
            const T = this.state.texts[this.state.currentLang];
            const langKey = this.state.currentLang.toUpperCase();
            const userAnswer = inputEl.value.trim();

            // Якщо поле пусте, просимо ввести відповідь
            if (userAnswer === '') {
                alert(T.field_cannot_be_empty);
                this.state.isCheckingAnswer = false; // Розблоковуємо
                return;
            }

            // Визначаємо правильну відповідь(і)
            const correctAnswersRawWithParen = direction === 'cz_to_lang' ? (wordData[langKey] || wordData.UA) : wordData.CZ;
            // Видаляємо дужки та всередині них для чистої перевірки
            const correctAnswersRaw = correctAnswersRawWithParen.replace(/\s*\(.*?\)\s*/g, '');
            // Розбиваємо на варіанти, якщо є коми/крапки з комою, і приводимо до нижнього регістру
            const correctAnswers = correctAnswersRaw.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(s => s);

            // Перевіряємо, чи є відповідь користувача серед правильних варіантів
            const isCorrect = correctAnswers.includes(userAnswer.toLowerCase());

            let xp_earned = 0;
            if (isCorrect) {
                // Нараховуємо XP
                xp_earned = direction === 'lang_to_cz' ? 12 : 5;
                feedbackEl.innerHTML = `<span class="xp-gain">${T.correct} +${xp_earned} XP</span>`; // Показуємо анімацію XP
                // Відправляємо XP на сервер
                const response = await fetch('/api/update_xp', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ xp: xp_earned })
                });
                if(response.ok) {
                    const data = await response.json();
                     // Оновлюємо XP у локальному стані користувача
                     if (this.state.currentUser) {
                          this.state.currentUser.xp = data.new_xp;
                     }
                }
            } else {
                // Якщо помилка, показуємо правильну відповідь
                feedbackEl.innerHTML = `${T.mistake} <br> <span style="opacity: 0.7">${T.correct_is} ${correctAnswers[0]}</span>`;
            }

            // Зберігаємо результат цього слова
            results.push({
                question: (direction === 'cz_to_lang' ? wordData.CZ : (wordData[langKey] || wordData.UA)).replace(/\s*\(.*?\)\s*/g, '').trim(), // Питання без дужок
                userAnswer,
                isCorrect,
                correctAnswer: correctAnswers[0], // Перший варіант правильної відповіді
                xp_earned
            });

            // Забарвлюємо фідбек
            feedbackEl.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';
            inputEl.disabled = true; // Блокуємо поле вводу

            // Чекаємо трохи і переходимо до наступного слова
            setTimeout(() => {
                this.state.currentTraining.index++;
                this.renderCurrentWord(); // Рендеримо наступне слово
            }, isCorrect ? 1200 : 2000); // Довша затримка при помилці
        },

        renderResults() {
            const summaryEl = document.getElementById('results-summary');
            const listEl = document.getElementById('results-list');
            if (!summaryEl || !listEl) return;

            const { results } = this.state.currentTraining;
            // Якщо результатів немає (наприклад, користувач вийшов одразу)
            if (!results || results.length === 0) {
                 summaryEl.innerHTML = "Ви не відповіли на жодне слово.";
                 listEl.innerHTML = '';
                 return;
            }

            // Рахуємо статистику
            const correctCount = results.filter(r => r.isCorrect).length;
            const totalXpEarned = results.reduce((sum, res) => sum + (res.xp_earned || 0), 0);

            // Показуємо загальний результат
            summaryEl.innerHTML = `Ваш результат: <b>${correctCount} з ${results.length}</b> (+${totalXpEarned} XP)`;
            listEl.innerHTML = ''; // Очищуємо список

            // Виводимо деталі по кожному слову
            results.forEach((res, index) => {
                const item = document.createElement('div');
                item.className = `result-item ${res.isCorrect ? 'correct' : 'incorrect'}`;
                // Генеруємо HTML з підсвічуванням різниці для неправильних відповідей
                const answerHTML = res.isCorrect ? `<span class="diff-correct">${res.userAnswer}</span>` : this.generateDiffHtml(res.correctAnswer, res.userAnswer);
                item.innerHTML = `<b>${index + 1}.</b> ${res.question} - ${answerHTML} <span>(+${res.xp_earned || 0} XP)</span>`;
                listEl.appendChild(item);
            });

            // Оновлюємо дані (рейтинг), бо XP могли змінитися
            this.loadInitialData();
        },

        // Допоміжна функція для підсвічування різниці між відповідями
        generateDiffHtml(correct, user) {
            if (!user) return `<span class="diff-incorrect">(пусто)</span> -> <span class="diff-correct">${correct}</span>`; // Якщо відповіді не було
            let html = '';
            const userLower = user.toLowerCase();
            const correctLower = correct.toLowerCase();
            // Порівнюємо посимвольно
            for (let i = 0; i < Math.max(user.length, correct.length); i++) {
                if (userLower[i] === correctLower[i]) {
                    html += `<span class="diff-correct">${user[i] || ''}</span>`; // Зелений, якщо співпадає
                } else {
                    html += `<span class="diff-incorrect">${user[i] || ''}</span>`; // Червоний, якщо не співпадає
                }
            }
            // Додаємо правильну відповідь у дужках для наочності
            html += ` <span style="opacity: 0.7">( ${correct} )</span>`;
            return html;
        },

        renderKeyboard() {
            const CZECH_LOWER = ['á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž'];
            const CZECH_UPPER = ['Á', 'Č', 'Ď', 'É', 'Ě', 'Í', 'Ň', 'Ó', 'Ř', 'Š', 'Ť', 'Ú', 'Ů', 'Ý', 'Ž'];
            const chars = this.state.isShiftActive ? CZECH_UPPER : CZECH_LOWER;
            const keyboardContainer = document.getElementById('special-chars-keyboard');
            if (!keyboardContainer) return;

            // Генеруємо HTML для клавіатури спецсимволів
            let html = '<div class="keyboard-row">';
            chars.forEach((char, index) => {
                html += `<button type="button" class="char-btn btn">${char}</button>`;
                if (index === 7) { // Переносимо на новий рядок після 8-го символу
                    html += '</div><div class="keyboard-row">';
                }
            });
            html += '</div>';
            // Додаємо кнопку Shift
            html += `<div class="keyboard-row"><button type="button" class="shift-btn btn btn-secondary">Shift</button></div>`;
            keyboardContainer.innerHTML = html;
        },

        toggleShift() {
            this.state.isShiftActive = !this.state.isShiftActive; // Перемикаємо стан Shift
            this.renderKeyboard(); // Перемальовуємо клавіатуру
        },

        // Вставляє символ у поле вводу на позицію курсора
        insertChar(char) {
            const inputEl = document.querySelector('.training-input');
            if (inputEl) {
                const start = inputEl.selectionStart;
                const end = inputEl.selectionEnd;
                inputEl.value = inputEl.value.substring(0, start) + char + inputEl.value.substring(end);
                // Встановлюємо курсор після вставленого символу
                inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                inputEl.focus(); // Повертаємо фокус
            }
        },

        // Розраховує рівень, прогрес до наступного рівня та XP для наступного рівня
        xpToLevel(xp) {
            let level = 1, startXp = 0, needed = 100;
            // Рахуємо рівень, поки XP вистачає
            while (xp >= startXp + needed) {
                startXp += needed; level++;
                // Розраховуємо XP для наступного рівня (збільшується на 20% кожен раз)
                needed = Math.floor(100 * (1.2 ** (level - 1)));
            }
            return { level, progress: xp - startXp, needed };
        },

        // Визначає ранг (емодзі та назву) за рівнем
        getRank(level) {
            let rankEmoji = RANKS[1]; // Ранг за замовчуванням
            let rankName = NAMES[1];
            // Шукаємо найвищий досягнутий ранг
            for (const lvl in RANKS) {
                if (level >= parseInt(lvl, 10)) {
                    rankEmoji = RANKS[lvl];
                    rankName = NAMES[lvl];
                } else {
                    break; // Зупиняємося, як тільки рівень менший за вимогу
                }
            }
            return { emoji: rankEmoji, name: rankName };
        },


         playMusic(eggName) {
            // Перевірка чи ми не в чужому профілі (для іконок пасхалок)
            const isViewingOtherProfile = document.getElementById('view-profile-screen-active');
            const clickedElement = event?.target; // Get the element that was clicked
             // Check if the click happened inside the easter egg icon container
             const isProfileEggIcon = clickedElement?.closest('#easter-egg-icons');

             // Блокуємо, якщо це іконка в чужому профілі
            if (isViewingOtherProfile && isProfileEggIcon) {
                return;
            }

            const newPlayer = this.elements.audio[eggName];
            if (!newPlayer) return; // Якщо аудіофайл не знайдено

            // Якщо натиснули на ту саму музику, що вже грає - зупиняємо
            if (this.state.currentMusicPlayer === newPlayer && this.state.isMusicPlaying) {
                this.stopAllMusic();
                return;
            }

            // Зупиняємо поточну музику перед запуском нової
            this.stopAllMusic();

            this.state.currentMusicPlayer = newPlayer;
            const savedVolume = parseFloat(localStorage.getItem('volumeLevel') || '1');
            this.state.currentMusicPlayer.volume = savedVolume; // Встановлюємо гучність
            this.state.currentMusicPlayer.play(); // Запускаємо
            this.state.isMusicPlaying = true;
            this.state.currentParticleType = eggName; // Запам'ятовуємо тип частинок для дощу

            // Оновлюємо вигляд кнопки музики (смарагд/діамант)
            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                const currentEggType = musicBtn.dataset.egg;
                 musicBtn.classList.toggle('playing', eggName === currentEggType);
            }

            // Якщо ми в налаштуваннях, оновлюємо слайдер гучності
             if (document.getElementById('settings-screen-active')) {
                 this.renderVolumeSlider();
             }

            // Запускаємо дощ з частинок
            this.startParticleRain(eggName);

            // Якщо ця пасхалка ще не знайдена, додаємо її і зберігаємо
            if (this.state.currentUser && !this.state.currentUser.found_easter_eggs.includes(eggName)) {
                this.state.currentUser.found_easter_eggs.push(eggName);
                this.updateEasterEggIcon(eggName); // Оновлюємо іконку в профілі
                this.saveFoundEasterEggs(); // Зберігаємо на сервері
            }
        },


        stopAllMusic() {
            // Якщо нічого не грає і дощу немає, нічого не робимо
            if (!this.state.isMusicPlaying && !this.state.isRaining) return;

            // Зупиняємо всі аудіоплеєри і скидаємо час відтворення
            for (const key in this.elements.audio) {
                this.elements.audio[key].pause();
                this.elements.audio[key].currentTime = 0;
            }

            this.state.isMusicPlaying = false;
            this.state.currentMusicPlayer = null;

            // Прибираємо анімацію з кнопки музики
            const musicBtn = document.getElementById('music-control-button');
            if (musicBtn) {
                musicBtn.classList.remove('playing');
            }

            // Оновлюємо слайдер гучності в налаштуваннях
             if (document.getElementById('settings-screen-active')) {
                 this.renderVolumeSlider();
             }

            // Зупиняємо дощ
            this.stopParticleRain();
        },

        async saveFoundEasterEggs() {
            if (!this.state.currentUser) return;
            try {
                // Відправляємо оновлений список знайдених пасхалок на сервер
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
             // Знаходимо поточний активний екран
             const currentScreen = document.querySelector('.screen.entering, .screen:not(.exiting)');
             if (currentScreen) {
                 // Знаходимо іконку пасхалки в контейнері #easter-egg-icons (у профілі)
                 const profileIcon = currentScreen.querySelector(`#easter-egg-icons .easter-egg-icon[data-egg="${eggName}"]`);
                  if (profileIcon) {
                     profileIcon.classList.add('found'); // Додаємо клас 'found'
                  }
             }

             // Знаходимо *іншу* іконку цієї пасхалки (не в контейнері #easter-egg-icons)
             // Наприклад, #gold-easter-egg у налаштуваннях
             const specificIcon = document.querySelector(`[data-egg="${eggName}"]:not(.easter-egg-icon)`);
              // Перевіряємо, чи вона видима (offsetParent !== null)
              if (specificIcon && specificIcon.offsetParent !== null) {
                 specificIcon.classList.add('found'); // Додаємо клас 'found'
             }
        },

        // Встановлює гучність для всіх аудіоплеєрів
        setVolume(volume) {
            const vol = parseFloat(volume);
            for (const key in this.elements.audio) {
                this.elements.audio[key].volume = vol;
            }
        },

        // Зберігає гучність у localStorage
        saveVolume(volume) {
            localStorage.setItem('volumeLevel', volume);
        },

        // Завантажує гучність з localStorage і застосовує її
        loadVolume() {
            const savedVolume = localStorage.getItem('volumeLevel') || '1';
            this.setVolume(savedVolume);
             // Оновлюємо повзунок у налаштуваннях, якщо він існує
             const settingsSlider = document.getElementById('volume-slider-settings');
             if (settingsSlider) {
                 settingsSlider.value = savedVolume;
             }
        },

        startParticleRain(particleName) {
            if (this.state.isRaining) this.stopParticleRain(); // Зупиняємо попередній дощ
            this.state.isRaining = true;
            this.state.lastParticleTimestamp = 0; // Скидаємо таймер
            this.state.currentParticleType = particleName;
            // Запускаємо цикл анімації
            this.state.animationFrameId = requestAnimationFrame(this.particleRainLoop.bind(this));
        },

        particleRainLoop(timestamp) {
            if (!this.state.isRaining) return; // Зупиняємо цикл, якщо дощ вимкнено

            const PARTICLE_INTERVAL = 120; // Інтервал між появою частинок (мс)
            // Якщо пройшло достатньо часу з моменту появи останньої частинки
            if (timestamp - this.state.lastParticleTimestamp > PARTICLE_INTERVAL) {
                this.state.lastParticleTimestamp = timestamp; // Оновлюємо час

                // Створюємо нову частинку
                const particle = document.createElement('div');
                particle.classList.add('falling-particle');
                particle.style.backgroundImage = `url('/static/${this.state.currentParticleType}.png')`; // Встановлюємо зображення

                // Задаємо випадкові розмір, тривалість падіння та прозорість
                const size = Math.random() * 10 + 10; // Розмір від 10 до 20px
                const duration = Math.random() * 5 + 7; // Тривалість від 7 до 12 сек

                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.left = `${Math.random() * 100}vw`; // Випадкова позиція по горизонталі
                particle.style.animationDuration = `${duration}s`; // Випадкова тривалість анімації
                particle.style.opacity = Math.random() * 0.4 + 0.4; // Випадкова напівпрозорість

                // Додаємо частинку на сторінку
                this.elements.particleRainContainer.appendChild(particle);

                // Видаляємо частинку після завершення анімації
                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }

            // Плануємо наступний кадр анімації
            this.state.animationFrameId = requestAnimationFrame(this.particleRainLoop.bind(this));
        },

        stopParticleRain() {
            this.state.isRaining = false;
            this.state.currentParticleType = null;
            // Зупиняємо цикл анімації
            if (this.state.animationFrameId) {
                cancelAnimationFrame(this.state.animationFrameId);
                this.state.animationFrameId = null;
            }

            // Плавно ховаємо та видаляємо всі існуючі частинки
            this.elements.particleRainContainer.querySelectorAll('.falling-particle').forEach(el => {
                el.style.transition = 'opacity 0.5s ease-out';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 500); // Видаляємо через 0.5 сек
            });
        }
    };

    app.init(); // Запускаємо додаток
});