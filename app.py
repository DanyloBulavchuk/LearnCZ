import os
import json
import pandas as pd
import psycopg2
from datetime import date, timedelta
from flask import Flask, jsonify, render_template, request, session, abort, send_from_directory
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_fallback_secret_key_for_dev')
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"DATABASE CONNECTION ERROR: {e}")
        abort(500, description="Cannot connect to the database.")

def init_db():
    conn = get_db_connection()
    if conn is None:
        print("ПОМИЛКА: Неможливо ініціалізувати БД, немає з'єднання.")
        return
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                original_case VARCHAR(255) NOT NULL,
                pin VARCHAR(4) NOT NULL,
                xp INTEGER DEFAULT 0,
                streak_count INTEGER DEFAULT 0,
                last_streak_date DATE,
                gender VARCHAR(1) DEFAULT 'N',
                avatar VARCHAR(255)
            );
        """)
        
        try:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(1) DEFAULT 'N';")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);")
        except psycopg2.Error as e:
            print(f"Помилка при оновленні таблиці: {e}")
            conn.rollback()
        else:
            conn.commit()
            
    conn.close()

WORDS_DIR = 'words_CZ'
AVATARS_DIR = os.path.join(app.static_folder, 'avatars')

TEXTS = {
    'ua': {
        'welcome': "Ласкаво просимо!", 'login': "Вхід", 'register': "Реєстрація",
        'main_menu_title': "Оберіть режим", 'random_training': "Рандомне навчання",
        'specific_training': "Конкретне навчання", 'dictionary': "Словник", 'logout': "Вийти", 'settings': "Налаштування",
        'repeat_difficult': "Повторення складних слів",
        'profile_title': "Мій профіль", 'leaderboard_title': "Рейтинг гравців",
        'level': "Рівень", 'total_xp': "Загально", 'back_to_menu': "Повернутися до меню",
        'choose_lecture': "Оберіть лекцію", 'back': "Назад",
        'direction_title': "Оберіть напрямок", 'lecture': "Лекція",
        'word': "Слово", 'of': "з", 'check': "Перевірити", 'correct': "Правильно!", 'mistake': "Помилка",
        'correct_is': "Правильно:", 'show_results': "Показати результати", 'finish_training': "Завершити",
        'results_title': "Результати тренування",
        'enter_nickname': "Нікнейм", 'enter_pin': "PIN-код (4 цифри)",
        'create_pin': "Створіть PIN-код (4 цифри)", 'all_lectures': "Всі лекції",
        'start_training': "Пройти навчання",
        'field_cannot_be_empty': "Поле не може бути порожнім.",
        'select_at_least_one_lecture': "Будь ласка, оберіть хоча б одну лекцію.",
        'words_learned_today': "Сьогодні вивчено слів", 'daily_streak': "Щоденна серія",
        'settings_title': "Налаштування", 'change_pin': "Змінити PIN-код", 'new_pin': "Новий PIN-код",
        'save_changes': "Зберегти зміни", 'pin_changed_success': "PIN-код успішно змінено!",
        'notebook_lecture': "Мій записник",
        'select_gender': "Оберіть вашу стать", 'gender_female': "Ж", 'gender_male': "Ч",
        'choose_avatar': "Оберіть аватарку", 'avatar_unavailable': "Аватар недоступний"
    },
    'en': {
        'welcome': "Welcome!", 'login': "Login", 'register': "Register",
        'main_menu_title': "Select a mode", 'random_training': "Random Training",
        'specific_training': "Specific Training", 'dictionary': "Dictionary", 'logout': "Log Out", 'settings': "Settings",
        'repeat_difficult': "Repeat Difficult Words",
        'profile_title': "My Profile", 'leaderboard_title': "Player Leaderboard",
        'level': "Level", 'total_xp': "Total", 'back_to_menu': "Return to Menu",
        'choose_lecture': "Select a lecture", 'back': "Back",
        'direction_title': "Choose direction", 'lecture': "Lecture",
        'word': "Word", 'of': "of", 'check': "Check", 'correct': "Correct!", 'mistake': "Mistake",
        'correct_is': "Correct:", 'show_results': "Show Results", 'finish_training': "Finish",
        'results_title': "Training Results",
        'enter_nickname': "Nickname", 'enter_pin': "PIN Code (4 digits)",
        'create_pin': "Create a PIN (4 digits)", 'all_lectures': "All Lectures",
        'start_training': "Start Training",
        'field_cannot_be_empty': "The field cannot be empty.",
        'select_at_least_one_lecture': "Please select at least one lecture.",
        'words_learned_today': "Words learned today", 'daily_streak': "Daily Streak",
        'settings_title': "Settings", 'change_pin': "Change PIN", 'new_pin': "New PIN",
        'save_changes': "Save Changes", 'pin_changed_success': "PIN changed successfully!",
        'notebook_lecture': "My Notebook",
        'select_gender': "Select your gender", 'gender_female': "F", 'gender_male': "M",
        'choose_avatar': "Choose an avatar", 'avatar_unavailable': "Avatar unavailable"
    },
    'ru': {
        'welcome': "Добро пожаловать!", 'login': "Вход", 'register': "Регистрация",
        'main_menu_title': "Выберите режим", 'random_training': "Случайное обучение",
        'specific_training': "Конкретное обучение", 'dictionary': "Словарь", 'logout': "Выйти", 'settings': "Настройки",
        'repeat_difficult': "Повторение сложных слов",
        'profile_title': "Мой профиль", 'leaderboard_title': "Рейтинг игроков",
        'level': "Уровень", 'total_xp': "Всего", 'back_to_menu': "Вернуться в меню",
        'choose_lecture': "Выберите лекцию", 'back': "Назад",
        'direction_title': "Выберите направление", 'lecture': "Лекция",
        'word': "Слово", 'of': "из", 'check': "Проверить", 'correct': "Верно!", 'mistake': "Ошибка",
        'correct_is': "Правильно:", 'show_results': "Показать результаты", 'finish_training': "Завершить",
        'results_title': "Результаты тренировки",
        'enter_nickname': "Никнейм", 'enter_pin': "PIN-код (4 цифры)",
        'create_pin': "Создайте PIN-код (4 цифры)", 'all_lectures': "Все лекции",
        'start_training': "Пройти обучение",
        'field_cannot_be_empty': "Поле не может быть пустым.",
        'select_at_least_one_lecture': "Пожалуйста, выберите хотя бы одну лекцию.",
        'words_learned_today': "Слов выучено сегодня", 'daily_streak': "Дневная серия",
        'settings_title': "Настройки", 'change_pin': "Сменить PIN-код", 'new_pin': "Новый PIN-код",
        'save_changes': "Сохранить изменения", 'pin_changed_success': "PIN-код успешно изменен!",
        'notebook_lecture': "Мой блокнот",
        'select_gender': "Выберите ваш пол", 'gender_female': "Ж", 'gender_male': "М",
        'choose_avatar': "Выберите аватар", 'avatar_unavailable': "Аватар недоступен"
    }
}
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
    level, startXp, needed = 1, 0, 100
    while xp >= startXp + needed:
        startXp += needed
        level += 1
        needed = int(100 * (1.2 ** (level - 1)))
    return level, xp - startXp, needed

def load_all_words():
    all_data = []
    if not os.path.exists(WORDS_DIR):
        return []

    all_files = [f for f in os.listdir(WORDS_DIR) if f.endswith('.xlsx')]
    
    numeric_files = sorted(
        [f for f in all_files if f[:-5].isdigit()], 
        key=lambda x: int(x.split('.')[0])
    )
    
    for filename in numeric_files:
        try:
            df = pd.read_excel(os.path.join(WORDS_DIR, filename), header=None, engine='openpyxl')
            if df.shape[1] >= 4:
                df = df.iloc[:, :4]
                df.columns = ['CZ', 'UA', 'RU', 'EN']
                df.dropna(subset=['CZ', 'UA'], inplace=True)
                df['lecture'] = int(filename.split('.')[0])
                all_data.append(df)
        except Exception as e:
            print(f"Error loading {filename}: {e}")

    if 'notebook.xlsx' in all_files:
        filename = 'notebook.xlsx'
        try:
            df = pd.read_excel(os.path.join(WORDS_DIR, filename), header=None, engine='openpyxl')
            if df.shape[1] >= 4:
                df = df.iloc[:, :4]
                df.columns = ['CZ', 'UA', 'RU', 'EN']
                df.dropna(subset=['CZ', 'UA'], inplace=True)
                df['lecture'] = 0
                all_data.append(df)
        except Exception as e:
            print(f"Error loading {filename}: {e}")

    if not all_data:
        return []
        
    full_df = pd.concat(all_data, ignore_index=True)
    full_df.fillna('', inplace=True)
    return full_df.to_dict('records')

def load_avatars():
    avatars = {"M": [], "F": []}
    if not os.path.exists(AVATARS_DIR):
        os.makedirs(AVATARS_DIR)
        print(f"Створено директорію {AVATARS_DIR}. Будь ласка, додайте аватари.")
        return avatars
        
    for f in os.listdir(AVATARS_DIR):
        if f.startswith('M_') and f.endswith('.png'):
            avatars['M'].append(f)
        elif f.startswith('F_') and f.endswith('.png'):
            avatars['F'].append(f)
    avatars['M'].sort()
    avatars['F'].sort()
    return avatars

ALL_WORDS = load_all_words()
ALL_AVATARS = load_avatars()
AVAILABLE_LECTURES = sorted(list(set(word['lecture'] for word in ALL_WORDS)))

@app.route('/')
def index(): return render_template('index.html')

@app.route('/avatars/<filename>')
def get_avatar(filename):
    return send_from_directory(AVATARS_DIR, filename)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    if not (username and pin and 3 <= len(username) <= 24 and pin.isdigit() and len(pin) == 4): abort(400)
    conn = get_db_connection()
    if conn is None: abort(500)
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username = %s;", (username.lower(),))
        if cur.fetchone(): abort(409)
        cur.execute("INSERT INTO users (username, original_case, pin, xp, gender) VALUES (%s, %s, %s, %s, 'N');", (username.lower(), username, pin, 0))
    conn.commit()
    conn.close()
    session['username'] = username
    return jsonify({"user": {"username": username, "xp": 0, "gender": "N", "avatar": None}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username, pin = data.get('username'), data.get('pin')
    conn = get_db_connection()
    if conn is None: abort(500)
    with conn.cursor() as cur:
        cur.execute("SELECT original_case, pin, xp, streak_count, gender, avatar FROM users WHERE username = %s;", (username.lower(),))
        user = cur.fetchone()
    conn.close()
    if user and user[1] == pin:
        session['username'] = user[0]
        return jsonify({"user": {
            "username": user[0], 
            "xp": user[2], 
            "streak_count": user[3],
            "gender": user[4],
            "avatar": user[5]
        }})
    abort(401)

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({"message": "Logged out."})

@app.route('/api/session')
def get_session():
    if 'username' in session:
        conn = get_db_connection()
        if conn is None:
            session.pop('username', None)
            return jsonify({"user": None})
        with conn.cursor() as cur:
            cur.execute("SELECT xp, streak_count, gender, avatar FROM users WHERE username = %s;", (session['username'].lower(),))
            user = cur.fetchone()
        conn.close()
        if user:
            return jsonify({"user": {
                "username": session['username'], 
                "xp": user[0], 
                "streak_count": user[1],
                "gender": user[2],
                "avatar": user[3]
            }})
        else:
            session.pop('username', None)
            return jsonify({"user": None})
    return jsonify({"user": None})

@app.route('/api/data/initial')
def get_initial_data():
    leaderboard = []
    conn = get_db_connection()
    if conn:
        with conn.cursor() as cur:
            cur.execute("SELECT original_case, xp FROM users ORDER BY xp DESC, username ASC;")
            leaderboard = [{"username": row[0], "xp": row[1]} for row in cur.fetchall()]
        conn.close()
    return jsonify({
        "lectures": AVAILABLE_LECTURES, 
        "leaderboard": leaderboard, 
        "texts": TEXTS,
        "avatars": ALL_AVATARS
    })

@app.route('/api/get_words', methods=['POST'])
def get_words():
    data = request.json
    lecture_ids = data.get('lectures', [])
    if not lecture_ids:
        return jsonify([])
        
    if 'random' in lecture_ids:
        words_to_train = ALL_WORDS
    else:
        words_to_train = [word for word in ALL_WORDS if word['lecture'] in lecture_ids]
        
    return jsonify(words_to_train)

@app.route('/api/update_xp', methods=['POST'])
def update_xp():
    if 'username' not in session: abort(401)
    xp_to_add = request.json.get('xp', 0)
    conn = get_db_connection()
    if conn is None: abort(500)
    with conn.cursor() as cur:
        user_key = session['username'].lower()
        today = date.today()
        yesterday = today - timedelta(days=1)
        cur.execute("SELECT xp, streak_count, last_streak_date FROM users WHERE username = %s;", (user_key,))
        user = cur.fetchone()
        new_xp = user[0] + xp_to_add
        new_streak, last_date = user[1], user[2]
        if last_date is None or last_date < yesterday:
            new_streak = 1
        elif last_date == yesterday:
            new_streak += 1
        cur.execute("UPDATE users SET xp = %s, streak_count = %s, last_streak_date = %s WHERE username = %s;", (new_xp, new_streak, today, user_key))
    conn.commit()
    conn.close()
    return jsonify({"new_xp": new_xp, "new_streak": new_streak})
    
@app.route('/api/settings/change_pin', methods=['POST'])
def change_pin():
    if 'username' not in session: abort(401)
    new_pin = request.json.get('new_pin')
    if not (new_pin and new_pin.isdigit() and len(new_pin) == 4): abort(400)
    conn = get_db_connection()
    if conn is None: abort(500)
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET pin = %s WHERE username = %s;", (new_pin, session['username'].lower()))
    conn.commit()
    conn.close()
    return jsonify({"message": "PIN updated."})

@app.route('/api/settings/save_avatar', methods=['POST'])
def save_avatar_settings():
    if 'username' not in session: abort(401)
    data = request.json
    gender = data.get('gender')
    avatar = data.get('avatar')
    user_key = session['username'].lower()
    
    conn = get_db_connection()
    if conn is None: abort(500)
    with conn.cursor() as cur:
        if gender is not None:
            cur.execute("UPDATE users SET gender = %s WHERE username = %s;", (gender, user_key))
        if avatar is not None:
            cur.execute("UPDATE users SET avatar = %s WHERE username = %s;", (avatar, user_key))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(debug=True)