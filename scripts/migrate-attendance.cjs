const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Load environment variables from .env.local
let env = {};
if (fs.existsSync('.env.local')) {
  const envStr = fs.readFileSync('.env.local', 'utf8');
  env = Object.fromEntries(
    envStr.split('\n')
      .filter(l => l.includes('='))
      .map(l => {
        const [k, ...v] = l.split('=');
        return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
      })
  );
}

const { createClient } = require('@supabase/supabase-js');
const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  check_in_latitude REAL,
  check_in_longitude REAL,
  check_out_latitude REAL,
  check_out_longitude REAL,
  check_in_distance_meters REAL,
  check_out_distance_meters REAL,
  total_working_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Incomplete',
  late_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance (employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance (employee_id);

CREATE TABLE IF NOT EXISTS attendance_holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
`;

const defaultSettings = {
  officeName: "Techomie Smart Devices - Head Office",
  officeAddress: "356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar, Coimbatore, Tamil Nadu 641048",
  latitude: 11.0526,
  longitude: 77.0189,
  geofenceRadiusMeters: 100,
  standardStartTime: "09:30",
  standardClosingTime: "18:30",
  gracePeriodMinutes: 15,
  minFullDayHours: 8,
  minHalfDayHours: 4,
  weeklyOffDays: ["Sunday"],
};

const defaultHolidays = [
  { id: "HOL-01", date: "2026-01-01", name: "New Year's Day" },
  { id: "HOL-02", date: "2026-01-15", name: "Pongal" },
  { id: "HOL-03", date: "2026-01-26", name: "Republic Day" },
  { id: "HOL-04", date: "2026-05-01", name: "May Day" },
  { id: "HOL-05", date: "2026-08-15", name: "Independence Day" },
  { id: "HOL-06", date: "2026-10-02", name: "Gandhi Jayanti" },
  { id: "HOL-07", date: "2026-11-08", name: "Diwali" },
  { id: "HOL-08", date: "2026-12-25", name: "Christmas" },
];

async function run() {
  console.log("Starting attendance migration...");

  // 1. Supabase migration
  if (supabase) {
    console.log("Migrating Supabase PostgreSQL...");
    const stmts = [
      `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attendance_date TEXT NOT NULL,
        check_in_time TEXT,
        check_out_time TEXT,
        check_in_latitude REAL,
        check_in_longitude REAL,
        check_out_latitude REAL,
        check_out_longitude REAL,
        check_in_distance_meters REAL,
        check_out_distance_meters REAL,
        total_working_minutes INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Incomplete',
        late_minutes INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT uq_attendance_emp_date UNIQUE (employee_id, attendance_date)
      );`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (attendance_date);`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance (employee_id);`,
      `CREATE TABLE IF NOT EXISTS attendance_holidays (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );`
    ];

    for (const sql of stmts) {
      const res = await supabase.rpc('techomie_exec', { query_text: sql, query_params: [] });
      if (res.error) {
        console.error("Supabase DDL error:", res.error);
      }
    }

    // Seed default settings into settings table
    const checkSettings = await supabase.rpc('techomie_exec', {
      query_text: "SELECT key FROM settings WHERE key = 'attendance_config';",
      query_params: []
    });
    if (!checkSettings.data || checkSettings.data.length === 0) {
      const now = new Date().toISOString();
      await supabase.rpc('techomie_exec', {
        query_text: "INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('attendance_config', $1, 'system', $2) ON CONFLICT (key) DO NOTHING;",
        query_params: [JSON.stringify(defaultSettings), now]
      });
      console.log("Seeded attendance_config in Supabase settings.");
    }

    // Seed holidays
    for (const h of defaultHolidays) {
      await supabase.rpc('techomie_exec', {
        query_text: "INSERT INTO attendance_holidays (id, date, name, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (date) DO NOTHING;",
        query_params: [h.id, h.date, h.name, new Date().toISOString()]
      });
    }
    console.log("Supabase migration finished.");
  }

  // 2. Local SQLite migration
  const sqliteFiles = ['.local-db.sqlite', 'db/local.sqlite'];
  for (const dbFile of sqliteFiles) {
    if (fs.existsSync(dbFile)) {
      console.log(`Migrating SQLite: ${dbFile}...`);
      const db = new DatabaseSync(dbFile);
      db.exec(createTablesSQL);

      const existingConfig = db.prepare("SELECT key FROM settings WHERE key = 'attendance_config'").all();
      if (existingConfig.length === 0) {
        const now = new Date().toISOString();
        const firstUser = db.prepare("SELECT id FROM users LIMIT 1").get();
        const userId = firstUser ? firstUser.id : '1b7ca933-76a2-4760-b549-c001b16d1ffe';
        // In case user doesn't exist, turn PRAGMA foreign_keys = OFF briefly
        db.exec("PRAGMA foreign_keys = OFF;");
        db.prepare("INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('attendance_config', ?, ?, ?)").run(JSON.stringify(defaultSettings), userId, now);
        db.exec("PRAGMA foreign_keys = ON;");
      }

      for (const h of defaultHolidays) {
        try {
          db.prepare("INSERT INTO attendance_holidays (id, date, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (date) DO NOTHING").run(h.id, h.date, h.name, new Date().toISOString());
        } catch (e) {
          // ignore duplicate
        }
      }
      console.log(`Migrated SQLite: ${dbFile}`);
    }
  }

  console.log("Attendance migration complete!");
}

run().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
