import sqlite3
import os
import json
import hashlib
import base64

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'camisetas.db')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# Secure PBKDF2 Password Hashing
def hash_password(password, salt=None):
    if not salt:
        salt = os.urandom(16)
    else:
        if isinstance(salt, str):
            salt = base64.b64decode(salt)
    
    # 100k iterations PBKDF2-HMAC-SHA256
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    salt_b64 = base64.b64encode(salt).decode('utf-8')
    key_b64 = base64.b64encode(key).decode('utf-8')
    return f"{salt_b64}${key_b64}"

def verify_password(password, stored_hash):
    try:
        salt_b64, key_b64 = stored_hash.split('$')
        salt = base64.b64decode(salt_b64)
        key = base64.b64decode(key_b64)
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return new_key == key
    except Exception:
        return False

def init_db():
    db_existed = os.path.exists(DB_FILE)
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tlf_number TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user', -- 'admin', 'user'
        status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Catalogue Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS catalogue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        additional_images TEXT DEFAULT '[]', -- JSON array of image URLs
        status TEXT DEFAULT 'suggested', -- 'suggested', 'approved', 'requested'
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    )
    """)
    
    # 3. Catalogue Votes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        catalogue_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(catalogue_id) REFERENCES catalogue(id) ON DELETE CASCADE,
        UNIQUE(user_id, catalogue_id)
    )
    """)
    
    # 4. Polls Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalogue_id INTEGER, -- Optional link to catalogue item
        question TEXT NOT NULL,
        options TEXT NOT NULL, -- JSON Array of options: ["Yes", "No", ...]
        status TEXT DEFAULT 'active', -- 'active', 'closed'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(catalogue_id) REFERENCES catalogue(id) ON DELETE SET NULL
    )
    """)
    
    # 5. Poll Votes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS poll_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER,
        user_id INTEGER,
        selected_option TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(poll_id) REFERENCES polls(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(poll_id, user_id)
    )
    """)
    
    # 6. Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        catalogue_id INTEGER,
        quantity INTEGER NOT NULL,
        sizes_json TEXT NOT NULL, -- JSON Object of sizing breakdown: {"S":1, "M":0, ...}
        total_price REAL NOT NULL,
        payment_status TEXT DEFAULT 'Not Paid', -- 'Not Paid', 'Paid', 'Cancel'
        paypal_tx_id TEXT,
        delivery_point TEXT, -- 'Mieres', 'Garrido\'s', 'Other'
        delivery_details TEXT, -- For 'Other' custom delivery notes
        picked_up INTEGER DEFAULT 0, -- 0 = Pending, 1 = Picked Up
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(catalogue_id) REFERENCES catalogue(id) ON DELETE SET NULL
    )
    """)
    
    conn.commit()

    # Ensure Guest Demo user 999 exists for public demo access (blocks SQL integrity foreign key issues)
    cursor.execute("SELECT COUNT(*) FROM users WHERE id=999")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (id, name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)",
                       (999, "Invitado Demo", "699999999", "guest_mode_disabled_hash_oviedo", "admin", "approved"))
        conn.commit()
        print("[+] Guest Demo user 999 successfully verified and active!")
    
    # Check if we need to seed the database
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("[*] Database is empty. Seeding initial data...")
        
        # Hash passwords
        admin_pass = hash_password("adminoviedo")
        user_pass = hash_password("useroviedo")
        
        # Seed Users
        cursor.execute("INSERT INTO users (name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
                       ("Dani Admin", "600000000", admin_pass, "admin", "approved"))
        cursor.execute("INSERT INTO users (name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
                       ("Nacho Oviedo", "611111111", user_pass, "user", "approved"))
        cursor.execute("INSERT INTO users (name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
                       ("Pelayo Pendiente", "622222222", user_pass, "user", "pending"))
        cursor.execute("INSERT INTO users (name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
                       ("Garrido Tienda", "633333333", user_pass, "user", "approved"))
        
        # Seed Catalogue items
        cursor.execute("""
        INSERT INTO catalogue (name, description, image_url, additional_images, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "Camiseta Oficial Real Oviedo Primera Equipación (China Premium)",
            "Réplica de altísima calidad de la camiseta oficial del Real Oviedo. Tejido transpirable con escudo bordado y todos los detalles patrocinados. Versión 2025/2026.",
            "/uploads/oviedo_primary.jpg",
            "[]",
            "requested", # Set to requested (Buy tab active)
            1
        ))
        
        cursor.execute("""
        INSERT INTO catalogue (name, description, image_url, additional_images, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "Camiseta Alternativa Rosa y Blanca Real Oviedo",
            "Diseño exclusivo alternativo sugerido por el grupo. Color rosa con cuello y detalles blancos retro.",
            "/uploads/oviedo_alternative.jpg",
            "[]",
            "suggested", # Suggested tab
            2
        ))
        
        # Seed Votes for the alternative shirt
        cursor.execute("INSERT INTO votes (user_id, catalogue_id) VALUES (?, ?)", (1, 2))
        cursor.execute("INSERT INTO votes (user_id, catalogue_id) VALUES (?, ?)", (4, 2))

        # Seed Polls
        cursor.execute("""
        INSERT INTO polls (catalogue_id, question, options, status)
        VALUES (?, ?, ?, ?)
        """, (
            2,
            "¿Qué os parece traer la camiseta alternativa rosa de Oviedo para este lote?",
            json.dumps(["Me encanta, contad conmigo", "Prefiero solo la clásica azul", "No me convence el diseño"]),
            "active"
        ))
        
        # Seed Poll Votes
        cursor.execute("INSERT INTO poll_votes (poll_id, user_id, selected_option) VALUES (?, ?, ?)", 
                       (1, 1, "Me encanta, contad conmigo"))
        cursor.execute("INSERT INTO poll_votes (poll_id, user_id, selected_option) VALUES (?, ?, ?)", 
                       (1, 4, "Prefiero solo la clásica azul"))

        # Seed Orders
        # Nacho ordered 2 items: 1 M and 1 L
        cursor.execute("""
        INSERT INTO orders (user_id, catalogue_id, quantity, sizes_json, total_price, payment_status, delivery_point, picked_up)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            2, # Nacho
            1, # Primary jersey
            2,
            json.dumps({"S": 0, "M": 1, "L": 1, "XL": 0, "XXL": 0, "XXXL": 0, "Kids 8-10": 0}),
            56.0,
            "Paid",
            "Mieres",
            0 # Not picked up yet
        ))
        
        # Garrido ordered 1 Kids size
        cursor.execute("""
        INSERT INTO orders (user_id, catalogue_id, quantity, sizes_json, total_price, payment_status, delivery_point, picked_up)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            4, # Garrido
            1, # Primary jersey
            1,
            json.dumps({"S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0, "Kids 8-10": 1}),
            28.0,
            "Not Paid",
            "Garrido's",
            0
        ))
        
        conn.commit()
        print("[+] Seed data successfully inserted!")
        
    conn.close()

if __name__ == "__main__":
    init_db()
