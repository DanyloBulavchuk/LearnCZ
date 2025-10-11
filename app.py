import os
import json
import pandas as pd
from flask import Flask, jsonify, render_template, request, session, abort

# --- App Configuration ---
app = Flask(__name__)
# ВАЖЛИВО: Змініть цей ключ на будь-який випадковий рядок у вашому проєкті
app.secret_key = 'a_very_random_and_long_secret_key_for_session_part_2'

# --- Constants and File Paths ---
USERS_FILE = 'users.json'
WORDS_DIR = 'words_CZ'
COLUMNS = ['CZ', 'UA', 'RU', 'EN']

# --- Localization Data ---
TEXTS = {
    'ua': {
        'welcome': "Ласкаво просимо!", 'login': "Вхід", 'register': "Реєстрація",
        'main_menu_title': "Оберіть режим", 'random_training': "Рандомне навчання",
        'specific_training': "Конкретне навчання", 'dictionary': "Словник", 'logout': "Вийти",
        'profile_title': "Мій профіль", 'leaderboard_title': "Рейтинг гравців",
        'level': "Рівень", 'total_xp': "Загально", 'back_to_menu': "Повернутися до меню",
        'choose_lecture': "Оберіть лекцію", 'back': "Назад",
        'direction_title': "Оберіть напрямок",
        'word': "Слово", 'of': "з", 'check': "Перевірити", 'correct': "Правильно!", 'mistake': "Помилка",
        'correct_is': "Правильно:", 'show_results': "Показати результати", 'finish_training': "Завершити",
        'results_title': "Результати тренування",
        'enter_nickname': "Нікнейм", 'enter_pin': "PIN-код (4 цифри)",
        'create_pin': "Створіть PIN-код (4 цифри)", 'all_lectures': "Всі лекції",
        'start_training': "Пройти навчання"
    },
    'en': {
        'welcome': "Welcome!", 'login': "Login", 'register': "Register",
        'main_menu_title': "Select a mode", 'random_training': "Random Training",
        'specific_training': "Specific Training", 'dictionary': "Dictionary", 'logout': "Log Out",
        'profile_title': "My Profile", 'leaderboard_title': "Player Leaderboard",
        'level': "Level", 'total_xp': "Total", 'back_to_menu': "Return to Menu",
        'choose_lecture': "Select a lecture", 'back': "Back",
        'direction_title': "Choose direction",
        'word': "Word", 'of': "of", 'check': "Check", 'correct': "Correct!", 'mistake': "Mistake",
        'correct_is': "Correct:", 'show_results': "Show Results", 'finish_training': "Finish",
        'results_title': "Training Results",
        'enter_nickname': "Nickname", 'enter_pin': "PIN Code (4 digits)",
        'create_pin': "Create a PIN (4 digits)", 'all_lectures': "All Lectures",
        'start_training': "Start Training"
    },
    'ru': {
        'welcome': "Добро пожаловать!", 'login': "Вход", 'register': "Регистрация",
        'main_menu_title': "Выберите режим", 'random_training': "Случайное обучение",
        'specific_training': "Конкретное обучение", 'dictionary': "Словарь", 'logout': "Выйти",
        'profile_title': "Мой профиль", 'leaderboard_title': "Рейтинг игроков",
        'level': "Уровень", 'total_xp': "Всего", 'back_to_menu': "Вернуться в меню",
        'choose_lecture': "Выберите лекцию", 'back': "Назад",
        'direction_title': "Выберите направление",
        'word': "Слово", 'of': "из", 'check': "Проверить", 'correct': "Верно!", 'mistake': "Ошибка",
        'correct_is': "Правильно:", 'show_results': "Показать результаты", 'finish_training': "Завершить",
        'results_title': "Результаты тренировки",
        'enter_nickname': "Никнейм", 'enter_pin': "PIN-код (4 цифры)",
        'create_pin': "Создайте PIN-код (4 цифры)", 'all_lectures': "Все лекции",
        'start_training': "Пройти обучение"
    }
}
TEXTS['ua']['cz_to_lang'] = "Чеська → Українська"
TEXTS['ua']['lang_to_cz'] = "Українська → Чеська"
TEXTS['en']['cz_to_lang'] = "Czech → English"
TEXTS['en']['lang_to_cz'] = "English → Czech"
TEXTS['ru']['cz_to_lang'] = "Чешский → Русский"
TEXTS['ru']['lang_to_cz'] = "Русский → Чешский"

# --- User and Rank Management ---
RANKS = {
    1: ("🥉", "Nováček"), 6: ("🥈", "Učedník"), 16: ("🥇", "Znalec"),
    31: ("🏆", "Mistr"), 51: ("💎", "Polyglot")
}

def get_rank(level):
    current_rank = RANKS[1]
    for lvl, rank_info in RANKS.items():
        if level >= lvl: current_rank = rank_info
        else: break
    return current_rank

def xp_to_level(xp):
    level, startXp, needed = 1, 0, 100
    while xp >= startXp + needed:
        startXp += needed
        level += 1
        needed = int(100 * (1.2 ** (level - 1)))
    return level, xp - startXp, needed

def load_users():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w', encoding='utf-8') as f: json.dump({}, f)
        return {}
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError): return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=4, ensure_ascii=False)

# --- Word Data Loading ---
def load_all_words():
    all_data = []
    if not os.path.exists(WORDS_DIR): return []
    files = sorted(
        [f for f in os.listdir(WORDS_DIR) if f.endswith('.xlsx') and f[:-5].isdigit()],
        key=lambda x: int(x.split('.')[0])
    )
    for filename in files:
        try:
            df = pd.read_excel(os.path.join(WORDS_DIR, filename), header=None, engine='openpyxl')
            if df.shape[1] >= 4:
                df = df.iloc[:, :4]
                df.columns = ['CZ', 'UA', 'RU', 'EN'] # Strict column order
                df.dropna(subset=['CZ', 'UA'], inplace=True)
                df['lecture'] = int(filename.split('.')[0])
                all_data.append(df)
        except Exception as e:
            print(f"Error loading {filename}: {e}")
    if not all_data: return []
    full_df = pd.concat(all_data, ignore_index=True)
    full_df.fillna('', inplace=True)
    return full_df.to_dict('records')

ALL_WORDS = load_all_words()
AVAILABLE_LECTURES = sorted(list(set(word['lecture'] for word in ALL_WORDS)))

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    if not (username and pin and 3 <= len(username) <= 24 and pin.isdigit() and len(pin) == 4):
        abort(400, "Invalid username or PIN format.")
    users = load_users()
    if username.lower() in users:
        abort(409, "User already exists.")
    users[username.lower()] = {'pin': pin, 'original_case': username, 'xp': 0}
    save_users(users)
    session['username'] = username
    return jsonify({"user": {"username": username, "xp": 0}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    users = load_users()
    user_data = users.get(username.lower())
    if user_data and user_data.get('pin') == pin:
        session['username'] = user_data.get('original_case', username)
        return jsonify({"user": {"username": session['username'], "xp": user_data.get('xp', 0)}})
    abort(401, "Invalid username or PIN.")

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({"message": "Logged out."})

@app.route('/api/session')
def get_session():
    if 'username' in session:
        users = load_users()
        user_data = users.get(session['username'].lower(), {})
        return jsonify({"user": {"username": session['username'], "xp": user_data.get('xp', 0)}})
    return jsonify({"user": None})

@app.route('/api/data/initial')
def get_initial_data():
    users = load_users()
    leaderboard = sorted(
        [{"username": data.get('original_case', uname), "xp": data.get('xp', 0)} for uname, data in users.items()],
        key=lambda x: (-x['xp'], x['username'].lower())
    )
    return jsonify({"words": ALL_WORDS, "lectures": AVAILABLE_LECTURES, "leaderboard": leaderboard, "texts": TEXTS})

@app.route('/api/update_xp', methods=['POST'])
def update_xp():
    if 'username' not in session: abort(401, "Not logged in.")
    xp_to_add = request.json.get('xp', 0)
    users = load_users()
    user_key = session['username'].lower()
    if user_key in users:
        users[user_key]['xp'] = users[user_key].get('xp', 0) + xp_to_add
        save_users(users)
        return jsonify({"new_xp": users[user_key]['xp']})
    abort(404, "User not found.")

if __name__ == '__main__':
    app.run(debug=True)