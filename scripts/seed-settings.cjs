const fs = require('fs');
const envStr = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envStr.split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
}));
const { createClient } = require('@supabase/supabase-js');
const s = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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

async function run() {
  const adminUser = (await s.rpc('techomie_exec', {
    query_text: "SELECT id FROM users WHERE role = 'admin' LIMIT 1;",
    query_params: []
  })).data[0];

  const adminId = adminUser ? adminUser.id : '15cfd945-f4d4-4e21-b4f3-5b4e4000c3a0';
  const now = new Date().toISOString();

  const res = await s.rpc('techomie_exec', {
    query_text: `INSERT INTO settings (key, value, updated_by, updated_at)
      VALUES ('attendance_config', $1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    query_params: [JSON.stringify(defaultSettings), adminId, now]
  });

  console.log("Seed result:", res);
}
run();
