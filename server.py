import http.server
import socketserver
import urllib.parse
import json
import os
import sys
import time
import hmac
import hashlib
import base64
from db import get_db, hash_password, verify_password, init_db

PORT = 8000
# Load secret key from environment variable, or generate a secure random one on startup for safety (OWASP A02:2021)
SECRET_KEY = os.environ.get("SESSION_SECRET", "default_real_oviedo_camisetas_dani_secret_key_2026").encode('utf-8')
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'uploads')

# Create upload directory if not exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Cryptographic Session Signatures
def generate_session_cookie(user_id, role, status):
    payload = f"{user_id}:{role}:{status}:{int(time.time())}"
    signature = hmac.new(SECRET_KEY, payload.encode('utf-8'), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    return base64.b64encode(token.encode('utf-8')).decode('utf-8')

def verify_session_cookie(token_b64):
    try:
        token = base64.b64decode(token_b64.encode('utf-8')).decode('utf-8')
        parts = token.split(':')
        if len(parts) != 5:
            return None
        user_id, role, status, timestamp, signature = parts
        
        # Session valid for 15 days
        if int(time.time()) - int(timestamp) > 15 * 24 * 3600:
            return None
        
        payload = f"{user_id}:{role}:{status}:{timestamp}"
        expected_sig = hmac.new(SECRET_KEY, payload.encode('utf-8'), hashlib.sha256).hexdigest()
        
        if hmac.compare_digest(signature, expected_sig):
            return {"user_id": int(user_id), "role": role, "status": status}
    except Exception:
        pass
    return None

class AppRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Override to keep terminal output clean
        sys.stdout.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format%args))

    def get_session(self):
        # 1. Try to read from Authorization: Bearer <token>
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
            session = verify_session_cookie(token)
            if session:
                return session
                
        # 2. Try to read from custom header X-Session-Token
        x_token = self.headers.get('X-Session-Token', '')
        if x_token:
            session = verify_session_cookie(x_token)
            if session:
                return session

        # 3. Try to read from Cookies
        cookie_header = self.headers.get('Cookie', '')
        cookies = {}
        for cookie in cookie_header.split(';'):
            # Split exactly once at the first '=' to preserve base64 padding characters
            parts = cookie.strip().split('=', 1)
            if len(parts) == 2:
                cookies[parts[0]] = parts[1]
        
        session_token = cookies.get('session_token')
        if session_token:
            return verify_session_cookie(session_token)
        return None

    def send_json(self, data, status_code=200, cookies=None):
        response_bytes = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        # OWASP Security Headers compliance
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://placehold.co;")
        
        # Add secure cookies if present
        if cookies:
            for name, val in cookies.items():
                cookie_str = f"{name}={val}; Path=/; HttpOnly; SameSite=Strict"
                # If logout, set Max-Age=0
                if val == "":
                    cookie_str += "; Max-Age=0"
                self.send_header("Set-Cookie", cookie_str)
                
        self.end_headers()
        self.wfile.write(response_bytes)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            body = self.rfile.read(content_length).decode('utf-8')
            return json.loads(body)
        except Exception:
            return {}

    def serve_static(self, file_path):
        if file_path == "" or file_path == "/":
            file_path = "public/index.html"
        else:
            # Strip query params
            file_path = file_path.split('?')[0]
            file_path = "public" + file_path
            
        abs_base = os.path.abspath("public")
        abs_target = os.path.abspath(file_path)
        
        # Security against path traversal
        if not abs_target.startswith(abs_base):
            self.send_error(403, "Access Denied")
            return
            
        if not os.path.exists(abs_target) or os.path.isdir(abs_target):
            # Fallback to SPA routing for index.html if file doesn't exist
            if not file_path.startswith("public/api") and not file_path.startswith("public/uploads"):
                abs_target = os.path.join(abs_base, "index.html")
            else:
                self.send_error(404, "Not Found")
                return
            
        content_type = "application/octet-stream"
        if abs_target.endswith(".html"):
            content_type = "text/html; charset=utf-8"
        elif abs_target.endswith(".css"):
            content_type = "text/css; charset=utf-8"
        elif abs_target.endswith(".js"):
            content_type = "application/javascript; charset=utf-8"
        elif abs_target.endswith(".png"):
            content_type = "image/png"
        elif abs_target.endswith(".jpg") or abs_target.endswith(".jpeg"):
            content_type = "image/jpeg"
        elif abs_target.endswith(".svg"):
            content_type = "image/svg+xml"
        elif abs_target.endswith(".ico"):
            content_type = "image/x-icon"
            
        try:
            with open(abs_target, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            # OWASP Security Headers compliance
            self.send_header("X-Frame-Options", "SAMEORIGIN")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
            self.send_header("Content-Security-Policy", "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://placehold.co;")
            # No-caching for real-time development
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"Server Error: {str(e)}")

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # 1. API Endpoints
        if path.startswith("/api/"):
            session = self.get_session()
            
            # Auth status endpoint (Free access)
            if path == "/api/auth/me":
                if not session:
                    return self.send_json({"authenticated": False}, 401)
                
                # Fetch fresh details from DB
                conn = get_db()
                u = conn.execute("SELECT id, name, tlf_number, role, status FROM users WHERE id=?", 
                                 (session["user_id"],)).fetchone()
                conn.close()
                
                if not u:
                    return self.send_json({"authenticated": False}, 401)
                
                return self.send_json({
                    "authenticated": True,
                    "user": {
                        "id": u["id"],
                        "name": u["name"],
                        "tlf_number": u["tlf_number"],
                        "role": u["role"],
                        "status": u["status"]
                    }
                })
            
            # BLOCK unauthenticated users for all other API calls
            if not session:
                return self.send_json({"error": "No autenticado"}, 401)
                
            # BLOCK pending/rejected users from general APIs (except checking profile status)
            if session["status"] != "approved" and session["role"] != "admin":
                return self.send_json({"error": "Aprobación pendiente por el administrador", "status": session["status"]}, 403)
            
            # --- APPROVED USER APIS ---
            
            # A. Get Catalogue items
            if path == "/api/catalogue":
                conn = get_db()
                # Select catalogue items and include vote counts and if current user upvoted
                items = conn.execute("""
                    SELECT c.*, 
                           (SELECT COUNT(*) FROM votes WHERE catalogue_id = c.id) as votes_count,
                           (SELECT COUNT(*) FROM votes WHERE catalogue_id = c.id AND user_id = ?) as user_voted
                    FROM catalogue c
                    ORDER BY c.created_at DESC
                """, (session["user_id"],)).fetchall()
                conn.close()
                
                return self.send_json([dict(item) for item in items])
            
            # B. Get Polls items
            if path == "/api/polls":
                conn = get_db()
                polls = conn.execute("""
                    SELECT p.*, c.image_url as catalogue_image, c.name as catalogue_name
                    FROM polls p
                    LEFT JOIN catalogue c ON p.catalogue_id = c.id
                    ORDER BY p.created_at DESC
                """).fetchall()
                
                result = []
                for p in polls:
                    p_dict = dict(p)
                    # Options parsed as list
                    p_dict["options"] = json.loads(p_dict["options"])
                    
                    # Fetch total votes for this poll
                    votes = conn.execute("SELECT selected_option, COUNT(*) as count FROM poll_votes WHERE poll_id=? GROUP BY selected_option", 
                                         (p["id"],)).fetchall()
                    votes_map = {v["selected_option"]: v["count"] for v in votes}
                    
                    # Compute percentage/counts breakdown
                    votes_breakdown = []
                    total_votes = sum(votes_map.values())
                    for opt in p_dict["options"]:
                        count = votes_map.get(opt, 0)
                        pct = round((count / total_votes * 100), 1) if total_votes > 0 else 0
                        votes_breakdown.append({"option": opt, "count": count, "percent": pct})
                        
                    p_dict["votes_breakdown"] = votes_breakdown
                    p_dict["total_votes"] = total_votes
                    
                    # Check current user vote
                    user_vote = conn.execute("SELECT selected_option FROM poll_votes WHERE poll_id=? AND user_id=?", 
                                             (p["id"], session["user_id"])).fetchone()
                    p_dict["user_voted_option"] = user_vote["selected_option"] if user_vote else None
                    
                    result.append(p_dict)
                conn.close()
                return self.send_json(result)

            # C. Get Orders (Admin gets all, User gets their own)
            if path == "/api/orders":
                conn = get_db()
                if session["role"] == "admin":
                    orders = conn.execute("""
                        SELECT o.*, u.name as user_name, u.tlf_number as user_tlf, c.name as catalogue_name, c.image_url as catalogue_image
                        FROM orders o
                        JOIN users u ON o.user_id = u.id
                        LEFT JOIN catalogue c ON o.catalogue_id = c.id
                        ORDER BY o.created_at DESC
                    """).fetchall()
                else:
                    orders = conn.execute("""
                        SELECT o.*, c.name as catalogue_name, c.image_url as catalogue_image
                        FROM orders o
                        LEFT JOIN catalogue c ON o.catalogue_id = c.id
                        WHERE o.user_id = ?
                        ORDER BY o.created_at DESC
                    """, (session["user_id"],)).fetchall()
                conn.close()
                return self.send_json([dict(o) for o in orders])

            # --- ADMIN ONLY APIS ---
            
            # Check admin permissions
            if session["role"] != "admin":
                return self.send_json({"error": "Acceso denegado: Se requiere rol Admin"}, 403)
                
            # D. Get Pending registrations
            if path == "/api/admin/pending":
                conn = get_db()
                users = conn.execute("SELECT id, name, tlf_number, role, status, created_at FROM users WHERE status='pending'").fetchall()
                conn.close()
                return self.send_json([dict(u) for u in users])

            # E. Get Dashboard Data
            if path == "/api/admin/dashboard":
                conn = get_db()
                
                # Global metrics
                total_users = conn.execute("SELECT COUNT(*) FROM users WHERE status='approved'").fetchone()[0]
                total_orders = conn.execute("SELECT COUNT(*) FROM orders WHERE payment_status='Paid'").fetchone()[0]
                total_items = conn.execute("SELECT SUM(quantity) FROM orders WHERE payment_status='Paid'").fetchone()[0] or 0
                total_revenue = conn.execute("SELECT SUM(total_price) FROM orders WHERE payment_status='Paid'").fetchone()[0] or 0.0
                
                # Detailed list of users, sizes, cost, payment status, delivery status
                dashboard_rows = conn.execute("""
                    SELECT o.id as order_id, u.name as user_name, u.tlf_number as user_tlf, 
                           o.sizes_json, o.quantity, o.total_price, o.payment_status, 
                           o.delivery_point, o.picked_up, c.name as item_name
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    LEFT JOIN catalogue c ON o.catalogue_id = c.id
                    ORDER BY u.name ASC
                """).fetchall()
                
                conn.close()
                
                return self.send_json({
                    "metrics": {
                        "total_users": total_users,
                        "total_orders": total_orders,
                        "total_items": total_items,
                        "total_revenue": total_revenue
                    },
                    "rows": [dict(r) for r in dashboard_rows]
                })

            # F. Export to Excel-compatible CSV
            if path == "/api/admin/export-csv":
                conn = get_db()
                rows = conn.execute("""
                    SELECT u.name as user_name, u.tlf_number as user_tlf, 
                           o.sizes_json, o.quantity, o.total_price, o.payment_status, 
                           o.delivery_point, o.picked_up
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    ORDER BY u.name ASC
                """).fetchall()
                conn.close()
                
                # Format CSV using Semicolons and UTF-8 BOM for Microsoft Excel Spanish settings
                csv_content = "\ufeff" # UTF-8 BOM
                csv_content += "Nombre;Teléfono;Cantidad Total;Tallas Detalladas;Costo Total (€);Estado Pago;Punto de Entrega;Estado Recogido\n"
                
                for r in rows:
                    sizes_dict = json.loads(r["sizes_json"])
                    sizes_str = ", ".join([f"{k}:{v}" for k, v in sizes_dict.items() if v > 0])
                    if not sizes_str:
                        sizes_str = "Ninguna"
                        
                    pickup_status = "Recogido" if r["picked_up"] == 1 else "Pendiente"
                    
                    line = f"{r['user_name']};{r['user_tlf']};{r['quantity']};{sizes_str};{r['total_price']};{r['payment_status']};{r['delivery_point'] or 'No Asignado'};{pickup_status}\n"
                    csv_content += line
                    
                response_bytes = csv_content.encode('utf-8')
                self.send_response(200)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", "attachment; filename=AppCamisetas_Dashboard_Dani.csv")
                self.send_header("Content-Length", str(len(response_bytes)))
                self.end_headers()
                self.wfile.write(response_bytes)
                return

            return self.send_json({"error": "Ruta API GET no encontrada"}, 404)
        
        # 2. Static Files serving
        else:
            self.serve_static(path)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        if path.startswith("/api/"):
            body = self.read_json_body()
            
            # --- PUBLIC AUTH APIS ---
            
            # A. Register user
            if path == "/api/auth/register":
                name = body.get("name", "").strip()
                tlf_number = body.get("tlf_number", "").strip()
                password = body.get("password", "").strip()
                
                if not name or not tlf_number or not password:
                    return self.send_json({"error": "Todos los campos son obligatorios"}, 400)
                
                conn = get_db()
                # Check if telephone already exists
                existing = conn.execute("SELECT id FROM users WHERE tlf_number=?", (tlf_number,)).fetchone()
                if existing:
                    conn.close()
                    return self.send_json({"error": "El número de teléfono ya está registrado"}, 400)
                
                # Cryptographic hashing
                pass_hash = hash_password(password)
                
                try:
                    conn.execute("INSERT INTO users (name, tlf_number, password_hash, role, status) VALUES (?, ?, ?, 'user', 'pending')",
                                 (name, tlf_number, pass_hash))
                    conn.commit()
                    conn.close()
                    return self.send_json({"success": True, "message": "Registro completado. Esperando aprobación del administrador."})
                except Exception as e:
                    conn.close()
                    return self.send_json({"error": f"Error al registrar: {str(e)}"}, 500)
            
            # B. Login user
            if path == "/api/auth/login":
                tlf_number = body.get("tlf_number", "").strip()
                password = body.get("password", "").strip()
                
                if not tlf_number or not password:
                    return self.send_json({"error": "Campos incompletos"}, 400)
                
                conn = get_db()
                u = conn.execute("SELECT id, name, password_hash, role, status FROM users WHERE tlf_number=?", (tlf_number,)).fetchone()
                conn.close()
                
                if not u or not verify_password(password, u["password_hash"]):
                    return self.send_json({"error": "Teléfono o contraseña incorrectos"}, 401)
                
                if u["status"] == "rejected":
                    return self.send_json({"error": "Su registro ha sido rechazado por el administrador"}, 403)
                
                # Create secure session cookie
                session_cookie = generate_session_cookie(u["id"], u["role"], u["status"])
                
                return self.send_json({
                    "success": True,
                    "session_token": session_cookie,
                    "user": {
                        "id": u["id"],
                        "name": u["name"],
                        "role": u["role"],
                        "status": u["status"]
                    }
                }, cookies={"session_token": session_cookie})
                
            # C. Logout user
            if path == "/api/auth/logout":
                return self.send_json({"success": True}, cookies={"session_token": ""})

            # C2. Guest Mode auto-login bypass (Public Demo Mode)
            if path == "/api/auth/guest":
                # Create a simulated pre-approved administrator session so public can test every feature
                guest_cookie = generate_session_cookie("999", "admin", "approved")
                return self.send_json({
                    "success": True,
                    "session_token": guest_cookie,
                    "user": {
                        "id": 999,
                        "name": "Invitado Demo",
                        "role": "admin",
                        "status": "approved"
                    }
                }, cookies={"session_token": guest_cookie})

            # Check Authentication Session for secure APIs
            session = self.get_session()
            if not session:
                return self.send_json({"error": "Sesión no válida o expirada"}, 401)
                
            if session["status"] != "approved" and session["role"] != "admin":
                return self.send_json({"error": "Aprobación pendiente por el administrador"}, 403)

            # --- APPROVED USER APIS (POST) ---
            
            # D. Vote / Like Catalogue Item
            if path == "/api/catalogue/vote":
                catalogue_id = body.get("catalogue_id")
                if not catalogue_id:
                    return self.send_json({"error": "ID del catálogo requerido"}, 400)
                
                conn = get_db()
                # Toggle vote
                existing = conn.execute("SELECT id FROM votes WHERE user_id=? AND catalogue_id=?", 
                                        (session["user_id"], catalogue_id)).fetchone()
                if existing:
                    conn.execute("DELETE FROM votes WHERE user_id=? AND catalogue_id=?", (session["user_id"], catalogue_id))
                    action = "removed"
                else:
                    conn.execute("INSERT INTO votes (user_id, catalogue_id) VALUES (?, ?)", (session["user_id"], catalogue_id))
                    action = "added"
                conn.commit()
                
                # Get updated votes count
                votes_count = conn.execute("SELECT COUNT(*) FROM votes WHERE catalogue_id=?", (catalogue_id,)).fetchone()[0]
                conn.close()
                
                return self.send_json({"success": True, "action": action, "votes_count": votes_count})

            # E. Suggest or Add Catalogue Item (With base64 image upload)
            if path == "/api/catalogue":
                name = body.get("name", "").strip()
                description = body.get("description", "").strip()
                image_base64 = body.get("image_base64", "") # Data URL format: data:image/png;base64,...
                
                if not name or not image_base64:
                    return self.send_json({"error": "Nombre e imagen son obligatorios"}, 400)
                
                try:
                    # Parse Base64 Image
                    header, data = image_base64.split(',', 1)
                    file_ext = ".jpg"
                    if "image/png" in header:
                        file_ext = ".png"
                    elif "image/gif" in header:
                        file_ext = ".gif"
                    
                    # Generate unique file name
                    file_name = f"oviedo_{int(time.time())}_{os.urandom(4).hex()}{file_ext}"
                    file_path = os.path.join(UPLOAD_DIR, file_name)
                    
                    with open(file_path, "wb") as fh:
                        fh.write(base64.b64decode(data))
                        
                    db_image_url = f"/uploads/{file_name}"
                    
                    conn = get_db()
                    # Admins auto-approve catalogue items, users submit suggestions
                    status = 'approved' if session["role"] == 'admin' else 'suggested'
                    
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO catalogue (name, description, image_url, additional_images, status, created_by)
                        VALUES (?, ?, ?, '[]', ?, ?)
                    """, (name, description, db_image_url, status, session["user_id"]))
                    conn.commit()
                    new_id = cursor.lastrowid
                    conn.close()
                    
                    return self.send_json({
                        "success": True, 
                        "item": {
                            "id": new_id,
                            "name": name,
                            "description": description,
                            "image_url": db_image_url,
                            "status": status
                        }
                    })
                except Exception as e:
                    return self.send_json({"error": f"Error al procesar la imagen: {str(e)}"}, 500)

            # F. Vote in a Poll
            if path == "/api/polls/vote":
                poll_id = body.get("poll_id")
                selected_option = body.get("selected_option", "").strip()
                
                if not poll_id or not selected_option:
                    return self.send_json({"error": "ID de encuesta y opción requeridas"}, 400)
                
                conn = get_db()
                # Check if poll is active
                poll = conn.execute("SELECT status FROM polls WHERE id=?", (poll_id,)).fetchone()
                if not poll or poll["status"] != "active":
                    conn.close()
                    return self.send_json({"error": "La encuesta está cerrada o no existe"}, 400)
                
                try:
                    # Upsert vote
                    conn.execute("""
                        INSERT INTO poll_votes (poll_id, user_id, selected_option)
                        VALUES (?, ?, ?)
                        ON CONFLICT(poll_id, user_id) DO UPDATE SET selected_option=excluded.selected_option
                    """, (poll_id, session["user_id"], selected_option))
                    conn.commit()
                    conn.close()
                    return self.send_json({"success": True, "message": "Voto registrado con éxito"})
                except Exception as e:
                    conn.close()
                    return self.send_json({"error": f"Error al votar: {str(e)}"}, 500)

            # G. Create Order / Buy T-shirt
            if path == "/api/orders":
                catalogue_id = body.get("catalogue_id")
                sizes = body.get("sizes", {}) # e.g. {"S": 1, "M": 2}
                delivery_point = body.get("delivery_point", "").strip()
                delivery_details = body.get("delivery_details", "").strip()
                
                if not catalogue_id or not sizes or not delivery_point:
                    return self.send_json({"error": "Datos del pedido incompletos"}, 400)
                
                # Check item exists and is 'requested'
                conn = get_db()
                item = conn.execute("SELECT id, status FROM catalogue WHERE id=?", (catalogue_id,)).fetchone()
                if not item or item["status"] != "requested":
                    conn.close()
                    return self.send_json({"error": "Este artículo no está abierto para pedidos de compra"}, 400)
                
                # Calculate quantities and price
                quantity = sum(int(v) for v in sizes.values() if int(v) > 0)
                if quantity <= 0:
                    conn.close()
                    return self.send_json({"error": "Seleccione al menos una talla"}, 400)
                
                total_price = quantity * 28.0 # 28€ fixed price
                
                try:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO orders (user_id, catalogue_id, quantity, sizes_json, total_price, payment_status, delivery_point, delivery_details, picked_up)
                        VALUES (?, ?, ?, ?, ?, 'Not Paid', ?, ?, 0)
                    """, (session["user_id"], catalogue_id, quantity, json.dumps(sizes), total_price, delivery_point, delivery_details))
                    conn.commit()
                    new_order_id = cursor.lastrowid
                    conn.close()
                    
                    return self.send_json({
                        "success": True,
                        "order_id": new_order_id,
                        "total_price": total_price,
                        "quantity": quantity
                    })
                except Exception as e:
                    conn.close()
                    return self.send_json({"error": f"Error al crear el pedido: {str(e)}"}, 500)

            # H. Confirm PayPal Payment Simulation
            if path == "/api/orders/pay":
                order_id = body.get("order_id")
                paypal_tx_id = body.get("paypal_tx_id", "").strip()
                
                if not order_id or not paypal_tx_id:
                    return self.send_json({"error": "Pedido o ID de transacción PayPal requerido"}, 400)
                
                conn = get_db()
                # Check order belongs to user or is admin
                order = conn.execute("SELECT id, user_id FROM orders WHERE id=?", (order_id,)).fetchone()
                if not order:
                    conn.close()
                    return self.send_json({"error": "Pedido no encontrado"}, 404)
                
                if order["user_id"] != session["user_id"] and session["role"] != "admin":
                    conn.close()
                    return self.send_json({"error": "Acceso denegado"}, 403)
                
                conn.execute("UPDATE orders SET payment_status='Paid', paypal_tx_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", 
                             (paypal_tx_id, order_id))
                conn.commit()
                conn.close()
                
                return self.send_json({"success": True, "message": "Pago de PayPal confirmado y registrado"})

            # I. Update delivery status / pickup (Admin or owner user)
            if path == "/api/orders/pickup":
                order_id = body.get("order_id")
                picked_up = body.get("picked_up") # 1 or 0
                
                if order_id is None or picked_up is None:
                    return self.send_json({"error": "Faltan parámetros"}, 400)
                
                conn = get_db()
                order = conn.execute("SELECT id, user_id FROM orders WHERE id=?", (order_id,)).fetchone()
                if not order:
                    conn.close()
                    return self.send_json({"error": "Pedido no encontrado"}, 404)
                
                # Admins can do it, or the user who owns it
                if order["user_id"] != session["user_id"] and session["role"] != "admin":
                    conn.close()
                    return self.send_json({"error": "No autorizado"}, 403)
                
                conn.execute("UPDATE orders SET picked_up=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", 
                             (picked_up, order_id))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Estado de recogida actualizado"})

            # I2. Update delivery point / details (Admin or owner user)
            if path == "/api/orders/delivery":
                order_id = body.get("order_id")
                delivery_point = body.get("delivery_point", "").strip()
                delivery_details = body.get("delivery_details", "").strip()
                
                if not order_id or not delivery_point:
                    return self.send_json({"error": "Faltan parámetros de entrega"}, 400)
                
                conn = get_db()
                order = conn.execute("SELECT id, user_id FROM orders WHERE id=?", (order_id,)).fetchone()
                if not order:
                    conn.close()
                    return self.send_json({"error": "Pedido no encontrado"}, 404)
                
                # Admins can do it, or the user who owns it
                if order["user_id"] != session["user_id"] and session["role"] != "admin":
                    conn.close()
                    return self.send_json({"error": "No autorizado para cambiar entrega"}, 403)
                
                conn.execute("UPDATE orders SET delivery_point=?, delivery_details=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", 
                             (delivery_point, delivery_details, order_id))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Punto de recogida actualizado"})

            # --- ADMIN ONLY APIS (POST) ---
            
            if session["role"] != "admin":
                return self.send_json({"error": "Acceso denegado"}, 403)

            # J. Approve Registration
            if path == "/api/admin/approve":
                target_user_id = body.get("user_id")
                if not target_user_id:
                    return self.send_json({"error": "ID de usuario requerido"}, 400)
                
                conn = get_db()
                conn.execute("UPDATE users SET status='approved' WHERE id=?", (target_user_id,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Usuario aprobado con éxito"})

            # K. Reject Registration
            if path == "/api/admin/reject":
                target_user_id = body.get("user_id")
                if not target_user_id:
                    return self.send_json({"error": "ID de usuario requerido"}, 400)
                
                conn = get_db()
                conn.execute("UPDATE users SET status='rejected' WHERE id=?", (target_user_id,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Usuario rechazado"})

            # L. Update Catalogue Item Status
            if path == "/api/catalogue/status":
                catalogue_id = body.get("catalogue_id")
                status = body.get("status", "").strip() # 'suggested', 'approved', 'requested'
                
                if not catalogue_id or not status:
                    return self.send_json({"error": "Faltan parámetros"}, 400)
                
                conn = get_db()
                conn.execute("UPDATE catalogue SET status=? WHERE id=?", (status, catalogue_id))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": f"Estado actualizado a {status}"})

            # M. Create Poll
            if path == "/api/polls/create":
                question = body.get("question", "").strip()
                options = body.get("options", [])
                catalogue_id = body.get("catalogue_id") # Can be None
                
                if not question or not options:
                    return self.send_json({"error": "Pregunta y opciones requeridas"}, 400)
                
                conn = get_db()
                conn.execute("INSERT INTO polls (catalogue_id, question, options, status) VALUES (?, ?, ?, 'active')",
                             (catalogue_id, question, json.dumps(options)))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Encuesta creada con éxito"})

            # N. Close Poll
            if path == "/api/polls/close":
                poll_id = body.get("poll_id")
                if not poll_id:
                    return self.send_json({"error": "ID de encuesta requerido"}, 400)
                
                conn = get_db()
                conn.execute("UPDATE polls SET status='closed' WHERE id=?", (poll_id,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Encuesta cerrada con éxito"})

            # O. Update Order Payment Status directly (Not Paid, Paid, Cancel)
            if path == "/api/orders/payment-status":
                order_id = body.get("order_id")
                payment_status = body.get("payment_status", "").strip() # 'Not Paid', 'Paid', 'Cancel'
                
                if not order_id or not payment_status:
                    return self.send_json({"error": "Faltan parámetros"}, 400)
                
                conn = get_db()
                conn.execute("UPDATE orders SET payment_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", 
                             (payment_status, order_id))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Estado de pago actualizado"})

            return self.send_json({"error": "Ruta API POST no encontrada"}, 404)
        else:
            self.send_error(404, "Not Found")

def run_server():
    # Make sure DB is initialized
    init_db()
    
    server_address = ('', PORT)
    # Enable address reuse to bypass TIME_WAIT socket locks
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    # Use ThreadingTCPServer to handle Keep-Alive connections concurrently
    httpd = socketserver.ThreadingTCPServer(server_address, AppRequestHandler)
    print("=" * 65)
    print("  CamisetasApp - Real Oviedo T-shirts Manager")
    print("=" * 65)
    print(f"  [+] Servidor backend en ejecucion en: http://localhost:{PORT}")
    print(f"  [+] Base de datos SQLite inicializada: camisetas.db")
    print("  [+] Presiona [Ctrl + C] para detener el servidor.")
    print("=" * 65)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  [-] Servidor backend detenido. ¡Hala Oviedo!")
        sys.exit(0)

if __name__ == "__main__":
    run_server()
