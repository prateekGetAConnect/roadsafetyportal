/**
 * India Transport Analytics POC — Risk & Analytics Models
 *
 * Depends on `window.TransportData` (loaded from data.js).
 * Exports on `window.RiskModels`.
 *
 * Models:
 *   calculateDriverRisk(driver, challans)   → { score, category, factors }
 *   calculateVehicleRisk(vehicle, challans) → { score, category, factors }
 *   analyzeRTOEfficiency(rtoOps)            → { overallScore, rating, ... }
 *   analyzeAccidentHotspots(accidents, filters?) → { hotspots, summary }
 *   predictServiceDelay(rtoName, serviceName, additionalStaff) → { ... }
 */
(function () {
  'use strict';

  // ─── Utilities ───────────────────────────────────────────────────────
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function riskCategory(score) {
    if (score <= 33) return 'Low';
    if (score <= 66) return 'Medium';
    return 'High';
  }

  // ─── Driver Risk Score ───────────────────────────────────────────────
  /**
   * Calculates a risk score (0-100) for a driver based on their profile
   * and challan history. Returns explainable factor breakdown.
   *
   * @param {Object} driver - Driver object from TransportData.drivers
   * @param {Array}  challans - Array of challan objects for this driver
   * @returns {{ score: number, category: string, factors: Array }}
   */
  function calculateDriverRisk(driver, challans) {
    if (!driver) return { score: 0, category: 'Low', factors: [] };
    if (!challans) challans = [];

    var factors = [];
    var score = 25; // base

    // ── Factor 1: Violation history ──
    var violationImpact = 0;
    var violationCount = challans.length;
    violationImpact += violationCount * 3;

    // Extra for serious violations
    var drunkCount = 0;
    var speedCount = 0;
    var mobileCount = 0;
    for (var i = 0; i < challans.length; i++) {
      if (challans[i].violationType === 'Drunk Driving') drunkCount++;
      if (challans[i].violationType === 'Over Speeding') speedCount++;
      if (challans[i].violationType === 'Mobile Use') mobileCount++;
    }
    violationImpact += drunkCount * 10;
    violationImpact += speedCount * 5;
    violationImpact += mobileCount * 3;

    if (violationCount > 0) {
      var desc = violationCount + ' challan' + (violationCount > 1 ? 's' : '');
      var serious = [];
      if (drunkCount > 0) serious.push(drunkCount + ' drunk driving');
      if (speedCount > 0) serious.push(speedCount + ' speeding');
      if (mobileCount > 0) serious.push(mobileCount + ' mobile use');
      if (serious.length > 0) desc += ' including ' + serious.join(', ');

      factors.push({
        name: 'Violation History',
        impact: violationImpact,
        direction: 'positive',
        description: desc
      });
    } else {
      violationImpact = -5;
      factors.push({
        name: 'Violation History',
        impact: violationImpact,
        direction: 'negative',
        description: 'Clean record with no challans'
      });
    }
    score += violationImpact;

    // ── Factor 2: Age ──
    var ageImpact = 0;
    var ageDesc = '';
    if (driver.age < 25) {
      ageImpact = 15;
      ageDesc = 'Under 25 (' + driver.age + ' years), statistically higher risk';
    } else if (driver.age > 60) {
      ageImpact = 5;
      ageDesc = 'Over 60 (' + driver.age + ' years), slightly elevated risk';
    } else {
      ageImpact = 0;
      ageDesc = driver.age + ' years old, standard risk age group';
    }
    factors.push({
      name: 'Age Factor',
      impact: ageImpact,
      direction: ageImpact > 0 ? 'positive' : 'neutral',
      description: ageDesc
    });
    score += ageImpact;

    // ── Factor 3: Experience ──
    var expImpact = Math.max(-20, -2 * driver.yearsExperience);
    var expDesc = driver.yearsExperience + ' year' + (driver.yearsExperience !== 1 ? 's' : '') + ' of driving experience';
    if (driver.yearsExperience >= 10) {
      expDesc += ' (significantly reduces risk)';
    } else if (driver.yearsExperience <= 2) {
      expImpact = Math.min(expImpact + 8, 8); // new drivers actually get penalty
      expDesc += ' (very limited experience increases risk)';
    }
    factors.push({
      name: 'Driving Experience',
      impact: expImpact,
      direction: expImpact < 0 ? 'negative' : 'positive',
      description: expDesc
    });
    score += expImpact;

    // ── Factor 4: Test attempts ──
    var testImpact = 0;
    if (driver.testAttempts > 1) {
      testImpact = (driver.testAttempts - 1) * 5;
      factors.push({
        name: 'Test Attempts',
        impact: testImpact,
        direction: 'positive',
        description: driver.testAttempts + ' attempts to pass driving test'
      });
    } else {
      factors.push({
        name: 'Test Attempts',
        impact: 0,
        direction: 'neutral',
        description: 'Passed driving test on first attempt'
      });
    }
    score += testImpact;

    // ── Factor 5: Accident history ──
    var accImpact = driver.accidentCount * 10;
    if (driver.accidentCount > 0) {
      factors.push({
        name: 'Accident History',
        impact: accImpact,
        direction: 'positive',
        description: driver.accidentCount + ' past accident' + (driver.accidentCount > 1 ? 's' : '') + ' linked to this driver'
      });
    } else {
      accImpact = -3;
      factors.push({
        name: 'Accident History',
        impact: accImpact,
        direction: 'negative',
        description: 'No accidents on record'
      });
    }
    score += accImpact;

    // ── Factor 6: Commercial usage ──
    var commImpact = 0;
    if (driver.commercialUsage) {
      commImpact = 8;
      factors.push({
        name: 'Commercial Usage',
        impact: commImpact,
        direction: 'positive',
        description: 'Commercial vehicle operator (higher road exposure)'
      });
    } else {
      factors.push({
        name: 'Commercial Usage',
        impact: 0,
        direction: 'neutral',
        description: 'Non-commercial driver'
      });
    }
    score += commImpact;

    // ── Factor 7: License status ──
    var statusImpact = 0;
    if (driver.status === 'Suspended') {
      statusImpact = 15;
      factors.push({
        name: 'License Status',
        impact: statusImpact,
        direction: 'positive',
        description: 'License currently suspended'
      });
    } else if (driver.status === 'Expired') {
      statusImpact = 8;
      factors.push({
        name: 'License Status',
        impact: statusImpact,
        direction: 'positive',
        description: 'License has expired — not renewed'
      });
    } else {
      factors.push({
        name: 'License Status',
        impact: -2,
        direction: 'negative',
        description: 'Active and valid license'
      });
      statusImpact = -2;
    }
    score += statusImpact;

    // Clamp
    score = clamp(Math.round(score), 0, 100);

    return {
      score: score,
      category: riskCategory(score),
      factors: factors
    };
  }

  // ─── Vehicle Risk Score ──────────────────────────────────────────────
  /**
   * Calculates a risk score (0-100) for a vehicle.
   *
   * @param {Object} vehicle - Vehicle object from TransportData.vehicles
   * @param {Array}  challans - Array of challan objects for this vehicle
   * @returns {{ score: number, category: string, factors: Array }}
   */
  function calculateVehicleRisk(vehicle, challans) {
    if (!vehicle) return { score: 0, category: 'Low', factors: [] };
    if (!challans) challans = [];

    var factors = [];
    var score = 20; // base

    // ── Factor 1: Vehicle age ──
    var ageImpact = 0;
    if (vehicle.vehicleAge > 5) {
      ageImpact = (vehicle.vehicleAge - 5) * 2;
      factors.push({
        name: 'Vehicle Age',
        impact: ageImpact,
        direction: 'positive',
        description: vehicle.vehicleAge + ' years old — wear and mechanical risk increases'
      });
    } else {
      ageImpact = -3;
      factors.push({
        name: 'Vehicle Age',
        impact: ageImpact,
        direction: 'negative',
        description: vehicle.vehicleAge + ' years old — relatively new vehicle'
      });
    }
    score += ageImpact;

    // ── Factor 2: Fitness status ──
    var fitnessImpact = 0;
    if (vehicle.fitnessExpired) {
      fitnessImpact = 25;
      factors.push({
        name: 'Fitness Status',
        impact: fitnessImpact,
        direction: 'positive',
        description: 'Fitness certificate expired (due: ' + vehicle.fitnessValidTill + ')'
      });
    } else {
      fitnessImpact = -5;
      factors.push({
        name: 'Fitness Status',
        impact: fitnessImpact,
        direction: 'negative',
        description: 'Fitness certificate valid until ' + vehicle.fitnessValidTill
      });
    }
    score += fitnessImpact;

    // ── Factor 3: PUCC status ──
    var puccImpact = 0;
    if (vehicle.puccExpired) {
      puccImpact = 15;
      factors.push({
        name: 'PUCC Status',
        impact: puccImpact,
        direction: 'positive',
        description: 'PUCC expired (due: ' + vehicle.puccValidTill + ')'
      });
    } else {
      puccImpact = -2;
      factors.push({
        name: 'PUCC Status',
        impact: puccImpact,
        direction: 'negative',
        description: 'PUCC valid until ' + vehicle.puccValidTill
      });
    }
    score += puccImpact;

    // ── Factor 4: Commercial use ──
    var commImpact = 0;
    if (vehicle.commercialUse) {
      commImpact = 10;
      factors.push({
        name: 'Commercial Use',
        impact: commImpact,
        direction: 'positive',
        description: 'Used for commercial transport (higher utilization and wear)'
      });
    } else {
      factors.push({
        name: 'Commercial Use',
        impact: 0,
        direction: 'neutral',
        description: 'Private/personal use vehicle'
      });
    }
    score += commImpact;

    // ── Factor 5: Vehicle type ──
    var typeImpact = 0;
    var typeDesc = '';
    switch (vehicle.type) {
      case 'HMV':
        typeImpact = 10;
        typeDesc = 'Heavy Motor Vehicle — higher accident severity risk';
        break;
      case 'BUS':
        typeImpact = 8;
        typeDesc = 'Bus — passenger safety liability';
        break;
      case '3W':
        typeImpact = 5;
        typeDesc = 'Three-wheeler — stability and maneuverability concerns';
        break;
      case '2W':
        typeImpact = 3;
        typeDesc = 'Two-wheeler — rider vulnerability on impact';
        break;
      default:
        typeImpact = 0;
        typeDesc = 'Light Motor Vehicle — standard risk category';
    }
    factors.push({
      name: 'Vehicle Type',
      impact: typeImpact,
      direction: typeImpact > 0 ? 'positive' : 'neutral',
      description: typeDesc
    });
    score += typeImpact;

    // ── Factor 6: Ownership changes ──
    var ownerImpact = 0;
    if (vehicle.ownershipChanges > 1) {
      ownerImpact = (vehicle.ownershipChanges - 1) * 3;
      factors.push({
        name: 'Ownership Changes',
        impact: ownerImpact,
        direction: 'positive',
        description: vehicle.ownershipChanges + ' ownership transfers — potential maintenance gaps'
      });
    } else {
      factors.push({
        name: 'Ownership Changes',
        impact: 0,
        direction: 'neutral',
        description: vehicle.ownershipChanges <= 1 ? 'Single owner — consistent maintenance likely' : ''
      });
    }
    score += ownerImpact;

    // ── Factor 7: Accident count ──
    var accImpact = vehicle.accidentCount * 12;
    if (vehicle.accidentCount > 0) {
      factors.push({
        name: 'Accident History',
        impact: accImpact,
        direction: 'positive',
        description: vehicle.accidentCount + ' recorded accident' + (vehicle.accidentCount > 1 ? 's' : '') + ' — potential structural damage'
      });
    } else {
      accImpact = -3;
      factors.push({
        name: 'Accident History',
        impact: accImpact,
        direction: 'negative',
        description: 'No accidents on record'
      });
    }
    score += accImpact;

    // ── Factor 8: Violation history (from challans) ──
    var violImpact = 0;
    if (challans.length > 0) {
      violImpact = Math.min(challans.length * 2, 15);
      factors.push({
        name: 'Violation History',
        impact: violImpact,
        direction: 'positive',
        description: challans.length + ' challan' + (challans.length > 1 ? 's' : '') + ' issued against this vehicle'
      });
    } else {
      violImpact = -5;
      factors.push({
        name: 'Violation History',
        impact: violImpact,
        direction: 'negative',
        description: 'No violations recorded for this vehicle'
      });
    }
    score += violImpact;

    score = clamp(Math.round(score), 0, 100);

    return {
      score: score,
      category: riskCategory(score),
      factors: factors
    };
  }

  // ─── RTO Efficiency Analysis ─────────────────────────────────────────
  /**
   * Analyses the operational efficiency of an RTO office.
   *
   * @param {Object} rto - RTO operations object from TransportData.rtoOperations
   * @returns {{ overallScore, rating, pendencyRate, avgProcessingTime,
   *             testSlotUtilization, staffProductivity, bottlenecks,
   *             staffingRecommendation, peerRanking }}
   */
  function analyzeRTOEfficiency(rto) {
    if (!rto) return null;

    var services = rto.services;
    var serviceKeys = Object.keys(services);

    // Aggregate totals
    var totalReceived = 0;
    var totalProcessed = 0;
    var totalPending = 0;
    var totalDaysWeighted = 0;

    for (var i = 0; i < serviceKeys.length; i++) {
      var svc = services[serviceKeys[i]];
      totalReceived += svc.received;
      totalProcessed += svc.processed;
      totalPending += svc.pending;
      totalDaysWeighted += svc.avgProcessingDays * svc.received;
    }

    var pendencyRate = totalReceived > 0 ? Math.round((totalPending / totalReceived) * 100) / 100 : 0;
    var avgProcessingTime = totalReceived > 0 ? Math.round((totalDaysWeighted / totalReceived) * 10) / 10 : 0;

    // Staff productivity: applications processed per staff per month (annualized / 12)
    var staffProductivity = rto.staffCount > 0
      ? Math.round((totalProcessed / rto.staffCount / 12) * 10) / 10
      : 0;

    // Identify bottlenecks
    var bottlenecks = [];
    for (var i = 0; i < serviceKeys.length; i++) {
      var key = serviceKeys[i];
      var svc = services[key];
      var pendingRatio = svc.received > 0 ? svc.pending / svc.received : 0;

      if (pendingRatio > 0.05) {
        var severity;
        if (pendingRatio > 0.15) severity = 'High';
        else if (pendingRatio > 0.08) severity = 'Medium';
        else severity = 'Low';

        var friendlyName = formatServiceName(key);
        var recommendation = generateBottleneckRecommendation(key, pendingRatio, svc.avgProcessingDays);

        bottlenecks.push({
          service: friendlyName,
          severity: severity,
          pendingRatio: Math.round(pendingRatio * 100) / 100,
          recommendation: recommendation
        });
      }
    }

    // Sort by severity
    var sevOrder = { High: 0, Medium: 1, Low: 2 };
    bottlenecks.sort(function (a, b) {
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    });

    // Staffing recommendation
    var throughputPerStaff = staffProductivity * 12; // annual
    var optimalStaff = totalReceived > 0 && throughputPerStaff > 0
      ? Math.ceil(totalReceived / throughputPerStaff * 1.15) // 15% buffer
      : rto.staffCount;
    if (optimalStaff < rto.staffCount) optimalStaff = rto.staffCount; // never recommend fewer

    var deficit = optimalStaff - rto.staffCount;
    var reductionPct = deficit > 0
      ? Math.round(Math.min(55, deficit / rto.staffCount * 100 * 1.8))
      : 0;

    var staffImpact = deficit > 0
      ? 'Adding ' + deficit + ' staff member' + (deficit > 1 ? 's' : '') +
        ' would reduce average processing time by ~' + reductionPct + '%'
      : 'Current staffing levels are adequate for the workload';

    // Overall score (use preset from data, but we can re-derive)
    var overallScore = rto.efficiencyScore;

    var rating;
    if (overallScore >= 90) rating = 'Excellent';
    else if (overallScore >= 75) rating = 'Good';
    else if (overallScore >= 60) rating = 'Average';
    else rating = 'Poor';

    // Peer ranking: rank among all RTOs
    var allRTOs = window.TransportData ? window.TransportData.rtoOperations : [];
    var sortedScores = allRTOs.map(function (r) { return r.efficiencyScore; })
      .sort(function (a, b) { return b - a; });
    var peerRanking = sortedScores.indexOf(overallScore) + 1;
    if (peerRanking === 0) peerRanking = allRTOs.length; // fallback

    return {
      overallScore: overallScore,
      rating: rating,
      pendencyRate: pendencyRate,
      avgProcessingTime: avgProcessingTime,
      testSlotUtilization: rto.testSlots.utilization,
      staffProductivity: staffProductivity,
      bottlenecks: bottlenecks,
      staffingRecommendation: {
        current: rto.staffCount,
        optimal: optimalStaff,
        deficit: deficit,
        impact: staffImpact
      },
      peerRanking: peerRanking
    };
  }

  /**
   * Converts a camelCase service key to a friendly display name.
   */
  function formatServiceName(key) {
    var map = {
      dlIssuance: 'DL Issuance',
      dlRenewal: 'DL Renewal',
      vehicleRegistration: 'Vehicle Registration',
      fitnessTest: 'Fitness Test',
      transferOfOwnership: 'Transfer of Ownership',
      duplicateDL: 'Duplicate DL'
    };
    return map[key] || key;
  }

  /**
   * Generates a context-aware recommendation for a bottleneck.
   */
  function generateBottleneckRecommendation(serviceKey, pendingRatio, avgDays) {
    var recommendations = {
      dlIssuance: [
        'Deploy additional biometric verification kiosks to speed up identity checks',
        'Introduce online application pre-verification to reduce counter time',
        'Allocate ' + Math.ceil(pendingRatio * 10) + ' additional staff to DL issuance counter'
      ],
      dlRenewal: [
        'Enable fully online renewal with Aadhaar-based e-KYC',
        'Set up express renewal counter for straightforward cases',
        'Extend operating hours by 2 hours on weekdays for renewals'
      ],
      vehicleRegistration: [
        'Allocate ' + Math.ceil(pendingRatio * 15) + ' additional staff to vehicle registration counter',
        'Digitize document verification to reduce processing time by 40%',
        'Implement dealer-point registration to offload 30% of walk-ins'
      ],
      fitnessTest: [
        'Add ' + Math.max(1, Math.ceil(avgDays / 5)) + ' automated testing lanes',
        'Enable pre-booking of fitness test slots to reduce wait times',
        'Partner with authorized private testing centres'
      ],
      transferOfOwnership: [
        'Digitize document verification to reduce processing time',
        'Create a fast-track lane for transfers with complete documentation',
        'Reduce NOC turnaround by integrating state transport databases'
      ],
      duplicateDL: [
        'Automate duplicate DL issuance for FIR-verified cases',
        'Deploy self-service kiosks for duplicate DL applications'
      ]
    };

    var pool = recommendations[serviceKey] || ['Increase staffing and streamline workflows'];
    // Pick based on severity
    var idx = pendingRatio > 0.15 ? 0 : pendingRatio > 0.08 ? 1 : pool.length - 1;
    return pool[Math.min(idx, pool.length - 1)];
  }

  // ─── Accident Hotspot Analysis ───────────────────────────────────────
  /**
   * Analyses accident data to identify hotspot road segments,
   * optionally filtered by timeOfDay, season, and/or state.
   *
   * @param {Array}  accidents - Array of accident objects
   * @param {Object} [filters] - Optional { timeOfDay, season, state }
   * @returns {{ hotspots: Array, summary: Object }}
   */
  function analyzeAccidentHotspots(accidents, filters) {
    if (!accidents || accidents.length === 0) {
      return {
        hotspots: [],
        summary: {
          totalAccidents: 0, fatalAccidents: 0,
          topCause: 'N/A', mostDangerousTime: 'N/A', mostDangerousSeason: 'N/A'
        }
      };
    }

    // Apply filters
    var filtered = accidents;
    if (filters) {
      filtered = accidents.filter(function (a) {
        if (filters.timeOfDay && filters.timeOfDay !== 'All' && a.timeOfDay !== filters.timeOfDay) return false;
        if (filters.season && filters.season !== 'All' && a.season !== filters.season) return false;
        if (filters.state && filters.state !== 'All' && a.state !== filters.state) return false;
        return true;
      });
    }

    // Cluster by road segment
    var segMap = {};
    for (var i = 0; i < filtered.length; i++) {
      var a = filtered[i];
      var key = a.roadSegment;
      if (!segMap[key]) {
        segMap[key] = {
          roadSegment: key,
          gps: a.gps,
          accidents: [],
          causes: {},
          times: {}
        };
      }
      segMap[key].accidents.push(a);

      // Count causes
      segMap[key].causes[a.cause] = (segMap[key].causes[a.cause] || 0) + 1;
      segMap[key].times[a.timeOfDay] = (segMap[key].times[a.timeOfDay] || 0) + 1;
    }

    // Severity weights
    var sevWeight = { Fatal: 3, Grievous: 2, Minor: 1 };

    // Build hotspot list
    var hotspots = [];
    for (var key in segMap) {
      if (!segMap.hasOwnProperty(key)) continue;
      var seg = segMap[key];
      var accList = seg.accidents;

      var fatalCount = 0;
      var grievousCount = 0;
      var weightedScore = 0;
      var totalCasualties = 0;
      var totalInjured = 0;

      for (var j = 0; j < accList.length; j++) {
        var sev = accList[j].severity;
        if (sev === 'Fatal') fatalCount++;
        if (sev === 'Grievous') grievousCount++;
        weightedScore += sevWeight[sev] || 1;
        totalCasualties += accList[j].casualties;
        totalInjured += accList[j].injured;
      }

      // Primary cause
      var primaryCause = '';
      var maxCauseCount = 0;
      for (var c in seg.causes) {
        if (seg.causes[c] > maxCauseCount) {
          maxCauseCount = seg.causes[c];
          primaryCause = c;
        }
      }

      // Peak time
      var peakTime = '';
      var maxTimeCount = 0;
      for (var t in seg.times) {
        if (seg.times[t] > maxTimeCount) {
          maxTimeCount = seg.times[t];
          peakTime = t;
        }
      }

      // Risk level
      var riskLevel;
      if (weightedScore >= 12) riskLevel = 'Critical';
      else if (weightedScore >= 7) riskLevel = 'High';
      else if (weightedScore >= 4) riskLevel = 'Moderate';
      else riskLevel = 'Low';

      // Generate recommendations
      var recs = generateHotspotRecommendations(primaryCause, peakTime, fatalCount, accList.length);

      hotspots.push({
        roadSegment: key,
        gps: seg.gps,
        accidentCount: accList.length,
        fatalCount: fatalCount,
        grievousCount: grievousCount,
        weightedScore: weightedScore,
        riskLevel: riskLevel,
        primaryCause: primaryCause,
        peakTime: peakTime,
        totalCasualties: totalCasualties,
        totalInjured: totalInjured,
        recommendations: recs,
        accidents: accList,
        causes: seg.causes,
        times: seg.times
      });
    }

    // Sort by weighted score descending
    hotspots.sort(function (a, b) { return b.weightedScore - a.weightedScore; });

    // Summary
    var totalFatal = 0;
    var causeCounts = {};
    var timeCounts = {};
    var seasonCounts = {};

    for (var i = 0; i < filtered.length; i++) {
      var a = filtered[i];
      if (a.severity === 'Fatal') totalFatal++;
      causeCounts[a.cause] = (causeCounts[a.cause] || 0) + 1;
      timeCounts[a.timeOfDay] = (timeCounts[a.timeOfDay] || 0) + 1;
      seasonCounts[a.season] = (seasonCounts[a.season] || 0) + 1;
    }

    var topCause = maxKey(causeCounts);
    var mostDangerousTime = maxKey(timeCounts);
    var mostDangerousSeason = maxKey(seasonCounts);

    return {
      hotspots: hotspots,
      summary: {
        totalAccidents: filtered.length,
        fatalAccidents: totalFatal,
        topCause: topCause,
        mostDangerousTime: mostDangerousTime,
        mostDangerousSeason: mostDangerousSeason
      }
    };
  }

  function maxKey(obj) {
    var best = '';
    var bestVal = -1;
    for (var k in obj) {
      if (obj[k] > bestVal) { bestVal = obj[k]; best = k; }
    }
    return best;
  }

  /**
   * Generates context-specific recommendations for accident hotspots.
   */
  function generateHotspotRecommendations(cause, peakTime, fatalCount, totalCount) {
    var recs = [];

    // Cause-based
    switch (cause) {
      case 'Over Speeding':
        recs.push('Install speed-detection cameras with automated challan generation');
        recs.push('Deploy rumble strips and speed breakers at approach zones');
        break;
      case 'Drunk Driving':
        recs.push('Set up permanent breath-analyzer checkpoints');
        recs.push('Increase night patrol frequency with mobile testing units');
        break;
      case 'Wrong Side':
        recs.push('Install central median barriers and concrete dividers');
        recs.push('Add reflective road markings and direction signage');
        break;
      case 'Road Condition':
        recs.push('Prioritize road resurfacing and pothole repair');
        recs.push('Install drainage systems to prevent waterlogging');
        break;
      case 'Weather':
        recs.push('Install fog-warning LED signage activated by visibility sensors');
        recs.push('Apply anti-skid surface treatment on accident-prone stretches');
        break;
      case 'Distracted Driving':
        recs.push('Deploy mobile-phone detection cameras');
        recs.push('Install "No Phone Zone" warning signs at approach');
        break;
      case 'Mechanical Failure':
        recs.push('Set up mandatory vehicle inspection checkpoints on this segment');
        recs.push('Increase fitness certificate enforcement for commercial vehicles');
        break;
      default:
        recs.push('Conduct detailed road safety audit');
    }

    // Time-based
    if (peakTime === 'Night') {
      recs.push('Improve street lighting and install reflective road markers');
      recs.push('Increase night patrol frequency between 9 PM and 4 AM');
    } else if (peakTime === 'Evening') {
      recs.push('Deploy traffic marshals during peak evening hours (5-8 PM)');
    } else if (peakTime === 'Morning') {
      recs.push('Install anti-glare screens on dividers for eastward-facing traffic');
    }

    // Severity-based
    if (fatalCount >= 2) {
      recs.push('Declare as accident black-spot and allocate emergency response unit');
      recs.push('Install crash barriers and energy-absorbing guardrails');
    }

    if (totalCount >= 5) {
      recs.push('Conduct public awareness campaign targeting this road segment');
    }

    // Deduplicate and cap at 5
    var seen = {};
    var unique = [];
    for (var i = 0; i < recs.length; i++) {
      if (!seen[recs[i]]) {
        seen[recs[i]] = true;
        unique.push(recs[i]);
      }
    }

    return unique.slice(0, 5);
  }

  // ─── Predict Service Delay ───────────────────────────────────────────
  /**
   * Uses a simple queueing model to predict how adding staff affects
   * service processing time at a given RTO.
   *
   * @param {string} rtoName - Name of the RTO office
   * @param {string} serviceName - Service key (e.g. 'vehicleRegistration')
   * @param {number} additionalStaff - Number of extra staff to simulate
   * @returns {{ currentDelay, predictedDelay, reduction, confidence }}
   */
  function predictServiceDelay(rtoName, serviceName, additionalStaff) {
    if (!window.TransportData) return null;

    var rtoList = window.TransportData.rtoOperations;
    var rto = null;
    for (var i = 0; i < rtoList.length; i++) {
      if (rtoList[i].rtoName === rtoName) { rto = rtoList[i]; break; }
    }
    if (!rto) return null;

    var svc = rto.services[serviceName];
    if (!svc) return null;

    var currentStaff = rto.staffCount;
    var currentDelay = svc.avgProcessingDays;

    // Throughput per staff per day (derived from data)
    var dailyThroughput = svc.processed / (currentStaff * 365);
    if (dailyThroughput <= 0) dailyThroughput = 0.5;

    // Current delay from queue model
    // delay = pending / (staff * dailyThroughput)  + base processing time
    var baseProcessing = Math.max(1, currentDelay * 0.4); // 40% is inherent process time
    var queueDelay = currentDelay - baseProcessing;

    // With additional staff — diminishing returns modeled via square root
    var newStaff = currentStaff + (additionalStaff || 0);
    var staffRatio = currentStaff / newStaff;

    // Queue delay scales with sqrt for diminishing returns
    var newQueueDelay = queueDelay * Math.sqrt(staffRatio);
    var predictedDelay = Math.max(1, Math.round((baseProcessing + newQueueDelay) * 10) / 10);

    var reduction = currentDelay > 0
      ? Math.round(((currentDelay - predictedDelay) / currentDelay) * 100)
      : 0;
    reduction = Math.max(0, Math.min(reduction, 80));

    // Confidence: higher when we have more data and fewer staff added
    var dataConfidence = Math.min(1, svc.received / 500);  // more data = higher
    var staffConfidence = 1 - Math.min(0.4, additionalStaff / (currentStaff * 2));
    var confidence = Math.round(dataConfidence * staffConfidence * 100) / 100;
    confidence = clamp(confidence, 0.45, 0.95);

    return {
      currentDelay: currentDelay,
      predictedDelay: predictedDelay,
      reduction: reduction,
      confidence: confidence
    };
  }

  // ─── Persona Actionables ──────────────────────────────────────────────
  /**
   * Generates AI-driven actionable insights tailored to a specific persona.
   *
   * @param {string} role - The selected role ('commissioner', 'collector', 'sp-traffic', 'rto-head')
   * @param {Object} dataSummary - Optional aggregated stats to make insights dynamic
   * @returns {Array} - Array of actionable insight objects
   */
  function generatePersonaInsights(role, dataSummary) {
    if (!dataSummary) dataSummary = { totalAccidents: 0, topCause: 'Over Speeding', overdueChallans: 0, worstRto: 'Janakpuri RTO' };

    var insights = [];

    switch (role) {
      case 'commissioner':
        insights.push({
          title: 'State-wide Policy Intervention Required',
          description: dataSummary.topCause + ' is the leading cause of fatal accidents.',
          action: 'Draft mandate for automated speed enforcement on all state highways.',
          impact: 'High', type: 'Policy'
        });
        insights.push({
          title: 'Revenue Recovery Escalation',
          description: dataSummary.overdueChallans + ' challans are currently overdue state-wide.',
          action: 'Initiate automated SMS/WhatsApp warning campaign tied to RC renewal block.',
          impact: 'High', type: 'Revenue'
        });
        insights.push({
          title: 'Infrastructure Modernization',
          description: 'Overall RTO efficiency is lagging due to manual document verification.',
          action: 'Approve budget for full Aadhaar e-KYC integration across all RTOs.',
          impact: 'Medium', type: 'Strategy'
        });
        break;

      case 'collector':
        insights.push({
          title: 'District Blackspot Remediation',
          description: 'High concentration of accidents at ' + (dataSummary.topHotspot || 'major junctions') + '.',
          action: 'Convene District Road Safety Committee to approve immediate budget for crash barriers.',
          impact: 'High', type: 'Safety'
        });
        insights.push({
          title: 'Public Awareness Campaign',
          description: 'Rise in two-wheeler fatalities involving youth demographics.',
          action: 'Launch district-wide college outreach program for road safety.',
          impact: 'Medium', type: 'Awareness'
        });
        break;

      case 'sp-traffic':
        insights.push({
          title: 'Tactical Deployment Shift',
          description: 'Accident hotspot analysis indicates peak risk during Night hours for Drunk Driving.',
          action: 'Deploy mobile breath-analyzer units at major arterial exits between 22:00-02:00.',
          impact: 'High', type: 'Enforcement'
        });
        insights.push({
          title: 'Targeted Interception',
          description: 'Top 20 high-risk vehicles identified with expired fitness and multiple violations.',
          action: 'Feed high-risk vehicle registration numbers to ANPR interceptor units.',
          impact: 'High', type: 'Operations'
        });
        break;

      case 'rto-head':
        insights.push({
          title: 'Workflow Bottleneck Resolution',
          description: dataSummary.worstRto + ' has a severe backlog in Vehicle Registration.',
          action: 'Reallocate 4 staff members from DL Issuance to Vehicle Registration temporarily.',
          impact: 'High', type: 'Operations'
        });
        insights.push({
          title: 'Test Slot Optimization',
          description: 'Driving test slot utilization is dropping below optimal levels.',
          action: 'Implement predictive overbooking (10%) to account for daily no-show rates.',
          impact: 'Medium', type: 'Efficiency'
        });
        break;
    }

    return insights;
  }

  // ─── Export ───────────────────────────────────────────────────────────
  window.RiskModels = {
    calculateDriverRisk: calculateDriverRisk,
    calculateVehicleRisk: calculateVehicleRisk,
    analyzeRTOEfficiency: analyzeRTOEfficiency,
    analyzeAccidentHotspots: analyzeAccidentHotspots,
    predictServiceDelay: predictServiceDelay,
    generatePersonaInsights: generatePersonaInsights
  };
})();
