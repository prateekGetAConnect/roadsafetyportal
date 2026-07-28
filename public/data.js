/**
 * India Transport Analytics POC — Mock Data Generator
 *
 * Exports everything on `window.TransportData`.
 * Uses a seeded PRNG (mulberry32) so the dataset is identical across reloads.
 *
 * Relational links
 *   challan.dlNumber   → driver.dlNumber
 *   challan.regNumber  → vehicle.regNumber
 *   vehicle.ownerDL    → driver.dlNumber
 *   accident.vehicleRegNumbers → vehicle.regNumber[]
 */
(function () {
  'use strict';

  // ─── Seeded PRNG (mulberry32) ────────────────────────────────────────
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rand = mulberry32(20240815);

  // Helpers
  function randInt(min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
  }
  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }
  function pickWeighted(items, weights) {
    var total = weights.reduce(function (s, w) { return s + w; }, 0);
    var r = rand() * total;
    for (var i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }
  function formatDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }

  // ─── Indian Names ────────────────────────────────────────────────────
  var firstNamesMale = [
    'Rajesh', 'Amit', 'Vikram', 'Arjun', 'Sanjay', 'Ravi', 'Suresh', 'Manoj',
    'Anil', 'Deepak', 'Rohit', 'Pankaj', 'Vikas', 'Sachin', 'Rahul', 'Gaurav',
    'Naveen', 'Ajay', 'Karan', 'Nitin', 'Pranav', 'Harsh', 'Siddharth', 'Ashwin',
    'Gopal', 'Ramesh', 'Tushar', 'Yash', 'Aman', 'Dhruv'
  ];

  var firstNamesFemale = [
    'Priya', 'Sunita', 'Meena', 'Kavita', 'Deepa', 'Anjali', 'Neha', 'Pooja',
    'Swati', 'Rekha', 'Asha', 'Geeta', 'Lakshmi', 'Divya', 'Sneha', 'Nandini',
    'Shruti', 'Pallavi', 'Renu', 'Bhavna', 'Tanvi', 'Aditi', 'Isha', 'Jyoti',
    'Sarita', 'Komal', 'Megha', 'Ankita', 'Ritika', 'Vaishali'
  ];

  var surnames = [
    'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Joshi', 'Reddy',
    'Nair', 'Yadav', 'Mehta', 'Chauhan', 'Mishra', 'Thakur', 'Das', 'Kaur',
    'Menon', 'Iyer', 'Pillai', 'Hegde', 'Naidu', 'Bhat', 'Kulkarni', 'Deshmukh',
    'Patil', 'Gowda', 'Shetty', 'Rao', 'Pandey', 'Tiwari', 'Saxena', 'Malhotra'
  ];

  function randomName() {
    var isMale = rand() < 0.6;
    var first = isMale ? pick(firstNamesMale) : pick(firstNamesFemale);
    return { name: first + ' ' + pick(surnames), gender: isMale ? 'Male' : 'Female' };
  }

  // ─── States & RTOs ───────────────────────────────────────────────────
  var states = ['Delhi', 'Maharashtra', 'Karnataka'];

  var rtosByState = {
    Delhi: ['Janakpuri RTO', 'Sarai Kale Khan RTO', 'Loni RTO', 'Dwarka RTO'],
    Maharashtra: ['Andheri RTO', 'Pune RTO', 'Thane RTO', 'Nagpur RTO'],
    Karnataka: ['Jayanagar RTO', 'Rajajinagar RTO', 'Mysuru RTO', 'Hubli RTO']
  };

  var stateCode = { Delhi: 'DL', Maharashtra: 'MH', Karnataka: 'KA' };
  var stateDistrictRange = { Delhi: [1, 14], Maharashtra: [1, 50], Karnataka: [1, 65] };

  var roadSegments = [
    { name: 'NH-48 Gurugram-Delhi KM 12-15', gps: { lat: 28.4595, lng: 77.0266 }, state: 'Delhi', district: 'South West Delhi', area: 'Gurugram Border' },
    { name: 'Ring Road Rajiv Chowk', gps: { lat: 28.6139, lng: 77.2090 }, state: 'Delhi', district: 'New Delhi', area: 'Connaught Place' },
    { name: 'Outer Ring Road Nehru Place', gps: { lat: 28.5494, lng: 77.2517 }, state: 'Delhi', district: 'South East Delhi', area: 'Nehru Place' },
    { name: 'GT Karnal Road KM 5-8', gps: { lat: 28.7295, lng: 77.1530 }, state: 'Delhi', district: 'North Delhi', area: 'Alipur' },
    { name: 'Mathura Road Faridabad Border', gps: { lat: 28.4970, lng: 77.2846 }, state: 'Delhi', district: 'South East Delhi', area: 'Badarpur' },
    { name: 'NH-24 Ghaziabad-Delhi KM 3-6', gps: { lat: 28.6624, lng: 77.3887 }, state: 'Delhi', district: 'East Delhi', area: 'Ghazipur' },
    { name: 'Mehrauli-Badarpur Road', gps: { lat: 28.5100, lng: 77.2600 }, state: 'Delhi', district: 'South Delhi', area: 'Mehrauli' },
    { name: 'Palam Flyover', gps: { lat: 28.5830, lng: 77.0870 }, state: 'Delhi', district: 'South West Delhi', area: 'Palam' },
    { name: 'Dwarka Expressway KM 10-14', gps: { lat: 28.5730, lng: 77.0030 }, state: 'Delhi', district: 'South West Delhi', area: 'Dwarka' },
    { name: 'ITO Bridge Crossing', gps: { lat: 28.6280, lng: 77.2420 }, state: 'Delhi', district: 'Central Delhi', area: 'ITO' },
    
    { name: 'Mumbai-Pune Expressway KM 45', gps: { lat: 18.8750, lng: 73.2860 }, state: 'Maharashtra', district: 'Pune', area: 'Lonavala' },
    { name: 'Western Express Highway Andheri', gps: { lat: 19.1197, lng: 72.8464 }, state: 'Maharashtra', district: 'Mumbai Suburban', area: 'Andheri' },
    { name: 'Eastern Express Highway Thane', gps: { lat: 19.1860, lng: 72.9637 }, state: 'Maharashtra', district: 'Thane', area: 'Teen Hath Naka' },
    { name: 'Pune-Nashik Highway KM 22', gps: { lat: 18.6750, lng: 73.8650 }, state: 'Maharashtra', district: 'Pune', area: 'Chakan' },
    { name: 'Sion-Panvel Expressway KM 8', gps: { lat: 19.0550, lng: 73.0120 }, state: 'Maharashtra', district: 'Mumbai Suburban', area: 'Mankhurd' },
    { name: 'Hinjewadi IT Park Road', gps: { lat: 18.5910, lng: 73.7380 }, state: 'Maharashtra', district: 'Pune', area: 'Hinjewadi' },
    { name: 'Mumbai-Nashik Highway KM 30', gps: { lat: 19.3050, lng: 72.9770 }, state: 'Maharashtra', district: 'Thane', area: 'Bhiwandi' },
    { name: 'Nagpur-Amravati Road KM 15', gps: { lat: 21.1580, lng: 79.0350 }, state: 'Maharashtra', district: 'Nagpur', area: 'Wadi' },
    { name: 'Bandra-Worli Sea Link', gps: { lat: 19.0380, lng: 72.8190 }, state: 'Maharashtra', district: 'Mumbai City', area: 'Worli' },
    { name: 'Pune Ring Road Katraj', gps: { lat: 18.4530, lng: 73.8630 }, state: 'Maharashtra', district: 'Pune', area: 'Katraj' },
    
    { name: 'Outer Ring Road Marathahalli', gps: { lat: 12.9538, lng: 77.7014 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Marathahalli' },
    { name: 'Bengaluru-Mysuru Highway KM 80', gps: { lat: 12.5500, lng: 76.8900 }, state: 'Karnataka', district: 'Mandya', area: 'Maddur' },
    { name: 'NICE Road Kengeri', gps: { lat: 12.9100, lng: 77.4870 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Kengeri' },
    { name: 'Tumkur Road Nelamangala', gps: { lat: 13.0960, lng: 77.3900 }, state: 'Karnataka', district: 'Bengaluru Rural', area: 'Nelamangala' },
    { name: 'Hosur Road Electronic City', gps: { lat: 12.8456, lng: 77.6603 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Electronic City' },
    { name: 'Bellary Road Hebbal Flyover', gps: { lat: 13.0358, lng: 77.5970 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Hebbal' },
    { name: 'Old Airport Road Domlur', gps: { lat: 12.9610, lng: 77.6380 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Domlur' },
    { name: 'Mysuru Ring Road KM 5', gps: { lat: 12.3100, lng: 76.6400 }, state: 'Karnataka', district: 'Mysuru', area: 'Vijayanagar' },
    { name: 'Hubli-Dharwad Bypass', gps: { lat: 15.3647, lng: 75.1240 }, state: 'Karnataka', district: 'Dharwad', area: 'Hubli' },
    { name: 'Kanakpura Road Rajarajeshwari Nagar', gps: { lat: 12.8920, lng: 77.5190 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'RR Nagar' },
    { name: 'Bannerghatta Road KM 12', gps: { lat: 12.8780, lng: 77.6020 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Bannerghatta' },
    { name: 'Whitefield Main Road', gps: { lat: 12.9698, lng: 77.7499 }, state: 'Karnataka', district: 'Bengaluru Urban', area: 'Whitefield' }
  ];

  // ─── Vehicle Makes/Models ────────────────────────────────────────────
  var vehicleCatalog = {
    '2W': [
      { make: 'Honda', model: 'Activa 6G', fuel: 'Petrol' },
      { make: 'TVS', model: 'Jupiter', fuel: 'Petrol' },
      { make: 'Bajaj', model: 'Pulsar 150', fuel: 'Petrol' },
      { make: 'Royal Enfield', model: 'Classic 350', fuel: 'Petrol' },
      { make: 'Hero', model: 'Splendor Plus', fuel: 'Petrol' },
      { make: 'Suzuki', model: 'Access 125', fuel: 'Petrol' },
      { make: 'Yamaha', model: 'FZ-S V3', fuel: 'Petrol' },
      { make: 'Ather', model: '450X', fuel: 'Electric' },
      { make: 'Ola', model: 'S1 Pro', fuel: 'Electric' },
      { make: 'TVS', model: 'iQube', fuel: 'Electric' }
    ],
    LMV: [
      { make: 'Maruti Suzuki', model: 'Swift', fuel: 'Petrol' },
      { make: 'Maruti Suzuki', model: 'WagonR', fuel: 'CNG' },
      { make: 'Hyundai', model: 'Creta', fuel: 'Diesel' },
      { make: 'Hyundai', model: 'i20', fuel: 'Petrol' },
      { make: 'Tata', model: 'Nexon', fuel: 'Petrol' },
      { make: 'Tata', model: 'Nexon EV', fuel: 'Electric' },
      { make: 'Mahindra', model: 'XUV700', fuel: 'Diesel' },
      { make: 'Kia', model: 'Seltos', fuel: 'Petrol' },
      { make: 'Toyota', model: 'Innova Crysta', fuel: 'Diesel' },
      { make: 'Honda', model: 'City', fuel: 'Petrol' },
      { make: 'Maruti Suzuki', model: 'Dzire', fuel: 'CNG' },
      { make: 'MG', model: 'Hector', fuel: 'Petrol' }
    ],
    HMV: [
      { make: 'Tata', model: 'Prima 4028.S', fuel: 'Diesel' },
      { make: 'Ashok Leyland', model: 'Captain 2523', fuel: 'Diesel' },
      { make: 'Eicher', model: 'Pro 3018', fuel: 'Diesel' },
      { make: 'BharatBenz', model: '2823R', fuel: 'Diesel' },
      { make: 'Mahindra', model: 'Blazo X 35', fuel: 'Diesel' }
    ],
    '3W': [
      { make: 'Bajaj', model: 'RE Compact', fuel: 'CNG' },
      { make: 'Piaggio', model: 'Ape City', fuel: 'CNG' },
      { make: 'Mahindra', model: 'Treo Zor', fuel: 'Electric' },
      { make: 'TVS', model: 'King Dimo', fuel: 'CNG' }
    ],
    BUS: [
      { make: 'Ashok Leyland', model: 'Viking', fuel: 'Diesel' },
      { make: 'Tata', model: 'Starbus Ultra', fuel: 'Diesel' },
      { make: 'Volvo', model: '9600', fuel: 'Diesel' },
      { make: 'Eicher', model: 'Skyline Pro', fuel: 'Diesel' },
      { make: 'Olectra', model: 'K9', fuel: 'Electric' }
    ]
  };

  var colors = ['White', 'Silver', 'Grey', 'Black', 'Red', 'Blue', 'Brown', 'Green', 'Maroon', 'Yellow'];
  var bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  var licenseTypes = ['MCWG', 'LMV', 'HMV', 'HGMV', 'TRANS'];

  var violationTypes = [
    'Over Speeding', 'No Helmet', 'Red Light Jump', 'No Seatbelt',
    'Drunk Driving', 'Mobile Use', 'Overloading', 'Without License',
    'No Insurance', 'No PUCC'
  ];
  var violationWeights = [25, 20, 15, 10, 8, 8, 5, 3, 3, 3];

  var detectionModes = ['Manual', 'Speed Camera', 'Red-Light Camera', 'ANPR'];
  var detectionWeights = [50, 20, 15, 15];

  var fineAmountMap = {
    'Over Speeding': [1000, 2000],
    'No Helmet': [1000, 1000],
    'Red Light Jump': [1000, 1000],
    'No Seatbelt': [1000, 1000],
    'Drunk Driving': [10000, 10000],
    'Mobile Use': [5000, 5000],
    'Overloading': [20000, 20000],
    'Without License': [5000, 5000],
    'No Insurance': [2000, 2000],
    'No PUCC': [1000, 1000]
  };

  var accidentCauses = [
    'Over Speeding', 'Drunk Driving', 'Wrong Side', 'Road Condition',
    'Weather', 'Distracted Driving', 'Mechanical Failure'
  ];
  var accidentCauseWeights = [35, 20, 15, 10, 8, 7, 5];

  var severities = ['Fatal', 'Grievous', 'Minor'];
  var severityWeights = [15, 35, 50];

  var weatherTypes = ['Clear', 'Rainy', 'Foggy', 'Cloudy'];
  var seasons = ['Summer', 'Monsoon', 'Winter', 'Spring'];
  var timesOfDay = ['Morning', 'Afternoon', 'Evening', 'Night'];
  var todWeights = [15, 20, 25, 40];

  var daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ─── Generate DL Number ──────────────────────────────────────────────
  function generateDL(state) {
    var code = stateCode[state];
    var dr = stateDistrictRange[state];
    var district = pad(randInt(dr[0], dr[1]), 2);
    var year = randInt(2005, 2023);
    var serial = pad(randInt(10000, 9999999), 7);
    return code + '-' + district + year + serial;
  }

  // ─── Generate Vehicle Reg ────────────────────────────────────────────
  function generateReg(state) {
    var code = stateCode[state];
    var district = pad(randInt(1, 99), 2);
    var alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var series = alpha[randInt(0, alpha.length - 1)] + alpha[randInt(0, alpha.length - 1)];
    var num = pad(randInt(1000, 9999), 4);
    return code + '-' + district + '-' + series + '-' + num;
  }

  function generateChassis() {
    var chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    var s = 'MA3';
    for (var i = 0; i < 14; i++) s += chars[randInt(0, chars.length - 1)];
    return s;
  }

  function generateEngine() {
    var chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    var s = '';
    for (var i = 0; i < 3; i++) s += chars[randInt(0, 25)];
    for (var i = 0; i < 8; i++) s += chars[randInt(26, chars.length - 1)];
    return s;
  }

  function generatePhone() {
    var prefixes = ['98', '97', '96', '95', '94', '93', '91', '90', '88', '87', '86', '85', '78', '77', '76', '70'];
    return pick(prefixes) + pad(randInt(10000000, 99999999), 8);
  }

  // ─── Generate Drivers ────────────────────────────────────────────────
  var drivers = [];
  var dlSet = {};
  for (var i = 0; i < 10000; i++) {
    var state = pickWeighted(states, [45, 35, 40]);
    var nameObj = randomName();
    var dl;
    do { dl = generateDL(state); } while (dlSet[dl]);
    dlSet[dl] = true;

    // age: skew 25-45
    var age = pickWeighted(
      [randInt(18, 24), randInt(25, 35), randInt(36, 45), randInt(46, 55), randInt(56, 65)],
      [15, 35, 30, 12, 8]
    );

    var issueYear = 2024 - randInt(1, Math.min(age - 17, 30));
    var issueDate = new Date(issueYear, randInt(0, 11), randInt(1, 28));
    var expiryDate = new Date(issueYear + 20, issueDate.getMonth(), issueDate.getDate());
    var yearsExp = 2024 - issueYear;

    // Test attempts: younger = more likely multiple
    var testAttempts;
    if (age < 25) {
      testAttempts = pickWeighted([1, 2, 3, 4], [30, 35, 25, 10]);
    } else {
      testAttempts = pickWeighted([1, 2, 3, 4], [60, 25, 10, 5]);
    }

    // Status
    var status;
    if (i < 5) {
      status = 'Suspended';
    } else if (expiryDate < new Date(2024, 7, 1)) {
      status = 'Expired';
    } else {
      status = 'Active';
    }

    var licType = pick(licenseTypes);
    var commercial = licType === 'HGMV' || licType === 'TRANS' || rand() < 0.15;

    drivers.push({
      dlNumber: dl,
      name: nameObj.name,
      age: age,
      gender: nameObj.gender,
      state: state,
      rtoOffice: pick(rtosByState[state]),
      licenseType: licType,
      issueDate: formatDate(issueDate),
      expiryDate: formatDate(expiryDate),
      yearsExperience: yearsExp,
      testAttempts: testAttempts,
      status: status,
      violationCount: 0, // will update after challans
      accidentCount: 0,  // will update after accidents
      commercialUsage: commercial,
      bloodGroup: pick(bloodGroups),
      phone: generatePhone()
    });
  }

  // ─── Generate Vehicles ───────────────────────────────────────────────
  var vehicles = [];
  var regSet = {};
  var vehicleTypePool = [];
  // 40% 2W, 35% LMV, 10% HMV, 10% 3W, 5% BUS  → out of 10000
  var typeCounts = { '2W': 4000, LMV: 3500, HMV: 1000, '3W': 1000, BUS: 500 };
  for (var t in typeCounts) {
    for (var c = 0; c < typeCounts[t]; c++) vehicleTypePool.push(t);
  }
  // Shuffle
  for (var i = vehicleTypePool.length - 1; i > 0; i--) {
    var j = randInt(0, i);
    var tmp = vehicleTypePool[i];
    vehicleTypePool[i] = vehicleTypePool[j];
    vehicleTypePool[j] = tmp;
  }

  for (var i = 0; i < 10000; i++) {
    var ownerDriver = drivers[i]; // 1:1 mapping
    var state = ownerDriver.state;
    var vType = vehicleTypePool[i];
    var reg;
    do { reg = generateReg(state); } while (regSet[reg]);
    regSet[reg] = true;

    var catalog = pick(vehicleCatalog[vType]);
    var regYear = randInt(2010, 2023);
    var vehicleAge = 2024 - regYear;
    var regDate = new Date(regYear, randInt(0, 11), randInt(1, 28));

    // Fitness validity
    var fitnessYear = regYear + (vType === '2W' ? 15 : 5);
    while (fitnessYear < 2024) fitnessYear += (vType === '2W' ? 5 : 2);
    var fitnessExpired = rand() < 0.15;
    var fitnessValid;
    if (fitnessExpired) {
      fitnessValid = new Date(2024, randInt(0, 5), randInt(1, 28));
    } else {
      fitnessValid = new Date(2025 + randInt(0, 2), randInt(0, 11), randInt(1, 28));
    }

    // PUCC validity
    var puccExpired = rand() < 0.10;
    var puccValid;
    if (puccExpired) {
      puccValid = new Date(2024, randInt(0, 6), randInt(1, 28));
    } else {
      puccValid = new Date(2025, randInt(0, 11), randInt(1, 28));
    }

    // Insurance validity
    var insValid = new Date(2025, randInt(0, 11), randInt(1, 28));

    var isCommercial = vType === 'HMV' || vType === 'BUS' || vType === '3W' || rand() < 0.10;

    vehicles.push({
      regNumber: reg,
      ownerName: ownerDriver.name,
      ownerDL: ownerDriver.dlNumber,
      type: vType,
      make: catalog.make,
      model: catalog.model,
      fuelType: catalog.fuel,
      registrationDate: formatDate(regDate),
      vehicleAge: vehicleAge,
      chassisNumber: generateChassis(),
      engineNumber: generateEngine(),
      color: pick(colors),
      state: state,
      commercialUse: isCommercial,
      fitnessValidTill: formatDate(fitnessValid),
      fitnessExpired: fitnessExpired,
      puccValidTill: formatDate(puccValid),
      puccExpired: puccExpired,
      insuranceValidTill: formatDate(insValid),
      ownershipChanges: pickWeighted([0, 1, 2, 3], [55, 25, 15, 5]),
      accidentCount: 0 // updated later
    });
  }

  // ─── Generate Challans ───────────────────────────────────────────────
  var challans = [];

  // Pick repeat offenders
  var repeatOffenderIndices = [];
  for (var i = 0; i < 1500; i++) {
    repeatOffenderIndices.push(randInt(0, 9999));
  }

  // Assign challan counts
  var challanAssignments = []; // { driverIdx, vehicleIdx }
  var repeatTotal = 0;

  for (var r = 0; r < repeatOffenderIndices.length; r++) {
    var dIdx = repeatOffenderIndices[r];
    var count = randInt(5, 15);
    for (var c = 0; c < count && repeatTotal + c < 20000; c++) {
      challanAssignments.push({ driverIdx: dIdx, vehicleIdx: dIdx });
    }
    repeatTotal += count;
  }

  // Fill remaining to 25000
  while (challanAssignments.length < 25000) {
    var dIdx = randInt(0, 9999);
    challanAssignments.push({ driverIdx: dIdx, vehicleIdx: dIdx });
  }
  challanAssignments.length = 25000;

  // Shuffle
  for (var i = challanAssignments.length - 1; i > 0; i--) {
    var j = randInt(0, i);
    var tmp = challanAssignments[i];
    challanAssignments[i] = challanAssignments[j];
    challanAssignments[j] = tmp;
  }

  // Track violation counts per driver
  var driverViolationMap = {};

  for (var i = 0; i < 25000; i++) {
    var assign = challanAssignments[i];
    var driver = drivers[assign.driverIdx];
    var vehicle = vehicles[assign.vehicleIdx];
    var state = driver.state;

    var violation = pickWeighted(violationTypes, violationWeights);
    var fineRange = fineAmountMap[violation];
    var fine = fineRange[0] === fineRange[1] ? fineRange[0] : randInt(fineRange[0], fineRange[1]);

    var payStatus = pickWeighted(['Paid', 'Pending', 'Overdue'], [60, 25, 15]);

    // Date/time
    var challanDate = new Date(2024, randInt(0, 11), randInt(1, 28));
    var hour = randInt(0, 23);
    var minute = randInt(0, 59);

    var seg = pick(roadSegments.filter(function (s) { return s.state === state; }));
    if (!seg) seg = pick(roadSegments);

    // Track per driver
    if (!driverViolationMap[driver.dlNumber]) driverViolationMap[driver.dlNumber] = 0;
    driverViolationMap[driver.dlNumber]++;

    var isRepeat = driverViolationMap[driver.dlNumber] > 1;

    var detection = pickWeighted(detectionModes, detectionWeights);
    // Speed cameras only for speeding
    if (violation !== 'Over Speeding' && detection === 'Speed Camera') detection = 'Manual';
    if (violation !== 'Red Light Jump' && detection === 'Red-Light Camera') detection = 'Manual';

    challans.push({
      challanId: 'CH-' + stateCode[state] + '-2024-' + pad(i + 1, 6),
      dateTime: formatDate(challanDate) + 'T' + pad(hour, 2) + ':' + pad(minute, 2) + ':00',
      location: seg.name,
      gps: { lat: seg.gps.lat + (rand() - 0.5) * 0.01, lng: seg.gps.lng + (rand() - 0.5) * 0.01 },
      violationType: violation,
      dlNumber: driver.dlNumber,
      regNumber: vehicle.regNumber,
      detectionMode: detection,
      fineAmount: fine,
      paymentStatus: payStatus,
      repeatOffence: isRepeat,
      state: state,
      officerBadge: 'T-' + pad(randInt(1000, 9999), 4)
    });
  }

  // Update driver violationCount
  for (var i = 0; i < drivers.length; i++) {
    drivers[i].violationCount = driverViolationMap[drivers[i].dlNumber] || 0;
  }

  // ─── Generate Accidents ──────────────────────────────────────────────
  var accidents = [];

  // Create hotspot segments (some segments get multiple accidents)
  var hotspotSegments = [
    roadSegments[0],  // NH-48
    roadSegments[1],  // Ring Road Rajiv Chowk
    roadSegments[10], // Mumbai-Pune Expressway
    roadSegments[20], // ORR Marathahalli
    roadSegments[3],  // GT Karnal Road
    roadSegments[24], // Hosur Road
    roadSegments[11], // WEH Andheri
    roadSegments[4]   // Mathura Road
  ];

  for (var i = 0; i < 2500; i++) {
    // Hotspot bias: 60% from hotspot segments
    var seg;
    if (rand() < 0.60) {
      seg = pick(hotspotSegments);
    } else {
      seg = pick(roadSegments);
    }

    var severity = pickWeighted(severities, severityWeights);
    var cause = pickWeighted(accidentCauses, accidentCauseWeights);
    var tod = pickWeighted(timesOfDay, todWeights);
    var weather = pick(weatherTypes);

    // Determine season from month
    var accMonth = randInt(0, 11);
    var accDate = new Date(2024, accMonth, randInt(1, 28));
    var season;
    if (accMonth >= 2 && accMonth <= 4) season = 'Summer';
    else if (accMonth >= 5 && accMonth <= 8) season = 'Monsoon';
    else if (accMonth >= 9 && accMonth <= 11) season = 'Winter';
    else season = 'Spring';

    // Time based on time-of-day
    var accHour;
    if (tod === 'Morning') accHour = randInt(5, 11);
    else if (tod === 'Afternoon') accHour = randInt(12, 16);
    else if (tod === 'Evening') accHour = randInt(17, 20);
    else accHour = randInt(21, 23);

    var casualties = severity === 'Fatal' ? randInt(1, 3) : 0;
    var injured = severity === 'Fatal' ? randInt(1, 5) : severity === 'Grievous' ? randInt(1, 4) : randInt(0, 1);

    // Pick 1-3 vehicles involved
    var numVehicles = pickWeighted([1, 2, 3], [40, 45, 15]);
    var involvedRegs = [];
    var involvedTypes = [];
    var stateVehicles = vehicles.filter(function (v) { return v.state === seg.state; });
    if (stateVehicles.length === 0) stateVehicles = vehicles;

    for (var v = 0; v < numVehicles; v++) {
      var veh = pick(stateVehicles);
      if (involvedRegs.indexOf(veh.regNumber) === -1) {
        involvedRegs.push(veh.regNumber);
        if (involvedTypes.indexOf(veh.type) === -1) involvedTypes.push(veh.type);
      }
    }

    accidents.push({
      accidentId: 'ACC-' + stateCode[seg.state] + '-2024-' + pad(i + 1, 4),
      date: formatDate(accDate),
      time: pad(accHour, 2) + ':' + pad(randInt(0, 59), 2),
      dayOfWeek: daysOfWeek[accDate.getDay()],
      location: seg.name,
      gps: { lat: seg.gps.lat + (rand() - 0.5) * 0.008, lng: seg.gps.lng + (rand() - 0.5) * 0.008 },
      state: seg.state,
      district: seg.district,
      area: seg.area,
      severity: severity,
      vehicleTypes: involvedTypes,
      cause: cause,
      roadSegment: seg.name,
      weather: weather,
      season: season,
      timeOfDay: tod,
      casualties: casualties,
      injured: injured,
      vehicleRegNumbers: involvedRegs,
      firNumber: 'FIR-' + stateCode[seg.state] + '-2024-' + pad(randInt(1000, 9999), 4)
    });

    // Update vehicle accident counts
    for (var r = 0; r < involvedRegs.length; r++) {
      for (var vi = 0; vi < vehicles.length; vi++) {
        if (vehicles[vi].regNumber === involvedRegs[r]) {
          vehicles[vi].accidentCount++;
          break;
        }
      }
    }
  }

  // Update driver accident counts based on vehicle ownership
  var regToDriverDL = {};
  for (var i = 0; i < vehicles.length; i++) {
    regToDriverDL[vehicles[i].regNumber] = vehicles[i].ownerDL;
  }
  for (var i = 0; i < accidents.length; i++) {
    var regs = accidents[i].vehicleRegNumbers;
    for (var r = 0; r < regs.length; r++) {
      var ownerDL = regToDriverDL[regs[r]];
      if (ownerDL) {
        for (var d = 0; d < drivers.length; d++) {
          if (drivers[d].dlNumber === ownerDL) {
            drivers[d].accidentCount++;
            break;
          }
        }
      }
    }
  }

  // ─── Generate RTO Operations ─────────────────────────────────────────
  var rtoOperations = [];
  var rtoEfficiencyPresets = {
    'Janakpuri RTO':       { eff: 82, staff: 52, busy: 1.3 },
    'Sarai Kale Khan RTO': { eff: 68, staff: 48, busy: 1.4 },
    'Loni RTO':            { eff: 58, staff: 28, busy: 1.1 },
    'Dwarka RTO':          { eff: 91, staff: 55, busy: 1.2 },
    'Andheri RTO':         { eff: 75, staff: 60, busy: 1.5 },
    'Pune RTO':            { eff: 88, staff: 50, busy: 1.0 },
    'Thane RTO':           { eff: 62, staff: 35, busy: 1.2 },
    'Nagpur RTO':          { eff: 72, staff: 30, busy: 0.7 },
    'Jayanagar RTO':       { eff: 93, staff: 58, busy: 1.1 },
    'Rajajinagar RTO':     { eff: 78, staff: 45, busy: 1.0 },
    'Mysuru RTO':          { eff: 85, staff: 38, busy: 0.6 },
    'Hubli RTO':           { eff: 55, staff: 25, busy: 0.5 }
  };

  var serviceNames = ['dlIssuance', 'dlRenewal', 'vehicleRegistration', 'fitnessTest', 'transferOfOwnership', 'duplicateDL'];

  var baseReceived = {
    dlIssuance: 1200,
    dlRenewal: 850,
    vehicleRegistration: 2000,
    fitnessTest: 600,
    transferOfOwnership: 400,
    duplicateDL: 160
  };

  var baseProcessingDays = {
    dlIssuance: 7,
    dlRenewal: 3,
    vehicleRegistration: 14,
    fitnessTest: 10,
    transferOfOwnership: 21,
    duplicateDL: 5
  };

  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var allRTONames = [];
  for (var st in rtosByState) {
    for (var ri = 0; ri < rtosByState[st].length; ri++) {
      allRTONames.push({ name: rtosByState[st][ri], state: st });
    }
  }

  for (var i = 0; i < allRTONames.length; i++) {
    var rtoName = allRTONames[i].name;
    var rtoState = allRTONames[i].state;
    var preset = rtoEfficiencyPresets[rtoName];

    var services = {};
    var totalReceived = 0;
    var totalProcessed = 0;
    var totalPending = 0;
    var totalDays = 0;
    var svcCount = 0;

    for (var si = 0; si < serviceNames.length; si++) {
      var svc = serviceNames[si];
      var received = Math.round(baseReceived[svc] * preset.busy * (0.8 + rand() * 0.4));
      var effFactor = preset.eff / 100;
      var processed = Math.round(received * (effFactor * (0.85 + rand() * 0.15)));
      if (processed > received) processed = received;
      var pending = received - processed;
      var avgDays = Math.round(baseProcessingDays[svc] * (1 + (1 - effFactor) * 2) * (0.8 + rand() * 0.4));

      services[svc] = {
        received: received,
        processed: processed,
        pending: pending,
        avgProcessingDays: avgDays
      };

      totalReceived += received;
      totalProcessed += processed;
      totalPending += pending;
      totalDays += avgDays;
      svcCount++;
    }

    // Test slots
    var totalSlots = Math.round(preset.staff * 2.2 * (0.8 + rand() * 0.4));
    var utilization = Math.min(0.98, preset.eff / 100 * (0.85 + rand() * 0.3));
    var utilized = Math.round(totalSlots * utilization);

    // Monthly trend
    var monthlyTrend = [];
    for (var m = 0; m < 12; m++) {
      var mReceived = Math.round((totalReceived / 12) * (0.7 + rand() * 0.6));
      var mProcessed = Math.round(mReceived * (preset.eff / 100) * (0.8 + rand() * 0.4));
      if (mProcessed > mReceived) mProcessed = mReceived;
      monthlyTrend.push({ month: monthNames[m], received: mReceived, processed: mProcessed });
    }

    rtoOperations.push({
      rtoName: rtoName,
      state: rtoState,
      staffCount: preset.staff,
      services: services,
      testSlots: {
        total: totalSlots,
        utilized: utilized,
        utilization: Math.round(utilization * 100) / 100
      },
      monthlyTrend: monthlyTrend,
      efficiencyScore: preset.eff
    });
  }

  // ─── PUCC Stats ──────────────────────────────────────────────────────
  var puccByType = {};
  var totalValid = 0;
  var totalExpired = 0;
  var vTypes = ['2W', 'LMV', 'HMV', '3W', 'BUS'];

  for (var ti = 0; ti < vTypes.length; ti++) {
    puccByType[vTypes[ti]] = { total: 0, expired: 0 };
  }

  for (var i = 0; i < vehicles.length; i++) {
    var v = vehicles[i];
    puccByType[v.type].total++;
    if (v.puccExpired) {
      puccByType[v.type].expired++;
      totalExpired++;
    } else {
      totalValid++;
    }
  }

  var puccStats = {
    totalVehicles: vehicles.length,
    validPUCC: totalValid,
    expiredPUCC: totalExpired,
    complianceRate: Math.round((totalValid / vehicles.length) * 100) / 100,
    byVehicleType: puccByType
  };

  // ─── Helper Functions ────────────────────────────────────────────────
  // Build lookup maps for fast access
  var dlMap = {};
  for (var i = 0; i < drivers.length; i++) {
    dlMap[drivers[i].dlNumber] = drivers[i];
  }

  var regMap = {};
  for (var i = 0; i < vehicles.length; i++) {
    regMap[vehicles[i].regNumber] = vehicles[i];
  }

  var challansByDL = {};
  var challansByReg = {};
  for (var i = 0; i < challans.length; i++) {
    var ch = challans[i];
    if (!challansByDL[ch.dlNumber]) challansByDL[ch.dlNumber] = [];
    challansByDL[ch.dlNumber].push(ch);
    if (!challansByReg[ch.regNumber]) challansByReg[ch.regNumber] = [];
    challansByReg[ch.regNumber].push(ch);
  }

  function getDriverByDL(dlNumber) {
    return dlMap[dlNumber] || null;
  }

  function getVehicleByReg(regNumber) {
    return regMap[regNumber] || null;
  }

  function getChallansByDL(dlNumber) {
    return challansByDL[dlNumber] || [];
  }

  function getChallansByReg(regNumber) {
    return challansByReg[regNumber] || [];
  }

  function getAccidentsByState(state) {
    return accidents.filter(function (a) { return a.state === state; });
  }

  function getRTOsByState(state) {
    return rtoOperations.filter(function (r) { return r.state === state; });
  }

  /**
   * Fuzzy search drivers by name or DL number. Returns top 5.
   */
  function searchDrivers(query) {
    if (!query || query.length === 0) return [];
    var q = query.toLowerCase();
    var scored = [];

    for (var i = 0; i < drivers.length; i++) {
      var d = drivers[i];
      var nameLower = d.name.toLowerCase();
      var dlLower = d.dlNumber.toLowerCase();
      var score = 0;

      // Exact DL match
      if (dlLower === q) { score = 100; }
      // DL starts with query
      else if (dlLower.indexOf(q) === 0) { score = 80; }
      // DL contains query
      else if (dlLower.indexOf(q) !== -1) { score = 60; }
      // Name exact match
      else if (nameLower === q) { score = 95; }
      // Name starts with query
      else if (nameLower.indexOf(q) === 0) { score = 75; }
      // Any word in name starts with query
      else {
        var words = nameLower.split(' ');
        for (var w = 0; w < words.length; w++) {
          if (words[w].indexOf(q) === 0) { score = 65; break; }
          if (words[w].indexOf(q) !== -1) { score = 45; break; }
        }
      }
      // Substring anywhere
      if (score === 0 && (nameLower.indexOf(q) !== -1 || dlLower.indexOf(q) !== -1)) {
        score = 30;
      }

      if (score > 0) {
        scored.push({ driver: d, score: score });
      }
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    var results = [];
    for (var i = 0; i < Math.min(5, scored.length); i++) {
      results.push(scored[i].driver);
    }
    return results;
  }

  /**
   * Fuzzy search vehicles by reg number or owner name. Returns top 5.
   */
  function searchVehicles(query) {
    if (!query || query.length === 0) return [];
    var q = query.toLowerCase();
    var scored = [];

    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      var regLower = v.regNumber.toLowerCase();
      var ownerLower = v.ownerName.toLowerCase();
      var score = 0;

      if (regLower === q) { score = 100; }
      else if (regLower.indexOf(q) === 0) { score = 80; }
      else if (regLower.indexOf(q) !== -1) { score = 60; }
      else if (ownerLower === q) { score = 95; }
      else if (ownerLower.indexOf(q) === 0) { score = 75; }
      else {
        var words = ownerLower.split(' ');
        for (var w = 0; w < words.length; w++) {
          if (words[w].indexOf(q) === 0) { score = 65; break; }
          if (words[w].indexOf(q) !== -1) { score = 45; break; }
        }
      }
      if (score === 0 && (regLower.indexOf(q) !== -1 || ownerLower.indexOf(q) !== -1)) {
        score = 30;
      }

      if (score > 0) {
        scored.push({ vehicle: v, score: score });
      }
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    var results = [];
    for (var i = 0; i < Math.min(5, scored.length); i++) {
      results.push(scored[i].vehicle);
    }
    return results;
  }

  // ─── Export ───────────────────────────────────────────────────────────
  window.TransportData = {
    drivers: drivers,
    vehicles: vehicles,
    challans: challans,
    accidents: accidents,
    rtoOperations: rtoOperations,
    puccStats: puccStats,
    geography: {
      Delhi: {
        center: { lat: 28.6139, lng: 77.2090 }, zoom: 10,
        districts: {
          'New Delhi': { center: { lat: 28.6139, lng: 77.2090 }, zoom: 12, areas: ['Connaught Place'] },
          'South West Delhi': { center: { lat: 28.5733, lng: 77.0118 }, zoom: 12, areas: ['Gurugram Border', 'Palam', 'Dwarka'] },
          'South East Delhi': { center: { lat: 28.5355, lng: 77.2710 }, zoom: 12, areas: ['Nehru Place', 'Badarpur'] },
          'South Delhi': { center: { lat: 28.4817, lng: 77.1873 }, zoom: 12, areas: ['Mehrauli'] },
          'North Delhi': { center: { lat: 28.7495, lng: 77.1184 }, zoom: 12, areas: ['Alipur'] },
          'East Delhi': { center: { lat: 28.6276, lng: 77.3015 }, zoom: 12, areas: ['Ghazipur'] },
          'Central Delhi': { center: { lat: 28.6441, lng: 77.2192 }, zoom: 12, areas: ['ITO'] }
        }
      },
      Maharashtra: {
        center: { lat: 19.0760, lng: 73.8777 }, zoom: 7,
        districts: {
          'Pune': { center: { lat: 18.5204, lng: 73.8567 }, zoom: 10, areas: ['Lonavala', 'Chakan', 'Hinjewadi', 'Katraj'] },
          'Mumbai Suburban': { center: { lat: 19.1136, lng: 72.8697 }, zoom: 11, areas: ['Andheri', 'Mankhurd'] },
          'Mumbai City': { center: { lat: 18.9750, lng: 72.8258 }, zoom: 12, areas: ['Worli'] },
          'Thane': { center: { lat: 19.2183, lng: 72.9781 }, zoom: 10, areas: ['Teen Hath Naka', 'Bhiwandi'] },
          'Nagpur': { center: { lat: 21.1458, lng: 79.0882 }, zoom: 11, areas: ['Wadi'] }
        }
      },
      Karnataka: {
        center: { lat: 13.9299, lng: 76.2710 }, zoom: 7,
        districts: {
          'Bengaluru Urban': { center: { lat: 12.9716, lng: 77.5946 }, zoom: 11, areas: ['Marathahalli', 'Kengeri', 'Electronic City', 'Hebbal', 'Domlur', 'RR Nagar', 'Bannerghatta', 'Whitefield'] },
          'Bengaluru Rural': { center: { lat: 13.2049, lng: 77.5683 }, zoom: 10, areas: ['Nelamangala'] },
          'Mandya': { center: { lat: 12.5238, lng: 76.8943 }, zoom: 10, areas: ['Maddur'] },
          'Mysuru': { center: { lat: 12.2958, lng: 76.6394 }, zoom: 12, areas: ['Vijayanagar'] },
          'Dharwad': { center: { lat: 15.4589, lng: 75.0078 }, zoom: 11, areas: ['Hubli'] }
        }
      }
    },

    // Lookup helpers
    getDriverByDL: getDriverByDL,
    getVehicleByReg: getVehicleByReg,
    getChallansByDL: getChallansByDL,
    getChallansByReg: getChallansByReg,
    getAccidentsByState: getAccidentsByState,
    getRTOsByState: getRTOsByState,
    searchDrivers: searchDrivers,
    searchVehicles: searchVehicles
  };
})();
