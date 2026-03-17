import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Initialize Database
const dbPath = path.resolve(process.cwd(), 'database.db');
const db = new Database(dbPath);

// Create Schema v2.0
db.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    username TEXT PRIMARY KEY,
    password TEXT,
    role TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS Schools (
    school_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    district TEXT,
    total_students INTEGER
  );

  CREATE TABLE IF NOT EXISTS Camps (
    camp_id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    date TEXT,
    status TEXT,
    assigned_doctors TEXT,
    FOREIGN KEY(school_id) REFERENCES Schools(school_id)
  );

  CREATE TABLE IF NOT EXISTS Students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    name TEXT,
    age INTEGER,
    gender TEXT,
    qr_code_hash TEXT,
    FOREIGN KEY(school_id) REFERENCES Schools(school_id)
  );

  CREATE TABLE IF NOT EXISTS Health_Records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    camp_id INTEGER,
    doctor_id TEXT,
    category TEXT,
    json_data TEXT,
    timestamp TEXT,
    FOREIGN KEY(student_id) REFERENCES Students(student_id),
    FOREIGN KEY(camp_id) REFERENCES Camps(camp_id),
    FOREIGN KEY(doctor_id) REFERENCES Users(username)
  );

  CREATE TABLE IF NOT EXISTS Inventory (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT,
    stock_count INTEGER,
    camp_allocated INTEGER
  );

  CREATE TABLE IF NOT EXISTS Audit_Logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    FOREIGN KEY(user_id) REFERENCES Users(username)
  );
`);

// Seed Initial Data
const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO Users (username, password, role, name) VALUES (?, ?, ?, ?)');
  insertUser.run('admin', 'admin', 'Super Admin', 'Dr. Sharma (HOD)');
  insertUser.run('coord', 'coord', 'Camp Admin', 'Rahul (Coordinator)');
  insertUser.run('school', 'school', 'School PoC', 'Principal Singh');
  insertUser.run('doctor', 'doc', 'Medical Staff', 'Dr. Verma');
  insertUser.run('parent', 'parent', 'Parent', 'Beneficiary');

  const insertSchool = db.prepare('INSERT INTO Schools (name, district, total_students) VALUES (?, ?, ?)');
  insertSchool.run('Govt High School', 'Bathinda', 500);

  const insertCamp = db.prepare('INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?, ?, ?, ?)');
  insertCamp.run(1, '2026-04-10', 'Scheduled', 'Dr. Verma');

  const insertInventory = db.prepare('INSERT INTO Inventory (item_name, stock_count, camp_allocated) VALUES (?, ?, ?)');
  insertInventory.run('Iron-Folic Acid Tablets', 1000, 200);
  insertInventory.run('Dental Kits', 50, 40);
  insertInventory.run('Vision Charts', 10, 2);
  insertInventory.run('Vitamins', 500, 100);
}

// Audit Log Helper
function logAudit(userId: string, action: string, details: string) {
  const stmt = db.prepare('INSERT INTO Audit_Logs (timestamp, user_id, action, details) VALUES (?, ?, ?, ?)');
  stmt.run(new Date().toISOString(), userId, action, details);
}

// API Routes

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT username, role, name FROM Users WHERE username = ? AND password = ?').get(username, password);
  if (user) {
    logAudit(username, 'LOGIN', 'User logged in successfully');
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Super Admin
app.get('/api/admin/metrics', (req, res) => {
  const students = db.prepare('SELECT COUNT(*) as count FROM Students').get() as { count: number };
  const camps = db.prepare('SELECT COUNT(*) as count FROM Camps').get() as { count: number };
  const referrals = db.prepare("SELECT COUNT(*) as count FROM Health_Records WHERE json_data LIKE '%Referral%'").get() as { count: number };
  res.json({ students: students.count, camps: 39 + camps.count, referrals: referrals.count });
});

app.get('/api/admin/heatmap', (req, res) => {
  const camps = db.prepare('SELECT COUNT(*) as count FROM Camps').get() as { count: number };
  const extraCamps = camps.count > 0 ? camps.count - 1 : 0;
  res.json([
    { district: 'Bathinda', camp_count: 15 + extraCamps },
    { district: 'Mansa', camp_count: 8 },
    { district: 'Muktsar', camp_count: 12 },
    { district: 'Faridkot', camp_count: 5 },
  ]);
});

app.get('/api/admin/audit-logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM Audit_Logs ORDER BY timestamp DESC LIMIT 50').all();
  res.json(logs);
});

// Camp Admin & Logistics
app.get('/api/inventory', (req, res) => {
  const items = db.prepare('SELECT * FROM Inventory').all();
  res.json(items);
});

app.post('/api/camps', (req, res) => {
  const { school_id, date, assigned_doctors, user_id } = req.body;
  const stmt = db.prepare("INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?, ?, 'Scheduled', ?)");
  stmt.run(school_id, date, assigned_doctors);
  logAudit(user_id, 'CREATE_CAMP', `Scheduled camp for school ${school_id} on ${date}`);
  res.json({ success: true });
});

app.get('/api/camps/pending', (req, res) => {
  const camps = db.prepare(`
    SELECT c.*, s.name as school_name, s.district 
    FROM Camps c 
    JOIN Schools s ON c.school_id = s.school_id 
    WHERE c.status = 'Requested'
  `).all();
  res.json(camps);
});

app.post('/api/camps/request', (req, res) => {
  const { school_id, date, user_id } = req.body;
  const stmt = db.prepare("INSERT INTO Camps (school_id, date, status, assigned_doctors) VALUES (?, ?, 'Requested', '')");
  stmt.run(school_id, date);
  logAudit(user_id, 'REQUEST_CAMP', `Requested camp for school ${school_id} on ${date}`);
  res.json({ success: true });
});

app.put('/api/camps/:id/approve', (req, res) => {
  const { assigned_doctors, user_id } = req.body;
  const stmt = db.prepare("UPDATE Camps SET status = 'Scheduled', assigned_doctors = ? WHERE camp_id = ?");
  stmt.run(assigned_doctors, req.params.id);
  logAudit(user_id, 'APPROVE_CAMP', `Approved camp ${req.params.id}`);
  res.json({ success: true });
});

app.get('/api/schools', (req, res) => {
  const schools = db.prepare('SELECT * FROM Schools').all();
  res.json(schools);
});

// School PoC
app.post('/api/students/bulk', (req, res) => {
  const { students, user_id } = req.body;
  const insertStudent = db.prepare('INSERT INTO Students (school_id, name, age, gender, qr_code_hash) VALUES (?, ?, ?, ?, ?)');
  
  const transaction = db.transaction((studentsList) => {
    for (const student of studentsList) {
      const hash = Math.random().toString(36).substring(2, 15);
      insertStudent.run(1, student.name, student.age, student.gender, hash);
    }
  });

  transaction(students);
  logAudit(user_id, 'UPLOAD_ROSTER', `Uploaded ${students.length} students`);
  res.json({ success: true, count: students.length });
});

// Medical Staff
app.get('/api/students/search', (req, res) => {
  const { query } = req.query;
  const students = db.prepare("SELECT * FROM Students WHERE name LIKE ? OR student_id = ?").all(`%${query}%`, query);
  res.json(students);
});

app.get('/api/students/:id', (req, res) => {
  const student = db.prepare("SELECT * FROM Students WHERE student_id = ?").get(req.params.id);
  res.json(student);
});

app.post('/api/health-records', (req, res) => {
  const { student_id, camp_id, doctor_id, category, json_data } = req.body;
  const stmt = db.prepare("INSERT INTO Health_Records (student_id, camp_id, doctor_id, category, json_data, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run(student_id, camp_id, doctor_id, category, json_data, new Date().toISOString());
  
  logAudit(doctor_id, `INSERT_${category.toUpperCase()}`, `Added record for student ${student_id}`);
  res.json({ success: true });
});

app.get('/api/health-records/:student_id', (req, res) => {
  const records = db.prepare("SELECT category, json_data, timestamp, doctor_id FROM Health_Records WHERE student_id = ? ORDER BY timestamp DESC").all(req.params.student_id);
  res.json(records);
});

// Digitise - Launch Streamlit MedDigitizer app
let digitiseProcess: ChildProcess | null = null;
const DIGITISE_PORT = 8501;

app.post('/api/digitise/launch', (req, res) => {
  // Check if process is already running
  if (digitiseProcess && !digitiseProcess.killed) {
    res.json({ success: true, url: `http://localhost:${DIGITISE_PORT}`, message: 'MedDigitizer is already running.' });
    return;
  }

  const digitisePath = path.resolve(process.cwd(), 'Digitise');
  
  try {
    digitiseProcess = spawn('streamlit', ['run', 'app.py', '--server.port', String(DIGITISE_PORT), '--server.headless', 'true'], {
      cwd: digitisePath,
      shell: true,
      stdio: 'pipe'
    });

    digitiseProcess.on('error', (err) => {
      console.error('Failed to start MedDigitizer:', err);
      digitiseProcess = null;
    });

    digitiseProcess.on('exit', () => {
      console.log('MedDigitizer process exited.');
      digitiseProcess = null;
    });

    logAudit(req.body.user_id || 'system', 'LAUNCH_DIGITISE', 'Launched MedDigitizer Streamlit app');
    
    // Give Streamlit a moment to start, then return the URL
    res.json({ success: true, url: `http://localhost:${DIGITISE_PORT}`, message: 'MedDigitizer is starting...' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to launch MedDigitizer.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    const fs = require('fs');
    fs.appendFileSync('server_log.txt', `Server started at ${new Date().toISOString()}\n`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
