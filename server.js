import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// MySQL Configuration
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'gotek';
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend build files
app.use(express.static(path.join(__dirname, 'dist')));

// Storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

let pool = null;

// Connect to MySQL
async function connectDB() {
  try {
    console.log(`🔌 Attempting to connect to MySQL: ${MYSQL_HOST}:${MYSQL_PORT}...`);
    pool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log(`🥭 ✅ Connected to MySQL: ${MYSQL_DATABASE} successfully. System is now using MySQL backend.`);
    connection.release();
  } catch (err) {
    console.error('❌ CRITICAL: MySQL connection failed! The server requires a live MySQL connection.');
    console.error(err);
    process.exit(1); // Force crash if DB isn't available
  }
}

// --- API ROUTES ---

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    const [projects] = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (e) {
    console.error('Error in GET /api/projects:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const id = req.body.id || uuidv4();
    const { name, organization, status, template, total_records, valid_records, invalid_records, missing_photos, color, created_by } = req.body;
    
    await pool.query(
      'INSERT INTO projects (id, name, organization, status, template, total_records, valid_records, invalid_records, missing_photos, color, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [id, name, organization, status, template, total_records || 0, valid_records || 0, invalid_records || 0, missing_photos || 0, color || '#3B82F6', created_by]
    );
    
    const [projects] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(projects[0]);
  } catch (e) {
    console.error('Error in POST /api/projects:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, organization, status, template, total_records, valid_records, invalid_records, missing_photos, color, created_by } = req.body;
    
    await pool.query(
      'UPDATE projects SET name = ?, organization = ?, status = ?, template = ?, total_records = ?, valid_records = ?, invalid_records = ?, missing_photos = ?, color = ?, created_by = ? WHERE id = ?',
      [name, organization, status, template, total_records, valid_records, invalid_records, missing_photos, color, created_by, id]
    );
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error in PUT /api/projects:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Delete associated records first
    await pool.query('DELETE FROM records WHERE project_id = ?', [id]);
    
    // Delete project
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Error in DELETE /api/projects:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:id/issues', async (req, res) => {
  try {
    const projectId = req.params.id;
    const [issues] = await pool.query(
      'SELECT * FROM records WHERE project_id = ? AND (photo_url IS NULL OR photo_url = ?)',
      [projectId, '']
    );
    res.json(issues.map(i => ({
      id: i.id,
      recordId: i.id,
      record: i.name || 'Unnamed Record',
      message: 'Missing photo',
      severity: 'warning',
      fixable: true
    })));
  } catch (e) {
    console.error('Error in GET /api/projects/:id/issues:', e);
    res.status(500).json({ error: e.message });
  }
});

// Records
app.get('/api/records', async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = 'SELECT * FROM records';
    let params = [];
    
    if (projectId) {
      query += ' WHERE project_id = ?';
      params.push(projectId);
    }
    
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (e) {
    console.error('Error in GET /api/records:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/records/bulk', async (req, res) => {
  try {
    const { projectId, records } = req.body;
    
    for (const r of records) {
      const id = r.id || uuidv4();
      const { name, photo_url, data } = r;
      const jsonData = typeof data === 'object' ? JSON.stringify(data) : data;
      
      await pool.query(
        'INSERT INTO records (id, project_id, name, photo_url, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [id, projectId, name, photo_url, jsonData]
      );
    }
    
    res.json({ success: true, count: records.length });
  } catch (e) {
    console.error('Error in POST /api/records/bulk:', e);
    res.status(500).json({ error: e.message });
  }
});

// Orders (Project Sessions)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.json({
        id: req.params.id,
        projectId: req.params.id.replace('order-', ''),
        status: 'draft',
        totalCards: 0
      });
    }
    res.json(orders[0]);
  } catch (e) {
    console.error('Error in GET /api/orders/:id:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const id = req.body.id || `order-${uuidv4()}`;
    const { projectId, status } = req.body;
    
    await pool.query(
      'INSERT INTO orders (id, projectId, status, created_at) VALUES (?, ?, ?, NOW())',
      [id, projectId, status || 'pending']
    );
    
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    res.json(orders[0]);
  } catch (e) {
    console.error('Error in POST /api/orders:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(orders[0]);
  } catch (e) {
    console.error('Error in PUT /api/orders/:id/status:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body;
    
    // Check if user exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const id = uuidv4();
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, organization, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [id, name, email, password, role || 'user', organization]
    );
    
    const [users] = await pool.query('SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?', [id]);
    const user = users[0];
    res.status(201).json({ ...user, token: `fake-jwt-token-${user.id}` });
  } catch (e) {
    console.error('Error in POST /api/auth/register:', e);
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length > 0 && users[0].password === password) {
      const { password: _, ...userWithoutPass } = users[0];
      res.json({ ...userWithoutPass, token: `fake-jwt-token-${users[0].id}` });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const userId = token.replace('fake-jwt-token-', '');
    
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const [users] = await pool.query('SELECT id, name, email, role, organization, created_at FROM users WHERE id = ?', [userId]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (e) {
    console.error('Error in GET /api/auth/me:', e);
    res.status(500).json({ message: e.message });
  }
});

app.put('/api/auth/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, organization, created_at FROM users');
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.delete('/api/auth/users/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found to delete.' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.put('/api/auth/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [result] = await pool.query('UPDATE users SET password = ? WHERE id = ?', [password, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found in the database. Ensure ID match.' });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.put('/api/auth/users/:id', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'No valid data to update' });
    }

    const [result] = await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found in the database.' });
    }

    res.json({ success: true, message: 'Profile updated successfully', name });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [projectsResult] = await pool.query('SELECT COUNT(*) as count FROM projects');
    const [subAdminsResult] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const [usersResult] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
    
    res.json({
      totalProjects: projectsResult[0].count,
      totalAdmins: subAdminsResult[0].count,
      totalUsers: usersResult[0].count
    });
  } catch (e) {
    console.error('Error in GET /api/dashboard/stats:', e);
    res.status(500).json({ error: e.message });
  }
});

// Uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  res.json({
    url: `${req.protocol}://${req.get('host')}/uploads/${filename}`,
    path: `uploads/${filename}`
  });
});

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Start Server
connectDB().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  });
});
