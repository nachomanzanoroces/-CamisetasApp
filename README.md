# CamisetasApp - Real Oviedo T-shirts Manager

⚽ **CamisetasApp** is a highly polished, premium mobile-first web application designed to manage Real Oviedo T-shirts imported from China. Designed to support 200–300 users, the application manages the entire group import flow—from catalog suggestions and upvoting to bulk order purchasing, simulated PayPal checkouts, and final logistics pickup tracking.

The application is themed around the iconic colors of **Real Oviedo** (Deep Royal Blue `#0B4F93` and Gold `#FFC72C`), creating a premium smartphone-like container layout optimized for both mobile screens and desktop testing.

---

## 🚀 Quick Start Guide

Since the application is written entirely using the **Python Standard Library**, it is completely zero-dependency! You do not need to install any external python modules or `npm` packages to run it.

### Running Locally:
1. Clone this repository to your system:
   ```bash
   git clone <your-repository-url>
   cd real-oviedo-camisetas-app
   ```
2. Start the concurrent threaded Python server:
   ```bash
   python server.py
   ```
3. Open your browser and navigate to:
   **[http://localhost:8000](http://localhost:8000)**

---

## 🔑 Demonstration Credentials (Demo Mode)

For public testing and review, the application contains a **Public Demo Mode** that bypasses the login wall:

* **⚡ Tap to Enter:** Click the gold **"Acceder como Invitado (Demo Pública)"** button on the login screen. It will instantly log you in as a simulated pre-approved coordinator (`Invitado Demo`) with administrator rights. You will have full access to browse shirts, vote on active polls, place test orders, play with the simulated PayPal modal, and check the administrator logistics dashboard with Excel exports.
* **🔒 Real Security Login:** Register an account or log in with our pre-seeded active accounts:
  * **Dani (Admin):** Phone `600000000` | Password `adminoviedo`
  * **Nacho (Approved Member):** Phone `611111111` | Password `useroviedo`
  * **Pelayo (Pending Member):** Phone `622222222` | Password `useroviedo` (Blocks access with a pending approval modal until Dani approves him inside the Admin Panel).

---

## 🛠️ System Architecture & Security Controls

This project adheres to **OWASP Top 10** guidelines and standard **OWASP Mobile Application Security Verification Standard (MASVS)** checks to ensure the application is completely secure for public release:

### 1. SQL Injection Protection (OWASP A03:2021-Injection)
All database calls to the local **SQLite** database (`camisetas.db`) are strictly parameterized using bound place-holders (e.g. `?` parameters). Direct SQL string interpolations are prohibited, completely neutralizing SQL Injection vectors.

### 2. Salted Cryptographic Password Hashing (OWASP A02:2021-Cryptographic Failures)
User passwords are never stored in plaintext. They are hashed using the standard **PBKDF2-HMAC-SHA256** algorithm with a secure 16-byte random salt generated via `os.urandom()` and **100,000 hashing iterations**, ensuring high-grade resistance against cryptographic attacks.

### 3. Signed Session Cookies (OWASP A07:2021-Identification and Authentication Failures)
Authentication sessions are generated as cryptographically signed secure cookies using **HMAC-SHA256**. The cookies are flags with `HttpOnly` (preventing script extraction) and `SameSite=Strict` (blocking CSRF attacks).

### 4. Cross-Site Scripting (XSS) Sanitization (OWASP A03:2021-Injection - XSS)
A dedicated `escapeHTML()` helper on the frontend scrubs all dynamic, user-supplied data (such as custom shirt names, description entries, telephone strings, and poll choices) before interpolating them into HTML structures, completely halting XSS vectors.

### 5. Multi-Threaded Concurrent Execution
The backend utilizes `socketserver.ThreadingTCPServer` with address reuse parameters (`allow_reuse_address = True`). This allows multiple concurrent connections, prevents modern browsers from locking sockets via Keep-Alive headers, and bypasses OS bind lockouts on restarts.

### 6. Public Release Decoupling
All sensitive session secret keys are decoupled from the source code. They are loaded dynamically from environment variables (`SESSION_SECRET`) at runtime, preventing private key leaks on public GitHub repositories.

---

## 📂 Project Structure

```
real-oviedo-camisetas-app/
├── db.py                 # SQLite database initialization, schemas & seed data
├── server.py             # Threaded HTTP server, secure routing & API controllers
├── README.md             # Project overview and quick start guide
├── SECURITY.md           # Security disclosure policies and OWASP checklist
├── .gitignore            # Excludes local SQLite files and session configs
└── public/               # Frontend SPA static client files
    ├── index.html        # Main HTML5 layout & bottom bar navigation
    ├── app.css           # Premium vanilla CSS with Oviedo themes
    ├── app.js            # Frontend logic, XSS filters & PayPal simulation
    └── uploads/          # Dynamic image storage (includes pre-seeded mockups)
```

---

## 📄 License
This project is released under the **ISC License**. Developed with pride for **Real Oviedo** football supporters. *Aupa Oviedo!* 🔵💛
