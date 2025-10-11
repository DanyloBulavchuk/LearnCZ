import os
import json
import pandas as pd
from flask import Flask, jsonify, render_template, request, session, abort

# --- App Configuration ---
app = Flask(__name__)
# IMPORTANT: Change this secret key to a random string in your project
app.secret_key = 'your_super_secret_key_change_this'

# --- Constants and File Paths ---
USERS_FILE = 'users.json'
WORDS_DIR = 'words_CZ'
COLUMNS = ['CZ', 'UA', 'RU', 'EN']
NOTEBOOK_LECTURE_NUM = -1

# --- User and Rank Management (from user_manager.py) ---
RANKS = {
    1: ("🥉", "Nováček"), 6: ("🥈", "Učedník"), 16: ("🥇", "Znalec"),
    31: ("🏆", "Mistr"), 51: ("💎", "Polyglot")
}

def get_rank(level):
    current_rank = RANKS[1]
    for lvl, rank_info in RANKS.items():
        if level >= lvl:
            current_rank = rank_info
        else:
            break
    return current_rank

def xp_to_level(xp):
    level = 1
    xp_at_start_of_current_level = 0
    xp_needed_for_next = 100
    while xp >= xp_at_start_of_current_level + xp_needed_for_next:
        xp_at_start_of_current_level += xp_needed_for_next
        level += 1
        xp_needed_for_next = int(100 * (1.2 ** (level - 1)))
    xp_current_level_progress = xp - xp_at_start_of_current_level
    return level, xp_current_level_progress, xp_needed_for_next

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=4, ensure_ascii=False)

# --- Word Data Loading (from data_loader.py) ---
def load_all_words():
    all_data = []
    if not os.path.exists(WORDS_DIR):
        print(f"Warning: Directory '{WORDS_DIR}' not found.")
        return []
    
    files = sorted(
        [f for f in os.listdir(WORDS_DIR) if f.endswith('.xlsx') and f[:-5].isdigit()],
        key=lambda x: int(x.split('.')[0])
    )
    for filename in files:
        try:
            df = pd.read_excel(os.path.join(WORDS_DIR, filename), header=None, usecols='A:D')
            df.columns = COLUMNS
            df.dropna(subset=['CZ', 'UA'], inplace=True)
            df['lecture'] = int(filename.split('.')[0])
            all_data.append(df)
        except Exception as e:
            print(f"Error loading {filename}: {e}")
    
    if not all_data:
        return []
        
    full_df = pd.concat(all_data, ignore_index=True)
    full_df.fillna('', inplace=True)
    return full_df.to_dict('records')

# Load words once at startup
ALL_WORDS = load_all_words()
AVAILABLE_LECTURES = sorted(list(set(word['lecture'] for word in ALL_WORDS)))


# --- Flask Routes (API Endpoints) ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    """Handles user registration."""
    data = request.json
    username = data.get('username')
    pin = data.get('pin')

    if not username or not pin or not (3 <= len(username) <= 24) or not pin.isdigit() or len(pin) != 4:
        abort(400, "Invalid username or PIN.")

    users = load_users()
    if username.lower() in users:
        abort(409, "User already exists.")
    
    users[username.lower()] = {
        'pin': pin,
        'original_case': username,
        'xp': 0
    }
    save_users(users)
    
    session['username'] = username
    return jsonify({"message": "Registration successful", "user": {"username": username, "xp": 0}})

@app.route('/api/login', methods=['POST'])
def login():
    """Handles user login."""
    data = request.json
    username = data.get('username')
    pin = data.get('pin')
    
    users = load_users()
    user_data = users.get(username.lower())

    if user_data and user_data.get('pin') == pin:
        session['username'] = user_data.get('original_case', username)
        return jsonify({
            "message": "Login successful",
            "user": {
                "username": session['username'],
                "xp": user_data.get('xp', 0)
            }
        })
    
    abort(401, "Invalid username or PIN.")

@app.route('/api/logout', methods=['POST'])
def logout():
    """Logs the user out."""
    session.pop('username', None)
    return jsonify({"message": "Logged out successfully."})

@app.route('/api/session')
def get_session():
    """Checks for an active session."""
    if 'username' in session:
        users = load_users()
        user_data = users.get(session['username'].lower(), {})
        return jsonify({
            "user": {
                "username": session['username'],
                "xp": user_data.get('xp', 0)
            }
        })
    return jsonify({"user": None})

@app.route('/api/data/initial')
def get_initial_data():
    """Provides all necessary data on initial load."""
    users = load_users()
    leaderboard = sorted(
        [
            {"username": data.get('original_case', uname), "xp": data.get('xp', 0)}
            for uname, data in users.items()
        ],
        key=lambda x: x['xp'],
        reverse=True
    )

    return jsonify({
        "words": ALL_WORDS,
        "lectures": AVAILABLE_LECTURES,
        "leaderboard": leaderboard
    })

@app.route('/api/update_xp', methods=['POST'])
def update_xp():
    """Updates user XP."""
    if 'username' not in session:
        abort(401, "Not logged in.")

    data = request.json
    xp_to_add = data.get('xp', 0)
    
    users = load_users()
    user_key = session['username'].lower()

    if user_key in users:
        users[user_key]['xp'] = users[user_key].get('xp', 0) + xp_to_add
        save_users(users)
        return jsonify({"new_xp": users[user_key]['xp']})
    
    abort(404, "User not found.")

if __name__ == '__main__':
    app.run(debug=True)