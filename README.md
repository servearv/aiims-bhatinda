# AIIMS Bathinda - School Health System

A comprehensive digital health management system for AIIMS Bathinda school screening camps.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, TypeScript
- **Backend**: Python (Flask)
- **Database**: SQLite
- **Session**: Server-side filesytem-backed sessions

---

## 🚀 Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+

### Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Copy the example `.env`:
   ```bash
   cp .env.example .env
   ```
   *Note: `SECRET_KEY` is required for production sessions. For local dev, a default is used.*

4. **Start Development Servers:**
   The following script automatically starts **both** the Flask backend (`http://localhost:3000`) and the Vite React frontend (`http://localhost:5173`) with Hot Module Reloading (HMR).
   ```bash
   python run_dev.py
   ```

5. **Access the App:**
   Open [http://localhost:5173](http://localhost:5173) in your browser.
   *(Default Admin credentials: `Admin` / `admin`)*

---

## ☁️ Deployment (Render)

This application is configured for one-click deployment using **Render** (which supports the required persistent disk for SQLite and session storage).

### Option 1: Render Dashboard (Manual Setup)

1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect this GitHub repository.
3. Configure the service:
   - **Environment**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn server:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. Add Environment Variables:
   - `PYTHON_VERSION`: `3.11.0`
   - `NODE_VERSION`: `20`
   - `SECRET_KEY`: *(Generate a secure random string)*
5. **CRITICAL: Add a Disk**
   - **Name**: `aiims-data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB

### Option 2: Render Blueprint (Automatic Setup)

Render can automatically detect and configure this app using the provided `render.yaml` file.

1. Go to your Render Dashboard > Blueprints.
2. Select this repository.
3. Render will automatically set up the Python environment, run the `/build.sh` script, attach a persistent disk located at `/opt/render/project/src/data`, and start `gunicorn`.
