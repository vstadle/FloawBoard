# Roadmap: Deploying a Self-Hosted SMTP Server for FloawBoard

This document outlines the roadmap for setting up a self-hosted email delivery system for FloawBoard, specifically for features like user email verification and password resets using your domain `vstadler.com` managed via Cloudflare.

Since you are opting for a self-hosted SMTP server, we will use **docker-mailserver**, a full-stack but simple mail server (SMTP, IMAP, LDAP, Antispam, Antivirus, etc.) delivered as a single Docker container.

## Phase 1: Prerequisites & Server Preparation

Self-hosting email requires strict adherence to network and DNS rules to ensure your emails are not marked as spam.

1.  **VPS (Virtual Private Server):**
    *   You need a VPS with a dedicated, static public IP address.
    *   **CRITICAL:** Check with your hosting provider that **Port 25 (Outbound)** is unblocked. Many providers (DigitalOcean, AWS, Vultr) block this by default to prevent spam. You may need to open a support ticket to unblock it.
2.  **Reverse DNS (PTR Record):**
    *   You must configure the Reverse DNS (PTR) record for your VPS's IP address to resolve exactly to your mail server's hostname (e.g., `mail.vstadler.com`).
    *   This is typically done in your hosting provider's control panel, *not* in Cloudflare.

## Phase 2: DNS Configuration (Cloudflare)

You must configure DNS on Cloudflare to prove you own `vstadler.com` and properly route mail traffic.

1.  Log in to [Cloudflare](https://dash.cloudflare.com/) and select `vstadler.com` -> **DNS** -> **Records**.
2.  **A Record (Mail Server):**
    *   Type: `A`
    *   Name: `mail`
    *   Content: `[Your VPS Public IP Address]`
    *   Proxy status: **DNS only (Gray cloud)** - *Crucial: Mail traffic cannot be proxied through Cloudflare.*
3.  **MX Record (Mail Exchange):**
    *   Type: `MX`
    *   Name: `@` (or `vstadler.com`)
    *   Mail server: `mail.vstadler.com`
    *   Priority: `10`
4.  **SPF (Sender Policy Framework):** Authorizes your server's IP to send email.
    *   Type: `TXT`
    *   Name: `@`
    *   Content: `v=spf1 mx a:mail.vstadler.com -all`
5.  **DMARC (Domain-based Message Authentication, Reporting, and Conformance):**
    *   Type: `TXT`
    *   Name: `_dmarc`
    *   Content: `v=DMARC1; p=quarantine; rua=mailto:admin@vstadler.com;`
6.  **DKIM (DomainKeys Identified Mail):**
    *   *We will generate this key in Phase 3 and add it to Cloudflare later.*

## Phase 3: Deploying Docker Mailserver

We will run `docker-mailserver` on your server. You can integrate this into your existing `docker-compose.yml` or run it in a separate directory. For security, running it separately is often preferred.

1.  **Create a Directory:**
    ```bash
    mkdir -p /opt/mailserver
    cd /opt/mailserver
    ```
2.  **Create `docker-compose.yml`:**
    Set up the `docker-mailserver` service. (Refer to the official [docker-mailserver documentation](https://docker-mailserver.github.io/docker-mailserver/latest/) for the most up-to-date configuration). You will need to mount volumes for mail data, state, and logs.
3.  **Create `.env` for Mailserver:**
    Define variables like `HOSTNAME=mail.vstadler.com` and `DOMAINNAME=vstadler.com`.
4.  **Start the Server:**
    ```bash
    docker compose up -d
    ```
5.  **Create an Email Account:**
    You need an account to authenticate FloawBoard (e.g., `noreply@vstadler.com`).
    ```bash
    docker exec -ti <mailserver-container-name> setup email add noreply@vstadler.com <your-secure-password>
    ```
6.  **Generate DKIM Keys:**
    ```bash
    docker exec -ti <mailserver-container-name> setup config dkim
    ```
    *   Look in the generated config directory (usually mapped to a volume like `./docker-data/dms/config/opendkim/keys/vstadler.com/mail.txt`).
    *   Copy the contents of this file.
    *   **Go back to Cloudflare** and add a new `TXT` record. The "Name" will be `mail._domainkey` and the "Content" will be the key you copied (starting with `v=DKIM1; k=rsa; p=...`).

## Phase 4: Backend Integration (Rust / Axum)

Now configure the FloawBoard backend to use your new self-hosted SMTP server.

### 1. Update Configuration
Add SMTP configuration to your FloawBoard `.env` file:
```env
SMTP_HOST=mail.vstadler.com
SMTP_PORT=587 # Use 587 for STARTTLS or 465 for SSL/TLS
SMTP_USERNAME=noreply@vstadler.com
SMTP_PASSWORD=<your-secure-password>
SMTP_FROM_EMAIL=noreply@vstadler.com
```

### 2. Add Dependencies
Add the `lettre` crate to `backend/Cargo.toml` for sending emails:
```toml
[dependencies]
lettre = { version = "0.11", features = ["tokio1", "tokio1-native-tls", "builder"] }
```

### 3. Implement Email Service
Create `backend/src/services/email.rs` to handle connecting to your SMTP server and sending messages (Verification, Password Reset).

### 4. Update Database Schema
Update `init.db/init.sql` to support tokens:
*   Add `is_verified` (Boolean, default false) to the `users` table.
*   Create `verification_tokens` (id, user_id, token, expires_at).
*   Create `password_reset_tokens` (id, user_id, token, expires_at).

### 5. Create New API Endpoints
*   `POST /auth/request-verification`: Generates a token and sends the email.
*   `POST /auth/verify`: Accepts the token, marks the user as verified.
*   `POST /auth/forgot-password`: Generates a reset token and sends the email.
*   `POST /auth/reset-password`: Accepts the token and new password.

## Phase 5: Frontend Integration (Next.js)

1.  **Verification Flow:**
    *   After registration, redirect the user to a "Check your email" page.
    *   Create a page route (e.g., `/verify?token=XYZ`) that automatically calls the `/auth/verify` backend endpoint.
2.  **Password Reset Flow:**
    *   Add a "Forgot Password?" link on the `/login` page.
    *   Create a `/forgot-password` page with an email input form.
    *   Create a `/reset-password?token=XYZ` page with a form for the new password.