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
CREATE TABLE IF NOT EXISTS training_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'Intermediate',
  estimated_hours REAL DEFAULT 4,
  objective TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  submission_requirements TEXT NOT NULL,
  is_mandatory INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_mandatory INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS training_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Started',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  task_version INTEGER NOT NULL DEFAULT 1,
  started_at TEXT,
  last_submitted_at TEXT,
  completed_at TEXT,
  approved_at TEXT,
  approved_by TEXT,
  admin_feedback TEXT,
  employee_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(task_id, user_id)
);

CREATE TABLE IF NOT EXISTS training_checklist_progress (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  checklist_item_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE(assignment_id, checklist_item_id)
);

CREATE TABLE IF NOT EXISTS training_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  submission_number INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  demo_url TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted',
  admin_feedback TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS training_submission_attachments (
  id TEXT PRIMARY KEY,
  submission_id TEXT,
  assignment_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Evidence',
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_challenges (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  assignment_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  product_model TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium',
  steps_attempted TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  actual_behavior TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  assigned_investigator_id TEXT,
  resolution_summary TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  kb_article_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_challenge_comments (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'Comment',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_challenge_attachments (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_kb_articles (
  id TEXT PRIMARY KEY,
  challenge_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  product_model TEXT NOT NULL,
  symptom TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  solution TEXT NOT NULL,
  prevention TEXT NOT NULL,
  tags TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_status_history (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
`;

const tasksData = [
  {
    id: "TASK-01",
    title: "Smart Life App Mastery",
    slug: "smart-life-app-mastery",
    category: "App Configuration",
    difficulty: "Beginner",
    estimated_hours: 4,
    objective: "Master all core functions, device pairing, automated schedules, and condition-based triggers in the Smart Life ecosystem.",
    description: "Explore the complete Smart Life / Tuya configuration interface, establish room hierarchies, pair both Wi-Fi and Zigbee hardware, set up automated schedules, and test notification rules.",
    instructions: "1. Download and set up the latest Smart Life app on your smartphone.\n2. Create a test home hierarchy with at least 3 distinct rooms (e.g., Living Room, Bedroom, Entrance).\n3. Pair at least one Wi-Fi device and one Zigbee sub-device through a gateway.\n4. Explore device sharing permissions across team accounts.\n5. Create 3 Tap-to-Run one-click scenes.\n6. Configure automated time-based schedules for automatic device switching.\n7. Test weather/condition-based automations (sunrise/sunset).\n8. Implement automation execution delays and multiple trigger conditions.\n9. Create device groups and test notification delivery.",
    submission_requirements: JSON.stringify(["Screenshots of home rooms and paired device list", "Screenshots of configured Tap-to-Run scenes and automations", "Screen recording (1-2 mins) showing one-tap scene execution and delay test"]),
    is_mandatory: 1,
    sort_order: 1,
    checklist: [
      "Explore all app menus and settings",
      "Create a home and configure rooms",
      "Pair Wi-Fi and Zigbee devices",
      "Explore sharing and permissions",
      "Create Tap-to-Run scenes",
      "Create time-based schedules",
      "Create condition-based automations",
      "Explore sunrise/sunset triggers",
      "Test automation delays and multiple conditions",
      "Explore device groups and notifications",
      "Submit screenshots and a screen recording"
    ]
  },
  {
    id: "TASK-02",
    title: "Smart Switch Experiments",
    slug: "smart-switch-experiments",
    category: "Switches & Wiring",
    difficulty: "Intermediate",
    estimated_hours: 6,
    objective: "Hands-on electrical installation, channel testing, power-on state configuration, and offline behaviour analysis of smart touch switches.",
    description: "Wire a smart switch on the test training rig, pair it, configure individual gang channels, verify power recovery behaviour, test operation without active internet, and compare Wi-Fi vs Zigbee response times.",
    instructions: "1. Mount and wire a multi-gang smart switch on a safe test board with neutral and phase lines.\n2. Pair the switch into the app and assign channel labels.\n3. Test both physical capacitive touch and remote app switching for each channel.\n4. Configure 'Power-On Behavior' (Off, On, Remember Last State) and test with power breaker cycling.\n5. Create multi-switch 2-way / multi-way virtual association scenes.\n6. Disconnect the WAN uplink/Wi-Fi router and verify if physical touch control remains instantaneous.\n7. Document status synchronization latency between physical tap and app UI update.\n8. Record differences noticed between Wi-Fi and Zigbee switch response.",
    submission_requirements: JSON.stringify(["Clear photograph of wiring diagram and physical test board setup", "Photographs of app channel configuration and power-on state settings", "Demonstration video showing physical switching, app sync, and offline response"]),
    is_mandatory: 1,
    sort_order: 2,
    checklist: [
      "Install a smart switch on a safe test board",
      "Configure it in Smart Life",
      "Test physical and app control",
      "Test individual channels",
      "Configure power-on behaviour",
      "Create multi-switch scenes",
      "Test operation during internet disconnection",
      "Compare Wi-Fi and Zigbee behaviour",
      "Investigate status synchronisation",
      "Submit wiring diagrams, photographs, and demonstration video"
    ]
  },
  {
    id: "TASK-03",
    title: "Create 10 Smart Home Automations",
    slug: "create-10-smart-home-automations",
    category: "Automation Logic",
    difficulty: "Intermediate",
    estimated_hours: 6,
    objective: "Design and implement 10 production-grade smart home automations covering luxury residential scenarios.",
    description: "Build 10 realistic automation routines spanning morning routines, night modes, security triggers, occupancy sensing, scheduled curtains, and multi-device single button triggers.",
    instructions: "Configure each of the 10 scenarios in the app:\n1. Good Morning scene (lights fade up, curtains open, morning plugs on).\n2. Good Night scene (all master lights off, night lamp on, doors locked).\n3. Away From Home scene (all loads off, perimeter armed).\n4. Welcome Home scene (corridor lights on, ambient lighting active).\n5. Motion-based corridor lighting with auto-off timer.\n6. Door-triggered entrance lighting active only after sunset.\n7. Scheduled curtain operation at 8:00 AM and 6:30 PM.\n8. Automatic light shutoff when no occupancy detected for 15 minutes.\n9. Security alert notification if door opens while Away mode active.\n10. Multi-device scene executed from a single master switch gang or scene switch.",
    submission_requirements: JSON.stringify(["Detailed screenshot for each of the 10 automation logic rules", "Short working demo video showcasing live triggering of at least 3 automations", "Written summary explaining edge cases handled (e.g. Day/Night restriction)"]),
    is_mandatory: 1,
    sort_order: 3,
    checklist: [
      "Good Morning scene",
      "Good Night scene",
      "Away From Home scene",
      "Welcome Home scene",
      "Motion-based corridor lighting",
      "Door-triggered entrance lighting",
      "Scheduled curtain operation",
      "Automatic light shutoff",
      "Security alert automation",
      "Multi-device scene controlled by one button",
      "Submit configuration screenshots and working demonstrations"
    ]
  },
  {
    id: "TASK-04",
    title: "Smart Sensor Configuration",
    slug: "smart-sensor-configuration",
    category: "Sensors & Security",
    difficulty: "Intermediate",
    estimated_hours: 5,
    objective: "Calibrate, test sensitivity thresholds, and integrate PIR motion and door/window contact sensors.",
    description: "Pair door and motion sensors, measure detection range, sensitivity, and blind-time timeouts, verify battery life telemetry, and test sensor-triggered automation accuracy.",
    instructions: "1. Pair wireless door contact sensors and PIR motion detectors.\n2. Configure push notification alerts for sensor trigger and tamper.\n3. Measure and record effective detection distances (3m, 5m, 7m) and angles.\n4. Measure trigger response time from physical motion to automation execution.\n5. Inspect battery percentage reporting in app.\n6. Create sensor-based automated lighting with 60-second no-motion turn-off.\n7. Test sensor behaviour during gateway reboot or router disconnection.\n8. Investigate potential causes of false triggering (heat sources, pets, reflections) and how to mitigate.",
    submission_requirements: JSON.stringify(["Sensor configuration screenshots and battery telemetry", "Tabulated test report of distance/angle measurements and response times", "Demonstration video of sensor triggering live automation"]),
    is_mandatory: 1,
    sort_order: 4,
    checklist: [
      "Pair door and motion sensors",
      "Configure notifications",
      "Test detection at different distances",
      "Test response times and sensitivity",
      "Check battery reporting",
      "Create sensor-based lighting automation",
      "Test offline behaviour",
      "Investigate false triggering",
      "Submit test reports"
    ]
  },
  {
    id: "TASK-05",
    title: "Smart Door Lock Mastery",
    slug: "smart-door-lock-mastery",
    category: "Access Control",
    difficulty: "Advanced",
    estimated_hours: 7,
    objective: "Master installation mechanics, biometric registration, temporary passcodes, emergency overrides, and access log auditing for smart digital locks.",
    description: "Learn mortise and cylinder installation, register fingerprints and RFID credentials, configure one-time guest passwords, review real-time access audit logs, and master mechanical emergency key and Type-C power overrides.",
    instructions: "1. Review the installation template, mortise alignment, and spindle insertion.\n2. Configure Master Admin password and administrator credentials.\n3. Register test fingerprints (thumb and index) and test 360-degree recognition.\n4. Set up PIN codes (regular, anti-peep decoy PINs).\n5. Program and verify RFID keycards.\n6. Generate time-limited temporary passcodes for guests and service staff.\n7. Test gateway connectivity and remote unlocking permissions.\n8. Review the access log history in the app.\n9. Demonstrate battery low alert, emergency physical key override, and Type-C 5V jumpstart power.\n10. Document top 5 customer troubleshooting questions for smart locks.",
    submission_requirements: JSON.stringify(["Step-by-step troubleshooting guide for smart lock errors", "Video showing admin setup, fingerprint unlock, and emergency key override", "Photos of mortise mounting and wiring connectors"]),
    is_mandatory: 1,
    sort_order: 5,
    checklist: [
      "Study installation procedures",
      "Configure administrator access",
      "Register fingerprints and PINs",
      "Configure RFID cards where supported",
      "Explore temporary access",
      "Configure mobile app and gateway functions",
      "Test access logs",
      "Practise battery replacement and emergency access",
      "Document common errors",
      "Submit a demonstration and troubleshooting guide"
    ]
  },
  {
    id: "TASK-06",
    title: "Smart Garage Door Controller",
    slug: "smart-garage-door-controller",
    category: "Gate Automation",
    difficulty: "Intermediate",
    estimated_hours: 5,
    objective: "Wire, calibrate, and automate smart dry-contact garage and rolling shutter controllers with magnetic position feedback.",
    description: "Connect dry-contact relay controllers to motor push-button terminals, install magnetic reed sensors for position feedback, test remote open/close commands, and establish auto-close safety rules.",
    instructions: "1. Study the wiring schematic for motor dry-contact control terminals (COM + NO).\n2. Wire the smart controller on the test setup.\n3. Pair the controller in the Smart Life app.\n4. Install and align the magnetic reed sensor to detect door closed/opened position.\n5. Test manual and app open/close/stop commands.\n6. Verify accurate position reporting in the mobile app.\n7. Configure an automation rule (e.g. notify if garage left open for more than 10 minutes).\n8. Simulate Wi-Fi drop and power outage recovery.\n9. Document safety requirements (photocells, obstacle detection, siren warnings).",
    submission_requirements: JSON.stringify(["Circuit wiring diagram showing motor and dry-contact connections", "Photos of sensor alignment and app status indicator", "Video demonstration of open/close operation and timeout alert"]),
    is_mandatory: 1,
    sort_order: 6,
    checklist: [
      "Study wiring and compatibility",
      "Install on a suitable test setup",
      "Configure Smart Life",
      "Test opening and closing",
      "Test position feedback if supported",
      "Explore remote operation",
      "Configure an automation",
      "Investigate connectivity failures",
      "Document safety requirements",
      "Submit a working demonstration"
    ]
  },
  {
    id: "TASK-07",
    title: "Zigbee Gateway and Network Testing",
    slug: "zigbee-gateway-and-network-testing",
    category: "Zigbee & Networking",
    difficulty: "Advanced",
    estimated_hours: 6,
    objective: "Construct and stress-test a multi-device Zigbee 3.0 mesh network across routing and end-device nodes.",
    description: "Deploy wired/wireless Zigbee hubs, pair multiple routing nodes (AC switches) and end devices (sensors), test mesh repeaters across physical barriers, and analyze network self-healing upon gateway or router power cycling.",
    instructions: "1. Set up a Zigbee 3.0 gateway and pair it to the primary network.\n2. Pair at least 4 Zigbee sub-devices (switches as routers, sensors as battery end-devices).\n3. Test pairing distance from hub and observe mesh relaying through AC-powered switches.\n4. Evaluate signal strength and latency through walls or partitions.\n5. Power cycle the Zigbee gateway and record the time taken for all sub-devices to re-establish connection.\n6. Reboot the main Wi-Fi router and observe local Zigbee automation execution without internet.\n7. Document device limits, channel interference with 2.4 GHz Wi-Fi, and compatibility findings.\n8. Draw a clear network topology diagram illustrating coordinator, routers, and end devices.",
    submission_requirements: JSON.stringify(["Zigbee network topology diagram (Coordinator, Routers, End-devices)", "Documented latency and recovery test report", "Screenshots of sub-device management list inside the gateway hub"]),
    is_mandatory: 1,
    sort_order: 7,
    checklist: [
      "Configure a gateway",
      "Pair multiple Zigbee devices",
      "Test pairing at different distances",
      "Investigate repeater functionality",
      "Test behaviour after gateway restart",
      "Test behaviour after router restart",
      "Investigate offline recovery",
      "Document compatibility",
      "Submit a network topology diagram"
    ]
  },
  {
    id: "TASK-08",
    title: "Smart Lighting and Curtain Automation",
    slug: "smart-lighting-and-curtain-automation",
    category: "Lighting & Curtains",
    difficulty: "Intermediate",
    estimated_hours: 6,
    objective: "Configure smart LED controllers (dimming, CCT, RGB) and assemble, calibrate, and automate motorized curtain tracks.",
    description: "Set up dimmable and tunable white drivers, build color scenes, calibrate motorized curtain track travel limits, configure percentage opening, and automate synchronized curtain and lighting moods.",
    instructions: "1. Wire a smart LED driver/controller to a test strip light.\n2. Configure brightness dimming (1% to 100%) and verify flicker-free performance.\n3. Test CCT color temperature tuning (Warm White 2700K to Cool White 6500K) or RGB color selection.\n4. Create smooth lighting scenes (e.g. Movie Mode, Dinner, Focus).\n5. Mount a curtain motor on a track or test jig and calibrate open/close limit positions.\n6. Test remote control and percentage opening (e.g. 50% open).\n7. Set up sunrise/sunset scheduled curtain opening and closing.\n8. Document common track assembly and belt tensioning faults.\n9. Record a demonstration showing synchronized lighting scene and curtain movement.",
    submission_requirements: JSON.stringify(["Demonstration video showing curtain motor calibration, percentage opening, and LED dimming", "Photographs of controller wiring and track mounting", "Curtain track assembly notes and belt tension tips"]),
    is_mandatory: 1,
    sort_order: 8,
    checklist: [
      "Configure smart LED drivers",
      "Test dimming and brightness",
      "Explore RGB and colour temperature where supported",
      "Create lighting scenes",
      "Install and calibrate curtain motors",
      "Configure open, close, and stop operations",
      "Test percentage positioning where supported",
      "Create scheduled curtain automation",
      "Investigate installation faults",
      "Submit a demonstration video"
    ]
  },
  {
    id: "TASK-09",
    title: "CCTV and NVR Troubleshooting",
    slug: "cctv-and-nvr-troubleshooting",
    category: "CCTV & Surveillance",
    difficulty: "Advanced",
    estimated_hours: 7,
    objective: "Configure IP cameras, static subnet routing, manual ONVIF/RTSP streams, PoE switches, and NVR recording channels.",
    description: "Assign static IP plans, add third-party cameras manually to an NVR using ONVIF and RTSP, troubleshoot IP conflicts, configure PoE ports, setup motion recording schedules, and verify mobile remote streaming.",
    instructions: "1. Configure static IP addresses and subnets on test IP cameras.\n2. Connect cameras through a PoE switch and verify power budget / link negotiation.\n3. Add cameras manually to the NVR using ONVIF protocol with username/password authentication.\n4. Test RTSP stream URL retrieval and playback in VLC media player.\n5. Troubleshoot host unreachable errors, default gateway mismatches, and IP subnet conflicts.\n6. Configure motion detection recording schedules and storage retention on the NVR.\n7. Set up remote mobile app viewing (P2P cloud and port forwarding concepts).\n8. Document compatibility issues and resolutions when integrating CP Plus, Hikvision, and Dahua cameras.\n9. Compile a comprehensive CCTV Troubleshooting Handbook.",
    submission_requirements: JSON.stringify(["CCTV and NVR Troubleshooting Handbook (PDF or document)", "Screenshots of NVR camera management table and ONVIF configuration", "Screenshot of active RTSP stream verification in VLC"]),
    is_mandatory: 1,
    sort_order: 9,
    checklist: [
      "Configure static camera IP addresses",
      "Add cameras to NVR manually",
      "Test ONVIF configuration",
      "Test RTSP streaming",
      "Troubleshoot network host errors",
      "Investigate IP conflicts and subnet mismatches",
      "Test PoE connectivity",
      "Configure recording and playback",
      "Configure remote viewing",
      "Document CP Plus and Hikvision integration issues",
      "Submit a troubleshooting handbook"
    ]
  },
  {
    id: "TASK-10",
    title: "Complete Smart Home Demonstration",
    slug: "complete-smart-home-demonstration",
    category: "System Integration",
    difficulty: "Mastery",
    estimated_hours: 8,
    objective: "Integrate a comprehensive mini smart home showcase combining lighting, switches, sensors, curtains, scenes, and access control into a unified demonstration.",
    description: "Design and build a multi-system working model using available office hardware. Program at least 5 interconnected cross-device automations and present a complete live walkthrough.",
    instructions: "1. Assemble a unified smart home test station including: smart switch, door sensor, motion sensor, smart lighting, curtain motor, and smart lock or garage controller.\n2. Establish at least 5 interconnected automations (e.g. Door unlocked -> corridor light fades on -> curtain opens if daytime -> welcome audio alert).\n3. Test the complete setup under various real-world usage patterns.\n4. Prepare a single-line wiring and system connectivity diagram.\n5. Record a 5-minute professional walkthrough video demonstrating all features and automations.",
    submission_requirements: JSON.stringify(["5-minute comprehensive video demonstration with clear narration", "Complete system connectivity and wiring diagram", "Detailed configuration and automation trigger matrix list"]),
    is_mandatory: 1,
    sort_order: 10,
    checklist: [
      "Build a mini smart home using available office products",
      "Include smart lighting, motion sensors, door sensors, scenes, curtains, and supported lock or garage controller functions",
      "Create at least five interconnected automations",
      "Test the complete system",
      "Submit a 5-minute demonstration video, system diagram, and configuration list"
    ]
  },
  {
    id: "TASK-11",
    title: "Troubleshooting Challenge",
    slug: "troubleshooting-challenge",
    category: "Troubleshooting",
    difficulty: "Mastery",
    estimated_hours: 8,
    objective: "Analyze, reproduce, diagnose, and document root causes and permanent solutions for 10 common field failures.",
    description: "Investigate real-world installation and operational failures, determine exact root causes, and write standard operating procedures (SOPs) for symptom, root cause, solution, and prevention.",
    instructions: "Diagnose and document the following 10 field issues:\n1. Switch pairing failures (2.4 GHz vs 5 GHz Wi-Fi, mesh steering, AP isolation).\n2. Devices frequently going offline (weak RSSI, DHCP lease expiration, noisy neutral line).\n3. Failed automations (conflicting conditions, cloud delay, missing trigger state).\n4. Sensor false triggers (air conditioning vents, sunlight glare, pet movement).\n5. Zigbee disconnections (thick RCC slabs, metal electrical backboxes, lack of routers).\n6. Physical switch vs app state discrepancies (neutral back-feeding, multi-way wiring errors).\n7. Smart lock biometric read failures and motor jams.\n8. CCTV/NVR stream dropouts and packet loss.\n9. Partial scene execution (Wi-Fi packet collision, lack of delays between commands).\n10. Compile each issue into: Symptom -> Root Cause -> Step-by-Step Solution -> Future Prevention.",
    submission_requirements: JSON.stringify(["Comprehensive Troubleshooting Guide covering all 10 problems", "Symptom, Root Cause, Solution, and Prevention documented for each issue", "At least 3 practical examples of successfully resolved test rig challenges"]),
    is_mandatory: 1,
    sort_order: 11,
    checklist: [
      "Diagnose switch pairing failures",
      "Diagnose offline devices",
      "Troubleshoot failed automations",
      "Investigate sensor false triggers",
      "Diagnose Zigbee disconnections",
      "Troubleshoot physical versus app control discrepancies",
      "Diagnose smart lock and curtain issues",
      "Troubleshoot CCTV/NVR connectivity",
      "Investigate partial scene execution",
      "For every issue, document symptom, root cause, solution, and prevention"
    ]
  },
  {
    id: "TASK-12",
    title: "Customer Demonstration and Sales Support",
    slug: "customer-demonstration-and-sales-support",
    category: "Sales & Demonstration",
    difficulty: "Mastery",
    estimated_hours: 6,
    objective: "Deliver a compelling, non-technical customer demonstration and master answers to 20 tough client technical questions.",
    description: "Prepare and deliver a 10-minute client-friendly smart home demo, explain complex technical concepts (Wi-Fi vs Zigbee, local vs cloud, retrofit wiring) simply, and answer 20 common customer objections.",
    instructions: "1. Prepare a 10-minute structured presentation demonstrating smart home luxury and convenience.\n2. Explain products clearly without using confusing technical jargon.\n3. Demonstrate at least 5 compelling lifestyle use-cases (Morning mood, Security alert, Energy saving, Guest access, Bedtime convenience).\n4. Explain Wi-Fi vs Zigbee differences so a non-technical homeowner easily understands.\n5. Explain what works locally when the internet is disconnected vs cloud-dependent features.\n6. Demonstrate how customer adds family members and configures permissions.\n7. Honestly explain system limitations and how Techomie designs around them.\n8. Prepare and document clear answers to 20 common customer questions.",
    submission_requirements: JSON.stringify(["10-minute customer demonstration presentation video", "Written document with 20 Customer Questions and Answers", "Admin assessment / peer evaluation form"]),
    is_mandatory: 1,
    sort_order: 12,
    checklist: [
      "Prepare a 10-minute smart home demonstration",
      "Explain each product in simple language",
      "Demonstrate at least five customer use cases",
      "Explain Wi-Fi versus Zigbee",
      "Explain local control and internet-dependent features",
      "Demonstrate customer app sharing",
      "Explain product limitations",
      "Prepare answers to 20 common customer questions",
      "Submit a demonstration video or admin-verified assessment"
    ]
  }
];

async function run() {
  console.log("=== Running Technical Academy Migration & Seeding ===");

  // 1. Run on Supabase if present
  if (supabase) {
    console.log("Applying schema to Supabase PostgreSQL via techomie_exec...");
    const statements = createTablesSQL.split(';').map(s => s.trim()).filter(Boolean);
    for (const sql of statements) {
      const res = await supabase.rpc('techomie_exec', { query_text: sql + ';', query_params: [] });
      if (res.error) {
        console.warn("Supabase SQL warning:", res.error.message, "SQL:", sql.slice(0, 50));
      }
    }
    console.log("Supabase schema applied.");
  }

  // 2. Run on local SQLite databases
  const sqliteDbs = ['.local-db.sqlite', 'db/local.sqlite'];
  for (const dbFile of sqliteDbs) {
    if (fs.existsSync(dbFile)) {
      console.log(`Applying schema to SQLite: ${dbFile}...`);
      const db = new DatabaseSync(dbFile);
      db.exec(createTablesSQL);
      console.log(`SQLite schema applied to ${dbFile}.`);
    }
  }

  // 3. Seed Tasks & Checklist Items
  const now = new Date().toISOString();
  console.log("Seeding 12 Technical Tasks...");

  for (const task of tasksData) {
    // Upsert into Supabase
    if (supabase) {
      await supabase.rpc('techomie_exec', {
        query_text: `
          INSERT INTO training_tasks (id, title, slug, category, difficulty, estimated_hours, objective, description, instructions, submission_requirements, is_mandatory, sort_order, version, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, 1, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            slug = EXCLUDED.slug,
            category = EXCLUDED.category,
            difficulty = EXCLUDED.difficulty,
            estimated_hours = EXCLUDED.estimated_hours,
            objective = EXCLUDED.objective,
            description = EXCLUDED.description,
            instructions = EXCLUDED.instructions,
            submission_requirements = EXCLUDED.submission_requirements,
            is_mandatory = EXCLUDED.is_mandatory,
            sort_order = EXCLUDED.sort_order,
            updated_at = EXCLUDED.updated_at;
        `,
        query_params: [
          task.id, task.title, task.slug, task.category, task.difficulty,
          task.estimated_hours, task.objective, task.description, task.instructions,
          task.submission_requirements, task.is_mandatory, task.sort_order, now, now
        ]
      });

      // Insert checklist items
      for (let i = 0; i < task.checklist.length; i++) {
        const itemTitle = task.checklist[i];
        const stepId = `${task.id}-S${String(i + 1).padStart(2, '0')}`;
        await supabase.rpc('techomie_exec', {
          query_text: `
            INSERT INTO training_checklist_items (id, task_id, step_number, title, is_mandatory)
            VALUES ($1, $2, $3, $4, 1)
            ON CONFLICT (id) DO UPDATE SET
              step_number = EXCLUDED.step_number,
              title = EXCLUDED.title;
          `,
          query_params: [stepId, task.id, i + 1, itemTitle]
        });
      }
    }

    // Upsert into local SQLite databases
    for (const dbFile of sqliteDbs) {
      if (fs.existsSync(dbFile)) {
        const db = new DatabaseSync(dbFile);
        const taskStmt = db.prepare(`
          INSERT INTO training_tasks (id, title, slug, category, difficulty, estimated_hours, objective, description, instructions, submission_requirements, is_mandatory, sort_order, version, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            title = excluded.title,
            slug = excluded.slug,
            category = excluded.category,
            difficulty = excluded.difficulty,
            estimated_hours = excluded.estimated_hours,
            objective = excluded.objective,
            description = excluded.description,
            instructions = excluded.instructions,
            submission_requirements = excluded.submission_requirements,
            is_mandatory = excluded.is_mandatory,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at;
        `);
        taskStmt.run(
          task.id, task.title, task.slug, task.category, task.difficulty,
          task.estimated_hours, task.objective, task.description, task.instructions,
          task.submission_requirements, task.is_mandatory, task.sort_order, now, now
        );

        const checkStmt = db.prepare(`
          INSERT INTO training_checklist_items (id, task_id, step_number, title, is_mandatory)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT (id) DO UPDATE SET
            step_number = excluded.step_number,
            title = excluded.title;
        `);
        for (let i = 0; i < task.checklist.length; i++) {
          const itemTitle = task.checklist[i];
          const stepId = `${task.id}-S${String(i + 1).padStart(2, '0')}`;
          checkStmt.run(stepId, task.id, i + 1, itemTitle);
        }
      }
    }
  }

  console.log("Tasks and checklist items seeded successfully.");

  // 4. Auto-assignment to all active non-admin users
  console.log("Checking active non-admin employees for automatic assignment...");
  let employees = [];
  if (supabase) {
    const res = await supabase.rpc('techomie_exec', {
      query_text: `SELECT id, name, email, role FROM users WHERE active = 1 AND LOWER(role) != 'admin';`,
      query_params: []
    });
    employees = res.data || [];
  } else {
    const db = new DatabaseSync('.local-db.sqlite');
    employees = db.prepare("SELECT id, name, email, role FROM users WHERE active = 1 AND LOWER(role) != 'admin'").all();
  }

  console.log(`Found ${employees.length} eligible non-admin employees:`, employees.map(e => `${e.name} (${e.role})`).join(', '));

  let assignmentCount = 0;
  for (const emp of employees) {
    for (let tIdx = 0; tIdx < tasksData.length; tIdx++) {
      const task = tasksData[tIdx];
      const asnId = `ASN-${emp.id.slice(0, 6)}-${task.id}`;
      // Stagger due dates 7 days apart starting from +7 days
      const dueDate = new Date(Date.now() + (tIdx + 1) * 7 * 86400000).toISOString().slice(0, 16);

      if (supabase) {
        const ins = await supabase.rpc('techomie_exec', {
          query_text: `
            INSERT INTO training_assignments (id, task_id, user_id, assigned_at, due_at, status, progress_percent, task_version, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'Not Started', 0, 1, $6, $7)
            ON CONFLICT (task_id, user_id) DO NOTHING;
          `,
          query_params: [asnId, task.id, emp.id, now, dueDate, now, now]
        });
        assignmentCount++;

        // Initialize checklist progress
        for (let i = 0; i < task.checklist.length; i++) {
          const stepId = `${task.id}-S${String(i + 1).padStart(2, '0')}`;
          const progId = `CKP-${asnId}-${stepId}`;
          await supabase.rpc('techomie_exec', {
            query_text: `
              INSERT INTO training_checklist_progress (id, assignment_id, checklist_item_id, completed)
              VALUES ($1, $2, $3, 0)
              ON CONFLICT (assignment_id, checklist_item_id) DO NOTHING;
            `,
            query_params: [progId, asnId, stepId]
          });
        }
      }

      for (const dbFile of sqliteDbs) {
        if (fs.existsSync(dbFile)) {
          const db = new DatabaseSync(dbFile);
          db.prepare(`
            INSERT INTO training_assignments (id, task_id, user_id, assigned_at, due_at, status, progress_percent, task_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'Not Started', 0, 1, ?, ?)
            ON CONFLICT (task_id, user_id) DO NOTHING;
          `).run(asnId, task.id, emp.id, now, dueDate, now, now);

          for (let i = 0; i < task.checklist.length; i++) {
            const stepId = `${task.id}-S${String(i + 1).padStart(2, '0')}`;
            const progId = `CKP-${asnId}-${stepId}`;
            db.prepare(`
              INSERT INTO training_checklist_progress (id, assignment_id, checklist_item_id, completed)
              VALUES (?, ?, ?, 0)
              ON CONFLICT (assignment_id, checklist_item_id) DO NOTHING;
            `).run(progId, asnId, stepId);
          }
        }
      }
    }
  }

  console.log(`Auto-assigned tasks to all non-admin employees (Total processed: ${assignmentCount}).`);
  console.log("=== Migration & Seeding Complete! ===");
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
