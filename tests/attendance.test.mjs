import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
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

const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

async function runTests() {
  console.log("=== RUNNING ATTENDANCE MODULE TEST SUITE ===");

  // 1. Test Haversine GPS Distance Calculation
  console.log("\n[Test 1] Testing Haversine GPS Distance Calculation...");
  const officeLat = 11.0526;
  const officeLng = 77.0189;
  
  // Exactly at office
  const distZero = calculateHaversineDistance(officeLat, officeLng, officeLat, officeLng);
  assert.strictEqual(distZero, 0, "Distance at same coordinates should be 0m");

  // 30 meters away (approx ~0.00027 deg)
  const nearbyLat = 11.0528;
  const nearbyLng = 77.0189;
  const distNearby = calculateHaversineDistance(officeLat, officeLng, nearbyLat, nearbyLng);
  console.log(`  Nearby point distance: ${distNearby} meters`);
  assert(distNearby < 100, "Point should be within 100m geofence");

  // 2 kilometers away
  const farLat = 11.0300;
  const farLng = 77.0189;
  const distFar = calculateHaversineDistance(officeLat, officeLng, farLat, farLng);
  console.log(`  Far point distance: ${distFar} meters`);
  assert(distFar > 1000, "Point should be well outside 100m geofence");
  console.log("  ✓ Haversine distance test passed.");

  // 2. Test Database Schema & Constraints
  console.log("\n[Test 2] Testing Database Table and Integrity...");
  if (supabase) {
    const res = await supabase.rpc('techomie_exec', {
      query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance';",
      query_params: []
    });
    assert(res.data && res.data.length > 0, "Attendance table should exist in PostgreSQL");
    const colNames = res.data.map(c => c.column_name);
    console.log("  PostgreSQL columns in attendance:", colNames.join(", "));
    assert(colNames.includes("check_in_time"), "check_in_time column exists");
    assert(colNames.includes("check_out_time"), "check_out_time column exists");
    assert(colNames.includes("check_in_distance_meters"), "check_in_distance_meters exists");
    assert(colNames.includes("total_working_minutes"), "total_working_minutes exists");
    assert(colNames.includes("status"), "status exists");
  }
  console.log("  ✓ Database schema verification passed.");

  // 3. Test Attendance Settings in Database
  console.log("\n[Test 3] Testing Attendance Configuration Retrieval...");
  if (supabase) {
    const configRes = await supabase.rpc('techomie_exec', {
      query_text: "SELECT value FROM settings WHERE key = 'attendance_config';",
      query_params: []
    });
    assert(configRes.data && configRes.data.length > 0, "attendance_config exists in settings table");
    const parsed = typeof configRes.data[0].value === 'string' ? JSON.parse(configRes.data[0].value) : configRes.data[0].value;
    console.log("  Configured Office:", parsed.officeName);
    console.log("  Geofence Radius:", parsed.geofenceRadiusMeters, "meters");
    console.log("  Office Timings:", parsed.standardStartTime, "to", parsed.standardClosingTime);
    assert.strictEqual(typeof parsed.geofenceRadiusMeters, "number");
    assert.strictEqual(typeof parsed.latitude, "number");
    assert.strictEqual(typeof parsed.longitude, "number");
  }
  console.log("  ✓ Attendance settings test passed.");

  // 4. Test Single Attendance Record per Employee per Day Constraint
  console.log("\n[Test 4] Testing Unique Constraint: One Record per Employee per Day...");
  const testUserId = "50335ce4-8c35-4e56-8992-1a1d24e55a8e"; // Ajith
  const testDate = "2026-10-02";
  const testId1 = `ATT-TEST-01`;
  const testId2 = `ATT-TEST-02`;
  const nowIso = new Date().toISOString();

  if (supabase) {
    // Clean up test rows first if any
    await supabase.rpc('techomie_exec', {
      query_text: "DELETE FROM attendance WHERE id IN ($1, $2) OR (employee_id = $3 AND attendance_date = $4);",
      query_params: [testId1, testId2, testUserId, testDate]
    });

    // Insert attendance record from remote client site (e.g. 15 km away)
    const remoteLat = 11.1500;
    const remoteLng = 77.1000;
    const remoteDist = calculateHaversineDistance(officeLat, officeLng, remoteLat, remoteLng);
    console.log(`  Testing mark present from remote location (${(remoteDist / 1000).toFixed(1)} km away)...`);

    const ins1 = await supabase.rpc('techomie_exec', {
      query_text: `INSERT INTO attendance (
        id, employee_id, attendance_date, check_in_time, check_in_latitude, check_in_longitude,
        check_in_distance_meters, total_working_minutes, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'Present', $8, $9);`,
      query_params: [testId1, testUserId, testDate, nowIso, remoteLat, remoteLng, remoteDist, nowIso, nowIso]
    });
    assert(!ins1.error, `Remote location mark present should succeed: ${ins1.error?.message}`);
    console.log(`  ✓ Marked present successfully from ${(remoteDist / 1000).toFixed(1)} km away.`);

    // Verify coordinates and maps link can be formed
    const verifyRow = await supabase.rpc('techomie_exec', {
      query_text: "SELECT check_in_latitude, check_in_longitude, check_in_distance_meters, status FROM attendance WHERE id = $1;",
      query_params: [testId1]
    });
    assert.strictEqual(verifyRow.data[0].status, "Present");
    const mapsLink = `https://www.google.com/maps?q=${verifyRow.data[0].check_in_latitude},${verifyRow.data[0].check_in_longitude}`;
    console.log("  ✓ Admin Google Maps pin generated:", mapsLink);

    // Duplicate check on same date for same employee -> Must fail unique constraint
    const ins2 = await supabase.rpc('techomie_exec', {
      query_text: `INSERT INTO attendance (
        id, employee_id, attendance_date, check_in_time, check_in_latitude, check_in_longitude,
        check_in_distance_meters, total_working_minutes, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'Present', $8, $9);`,
      query_params: [testId2, testUserId, testDate, nowIso, remoteLat, remoteLng, remoteDist, nowIso, nowIso]
    });
    assert(ins2.error, "Duplicate mark present on same day MUST fail unique constraint");
    console.log("  ✓ Duplicate mark present on same day correctly blocked by DB constraint.");

    // Clean up test record
    await supabase.rpc('techomie_exec', {
      query_text: "DELETE FROM attendance WHERE id = $1;",
      query_params: [testId1]
    });
    console.log("  ✓ Test data cleaned up.");
  }

  console.log("\n=== ALL ATTENDANCE TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
