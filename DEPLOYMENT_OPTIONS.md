# AIIMS Bathinda Project: Tech Stack & Deployment Guide

This document provides an overview of the current technology stack used in the AIIMS Bathinda portal and outlines the best strategies for deploying it to a production server, specifically tailored for **compliance with Indian data residency laws**.

---

## 🏗️ Current Technology Stack

Your project is built using a modern, reliable, and production-ready architecture. It is fully containerized, making it extremely portable across different hosting providers.

### 1. Frontend Architecture
*   **Framework:** React 19 built with Vite.
*   **Styling:** Tailwind CSS v4.
*   **Features:** Configured as a Progressive Web App (PWA) with offline capabilities (using `vite-plugin-pwa`).
*   **Deployment state:** In production, the Vite application is built into static HTML/JS/CSS files located in the `dist/` directory.

### 2. Backend Architecture
*   **Language:** Python 3.11.
*   **Framework:** Flask.
*   **Production Server:** Gunicorn. The Dockerfile correctly maps `gunicorn` to serve the Flask app, which is crucial for handling multiple concurrent requests reliably in production.
*   **Authentication:** OTP-based login utilizing external SMTP for email delivery, alongside traditional password login.

### 3. Database
*   **Engine:** PostgreSQL 16.
*   **Driver:** `psycopg2-binary`.
*   **Schema Init:** The app handles its own initial schema construction idempotently via `init_db()` in `server.py`.

### 4. Infrastructure & Containerization 🐳
*   **Docker:** A multi-stage `Dockerfile` handles building the Node.js frontend and packaging it inside a lightweight Python backend environment.
*   **Docker Compose:** `docker-compose.yml` seamlessly connects the application container with an isolated PostgreSQL database container.
*   **Environment Variables:** Security is decoupled from the code. The system expects `DATABASE_URL`, `SECRET_KEY`, and `SMTP` variables to be passed at runtime.

---

## 🌍 Deployment Options (Indian Context)

Because this application handles **healthcare and patient data**, Indian regulations strongly favor (and in many cases mandate) that **data must reside on servers physically located within India**. 

Because of this, global PaaS providers like Render.com (which lack Indian servers) should be avoided for the production database. The most compliant and reliable approach is renting a **Virtual Private Server (VPS)** located in India and deploying your existing `docker-compose.yml` file.

Here are the best cloud providers for your use case, ranked by suitability:

### 1. E2E Networks (The Top Indian Choice)
E2E Networks is an Indian homegrown cloud computing platform widely used by Indian startups.

*   **Server Locations:** Delhi NCR, Mumbai.
*   **Estimated Cost:** ₹300 - ₹500 / month.
*   **Payment Methods:** Native UPI, RuPay, NetBanking, Indian Credit/Debit cards.
*   **Advantages:**
    *   **100% Compliant:** Strictly adheres to Indian data jurisdiction.
    *   **Payments:** Easiest billing for users without international credit cards. Generates GST-compliant invoices natively.
    *   **Performance:** Excellent low-latency connections within India.
*   **Disadvantages:**
    *   The user interface/dashboard is slightly less polished than international giants like DigitalOcean or AWS.

### 2. DigitalOcean (Bangalore Region)
DigitalOcean is a global favorite for developers due to its simplicity and robust documentation. 

*   **Server Location:** Bangalore (BLR1 Region).
*   **Estimated Cost:** ~$4 to $6 (~₹350 to ₹510) / month.
*   **Payment Methods:** Credit Cards, PayPal (must have international transactions enabled).
*   **Advantages:**
    *   **Developer Experience:** Incredibly easy to use. Setting up a new Droplet (server) takes 30 seconds.
    *   **Community:** If you ever get stuck, looking up "How to do X on DigitalOcean" will yield thousands of tutorials.
*   **Disadvantages:**
    *   Does not support direct UPI. You need a card that supports international recurring payments, which RBI regulations sometimes make difficult.

### 3. AWS Lightsail (Mumbai or Hyderabad Region)
Lightsail is Amazon Web Services' (AWS) simplified VPS offering with flat monthly pricing, bypassing the confusing complexity of standard AWS EC2.

*   **Server Locations:** Mumbai (`ap-south-1`) or Hyderabad (`ap-south-2`).
*   **Estimated Cost:** $5 (~₹420) / month.
*   **Payment Methods:** Credit/Debit Cards (Processed securely via AWS India).
*   **Advantages:**
    *   **Enterprise Reliability:** Backed by Amazon’s world-class infrastructure.
    *   **Billing Entity:** Billed through AWS India, meaning standard Indian debit and credit cards usually face fewer transaction block issues compared to foreign providers.
*   **Disadvantages:**
    *   Customer support can be slow on lower-tier/free AWS accounts.
    *   Navigating the broader AWS ecosystem can be intimidating if you accidentally click out of the Lightsail dashboard.

### 4. Hostinger India (VPS)
Hostinger targets the mass market and is heavily localized for Indian consumers.

*   **Server Location:** Mumbai.
*   **Estimated Cost:** ~₹300 - ₹450 / month (depends strongly on the duration you commit to).
*   **Payment Methods:** UPI, Paytm, local cards.
*   **Advantages:**
    *   **Localization:** Built specifically for the Indian market regarding payments and support.
    *   **Initial Cost:** Offers very aggressive introductory discounts.
*   **Disadvantages:**
    *   **Renewal Pricing:** Prices often jump significantly when your initial 1-year or 2-year contract expires. You must continuously monitor the renewal rates.

---

## 🚀 How You Will Actually Deploy (The Process)

Regardless of which VPS provider you choose from the list above, the steps you take will be identical:

1.  **Rent the Server:** Purchase a basic Linux VPS (Ubuntu 24.04 or 22.04 LTS is recommended) from the provider.
2.  **Connect:** SSH into your new server using your terminal.
3.  **Install Docker:** Run the standard commands to install Docker and Docker-Compose on the server.
4.  **Transfer Code:** Use `git clone` to pull your AIIMS project onto the server.
5.  **Configure Environment:** Create a `.env` file on the server with your production secrets:
```env
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SECRET_KEY=generate_a_random_secure_string
```
6.  **Launch:** Run `docker compose up -d --build`. 

Your application and database will instantly spin up, perfectly insulated, and accessible via the server's IP address.
