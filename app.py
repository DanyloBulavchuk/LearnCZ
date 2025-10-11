import os
import json
import pandas as pd
import psycopg2
from flask import Flask, jsonify, render_template, request, session, abort
from dotenv import load_dotenv

load_dotenv()

# --- App Configuration ---
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_fallback_secret_key_for_dev')
DATABASE_URL = os.environ.get('DATABASE_URL')

# --- Database Connection ---
def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"DATABASE CONNECTION ERROR: {e}")
        abort(500, description="Cannot connect to the database.")

def init_db():
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                original_case VARCHAR(255) NOT NULL,
                pin VARCHAR(4) NOT NULL,
                xp INTEGER DEFAULT 0
            );
        """)
    conn.commit()
    conn.close()

# --- Constants, Ranks, and Localization ---
WORDS_DIR = 'words_CZ'
TEXTS = { 'ua': { 'welcome': "Ласкаво просимо!", 'login': "Вхід", 'register': "Реєстрація", 'main_menu_title': "Оберіть режим", 'random_training': "Рандомне навчання", 'specific_training': "Конкретне навчання", 'dictionary': "Словник", 'logout': "Вийти", 'profile_title': "Мій профіль", 'leaderboard_title': "Рейтинг гравців", 'level': "Рівень", 'total_xp': "Загально", 'back_to_menu': "Повернутися до меню", 'choose_lecture': "Оберіть лекцію", 'back': "Назад", 'direction_title': "Оберіть напрямок", 'lecture': "Лекція", 'word': "Слово", 'of': "з", 'check': "Перевірити", 'correct': "Правильно!", 'mistake': "Помилка", 'correct_is': "Правильно:", 'show_results': "Показати результати", 'finish_training': "Завершити", 'results_title': "Результати тренування", 'enter_nickname': "Нікнейм", 'enter_pin': "PIN-код (4 цифри)", 'create_pin': "Створіть PIN-код (4 цифри)", 'all_lectures': "Всі лекції", 'start_training': "Пройти навчання" }, 'en': { 'welcome': "Welcome!", 'login': "Login", 'register': "Register", 'main_menu_title': "Select a mode", 'random_training': "Random Training", 'specific_training': "Specific Training", 'dictionary': "Dictionary", 'logout': "Log Out", 'profile_title': "My Profile", 'leaderboard_title': "Player Leaderboard", 'level': "Level", 'total_xp': "Total", 'back_to_menu': "Return to Menu", 'choose_lecture': "Select a lecture", 'back': "Back", 'direction_title': "Choose direction", 'lecture': "Lecture", 'word': "Word", 'of': "of", 'check': "Check", 'correct': "Correct!", 'mistake': "Mistake", 'correct_is': "Correct:", 'show_results': "Show Results", 'finish_training': "Finish", 'results_title': "Training Results", 'enter_nickname': "Nickname", 'enter_pin': "PIN Code (4 digits)", 'create_pin': "Create a PIN (4 digits)", 'all_lectures': "All Lectures", 'start_training': "Start Training" }, 'ru': { 'welcome': "Добро пожаловать!", 'login': "Вход", 'register': "Регистрация", 'main_menu_title': "Выберите режим", 'random_training': "Случайное обучение", 'specific_training': "Конкретное обучение", 'dictionary': "Словарь", 'logout': "Выйти", 'profile_title': "Мой профиль", 'leaderboard_title': "Рейтинг игроков", 'level': "Уровень", 'total_xp': "Всего", 'back_to_menu': "Вернуться в меню", 'choose_lecture': "Выберите лекцию", 'back': "Назад", 'direction_title': "Выберите направление", 'lecture': "Лекция", 'word': "Слово", 'of': "из", 'check': "Проверить", 'correct': "Верно!", 'mistake': "Ошибка", 'correct_is': "Правильно:", 'show_results': "Показать результаты", 'finish_training': "Завершить", 'results_title': "Результаты тренировки", 'enter_nickname': "Никнейм", 'enter_pin': "PIN-код (4 цифры)", 'create_pin': "Создайте PIN-код (4 цифры)", 'all_lectures': "Все лекции", 'start_training': "Пройти обучение" } }
TEXTS['ua']['cz_to_lang'] = "Чеська → Українська"; TEXTS['ua']['lang_to_cz'] = "Українська → Чеська"
TEXTS['en']['cz_to_lang'] = "Czech → English"; TEXTS['en']['lang_to_cz'] = "English → Czech"
TEXTS['ru']['cz_to_lang'] = "Чешский → Русский"; TEXTS['ru']['lang_to_cz'] = "Русский → Чешский"

RANKS = { 1: ("🥉", "Nováček"), 6: ("🥈", "Učedník"), 16: ("🥇", "Znalec"), 31: ("🏆", "Mistr"), 51: ("💎", "Polyglot") }

def get_rank(level):
    r = RANKS[1]
    for l, i in RANKS.items():
        if level >= l: r = i
        else: break
    return r

def xp_to_level(xp):
    level = 1
    startXp = 0
    needed = 100
    while xp >= startXp + needed:
        startXp += needed
        level += 1
        needed = int(100 * (1.2 ** (level - 1)))
    return level, xp - startXp, needed

# --- Word Data Loading ---
def load_all_words():
    all_data = []
    if not os.path.exists(WORDS_DIR): return []
    files = sorted([f for f in os.listdir(WORDS_DIR) if f.endswith('.xlsx') and f[:-5].isdigit()], key=lambda x: int(x.split('.')[0]))
    for filename in files:
        try:
            df = pd.read_excel(os.path.join(WORDS_DIR, filename), header=None, engine='openpyxl')
            if df.shape[1] >= 4:
                df = df.iloc[:, :4]
                df.columns = ['CZ', 'UA', 'RU', 'EN']
                df.dropna(subset=['CZ', 'UA'], inplace=True)
                df['lecture'] = int(filename.split('.')[0])
                all_data.append(df)
        except Exception as e: print(f"Error loading {filename}: {e}")
    if not all_data: return []
    full_df = pd.concat(all_data, ignore_index=True)
    full_df.fillna('', inplace=True)
    return full_df.to_dict('records')

ALL_WORDS = load_all_words()
AVAILABLE_LECTURES = sorted(list(set(word['lecture'] for word in ALL_WORDS)))

# --- Flask Routes ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    if not (username and pin and 3 <= len(username) <= 24 and pin.isdigit() and len(pin) == 4): abort(400)
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username = %s;", (username.lower(),))
        if cur.fetchone(): abort(409)
        cur.execute("INSERT INTO users (username, original_case, pin, xp) VALUES (%s, %s, %s, %s);", (username.lower(), username, pin, 0))
    conn.commit()
    conn.close()
    session['username'] = username
    return jsonify({"user": {"username": username, "xp": 0}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT original_case, pin, xp FROM users WHERE username = %s;", (username.lower(),))
        user = cur.fetchone()
    conn.close()
    if user and user[1] == pin:
        session['username'] = user[0]
        return jsonify({"user": {"username": user[0], "xp": user[2]}})
    abort(401)

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({"message": "Logged out."})

@app.route('/api/session')
def get_session():
    if 'username' in session:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT xp FROM users WHERE username = %s;", (session['username'].lower(),))
            user = cur.fetchone()
        conn.close()
        return jsonify({"user": {"username": session['username'], "xp": user[0] if user else 0}})
    return jsonify({"user": None})

@app.route('/api/data/initial')
def get_initial_data():
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT original_case, xp FROM users ORDER BY xp DESC, username ASC;")
        leaderboard = [{"username": row[0], "xp": row[1]} for row in cur.fetchall()]
    conn.close()
    return jsonify({"words": ALL_WORDS, "lectures": AVAILABLE_LECTURES, "leaderboard": leaderboard, "texts": TEXTS})

@app.route('/api/update_xp', methods=['POST'])
def update_xp():
    if 'username' not in session: abort(401)
    xp_to_add = request.json.get('xp', 0)
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET xp = xp + %s WHERE username = %s RETURNING xp;", (xp_to_add, session['username'].lower()))
        new_xp = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"new_xp": new_xp})

with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True)