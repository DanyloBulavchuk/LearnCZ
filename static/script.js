document.addEventListener('DOMContentLoaded', () => {
    const app = {
        state: {
            currentUser: null,
            words: [],
            lectures: [],
            leaderboard: [],
        },

        elements: {
            appContainer: document.getElementById('app-container'),
            templates: document.getElementById('templates'),
            mainHeader: document.getElementById('main-header'),
            profileButton: document.getElementById('profile-button'),
        },

        init() {
            this.addEventListeners();
            this.checkSession();
        },

        addEventListeners() {
            document.body.addEventListener('click', (e) => {
                if (e.target.matches('[data-screen]')) {
                    this.navigateTo(e.target.dataset.screen);
                }
            });

            this.elements.profileButton.addEventListener('click', () => this.navigateTo('profile-screen'));
        },

        async checkSession() {
            const response = await fetch('/api/session');
            const data = await response.json();
            if (data.user) {
                this.state.currentUser = data.user;
                await this.loadInitialData();
                this.updateHeader();
                this.navigateTo('main-menu-screen');
            } else {
                this.navigateTo('welcome-screen');
            }
        },
        
        async loadInitialData() {
            const response = await fetch('/api/data/initial');
            const data = await response.json();
            this.state.words = data.words;
            this.state.lectures = data.lectures;
            this.state.leaderboard = data.leaderboard;
        },

        updateHeader() {
            if (this.state.currentUser) {
                this.elements.profileButton.textContent = this.state.currentUser.username;
                this.elements.mainHeader.classList.remove('hidden');
            } else {
                this.elements.mainHeader.classList.add('hidden');
            }
        },

        navigateTo(screenId) {
            const template = this.elements.templates.querySelector(`#${screenId}`);
            if (template) {
                this.elements.appContainer.innerHTML = `<div class="screen" id="${screenId}-active">${template.innerHTML}</div>`;
                this.addScreenSpecificListeners(screenId);
                if (screenId === 'profile-screen') {
                    this.renderProfile();
                }
            }
        },
        
        addScreenSpecificListeners(screenId) {
            const activeScreen = document.getElementById(`${screenId}-active`);
            if (!activeScreen) return;

            const loginForm = activeScreen.querySelector('#login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username = activeScreen.querySelector('#login-username').value;
                    const pin = activeScreen.querySelector('#login-pin').value;
                    await this.handleLogin(username, pin);
                });
            }

            const registerForm = activeScreen.querySelector('#register-form');
            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username = activeScreen.querySelector('#register-username').value;
                    const pin = activeScreen.querySelector('#register-pin').value;
                    await this.handleRegister(username, pin);
                });
            }
            
            const logoutBtn = activeScreen.querySelector('#logout-btn');
            if(logoutBtn) {
                logoutBtn.addEventListener('click', async () => await this.handleLogout());
            }
        },

        async handleLogin(username, pin) {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, pin }),
            });

            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                await this.loadInitialData();
                this.updateHeader();
                this.navigateTo('main-menu-screen');
            } else {
                alert('Неправильний нікнейм або PIN-код.');
            }
        },

        async handleRegister(username, pin) {
             const response = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, pin }),
            });
            
            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
                await this.loadInitialData();
                this.updateHeader();
                this.navigateTo('main-menu-screen');
            } else {
                const error = await response.text();
                alert(`Помилка реєстрації: ${error}`);
            }
        },
        
        async handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            this.state.currentUser = null;
            this.updateHeader();
            this.navigateTo('welcome-screen');
        },

        renderProfile() {
            // Right Panel: User Details
            const detailsContainer = document.getElementById('profile-details');
            if (!detailsContainer) return;
            
            const xp = this.state.currentUser.xp;
            const { level, progress, needed } = this.xpToLevel(xp);
            const { emoji, name } = this.getRank(level);

            detailsContainer.innerHTML = `
                <div class="username">${this.state.currentUser.username}</div>
                <div class="rank"><span class="emoji">${emoji}</span> ${name}</div>
                <div class="level-info">Рівень ${level}</div>
                <div class="xp-bar">
                    <div class="xp-bar-fill" style="width: ${(progress / needed) * 100}%;"></div>
                </div>
                <div>${progress} / ${needed} XP</div>
            `;

            // Left Panel: Leaderboard
            const leaderboardContainer = document.getElementById('leaderboard-container');
            if (!leaderboardContainer) return;
            
            leaderboardContainer.innerHTML = '';
            this.state.leaderboard.forEach((user, index) => {
                const userLevel = this.xpToLevel(user.xp).level;
                const userRank = this.getRank(userLevel);

                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                if (user.username === this.state.currentUser.username) {
                    item.classList.add('current-user');
                }
                
                item.innerHTML = `
                    <span class="lb-pos">${index + 1}.</span>
                    <span class="lb-rank">${userRank.emoji}</span>
                    <span class="lb-name">-> ⏹️${user.username}⏹️ -></span>
                    <span class="lb-xp">(${user.xp} XP)</span>
                `;
                leaderboardContainer.appendChild(item);
            });
        },
        
        // Helper functions replicated from backend for frontend display
        xpToLevel(xp) {
            let level = 1;
            let startXp = 0;
            let needed = 100;
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
            let rankEmoji = "🥉";
            let rankName = "Nováček";
            for (const lvl in RANKS) {
                if (level >= lvl) {
                    rankEmoji = RANKS[lvl];
                    rankName = NAMES[lvl];
                }
            }
            return { emoji: rankEmoji, name: rankName };
        }

    };

    app.init();
});