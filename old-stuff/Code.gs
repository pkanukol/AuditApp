// ============================================================
// CLASSROOM OBSERVATION AUDIT — Harvest International School
// ============================================================
// SCHEMA (new — 8 parameters, 1-4 each, total /32):
//   Domain 1 — Planning & Preparation  (params 1.1, 1.2, 1.3 → max 12)
//   Domain 2 — Classroom Environment   (param  2.1           → max  4)
//   Domain 3 — Instruction & Impl.     (params 3.1-3.4       → max 16)
//   OVERALL = /32
//
// SHEET TABS named:  Location_TeacherName
// SETUP:
//   1. Open Auditor Data sheet → Extensions → Apps Script
//   2. Paste this Code.gs; add AuditLogin, AuditEntry, AuditDashboard HTML files
//   3. Script Properties → ANTHROPIC_API_KEY = sk-ant-xxx
//   4. Deploy as Web App (Execute as Me, Anyone)
// ============================================================

function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'dashboard') {
    return HtmlService.createHtmlOutputFromFile('AuditDashboard')
      .setTitle('Teacher Performance Dashboard — Harvest International School')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'form') {
    return HtmlService.createHtmlOutputFromFile('AuditEntry')
      .setTitle('Classroom Observation — Harvest International School')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (page === 'teacher') {
    return HtmlService.createHtmlOutputFromFile('AuditTeacher')
      .setTitle('My Audit Reports — Harvest International School')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('AuditLogin')
    .setTitle('Harvest International School — Sign In')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

// Store session so pages can read name/role without URL params
// (Apps Script strips URL params from window.location.search on client)
function storeSessionAndGetUrl(name, email, designation, role, location, sme) {
  try {
    var props = PropertiesService.getUserProperties();
    props.setProperties({
      'session_name':        name        || '',
      'session_email':       email       || '',
      'session_designation': designation || '',
      'session_role':        role        || 'auditor',
      'session_location':    location    || '',
      'session_sme':         sme         || ''
    });
  } catch(e) {}
  var url    = ScriptApp.getService().getUrl();
  var drafts = getPendingDraftsForAuditor(name);
  return { url: url, pendingDrafts: drafts };
}

// Returns list of teacher names with pending drafts for the given auditor.
function getPendingDraftsForAuditor(auditorName) {
  try {
    var ss           = SpreadsheetApp.getActiveSpreadsheet();
    var draftsSheet  = ss.getSheetByName('Drafts');
    if (!draftsSheet || draftsSheet.getLastRow() < 2) return [];
    var data    = draftsSheet.getRange(2, 1, draftsSheet.getLastRow() - 1, 3).getValues();
    var pending = [];
    data.forEach(function(row) {
      if (String(row[0]).trim().toLowerCase() === (auditorName || '').trim().toLowerCase()) {
        var teacherName = String(row[1]).trim();
        if (teacherName) pending.push(teacherName);
      }
    });
    return pending;
  } catch(e) {
    Logger.log('getPendingDrafts error: ' + e.message);
    return [];
  }
}

// Returns stored session for the current user
function getSession() {
  try {
    var props = PropertiesService.getUserProperties();
    return {
      name:        props.getProperty('session_name')        || '',
      email:       props.getProperty('session_email')       || '',
      designation: props.getProperty('session_designation') || '',
      role:        props.getProperty('session_role')        || 'auditor',
      location:    props.getProperty('session_location')    || '',
      sme:         props.getProperty('session_sme')         || ''
    };
  } catch(e) {
    return { name:'', email:'', designation:'', role:'auditor', location:'', sme:'' };
  }
}

// Format a Google Sheets date value cleanly
function formatSheetDate(val) {
  if (!val) return '';
  var d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h = d.getHours(), m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var mStr = m < 10 ? '0'+m : String(m);
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() +
         ' at ' + h + ':' + mStr + ' ' + ampm;
}

// Save teacher's remarks to col W (column 23, 1-based) of the exact row
function saveTeacherRemarks(tabName, rowIndex, remarks) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return { success: false, error: 'Tab not found: ' + tabName };
    if (!rowIndex || rowIndex < 2) return { success: false, error: 'Invalid row.' };
    sheet.getRange(rowIndex, 23).setValue(remarks || '');
    SpreadsheetApp.flush();

    // Set Remarks='Yes' in Audits by UniqueID (col Z = index 25)
    try {
      var lastCol  = Math.max(sheet.getLastColumn(), 26);
      var rowVals  = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
      var uniqueID = String(rowVals[25] || '').trim();
      if (uniqueID) {
        var auditsSheet = ss.getSheetByName('Audits');
        if (auditsSheet && auditsSheet.getLastRow() > 1) {
          var aData = auditsSheet.getRange(2,1,auditsSheet.getLastRow()-1,7).getValues();
          for (var ai = 0; ai < aData.length; ai++) {
            if (String(aData[ai][6]||'').trim() === uniqueID && String(aData[ai][5]).trim() === 'No') {
              auditsSheet.getRange(ai+2, 6).setValue('Yes');
            }
          }
        }
      }
    } catch(ae) { Logger.log('Audits remarks update error: ' + ae.message); }

    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// Saves edited AI feedback → col X (24) and objective observations → col V (22).
// Sets Draft col Y (25) = 'No', saves feedback + obj observations,
// then removes the matching row from the Drafts tab.
function saveAuditFeedback(tabName, rowIndex, feedback, otherRemarks) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return { success: false, error: 'Tab not found: ' + tabName };
    if (!rowIndex || rowIndex < 2) return { success: false, error: 'Invalid row index.' };

    // Read UniqueID from col Z (index 25)
    var lastCol  = Math.max(sheet.getLastColumn(), 26);
    var rowVals  = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    var uniqueID = String(rowVals[25] || '').trim();

    sheet.getRange(rowIndex, 24).setValue(feedback     || ''); // col X
    sheet.getRange(rowIndex, 22).setValue(otherRemarks || ''); // col V
    sheet.getRange(rowIndex, 25).setValue('No');                // col Y — finalised
    SpreadsheetApp.flush();

    // Delete from Drafts by UniqueID (col D = index 3)
    try {
      var draftsSheet = ss.getSheetByName('Drafts');
      if (draftsSheet && draftsSheet.getLastRow() > 1) {
        var dData = draftsSheet.getRange(2,1,draftsSheet.getLastRow()-1,4).getValues();
        for (var di = dData.length-1; di >= 0; di--) {
          if (uniqueID && String(dData[di][3]||'').trim() === uniqueID) {
            draftsSheet.deleteRow(di + 2);
          }
        }
      }
    } catch(de) { Logger.log('Drafts delete error: ' + de.message); }

    // Set Email='Yes' in Audits by UniqueID (col G = index 6)
    try {
      var auditsSheet = ss.getSheetByName('Audits');
      if (auditsSheet && auditsSheet.getLastRow() > 1) {
        var aData = auditsSheet.getRange(2,1,auditsSheet.getLastRow()-1,7).getValues();
        for (var ai = 0; ai < aData.length; ai++) {
          if (uniqueID && String(aData[ai][6]||'').trim() === uniqueID && String(aData[ai][4]).trim() === 'No') {
            auditsSheet.getRange(ai+2, 5).setValue('Yes');
          }
        }
      }
    } catch(ae) { Logger.log('Audits email update error: ' + ae.message); }

    // Send email notification to teacher
    try { sendAuditNotification(ss, tabName, rowIndex); }
    catch(me) { Logger.log('Email error: ' + me.message); }

    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// Returns all audit rows for a teacher.
// teacherName = teacher's CONFIG name; location = 'Kodathi'|'Attibele'|'Both' from CONFIG col F.
// Builds tab candidates based on location, reads col R (index 17) for overall score.
function getTeacherAudits(teacherName, location) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var namePart = (teacherName || '').trim().replace(/\s+/g, '_');
    var loc      = (location    || 'Kodathi').trim();
    var audits   = [];

    if (!namePart) return { success: false, error: 'No teacher name provided.' };

    var candidates = [];
    if (loc === 'Both') {
      candidates = [
        { tabName: 'Kodathi_'  + namePart, location: 'Kodathi'  },
        { tabName: 'Attibele_' + namePart, location: 'Attibele' }
      ];
    } else {
      candidates = [{ tabName: loc + '_' + namePart, location: loc }];
    }

    candidates.forEach(function(c) {
      var sheet = ss.getSheetByName(c.tabName);
      if (!sheet) return;

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      var lastCol = Math.max(sheet.getLastColumn(), 25);
      var data    = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      data.forEach(function(row, idx) {
        var overall = Number(row[17]);
        if (!overall || overall < 1) return;
        var draftVal = String(row[24] || '').trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
        audits.push({
          tabName:        c.tabName,
          rowIndex:       idx + 2,        // 1-based sheet row (row 1 = header)
          date:           formatSheetDate(row[0]),
          auditor:        String(row[1]  || ''),
          subject:        String(row[5]  || ''),
          grade:          String(row[6]  || ''),
          p11:            Number(row[7]  || 0),
          p12:            Number(row[8]  || 0),
          domain1:        Number(row[9]  || 0),
          p21:            Number(row[10] || 0),
          domain2:        Number(row[11] || 0),
          p31:            Number(row[12] || 0),
          p32:            Number(row[13] || 0),
          p33:            Number(row[14] || 0),
          p34:            Number(row[15] || 0),
          domain3:        Number(row[16] || 0),
          overall:        overall,
          rating:         String(row[18] || ''),
          location:       c.location,
          infraIssues:    String(row[19] || ''),
          otherIssues:    String(row[20] || ''),
          otherRemarks:   String(row[21] || ''),
          teacherRemarks: String(row[22] || ''),
          feedback:       String(row[23] || ''),
          draft:          draftVal
        });
      });
    });

    audits.reverse();
    return { success: true, audits: audits };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

// Returns teacher summary cards + full observation rows for a given location.
// Column layout (0-based):
//   0=Date, 1=Auditor, 2=AuditorDesig, 3=Location, 4=TeacherName
//   5=Subject(F), 6=Grade, 7-9=params, 10=D1, 11=p21, 12=D2,
//   13-16=params, 17=D3, 18=Overall(S), 19=Rating(T),
//   20=InfraIssues, 21=OtherIssues, 22=OtherRemarks, 23=TeacherRemarks, 24=AIFeedback
//   25=Draft (col Y) — 'Yes'=saved as draft, 'No'=finalised
function getTeacherScores(location, smeFilter) {
  try {
    location  = (location  || 'Kodathi').trim();
    smeFilter = (smeFilter || '').trim().toLowerCase();
    var prefix = location + '_';
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var result = [];

    // Build allowed teacher list if SME filter is active
    var allowedTeachers = null;
    if (smeFilter) {
      allowedTeachers = {};
      var cfg = ss.getSheetByName('CONFIG');
      if (cfg) {
        var cfgData = cfg.getDataRange().getValues();
        for (var ci = 1; ci < cfgData.length; ci++) {
          var crow = cfgData[ci];
          if (String(crow[1]||'').trim().toLowerCase() === 'teacher' &&
              String(crow[4]||'').trim().toLowerCase() === smeFilter) {
            allowedTeachers[String(crow[0]||'').trim().toLowerCase()] = true;
          }
        }
      }
    }

    sheets.forEach(function(sheet) {
      var tabName = sheet.getName().trim();
      if (tabName.indexOf(prefix) !== 0) return;

      var teacherName = tabName.substring(prefix.length).replace(/_/g, ' ').trim();
      if (!teacherName) return;

      // SME filter: skip teachers not assigned to this SME
      if (allowedTeachers !== null && !allowedTeachers[teacherName.toLowerCase()]) return;

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      var lastCol = Math.max(sheet.getLastColumn(), 25);
      var data    = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      var totalScore = 0, count = 0;
      var subjects = {}, ratings = {};
      var rows = [];
      var sheetRowOffset = 2; // data starts at row 2 (row 1 = header)

      data.forEach(function(row, dataIdx) {
        var overall = Number(row[17]);
        if (!overall || overall < 1 || overall > 28) return;

        totalScore += overall;
        count++;

        var subj   = String(row[5]  || '').trim();
        var rating = String(row[18] || '').trim();
        if (subj)   subjects[subj]   = (subjects[subj]   || 0) + 1;
        if (rating) ratings[rating]  = (ratings[rating]  || 0) + 1;

        rows.push({
          date:           String(row[0]  || ''),
          auditor:        String(row[1]  || ''),
          subject:        subj,
          grade:          String(row[6]  || ''),
          p11: Number(row[7]),  p12: Number(row[8]),
          domain1:        Number(row[9]),
          p21: Number(row[10]),
          domain2:        Number(row[11]),
          p31: Number(row[12]), p32: Number(row[13]),
          p33: Number(row[14]), p34: Number(row[15]),
          domain3:        Number(row[16]),
          overall:        overall,
          rating:         rating,
          infraIssues:    String(row[19] || ''),
          otherIssues:    String(row[20] || ''),
          otherRemarks:   String(row[21] || ''),
          teacherRemarks: String(row[22] || ''),
          feedback:       String(row[23] || ''),
          draft:          String(row[24] || '').trim().toLowerCase() === 'yes' ? 'Yes' : 'No',
          tabName:        tabName,
          rowIndex:       dataIdx + sheetRowOffset
        });
      });

      if (count === 0) return;

      // Most common subject and latest rating
      var topSubject = Object.keys(subjects).sort(function(a,b){ return subjects[b]-subjects[a]; })[0] || '';
      var latestRating = rows[rows.length - 1].rating || '';

      result.push({
        teacherName:  teacherName,
        tabName:      tabName,
        subject:      topSubject,
        latestRating: latestRating,
        avgScore:     Math.round((totalScore / count) * 10) / 10,
        obsCount:     count,
        rows:         rows
      });
    });

    result.sort(function(a, b) { return b.avgScore - a.avgScore; });
    return { success: true, teachers: result };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ---- AUTHENTICATION ----
// CONFIG columns (0-based): A=0 Name, B=1 Designation, C=2 Email,
// D=3 Password, E=4 SME, F=5 Location
// Roles:
//   'teacher'  → AuditTeacher page (own reports only, location from col F)
//   'sme'      → AuditDashboard  (only teachers where CONFIG col E == this SME's name)
//   'auditor'  → AuditEntry form (Chairman/HOD/Principal/Auditor — full access)
function signIn(email, password) {
  try {
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var cfg = ss.getSheetByName('CONFIG');
    if (!cfg) return { success: false, error: 'CONFIG sheet not found.' };

    var data = cfg.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[2]) continue;
      if (String(row[2]).trim().toLowerCase() !== email.trim().toLowerCase()) continue;
      if (String(row[3]).trim() !== password.trim()) continue;

      var name     = String(row[0]).trim();
      var desig    = String(row[1]).trim().toLowerCase();
      var sme      = String(row[4] || '').trim();    // col E
      var location = String(row[5] || '').trim();    // col F

      // ── TEACHER ────────────────────────────────────────────────────────────
      if (desig === 'teacher') {
        // Use location from col F to find the tab (Location_TeacherName)
        var loc      = location || 'Kodathi';
        var namePart = name.replace(/\s+/g, '_');
        var tabs     = [];
        if (loc === 'Both') {
          tabs = ['Kodathi_' + namePart, 'Attibele_' + namePart];
        } else {
          tabs = [loc + '_' + namePart];
        }
        // Check if any tab exists — if not, still route to teacher page (show empty state)
        var found = tabs.filter(function(t){ return !!ss.getSheetByName(t); });
        return {
          success:   true,
          role:      'teacher',
          noReports: (found.length === 0),
          auditor: { name: name, designation: row[1].trim(),
            email: String(row[2]).trim().toLowerCase(),
            location: loc, sme: sme }
        };
      }

      // ── SME ────────────────────────────────────────────────────────────────
      if (desig === 'sme') {
        return {
          success: true, role: 'sme',
          auditor: { name: name, designation: row[1].trim(),
            email: String(row[2]).trim().toLowerCase(),
            location: location, sme: name }
        };
      }

      // ── AUDITOR / CHAIRMAN / HOD / PRINCIPAL ───────────────────────────────
      return {
        success: true, role: 'auditor',
        auditor: { name: name, designation: row[1].trim(),
          email: String(row[2]).trim().toLowerCase(),
          location: location }
      };
    }
    return { success: false, error: 'Invalid email or password.' };
  } catch (err) {
    return { success: false, error: 'Sign-in error: ' + err.message };
  }
}

// ============================================================
// REPORT SUBMISSION
// Tab name: Location_TeacherName (created if missing)
// ONE row per observation. Column layout (0-based):
//  0  Date & Time
//  1  Auditor         2  Auditor Designation
//  3  Location        4  Teacher Name    5  Subject    6  Grade
//  7  1.1 Knowledge of Content & Curriculum
//  8  1.2 Alignment of Learning Outcomes
//  9  Domain 1 Score (/8)
//  10 2.1 Managing Classroom Procedures
//  11 Domain 2 Score (/4)
//  12 3.1 Questioning & Discussion Techniques
//  13 3.2 Fostering Student Engagement
//  14 3.3 Implementation of Process
//  15 3.4 Effective Use of Technology
//  16 Domain 3 Score (/16)
//  17 Overall Score (/28)
//  18 Rating
//  19 Infrastructure Issues
//  20 Other Issues
//  21 Other Remarks (Auditor)
//  22 Teacher Remarks
//  23 Feedback for Teacher  ← AI generated (col X)
// ============================================================

function submitReport(payload) {
  try {
    // Tab name
    var teacherClean  = (payload.teacherName || 'Teacher').trim().replace(/\s+/g, '_');
    var locationClean = (payload.school      || 'Location').trim().replace(/\s+/g, '');
    var tabName       = locationClean + '_' + teacherClean;
    tabName           = tabName.substring(0, 100);

    // AI feedback
    var aiFeedback = generateAIFeedbackViaAPI(payload);

    // Get or create tab
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);

    // Headers (if new sheet)
    if (sheet.getLastRow() === 0) {
      var headers = [
        'Date & Time',
        'Auditor', 'Auditor Designation',
        'Location', 'Teacher Name', 'Subject', 'Grade',
        '1.1 Knowledge of Content & Curriculum',
        '1.2 Alignment of Learning Outcomes',
        'Domain 1 Score (/8)',
        '2.1 Managing Classroom Procedures',
        'Domain 2 Score (/4)',
        '3.1 Questioning & Discussion Techniques',
        '3.2 Fostering Student Engagement',
        '3.3 Implementation of Process',
        '3.4 Effective Use of Technology',
        'Domain 3 Score (/16)',
        'Overall Score (/28)', 'Rating',
        'Infrastructure Issues', 'Other Issues',
        'Other Remarks (Auditor)', 'Teacher Remarks',
        'Feedback for Teacher',  // col X
        'Draft',                   // col Y
        'UniqueID'                 // col Z
      ];
      sheet.appendRow(headers);
      var hRange = sheet.getRange(1, 1, 1, headers.length);
      hRange.setBackground('#0f2410').setFontColor('#29ABE2').setFontWeight('bold').setWrap(true);
      sheet.setRowHeight(1, 44);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(headers.length - 1, 500); // col X — feedback
      sheet.setColumnWidth(headers.length - 2, 300); // col W — teacher remarks
      sheet.setColumnWidth(headers.length - 3, 300); // col V — other remarks
      sheet.setColumnWidth(1, 170);               // date col
    }

    // Rating
    var os     = payload.overallScore;
    var rating = os >= 25 ? 'DISTINGUISHED'
               : os >= 19 ? 'PROFICIENT'
               : os >= 13 ? 'DEVELOPING'
               :            'BEGINNING';

    // UniqueID: 3 chars tabName + 3 chars auditor + 3 chars teacher + DDMMYY + HHMM
    var tz      = Session.getScriptTimeZone();
    var nowTs   = new Date();
    var ddmmyy  = Utilities.formatDate(nowTs, tz, 'ddMMyy');
    var hhmm    = Utilities.formatDate(nowTs, tz, 'HHmm');
    var tPart   = tabName.replace(/[^a-zA-Z0-9]/g,'').substring(0,3).toUpperCase();
    var aPart   = (payload.auditorName||'').replace(/[^a-zA-Z0-9]/g,'').substring(0,3).toUpperCase();
    var tchPart = (payload.teacherName||'').replace(/[^a-zA-Z0-9]/g,'').substring(0,3).toUpperCase();
    var uniqueID = tPart + aPart + tchPart + ddmmyy + hhmm;

    // Data row (must match header order above)
    var dataRow = [
      payload.submissionDate,
      payload.auditorName, payload.auditorDesignation,
      payload.school || '', payload.teacherName || '', payload.subject || '', payload.grade || '',
      payload.p11, payload.p12,
      payload.domain1Score,
      payload.p21,
      payload.domain2Score,
      payload.p31, payload.p32, payload.p33, payload.p34,
      payload.domain3Score,
      os, rating,
      payload.infrastructureIssues || '', payload.otherIssues || '',
      payload.otherRemarks || '',   // col V — Other Remarks (Auditor)
      '',                           // col W — Teacher Remarks (filled separately)
      aiFeedback,                   // col X — AI Feedback for Teacher
      'Yes',                        // col Y — Draft flag
      uniqueID                      // col Z — UniqueID
    ];

    sheet.appendRow(dataRow);

    var newRow = sheet.getLastRow();
    // Highlight overall score cell (col 19 = index 18, 1-based = 19)
    sheet.getRange(newRow, 19).setBackground('#e8f7fd').setFontWeight('bold');
    // Wrap feedback and remarks cells
    sheet.getRange(newRow, 22).setWrap(true);  // col V — Other Remarks (Auditor)
    sheet.getRange(newRow, 23).setWrap(true);  // col W — Teacher Remarks
    sheet.getRange(newRow, 24).setWrap(true);  // col X — AI Feedback for Teacher
    // col Y (25) = Draft — no special formatting needed

    // ── Add to Drafts tab (Auditor, Teacher, TabName) ──────────────────────
    try {
      var draftsSheet = ss.getSheetByName('Drafts');
      if (!draftsSheet) {
        draftsSheet = ss.insertSheet('Drafts');
        draftsSheet.appendRow(['Auditor Name', 'Teacher Name', 'Tab Name', 'UniqueID']);
        draftsSheet.getRange(1,1,1,4).setBackground('#0f2410').setFontColor('#29ABE2').setFontWeight('bold');
        draftsSheet.setFrozenRows(1);
      }
      draftsSheet.appendRow([
        payload.auditorName  || '',
        payload.teacherName  || '',
        tabName,
        uniqueID
      ]);
    } catch(de) { Logger.log('Drafts write error: ' + de.message); }

    // ── Audits log ────────────────────────────────────────────────────────
    try {
      var auditsSheet = ss.getSheetByName('Audits');
      if (!auditsSheet) {
        auditsSheet = ss.insertSheet('Audits');
        auditsSheet.appendRow(['Date','Teacher Name','Auditor','Tab Name','Email','Remarks','UniqueID']);
        auditsSheet.getRange(1,1,1,7).setBackground('#0f2410').setFontColor('#29ABE2').setFontWeight('bold');
        auditsSheet.setFrozenRows(1);
        auditsSheet.setColumnWidth(1,160); auditsSheet.setColumnWidth(4,180); auditsSheet.setColumnWidth(7,220);
      }
      auditsSheet.appendRow([
        Utilities.formatDate(nowTs, tz, 'dd MMM yyyy HH:mm'),
        payload.teacherName || '',
        payload.auditorName || '',
        tabName,
        'No', 'No',
        uniqueID
      ]);
    } catch(ae) { Logger.log('Audits log write error: ' + ae.message); }

    return {
      success:   true,
      sheetName: tabName,
      sheetUrl:  ss.getUrl() + '#gid=' + sheet.getSheetId()
    };

  } catch (err) {
    return { success: false, error: 'Submission failed: ' + err.message };
  }
}


// ============================================================
// DASHBOARD DATA
// Reads all tabs named Location_TeacherName (prefix match).
// Column S = index 18 (0-based) = Overall Score (/32).
// Reads every data row (row 2 onward), averages column S values,
// and returns { teacherName, avgScore, obsCount } per teacher.
// Sorted by avgScore descending.
// ============================================================
function getDashboardData(location) {
  try {
    location   = (location || 'Kodathi').trim();
    var prefix = location + '_';

    var OVR_COL = 17;  // column R (0-based) — Overall Score (/28)

    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var sheets   = ss.getSheets();
    var teachers = [];

    sheets.forEach(function(sheet) {
      var tabName = sheet.getName().trim();

      // Only process tabs that start with the location prefix
      if (tabName.indexOf(prefix) !== 0) return;

      // Teacher name = everything after "Location_", underscores → spaces
      var teacherName = tabName.substring(prefix.length).replace(/_/g, ' ').trim();
      if (!teacherName) return;

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return;  // header only, no observations yet

      // Read only column S (column 19, 1-based) from row 2 onward
      var scoreRange = sheet.getRange(2, OVR_COL + 1, lastRow - 1, 1).getValues();

      var total = 0, count = 0;
      scoreRange.forEach(function(row) {
        var v = Number(row[0]);
        if (v >= 1 && v <= 32) {   // valid score guard
          total += v;
          count++;
        }
      });

      if (count === 0) return;   // no valid scores — skip

      var avgScore = Math.round((total / count) * 10) / 10;

      teachers.push({
        teacherName: teacherName,
        avgScore:    avgScore,
        obsCount:    count
      });
    });

    // Sort highest average first
    teachers.sort(function(a, b) { return b.avgScore - a.avgScore; });

    return { success: true, teachers: teachers, location: location };

  } catch(e) {
    return { success: false, error: e.message };
  }
}


// ============================================================
// AI FEEDBACK — Anthropic API
// ============================================================
function generateAIFeedbackViaAPI(payload) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return generateRuleBasedFeedback(payload);

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: buildFeedbackPrompt(payload) }]
      }),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code = resp.getResponseCode();
    var body = JSON.parse(resp.getContentText());

    if (code === 200 && body.content && body.content[0] && body.content[0].text)
      return body.content[0].text.trim();

    Logger.log('API error ' + code + ': ' + JSON.stringify(body));
    return generateRuleBasedFeedback(payload);
  } catch (e) {
    Logger.log('AI feedback error: ' + e.message);
    return generateRuleBasedFeedback(payload);
  }
}

function buildFeedbackPrompt(payload) {
  var os     = payload.overallScore;
  var rating = os >= 23 ? 'DISTINGUISHED' : os >= 17 ? 'PROFICIENT'
             : os >= 12 ? 'DEVELOPING' : 'BEGINNING';
  var lbl = function(n){ return n===4?'Distinguished':n===3?'Proficient':n===2?'Developing':'Beginning'; };

  var p = 'You are an experienced instructional coach at Harvest International School.\n';
  p += 'Write a professional, warm, specific and constructive classroom observation feedback report.\n';
  p += 'Target: 400-500 words. Do NOT mention raw scores in the body text.\n\n';
  p += 'TEACHER: '+(payload.teacherName||'N/A')+' | SUBJECT: '+(payload.subject||'N/A')+
       ' | GRADE: '+(payload.grade||'N/A')+' | LOCATION: '+(payload.school||'N/A')+'\n';
  p += 'AUDITOR: '+payload.auditorName+' ('+payload.auditorDesignation+')\n';
  p += 'OVERALL RATING: '+rating+'\n\n';
  p += 'DOMAIN 1 — PLANNING & PREPARATION:\n';
  p += '  1.1 Knowledge of Content & Curriculum: '+lbl(payload.p11)+'\n';
  p += '  1.2 Alignment of Learning Outcomes: '+lbl(payload.p12)+'\n\n';
  p += 'DOMAIN 2 — CLASSROOM ENVIRONMENT:\n';
  p += '  2.1 Managing Classroom Procedures: '+lbl(payload.p21)+'\n\n';
  p += 'DOMAIN 3 — INSTRUCTION & IMPLEMENTATION:\n';
  p += '  3.1 Questioning & Discussion Techniques: '+lbl(payload.p31)+'\n';
  p += '  3.2 Fostering Student Engagement: '+lbl(payload.p32)+'\n';
  p += '  3.3 Implementation of Process: '+lbl(payload.p33)+'\n';
  p += '  3.4 Effective Use of Technology: '+lbl(payload.p34)+'\n\n';
  if (payload.infrastructureIssues && payload.infrastructureIssues.trim())
    p += 'INFRASTRUCTURE ISSUES: '+payload.infrastructureIssues.trim()+'\n';
  if (payload.otherIssues && payload.otherIssues.trim())
    p += 'OTHER ISSUES: '+payload.otherIssues.trim()+'\n';
  p += '\nStructure:\n1. Opening paragraph (overall context)\n';
  p += '2. Strengths (Distinguished/Proficient parameters — specific, qualitative)\n';
  p += '3. Areas for Development (Beginning/Developing parameters — constructive)\n';
  p += '4. Key Recommendation (actionable next steps)\n';
  return p;
}

// ---- RULE-BASED FALLBACK ----
function generateRuleBasedFeedback(payload) {
  var lbl  = function(n){ return n===4?'Distinguished':n===3?'Proficient':n===2?'Developing':'Beginning'; };
  var os   = payload.overallScore;
  var rtg  = os>=23?'DISTINGUISHED':os>=17?'PROFICIENT':os>=12?'DEVELOPING':'BEGINNING';
  var today= new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});

  var strengths = [], improvements = [];
  var params = [
    [payload.p11, '1.1 Knowledge of Content & Curriculum',
      'demonstrates strong subject knowledge with clear curriculum alignment and NEP integration',
      'strengthen subject knowledge and ensure explicit links to grade-level curriculum and NEP competencies'],
    [payload.p12, '1.2 Alignment of Learning Outcomes',
      'states lesson outcomes clearly, aligned with curriculum goals and targeted competencies',
      'ensure lesson outcomes are clearly stated and explicitly mapped to curricular goals'],
    [payload.p21, '2.1 Managing Classroom Procedures',
      'manages classroom routines and transitions effectively with student independence',
      'establish consistent routines and reduce reliance on teacher direction during transitions'],
    [payload.p31, '3.1 Questioning & Discussion Techniques',
      'uses higher-order questions and facilitates rich peer dialogue with student reflection',
      'move beyond recall-based questions to open-ended, higher-order questioning and peer dialogue'],
    [payload.p32, '3.2 Fostering Student Engagement',
      'fosters active student participation — students ask questions and express ideas throughout',
      'create structured opportunities for students to ask questions and express their own ideas'],
    [payload.p33, '3.3 Implementation of Process',
      'implements all planned teaching processes and adapts them appropriately to support learning',
      'ensure all planned teaching processes are implemented as outlined in the lesson plan'],
    [payload.p34, '3.4 Effective Use of Technology',
      'leverages BrightAI and additional digital tools effectively to enrich the lesson',
      'ensure consistent and effective use of BrightAI and all prescribed technology resources']
  ];

  params.forEach(function(p){
    if(p[0] >= 3) strengths.push(p[2]); else improvements.push(p[3]);
  });

  var fb = 'CLASSROOM OBSERVATION FEEDBACK\nHarvest International School\n';
  fb += 'Date: '+today+' | Teacher: '+(payload.teacherName||'N/A');
  fb += ' | Subject: '+(payload.subject||'N/A')+' | Grade: '+(payload.grade||'N/A')+'\n';
  fb += 'Overall Rating: '+rtg+' ('+os+'/28)\n\n';

  if(strengths.length){
    fb += 'STRENGTHS OBSERVED:\n';
    strengths.forEach(function(s,i){ fb += (i+1)+'. The teacher '+s+'.\n'; });
    fb += '\n';
  }
  if(improvements.length){
    fb += 'AREAS FOR DEVELOPMENT:\n';
    improvements.forEach(function(s,i){ fb += (i+1)+'. '+s.charAt(0).toUpperCase()+s.slice(1)+'.\n'; });
    fb += '\n';
  }
  fb += 'KEY RECOMMENDATION:\n';
  if(os>=29)      fb += 'Exemplary practice across all domains. Consider this teacher as a peer mentor.';
  else if(os>=22) fb += 'Strong performance. Targeted focus on '+improvements.length+' development areas will sustain growth.';
  else if(os>=15) fb += 'Good potential. Coaching focus: '+improvements.slice(0,3).join('; ')+'.';
  else            fb += 'Structured coaching support needed across multiple domains. An improvement plan should be developed with school leadership.';

  if(payload.infrastructureIssues&&payload.infrastructureIssues.trim())
    fb += '\n\nINFRASTRUCTURE ISSUES: '+payload.infrastructureIssues.trim();
  if(payload.otherIssues&&payload.otherIssues.trim())
    fb += '\nOTHER ISSUES: '+payload.otherIssues.trim();
  return fb;
}

// ---- ONE-TIME AUTH TRIGGER ----
function requestPermissions() {
  try { SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  try { DriveApp.getRootFolder(); } catch(e) {}
  try { UrlFetchApp.fetch('https://www.google.com',{muteHttpExceptions:true}); } catch(e) {}
  try { PropertiesService.getScriptProperties().getKeys(); } catch(e) {}
  Logger.log('All permissions granted successfully.');
}

// ============================================================
// DIAGNOSTIC — run this manually in Apps Script editor to
// verify getDashboardData works before opening the dashboard.
// Apps Script editor → select testDashboard → Run ▶
// Check Execution Log for output.
// ============================================================
function testDashboard() {
  var locations = ['Kodathi', 'Attibele'];
  locations.forEach(function(loc) {
    var result = getDashboardData(loc);
    Logger.log('--- ' + loc + ' ---');
    if (!result.success) {
      Logger.log('ERROR: ' + result.error);
      return;
    }
    Logger.log('Teachers found: ' + result.teachers.length);
    result.teachers.forEach(function(t) {
      Logger.log('  ' + t.teacherName + ' | obs: ' + t.obsCount + ' | avg: ' + t.avgScore + '/28');
    });
  });

  // Also list ALL tab names so you can see what's in the sheet
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  Logger.log('\n--- ALL TABS IN SPREADSHEET ---');
  sheets.forEach(function(s) { Logger.log('  ' + s.getName()); });
}
// ============================================================
// PROGRESS COMPARISON
// Called from dashboard when teacher has multiple observations.
// Sends all feedbacks + scores to Claude and asks for a
// structured progress comparison.
// ============================================================
function getProgressComparison(teacherName, rows) {
  try {
    if (!rows || rows.length < 2) {
      return { success: false, error: 'Need at least 2 observations to compare.' };
    }

    var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { success: false, error: 'No API key configured.' };

    // Build prompt
    var prompt = 'You are an instructional coach at Harvest International School.\n';
    prompt += 'Below are multiple classroom observation reports for ' + teacherName + ', ordered from oldest to newest.\n';
    prompt += 'Compare the observations and write a concise progress analysis (250-300 words).\n\n';

    rows.forEach(function(r, i) {
      prompt += '--- OBSERVATION ' + (i + 1) + ' (' + r.date + ', by ' + r.auditor + ') ---\n';
      prompt += 'Overall Score: ' + r.overall + '/28  |  Rating: ' + r.rating + '\n';
      prompt += 'Domain 1 (Planning): ' + r.domain1 + '/12\n';
      prompt += 'Domain 2 (Classroom): ' + r.domain2 + '/4\n';
      prompt += 'Domain 3 (Instruction): ' + r.domain3 + '/16\n';
      if (r.feedback && r.feedback.trim()) {
        // Trim to first 600 chars to keep prompt manageable
        prompt += 'Feedback summary: ' + r.feedback.trim().substring(0, 600) + '\n';
      }
      prompt += '\n';
    });

    prompt += 'Write your comparison in this structure:\n';
    prompt += '1. OVERALL TREND (1-2 sentences: is the teacher improving, declining, or steady?)\n';
    prompt += '2. AREAS OF GROWTH (bullet points: what has improved across observations?)\n';
    prompt += '3. PERSISTENT CHALLENGES (bullet points: what has not improved or worsened?)\n';
    prompt += '4. RECOMMENDATION (1 focused paragraph for the next observation cycle)\n';
    prompt += 'Be specific and reference actual scores and dates where relevant.';

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var code = resp.getResponseCode();
    var body = JSON.parse(resp.getContentText());

    if (code === 200 && body.content && body.content[0] && body.content[0].text) {
      return { success: true, comparison: body.content[0].text.trim() };
    }
    Logger.log('Comparison API error ' + code + ': ' + JSON.stringify(body));
    return { success: false, error: 'API returned ' + code };

  } catch(e) {
    Logger.log('getProgressComparison error: ' + e.message);
    return { success: false, error: e.message };
  }
}
// ── DIAGNOSTIC ──────────────────────────────────────────────────────────────
// Run testTeacherLookup() in Apps Script editor to verify teacher tab matching.
// It logs CONFIG entries, all tab names, and simulates the lookup.
function testTeacherLookup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Show all sheet tab names
  Logger.log('=== ALL TABS ===');
  ss.getSheets().forEach(function(s){ Logger.log('  "' + s.getName() + '"'); });

  // 2. Show CONFIG rows
  Logger.log('\n=== CONFIG ===');
  var cfg = ss.getSheetByName('CONFIG');
  if (!cfg) { Logger.log('CONFIG sheet missing!'); return; }
  var rows = cfg.getDataRange().getValues();
  rows.forEach(function(r, i){
    if (i === 0) return; // skip header
    var name  = String(r[0]).trim();
    var desig = String(r[1]).trim();
    var email = String(r[2]).trim();
    var namePart = name.replace(/\s+/g, '_');
    var tabK = 'Kodathi_'  + namePart;
    var tabA = 'Attibele_' + namePart;
    Logger.log('  name="' + name + '" desig="' + desig + '" email="' + email + '"');
    Logger.log('    → would look for tabs: "' + tabK + '" and "' + tabA + '"');
    Logger.log('    → Kodathi tab exists:  ' + (ss.getSheetByName(tabK)  ? 'YES' : 'NO'));
    Logger.log('    → Attibele tab exists: ' + (ss.getSheetByName(tabA) ? 'YES' : 'NO'));
  });
}

// ── EMAIL NOTIFICATION ──────────────────────────────────────────────────────
function sendAuditNotification(ss, tabName, rowIndex) {
  try {
    var underscoreIdx = tabName.indexOf('_');
    if (underscoreIdx < 0) return;
    var location    = tabName.substring(0, underscoreIdx);
    var teacherPart = tabName.substring(underscoreIdx + 1).replace(/_/g,' ').trim();

    var sheet   = ss.getSheetByName(tabName);
    var lastCol = Math.max(sheet.getLastColumn(), 10);
    var row     = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    var auditorName = String(row[1] || '').trim();
    var grade       = String(row[6] || '').trim();

    var subject = location + ' | Audit Report of ' + (grade || 'your class');

    var cfg     = ss.getSheetByName('CONFIG');
    if (!cfg) return;
    var cfgData = cfg.getDataRange().getValues();
    var teacherEmail = '';
    var teacherName  = '';
    var appUrl       = ScriptApp.getService().getUrl();

    for (var i = 1; i < cfgData.length; i++) {
      var cfgName  = String(cfgData[i][0] || '').trim();
      var cfgDesig = String(cfgData[i][1] || '').trim().toLowerCase();
      var cfgEmail = String(cfgData[i][2] || '').trim();
      if (cfgDesig === 'teacher' &&
          cfgName.replace(/\s+/g,'_').toLowerCase() === teacherPart.replace(/\s+/g,'_').toLowerCase()) {
        teacherEmail = cfgEmail;
        teacherName  = cfgName;
        break;
      }
    }

    if (!teacherEmail) {
      Logger.log('sendAuditNotification: no email found for "' + teacherPart + '"');
      return;
    }

    var body =
      'Dear ' + (teacherName || 'Teacher') + ',\n\n' +
      'Your classroom observation report has been reviewed and finalised by ' +
      (auditorName || 'your auditor') + '.\n\n' +
      'Details:\n  Location : ' + location + '\n  Class    : ' + (grade || 'N/A') + '\n\n' +
      'Please log in to view your full report, AI-generated feedback and domain scores.\n\n' +
      appUrl + '\n\nRegards,\nHarvest International School\nAcademic Quality Team';

    var htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #d4e4d4;border-radius:12px;overflow:hidden;">' +
        '<div style="background:#1a3a1a;padding:18px 22px;">' +
          '<div style="font-size:17px;font-weight:bold;color:#7fff7f;">Harvest International School</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">Academic Quality &amp; Observation Programme</div>' +
        '</div>' +
        '<div style="padding:22px;">' +
          '<p style="margin:0 0 14px;font-size:14px;color:#1a2a1a;">Dear <strong>' + (teacherName||'Teacher') + '</strong>,</p>' +
          '<p style="margin:0 0 14px;font-size:13px;color:#333;line-height:1.6;">Your classroom observation report has been <strong>reviewed and finalised</strong> by <strong>' + (auditorName||'your auditor') + '</strong>.</p>' +
          '<div style="background:#f0f7f0;border-left:4px solid #2D6A2D;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 16px;">' +
            '<div style="font-size:11px;font-weight:bold;color:#2D6A2D;text-transform:uppercase;margin-bottom:6px;">Observation Details</div>' +
            '<div style="font-size:13px;color:#333;line-height:1.8;">&#128205; <strong>Location:</strong> ' + location + '<br>&#127979; <strong>Class:</strong> ' + (grade||'N/A') + '</div>' +
          '</div>' +
          '<div style="text-align:center;margin-bottom:18px;">' +
            '<a href="' + appUrl + '" style="display:inline-block;padding:11px 26px;background:linear-gradient(135deg,#2D6A2D,#4a8c4a);color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">&#128202; View My Report</a>' +
          '</div>' +
          '<p style="margin:0;font-size:11px;color:#888;">If you have questions, please contact your school coordinator.</p>' +
        '</div>' +
        '<div style="background:#f0f7f0;padding:10px 22px;font-size:10px;color:#888;text-align:center;border-top:1px solid #d4e4d4;">Harvest International School &mdash; Academic Quality Team</div>' +
      '</div>';

    MailApp.sendEmail({ to: teacherEmail, subject: subject, body: body, htmlBody: htmlBody });
    Logger.log('Email sent to ' + teacherEmail + ' | Subject: ' + subject);
  } catch(e) {
    Logger.log('sendAuditNotification error: ' + e.message);
  }
}