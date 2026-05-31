# Security Policy (SECURITY.md)

This project, **App Camisetas Dani**, is developed adhering to the **OWASP Top 10** vulnerabilities standard and **OWASP Mobile Application Security Verification Standard (MASVS)** guidelines.

## Supported Versions

We actively monitor and patch security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## OWASP Top 10 Security Architecture Details

Our architecture implements the following security controls:

### 1. SQL Injection Protection (OWASP A03:2021-Injection)
* **Control:** All interactions with the **SQLite** database are strictly parameterized using bound place-holders (e.g. `?` markers).
* **Compliance:** Direct SQL string interpolation is banned, completely blocking SQL Injection vectors.

### 2. Cryptographic Salted Hashing (OWASP A02:2021-Cryptographic Failures)
* **Control:** Passwords are cryptographically salted and hashed using **PBKDF2-HMAC-SHA256** with **100,000 iterations** and a secure 16-byte random salt generated via `os.urandom()`.
* **Compliance:** Standard hashing algorithms prevent rainbow-table compromises and are in full compliance with NIST SP 800-132.

### 3. Session Security (OWASP A07:2021-Identification and Authentication Failures)
* **Control:** Sessions are maintained using cryptographically signed cookies via a server-side secret using **HMAC-SHA256**.
* **Cookie Flags:** All session cookies are configured with:
  * `HttpOnly`: Prevents client-side scripts from reading the token (blocks XSS-based session hijacking).
  * `SameSite=Strict`: Protects against Cross-Site Request Forgery (CSRF).
  * `Path=/`: Restricts scope to application root.

### 4. Cross-Site Scripting Mitigation (OWASP A03:2021-Injection - XSS)
* **Control:** The SPA frontend uses a custom HTML sanitization/escaping helper `escapeHTML()` to scrub all dynamic user input (T-shirt names, descriptions, telephone numbers, and poll options) before rendering in templates.
* **Compliance:** Replaces `<`, `>`, `&`, `"`, and `'` with respective HTML entities, preventing script injection.

### 5. Secure HTTP Headers (OWASP A05:2021-Security Misconfiguration)
Our custom multi-threaded Python server automatically emits standard security headers:
* `Content-Security-Policy`: Restricts resource loads to trusted local origins and approved fonts.
* `X-Frame-Options: DENY`: Blocks Clickjacking.
* `X-Content-Type-Options: nosniff`: Inhibits MIME-sniffing.
* `Referrer-Policy: strict-origin-when-cross-origin`: Controls referrer data leaks.

---

## Reporting a Vulnerability

> [!IMPORTANT]
> **Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability within this project, please notify the lead coordinator **Dani** or email the security team privately. We will acknowledge receipt of your report within 48 hours and work with you to patch the issue before making it public.
