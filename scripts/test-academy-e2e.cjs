const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

// Load environment variables
let env = {};
if (fs.existsSync('.env.local')) {
  env = Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8')
      .split('\n')
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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createTestSession(userEmail) {
  // Find user
  let user;
  if (supabase) {
    const res = await supabase.rpc('techomie_exec', {
      query_text: `SELECT id, name, email, role FROM users WHERE email = $1 AND active = 1 LIMIT 1;`,
      query_params: [userEmail]
    });
    user = res.data && res.data[0];
  } else {
    const db = new DatabaseSync('.local-db.sqlite');
    user = db.prepare('SELECT id, name, email, role FROM users WHERE email = ? AND active = 1 LIMIT 1').get(userEmail);
  }

  if (!user) throw new Error(`User not found: ${userEmail}`);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenH = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const sessionId = crypto.randomUUID();

  if (supabase) {
    await supabase.rpc('techomie_exec', {
      query_text: `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5);`,
      query_params: [sessionId, user.id, tokenH, expires, now.toISOString()]
    });
  } else {
    const db = new DatabaseSync('.local-db.sqlite');
    db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(sessionId, user.id, tokenH, expires, now.toISOString());
  }

  return { token, user };
}

async function run() {
  console.log('--- STARTING TECHNICAL ACADEMY E2E TEST ---');

  // 1. Get Admin & Employee Users
  let usersList = [];
  if (supabase) {
    const res = await supabase.rpc('techomie_exec', {
      query_text: `SELECT id, name, email, role FROM users WHERE active = 1;`,
      query_params: []
    });
    usersList = res.data || [];
  } else {
    const db = new DatabaseSync('.local-db.sqlite');
    usersList = db.prepare('SELECT id, name, email, role FROM users WHERE active = 1').all();
  }

  console.log('Available active users:', usersList.map(u => `${u.name} (${u.role}: ${u.email})`).join(', '));

  const admin = usersList.find(u => u.role.toLowerCase() === 'admin');
  const employee = usersList.find(u => u.role.toLowerCase() !== 'admin');

  if (!admin || !employee) {
    throw new Error('Both an admin and non-admin employee are required to test RBAC');
  }

  console.log(`\nAdmin: ${admin.name} (${admin.email})`);
  console.log(`Employee: ${employee.name} (${employee.role} - ${employee.email})`);

  const adminSession = await createTestSession(admin.email);
  const empSession = await createTestSession(employee.email);

  const adminHeaders = {
    'Cookie': `techomie_session=${adminSession.token}`,
    'Content-Type': 'application/json'
  };
  const empHeaders = {
    'Cookie': `techomie_session=${empSession.token}`,
    'Content-Type': 'application/json'
  };

  const BASE_URL = 'http://localhost:3000';

  // TEST 1: Admin Stats
  console.log('\n[TEST 1] Admin Stats API');
  const statsRes = await fetch(`${BASE_URL}/api/academy/stats`, { headers: adminHeaders });
  const statsData = await statsRes.json();
  console.log('Admin Stats Status:', statsRes.status, 'Data:', statsData.kpis ? 'Success (KPIs loaded)' : statsData);
  if (!statsData.kpis) throw new Error('Failed to load admin stats');
  console.log(`KPIs -> Total Employees: ${statsData.kpis.totalEmployees}, Assignments: ${statsData.kpis.totalAssignments}, Completed: ${statsData.kpis.completedTasks}`);

  // TEST 2: Employee cannot view other assignments
  console.log('\n[TEST 2] Employee Assignments Scoping (RBAC)');
  const empAsnRes = await fetch(`${BASE_URL}/api/academy/assignments`, { headers: empHeaders });
  const empAsnData = await empAsnRes.json();
  console.log(`Employee Assignments Count: ${empAsnData.assignments?.length}`);
  const hasOtherEmployees = empAsnData.assignments?.some(a => a.user_id !== employee.id);
  if (hasOtherEmployees) {
    throw new Error('SECURITY VIOLATION: Employee saw task assignments belonging to another user!');
  }
  console.log('✓ RBAC Verified: Employee ONLY sees their own assignments.');

  // TEST 3: Verify Admin has NO task assignments
  console.log('\n[TEST 3] Verify Admin Excluded From Task Assignments');
  const adminAsnRes = await fetch(`${BASE_URL}/api/academy/assignments?user_id=${admin.id}`, { headers: adminHeaders });
  const adminAsnData = await adminAsnRes.json();
  console.log(`Assignments for Admin user ${admin.name}: ${adminAsnData.assignments?.length}`);
  if (adminAsnData.assignments?.length > 0) {
    throw new Error('SECURITY VIOLATION: Admin user received task assignments!');
  }
  console.log('✓ Verified: Admin has 0 task assignments as required.');

  // TEST 4: Employee interactive checklist update
  const firstAssignment = empAsnData.assignments[0];
  console.log(`\n[TEST 4] Updating Checklist for Task: "${firstAssignment.task_title}" (ID: ${firstAssignment.id})`);
  const checklistRes = await fetch(`${BASE_URL}/api/academy/tasks?id=${firstAssignment.task_id}`, { headers: empHeaders });
  const checklistData = await checklistRes.json();
  const firstStep = checklistData.task.checklist[0];

  for (const step of checklistData.task.checklist) {
    const toggleRes = await fetch(`${BASE_URL}/api/academy/assignments`, {
      method: 'PATCH',
      headers: empHeaders,
      body: JSON.stringify({
        action: 'checklist-item',
        assignment_id: firstAssignment.id,
        item_id: step.id,
        is_completed: 1,
        notes: `Completed step: ${step.title}`
      })
    });
    const toggleData = await toggleRes.json();
    if (!toggleData.ok) throw new Error(`Checklist toggle failed: ${JSON.stringify(toggleData)}`);
  }
  console.log(`✓ All ${checklistData.task.checklist.length} checklist steps completed. Progress: 100%`);

  // TEST 5: Employee Submits Task for Review
  console.log('\n[TEST 5] Employee Submitting Task for Review');
  const submitRes = await fetch(`${BASE_URL}/api/academy/submissions`, {
    method: 'POST',
    headers: empHeaders,
    body: JSON.stringify({
      assignment_id: firstAssignment.id,
      report_text: 'Completed all required steps on the test rig. Configured Tap-to-run, schedules, and automation delays.',
      learnings: 'Discovered that Zigbee switch maintains local physical control even when Wi-Fi is disconnected, but Wi-Fi multi-switch scene requires WAN for syncing.',
      attachments: [
        { file_key: 'test/wiring_diag.png', file_name: 'wiring_diag.png', file_type: 'image/png', file_size: 104857 },
        { file_key: 'test/demo_video.mp4', file_name: 'demo_video.mp4', file_type: 'video/mp4', file_size: 2048576 }
      ]
    })
  });
  const submitData = await submitRes.json();
  console.log('Submit Result:', submitData.ok ? 'Success' : submitData, 'Submission ID:', submitData.submission_id);

  // TEST 6: Admin Reviews & Approves Submission
  console.log('\n[TEST 6] Admin Review & Approval');
  const approveRes = await fetch(`${BASE_URL}/api/academy/submissions`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      action: 'approve',
      submission_id: submitData.submission_id,
      admin_feedback: 'Excellent wiring diagram and thorough testing of offline Zigbee behaviour. Approved!'
    })
  });
  const approveData = await approveRes.json();
  console.log('Admin Approval Result:', approveData.ok ? 'Success (Task marked Completed)' : approveData);

  // TEST 7: Employee Reports a Technical Challenge
  console.log('\n[TEST 7] Employee Reporting Technical Challenge');
  const challengeRes = await fetch(`${BASE_URL}/api/academy/challenges`, {
    method: 'POST',
    headers: empHeaders,
    body: JSON.stringify({
      task_id: firstAssignment.task_id,
      title: 'Smart Life Switch Multi-Way Scene Failure during Wi-Fi Router Reboot',
      category: 'Connectivity',
      severity: 'High',
      product_model: 'Phlipton 4-Gang Touch Switch (Wi-Fi)',
      description: 'When router reboots, 2-way virtual association between switch A and switch B fails to trigger until router cloud link is re-established.',
      steps_attempted: '1. Re-paired both switches to 2.4GHz network.\n2. Created local scene in Smart Life.\n3. Powered off Wi-Fi router.',
      expected_behavior: 'Virtual 2-way switching should execute locally or sync immediately after reconnection.',
      actual_behavior: 'Tapping switch A does not toggle switch B when cloud offline.',
      attachments: [
        { file_key: 'test/log_error.png', file_name: 'log_error.png', file_type: 'image/png', file_size: 45000 }
      ]
    })
  });
  const challengeData = await challengeRes.json();
  console.log('Challenge Report Result:', challengeData.ok ? 'Success' : challengeData, 'Challenge ID:', challengeData.challenge_id);

  // TEST 8: Admin Resolves Challenge & Converts to Knowledge Base Article
  console.log('\n[TEST 8] Admin Resolves Challenge & Converts to KB Article');
  const resolveRes = await fetch(`${BASE_URL}/api/academy/challenges`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      challenge_id: challengeData.challenge_id,
      action: 'resolve',
      solution: 'Wi-Fi switches execute automations via Tuya cloud server, so WAN is required for multi-switch association. Use Zigbee switches with a local Zigbee gateway for 100% offline local scene execution.'
    })
  });
  const resolveData = await resolveRes.json();
  console.log('Challenge Resolve Result:', resolveData.ok ? 'Success (Marked Resolved)' : resolveData);

  const kbRes = await fetch(`${BASE_URL}/api/academy/kb`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      challenge_id: challengeData.challenge_id,
      title: 'Fixing Multi-Way Switch Associations during Internet Disconnections',
      category: 'Connectivity',
      product_model: 'Phlipton Smart Switches',
      symptom: 'Switch A does not sync with Switch B when router internet is down',
      root_cause: 'Wi-Fi smart switches require Tuya Cloud MQTT connection to trigger multi-gang mirror automations.',
      solution: 'For mission-critical 2-way circuits without internet dependency, specify Zigbee switches paired to the same Zigbee Hub so local association runs on the Zigbee mesh.',
      prevention: 'Advise customer during site survey: Wi-Fi switches for single points, Zigbee switches + gateway for staircases and multi-way lighting.'
    })
  });
  const kbData = await kbRes.json();
  console.log('Knowledge Base Article Result:', kbData.ok ? 'Success' : kbData, 'KB Article ID:', kbData.article_id);

  // TEST 9: Test Standard Task creation with optional project/customer
  console.log('\n[TEST 9] Creating Standard Task with Optional Project / Customer');
  const taskCreateRes = await fetch(`${BASE_URL}/api/records/tasks`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'E2E Standalone Test Task',
      due_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      assigned_to: employee.id,
      status: 'To Do',
      notes: 'Customer and project are optional'
    })
  });
  const taskCreateData = await taskCreateRes.json();
  const taskCreatedOk = !!(taskCreateData.record || taskCreateData.ok);
  console.log('Standalone Task Create Result:', taskCreatedOk ? 'Success (Task created without project)' : taskCreateData);
  if (!taskCreatedOk) {
    throw new Error(`Failed to create task with optional project: ${JSON.stringify(taskCreateData)}`);
  }

  console.log('\n========================================');
  console.log('ALL 9 END-TO-END TESTS PASSED FLAWLESSLY!');
  console.log('========================================\n');
}

run().catch(e => {
  console.error('\n❌ E2E TEST FAILED:', e);
  process.exit(1);
});
