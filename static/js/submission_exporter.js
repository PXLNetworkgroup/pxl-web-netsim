/**
 * submission_exporter.js - Student Exam Submission & Anti-Cheat Bundle Generator
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

const SubmissionExporter = {
  /**
   * Builds the official student submission bundle
   */
  buildPackage(studentInfo = {}) {
    const sim = window.PXLNetworkSim;
    const grading = window.PXLApp ? window.PXLApp.gradingEngine.evaluate() : { earnedPoints: 0, totalPoints: 0, percentage: 0 };
    const exam = window.PXLApp ? window.PXLApp.activeExam : { id: 'unknown', title: 'Lab' };

    const devicesConfig = {};
    const commandLogs = {};

    if (sim) {
      for (const [id, dev] of Object.entries(sim.devices)) {
        devicesConfig[id] = {
          hostname: dev.hostname,
          type: dev.type,
          model: dev.model,
          runningConfig: dev.generateRunningConfig(),
          hasSavedConfig: Boolean(dev.savedStartupConfig),
          interfaces: dev.interfaces
        };
        commandLogs[id] = dev.history || [];
      }
    }

    const payload = {
      institution: "Hogeschool PXL - Toegepaste Informatica / SNE",
      system: "PXL Web NetSim v2.0",
      examId: exam.id || "custom",
      examTitle: exam.title || "Cisco IOS Lab Exam",
      student: {
        name: studentInfo.name || "Student",
        studentNumber: studentInfo.studentNumber || "00000000",
        classGroup: studentInfo.classGroup || "1SNE"
      },
      timestamp: new Date().toISOString(),
      grading: {
        earnedPoints: grading.earnedPoints,
        totalPoints: grading.totalPoints,
        percentage: grading.percentage,
        objectives: grading.objectives
      },
      topology: {
        devices: Object.values(sim.devices).map(d => ({
          id: d.id,
          type: d.type,
          hostname: d.hostname,
          x: d.x,
          y: d.y
        })),
        cables: sim.cables
      },
      devices: devicesConfig,
      commandAuditLog: commandLogs
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const signature = CiscoCrypto.generateSubmissionSignature(jsonString);
    payload.signature = signature;

    return payload;
  },

  /**
   * Prompts user and downloads .pxlexam file
   */
  exportAndDownload(studentInfo) {
    const pkg = this.buildPackage(studentInfo);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (studentInfo.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const safeNum = (studentInfo.studentNumber || '00000000').replace(/[^a-zA-Z0-9]/g, '_');
    a.href = url;
    a.download = `Inzending_${safeName}_${safeNum}_PXL_CiscoExa.pxlexam`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return pkg;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SubmissionExporter };
}
