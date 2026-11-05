import { SchoolRecord, UserSession, DPRReport, SchoolReview, UploadHistoryItem } from '../types/school';
import { DEMO_ACCOUNTS } from '../data/sampleSchools';

const STORAGE_KEYS = {
  SESSION: 'nx_dpr_session',
  SCHOOLS: 'nx_dpr_schools',
  REPORTS: 'nx_dpr_reports',
  REVIEWS: 'nx_school_reviews',
  UPLOADS: 'nx_upload_history',
  ACTIVE_UPLOAD_ID: 'nx_active_upload_id',
};

class AppStore {
  private session: UserSession | null = null;
  private schools: SchoolRecord[] = [];
  private reports: DPRReport[] = [];
  private reviews: SchoolReview[] = [];
  private uploads: UploadHistoryItem[] = [];
  private activeUploadId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Session (default to Super Admin for immediate testing)
      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (savedSession) {
        this.session = JSON.parse(savedSession);
      } else {
        this.session = DEMO_ACCOUNTS.superadmin;
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(this.session));
      }

      // 2. Schools: STRICTLY DYNAMIC ONLY — NO DUMMY DATA
      // Purge any legacy dummy records starting with 'sch-0'
      const savedSchools = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (savedSchools) {
        const parsed: SchoolRecord[] = JSON.parse(savedSchools);
        // Only keep dynamic user uploaded records
        this.schools = parsed.filter((s) => !s.id.startsWith('sch-0'));
      } else {
        this.schools = [];
      }
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(this.schools));

      // 3. DPR Reports: STRICTLY DYNAMIC ONLY
      const savedReports = localStorage.getItem(STORAGE_KEYS.REPORTS);
      if (savedReports) {
        const parsedRep: DPRReport[] = JSON.parse(savedReports);
        this.reports = parsedRep.filter((r) => !r.id.startsWith('dpr-rep-001') && !r.schoolId.startsWith('sch-0'));
      } else {
        this.reports = [];
      }
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));

      // 4. Reviews: STRICTLY DYNAMIC ONLY
      const savedReviews = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      if (savedReviews) {
        const parsedRev: SchoolReview[] = JSON.parse(savedReviews);
        this.reviews = parsedRev.filter((r) => !r.id.startsWith('rev-001') && !r.id.startsWith('rev-002') && !r.schoolId.startsWith('sch-0'));
      } else {
        this.reviews = [];
      }
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(this.reviews));

      // 5. Upload History: STRICTLY DYNAMIC ONLY
      const savedUploads = localStorage.getItem(STORAGE_KEYS.UPLOADS);
      if (savedUploads) {
        const parsedUp: UploadHistoryItem[] = JSON.parse(savedUploads);
        this.uploads = parsedUp.filter((u) => u.id !== 'upload-default-bengaluru');
      } else {
        this.uploads = [];
      }
      localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(this.uploads));

      const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_UPLOAD_ID);
      this.activeUploadId = savedActiveId && savedActiveId !== 'upload-default-bengaluru' ? savedActiveId : null;
    } catch (e) {
      console.warn('Could not initialize local storage store:', e);
      this.schools = [];
      this.reports = [];
      this.reviews = [];
      this.uploads = [];
    }
  }

  public subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // Session
  public getSession(): UserSession | null {
    return this.session;
  }

  public setSession(session: UserSession | null) {
    this.session = session;
    if (session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
    this.notify();
  }

  public switchUser(userKey: 'superadmin' | 'admin' | 'user' | 'user2') {
    if (DEMO_ACCOUNTS[userKey]) {
      this.setSession(DEMO_ACCOUNTS[userKey]);
    }
  }

  // Schools
  public getSchools(): SchoolRecord[] {
    return this.schools;
  }

  public setSchools(newSchools: SchoolRecord[]) {
    // Only keep real dynamic records
    this.schools = newSchools.filter((s) => !s.id.startsWith('sch-0'));
    try {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(this.schools));
    } catch (e) {
      console.error('Error saving schools to localStorage:', e);
    }
    this.notify();
  }

  public updateSchool(updated: SchoolRecord) {
    const idx = this.schools.findIndex((s) => s.id === updated.id);
    if (idx !== -1) {
      this.schools[idx] = updated;
      try {
        localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(this.schools));
      } catch (e) {
        console.error('Error updating school in localStorage:', e);
      }
      this.notify();
    }
  }

  public clearAllSchools() {
    this.schools = [];
    this.uploads = [];
    this.activeUploadId = null;
    try {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify([]));
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_UPLOAD_ID);
    } catch (e) {
      console.error('Error clearing schools:', e);
    }
    this.notify();
  }

  public addUploadedFile(filename: string, importedRecords: SchoolRecord[], csvText?: string) {
    const newUpload: UploadHistoryItem = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      filename,
      uploadedAt: new Date().toISOString(),
      recordsCount: importedRecords.length,
      records: importedRecords,
      csvText,
      ownerId: this.session?.id || 'usr-super-01',
      ownerName: this.session?.name || 'Administrator',
      canVisit: true,
      canShare: true,
    };

    this.uploads.unshift(newUpload);
    this.activeUploadId = newUpload.id;
    this.schools = [...importedRecords];

    try {
      localStorage.setItem(STORAGE_KEYS.UPLOADS, JSON.stringify(this.uploads));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_UPLOAD_ID, newUpload.id);
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(this.schools));
    } catch (e) {
      console.error('Error saving uploaded file:', e);
    }

    this.notify();
    return newUpload;
  }

  public getUploadHistory(): UploadHistoryItem[] {
    return this.uploads;
  }

  public restoreUpload(uploadId: string) {
    const target = this.uploads.find((u) => u.id === uploadId);
    if (target) {
      this.schools = [...target.records];
      this.activeUploadId = target.id;
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(this.schools));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_UPLOAD_ID, target.id);
      this.notify();
    }
  }

  // DPR Reports
  public getReports(): DPRReport[] {
    return this.reports;
  }

  public addReport(reportData: Omit<DPRReport, 'id' | 'createdAt'>): DPRReport {
    const newReport: DPRReport = {
      ...reportData,
      id: `dpr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.reports.unshift(newReport);

    const school = this.schools.find((s) => s.id === reportData.schoolId);
    if (school) {
      school.lastVisitedDate = reportData.visitDate;
      school.totalVisitsCount = (school.totalVisitsCount || 0) + 1;
      school.daysSinceLastVisit = 0;
      if (reportData.computerLabObserved === 'Yes') {
        school.computerLab = 'Yes';
        school.computerLabSource = 'VISIT';
        school.computerLabCheckedAt = new Date().toISOString();
        if (reportData.computersCountObserved) {
          school.labComputersCount = reportData.computersCountObserved;
        }
        school.labInternetAvailable = reportData.internetWorking ? 'Yes (Verified in Field Visit)' : 'No';
        school.labVerificationNote = `Verified in field visit by ${reportData.officerName} on ${reportData.visitDate}.`;
      } else if (reportData.computerLabObserved === 'No') {
        school.computerLab = 'No';
        school.computerLabSource = 'VISIT';
        school.computerLabCheckedAt = new Date().toISOString();
        school.labComputersCount = 0;
        school.labVerificationNote = `Field officer confirmed absence of computer lab during visit on ${reportData.visitDate}.`;
      }
      this.updateSchool(school);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));
    } catch (e) {
      console.error('Error saving DPR report:', e);
    }
    this.notify();
    return newReport;
  }

  public updateReportStatus(reportId: string, status: 'APPROVED_BY_ADMIN' | 'REVISION_REQUESTED', remarks?: string) {
    const rep = this.reports.find((r) => r.id === reportId);
    if (rep) {
      rep.approvalStatus = status;
      if (remarks) rep.adminRemarks = remarks;
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));
      this.notify();
    }
  }

  // Reviews
  public getReviews(): SchoolReview[] {
    return this.reviews;
  }

  public addReview(reviewData: Omit<SchoolReview, 'id' | 'reviewedAt'>) {
    const newRev: SchoolReview = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      reviewedAt: new Date().toISOString(),
    };
    this.reviews.unshift(newRev);
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(this.reviews));
    } catch (e) {
      console.error('Error saving review:', e);
    }
    this.notify();
    return newRev;
  }
}

export const store = new AppStore();
