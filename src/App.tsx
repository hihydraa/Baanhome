import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header, NavigationTab } from './components/Header';
import { CorporateSearchUI } from './components/CorporateSearchUI';
import { CategoriesGrid } from './components/CategoriesGrid';
import { GoogleSheetsLogView } from './components/GoogleSheetsLogView';
import { UnansweredQuestionsView } from './components/UnansweredQuestionsView';
import { DocPreviewModal } from './components/DocPreviewModal';
import { ArchitectureView } from './components/ArchitectureView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { UserWelcomeGate } from './components/UserWelcomeGate';
import { B2BPartnershipsView } from './components/B2BPartnershipsView';
import { ServiceShowcaseSection } from './components/ServiceShowcaseSection';
import { UserManagementView } from './components/UserManagementView';
import { GoogleSheetsDbConnectModal } from './components/GoogleSheetsDbConnectModal';

import {
  KnowledgeCategory,
  CategoryMeta,
  StaffProfile,
  QuestionLog,
  UnansweredQuestion,
  KnowledgeItem,
  AppUser,
  UserActivityLog,
  UserRole,
  B2BAppointment,
} from './types';
import { INITIAL_QUESTION_LOGS, INITIAL_UNANSWERED_QUESTIONS } from './data/initialLogs';
import { INITIAL_B2B_APPOINTMENTS } from './data/b2bAppointments';
import { KNOWLEDGE_BASE_ITEMS } from './data/knowledgeBase';
import { 
  createQuestionLog, 
  createUnansweredQuestion, 
  updateUnansweredStatus,
  deleteUnansweredQuestion,
  deleteQuestionLog,
  subscribeQuestionLogs,
  subscribeUnansweredQuestions,
  getLocalQuestionLogs,
  getLocalUnansweredQuestions
} from './utils/firebase';
import { getSyncedKnowledgeItems, syncKnowledgeWithServer, withPdfKnowledge } from './utils/googleSheetsSync';
import { 
  GoogleSheetsDbConfig, 
  getStoredSheetsConfig, 
  appendQuestionLogToSheet,
  syncCentralSheetsConfig
} from './utils/googleSheetsDatabase';
import { getGoogleAccessToken, initGoogleAuth } from './utils/googleWorkspaceAuth';
import { syncCustomImagesWithServer } from './utils/itemImageManager';
import { subscribeCentralB2B, getCachedAppointments } from './utils/b2bService';
import { 
  getActiveSessionUser, 
  setActiveSessionUser, 
  subscribeUsers,
  refreshCentralUsers, 
  subscribeUserActivities, 
  recordUserActivity, 
  initializeDefaultUsersIfNeeded,
  canUserAccessTab,
  getLocalUsers,
  INITIAL_DEFAULT_USERS,
  INITIAL_ACTIVITY_LOGS,
  ROLE_PERMISSIONS
} from './utils/authService';
import { Sparkles, ShieldAlert, Lock, ArrowRight } from 'lucide-react';

const NongHomeAnalyticsView = lazy(() => import('./components/NongHomeAnalyticsView').then(module => ({ default: module.NongHomeAnalyticsView })));

export default function App() {
  // Current Authenticated User (Strict Login Required: anyone opening the link must log in first)
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(() => {
    return getActiveSessionUser();
  });

  const [showWelcomeGate, setShowWelcomeGate] = useState<boolean>(() => !getActiveSessionUser());
  const [allowWelcomeGateCancel, setAllowWelcomeGateCancel] = useState<boolean>(() => !!getActiveSessionUser());
  
  const [activeTab, setActiveTab] = useState<NavigationTab>('qa');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all');
  
  // Users & Activity Logs state (Real-time Firebase Firestore + Local Cache)
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);

  // Active Knowledge Base Items (loaded from Google Sheets sync or default)
  const [activeKnowledgeItems, setActiveKnowledgeItems] = useState<KnowledgeItem[]>(
    () => getSyncedKnowledgeItems() || KNOWLEDGE_BASE_ITEMS
  );
  const [isUsingCustomSheet, setIsUsingCustomSheet] = useState<boolean>(
    () => !!getSyncedKnowledgeItems()
  );
  const [showSheetsSyncModal, setShowSheetsSyncModal] = useState<boolean>(false);

  const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>(() => {
    const cached = getLocalQuestionLogs();
    return cached;
  });
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>(() => {
    const cached = getLocalUnansweredQuestions();
    return cached;
  });

  // Google Sheets Live Database Connection state
  const [showGoogleSheetsDbModal, setShowGoogleSheetsDbModal] = useState<boolean>(false);
  const [sheetsDbConfig, setSheetsDbConfig] = useState<GoogleSheetsDbConfig | null>(() =>
    getStoredSheetsConfig()
  );

  // Cached B2B Appointments for Google Sheets sync
  const [b2bAppointments, setB2bAppointments] = useState<B2BAppointment[]>(() => {
    return getCachedAppointments();
  });

  const handleOpenGoogleSheetsDbModal = () => {
    setB2bAppointments(getCachedAppointments());
    setShowGoogleSheetsDbModal(true);
  };

  const [previewDocCategory, setPreviewDocCategory] = useState<CategoryMeta | null>(null);

  const [syncError,setSyncError]=useState<string|null>(null);
  // Initialize and subscribe to Firestore
  useEffect(() => {
    const handler=(event:Event)=>setSyncError((event as CustomEvent).detail);
    window.addEventListener('baanhome-sync-error',handler);
    return ()=>window.removeEventListener('baanhome-sync-error',handler);
  },[]);

  useEffect(() => {
    // Initialize Google Workspace OAuth auth listener
    initGoogleAuth();

    // Sync custom knowledge from server if uploaded by any staff/admin
    syncKnowledgeWithServer((items) => {
      setActiveKnowledgeItems(items);
      setIsUsingCustomSheet(true);
    });

    // Sync custom item images from server
    syncCustomImagesWithServer();

    // Subscribe to Central Sheets Config
    const unsubSheets = syncCentralSheetsConfig((cfg) => {
      setSheetsDbConfig(cfg);
    });

    // Subscribe to Central B2B appointments
    const unsubB2b = subscribeCentralB2B(({ appointments: apts }) => {
      setB2bAppointments(apts);
    });

    // Seed default users if Firestore is empty
    initializeDefaultUsersIfNeeded();

    // Subscribe to users
    const unsubUsers = subscribeUsers((loadedUsers) => {
      if (Array.isArray(loadedUsers)) {
        setUsers(loadedUsers);
        // If current staff status or role was updated by admin in real-time, sync it
        if (currentStaff) {
          const matchingCurrent = loadedUsers.find((u) => u.id === currentStaff.id);
          if (!matchingCurrent || matchingCurrent.status === 'inactive') {
              setActiveSessionUser(null);setCurrentStaff(null);setShowWelcomeGate(true);setAllowWelcomeGateCancel(false);
            } else {
            if (matchingCurrent.role !== currentStaff.role) {
              setCurrentStaff((prev) => (prev ? {
                ...prev,
                role: matchingCurrent.role,
              } : null));
            }
          }
        }
      }
    });

    // Subscribe to activity logs
    const unsubLogs = subscribeUserActivities((loadedLogs) => {
      if (Array.isArray(loadedLogs)) {
        setActivityLogs(loadedLogs);
      }
    });

    // Subscribe to question logs & unanswered questions
    const unsubQuestionLogs = subscribeQuestionLogs((logs) => {
      if (Array.isArray(logs)) {
        setQuestionLogs(logs);
      }
    });

    const unsubUnanswered = subscribeUnansweredQuestions((qs) => {
      if (Array.isArray(qs)) {
        setUnansweredQuestions(qs);
      }
    });

    return () => {
      unsubSheets();
      unsubB2b();
      unsubUsers();
      unsubLogs();
      unsubQuestionLogs();
      unsubUnanswered();
    };
  }, [currentStaff?.id]);

  // Role Protection: Ensure current user has permission to view current tab
  useEffect(() => {
    if (!currentStaff) return;
    const role = currentStaff.role || 'Knowledge User';
    if (!canUserAccessTab(role, activeTab)) {
      // Auto fallback to 'qa' if switching to an unauthorized tab
      setActiveTab('qa');
    }
  }, [currentStaff?.role, activeTab]);

  const handleExecuteSearch = (queryToSearch?: string) => {
    const targetQuery = queryToSearch !== undefined ? queryToSearch : searchQuery;
    if (!targetQuery.trim()) return;
    setSearchQuery(targetQuery);
    setActiveTab('qa');

    // Audit log
    recordUserActivity(
      'SEARCH_QA',
      `ค้นหาคำถาม: "${targetQuery}"`,
      {
        id: currentStaff.id,
        username: currentStaff.username || 'user',
        name: currentStaff.name,
        role: currentStaff.role || 'Knowledge User',
      }
    );
  };

  const handleUpdateUnansweredStatus = async (
    id: string,
    status: 'pending' | 'assigned' | 'resolved',
    notes?: string
  ) => {
    await updateUnansweredStatus(id, status, notes);
  };

  const handleDeleteUnansweredQuestion = async (id: string) => {
    await deleteUnansweredQuestion(id);
  };

  const handleClearResolvedUnanswered = async () => {
    const resolvedIds = unansweredQuestions.filter((q) => q.status === 'resolved').map((q) => q.id);
    await Promise.all(resolvedIds.map((id) => deleteUnansweredQuestion(id)));
  };

  const handleDeleteQuestionLog = async (id: string) => {
    await deleteQuestionLog(id);
  };

  const handleClearAllLogs = async () => {
    const logIds = questionLogs.map((log) => log.id);
    await Promise.all(logIds.map((id) => deleteQuestionLog(id)));
  };

  const handleSaveUserProfile = (profile: StaffProfile) => {
    setActiveSessionUser(profile);
    setCurrentStaff(profile);
    setShowWelcomeGate(false);
    setAllowWelcomeGateCancel(true);
  };

  const handleSelectStaff = (staff: StaffProfile) => {
    setActiveSessionUser(staff);
    setCurrentStaff(staff);
  };

  const handleLogout = () => {
    setActiveSessionUser(null);
    setCurrentStaff(null);
    setShowWelcomeGate(true);
    setAllowWelcomeGateCancel(false);
  };

  // If not logged in, render the login gate directly as the entry page
  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#143224] via-[#1B3D2F] to-[#0A1A12] flex items-center justify-center p-3 sm:p-5 relative overflow-hidden">
      {syncError && <div role="alert" className="bg-amber-50 text-amber-900 p-3 text-sm">{syncError}<button className="ml-3 underline" onClick={()=>window.location.reload()}>ลองเชื่อมต่อใหม่</button></div>}
        {/* Ambient luxury background glow */}
        <div className="fixed top-0 right-0 w-[550px] h-[550px] bg-[#E8C57D]/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed bottom-0 left-0 w-[450px] h-[450px] bg-[#2D5A43]/20 rounded-full blur-3xl pointer-events-none -z-10" />
        <UserWelcomeGate
          isOpen={true}
          initialProfile={null}
          allowCancel={false}
          onSaveProfile={handleSaveUserProfile}
        />
      </div>
    );
  }

  const currentRole: UserRole = currentStaff.role || 'Knowledge User';
  const roleConfig = ROLE_PERMISSIONS[currentRole] || ROLE_PERMISSIONS['Knowledge User'];
  const hasAccessToCurrentTab = canUserAccessTab(currentRole, activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF7F0] via-[#F4EFE4] to-[#ECE3D2] flex flex-col text-[#1F3327] relative selection:bg-[#1B3D2F] selection:text-[#E8C57D]">
      {/* Ambient luxury background glow */}
      <div className="fixed top-0 right-0 w-[550px] h-[550px] bg-[#E8C57D]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-80 left-0 w-[450px] h-[450px] bg-[#2D5A43]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header with identity & sleek navigation */}
      <Header
        currentStaff={currentStaff}
        onSelectStaff={handleSelectStaff}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unansweredCount={unansweredQuestions.filter((q) => q?.status === 'pending').length}
        onOpenSheetsSync={() => setShowSheetsSyncModal(true)}
        isUsingCustomSheet={isUsingCustomSheet}
        onOpenGoogleSheetsDbModal={handleOpenGoogleSheetsDbModal}
        sheetsDbConfig={sheetsDbConfig}
        onEditProfile={() => {
          setAllowWelcomeGateCancel(true);
          setShowWelcomeGate(true);
        }}
        onLogout={handleLogout}
      />

      {syncError && <div role="alert" className="bg-amber-50 text-amber-900 p-3 text-sm">{syncError}<button className="ml-3 underline" onClick={()=>window.location.reload()}>ลองเชื่อมต่อใหม่</button></div>}
      {/* Main Container */}
      <main className="flex-1 pb-24 md:pb-16">
        {/* ACCESS RESTRICTION BANNER IF TAB IS UNAUTHORIZED */}
        {!hasAccessToCurrentTab ? (
          <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#FDECEE] text-[#B8324E] border border-[#F7BFC9] flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1B3D2F]">
              สิทธิ์การเข้าถึงไม่เพียงพอ (Access Restricted)
            </h2>
            <p className="text-sm text-[#5A6E60] leading-relaxed max-w-md mx-auto">
              บัญชีปัจจุบันของคุณคือ <strong>{currentStaff.name}</strong> (@{currentStaff.username}) ในบทบาท <strong>{currentRole}</strong> ซึ่งไม่มีสิทธิ์เข้าถึงเมนูนี้ตามที่ผู้ดูแลระบบกำหนดไว้
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setActiveTab('qa')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1B3D2F] hover:bg-[#244E3C] shadow-sm cursor-pointer"
              >
                กลับสู่หน้าถาม-ตอบ
              </button>
              <button
                onClick={() => setShowWelcomeGate(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#9A5B08] bg-[#FEF6E8] border border-[#F5DEAB] hover:bg-[#FDF0DA] cursor-pointer"
              >
                สลับบทบาทผู้ใช้
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab: QA Search Engine (All Roles) */}
            {activeTab === 'qa' && (
              <CorporateSearchUI 
                searchQuery={searchQuery} 
                onSearchChange={setSearchQuery}
                activeKnowledgeItems={activeKnowledgeItems}
                staffName={currentStaff.name}
                analyticsStaff={currentStaff}
                onOpenSheetsSync={currentRole !== 'Knowledge User' ? () => setShowSheetsSyncModal(true) : undefined}
                isUsingCustomSheet={isUsingCustomSheet}
                onRecordLog={(query, result) => {
                  if (query && result) {
                    const newLog = {
                      id: `log-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      staffName: currentStaff.name,
                      department: currentStaff.department,
                      question: query,
                      answerSummary: result.item.summary,
                      category: result.item.category,
                      sourceDoc: result.item.sourceDoc,
                      found: true,
                    };
                    void createQuestionLog(newLog).catch(()=>{});

                    // User activity log
                    recordUserActivity(
                      'SEARCH_QA',
                      `ค้นพบคำตอบหมวด [${result.item.category}]: "${query}"`,
                      {
                        id: currentStaff.id,
                        username: currentStaff.username || 'user',
                        name: currentStaff.name,
                        role: currentRole,
                      }
                    );
                  }
                }}
                onAskUnanswered={(query) => {
                  const u = {
                    id: `un-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    staffName: currentStaff.name,
                    department: currentStaff.department,
                    question: query,
                    status: 'pending' as const,
                  };
                  void createUnansweredQuestion(u).catch(()=>{});
                  setActiveTab('unanswered');
                }}
              />
            )}

            {/* Tab: B2B Partnerships (Operator & Administrator only) */}
            {activeTab === 'b2b' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <B2BPartnershipsView
                  onSelectLeadForSearch={(leadName) => {
                    handleExecuteSearch(leadName);
                    setActiveTab('qa');
                  }}
                  onOpenGoogleSheetsDbModal={handleOpenGoogleSheetsDbModal}
                  sheetsDbConfig={sheetsDbConfig}
                  currentUser={currentStaff}
                />
              </div>
            )}

            {/* Tab: Google Sheets Log (Operator & Administrator only) */}
            {activeTab === 'sheets' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <GoogleSheetsLogView
                  logs={questionLogs}
                  onSelectLog={(log) => {
                    if (log.found) {
                      handleExecuteSearch(log.question);
                      setActiveTab('qa');
                    }
                  }}
                  onDeleteLog={handleDeleteQuestionLog}
                  onClearLogs={handleClearAllLogs}
                  onOpenSheetsSync={() => setShowSheetsSyncModal(true)}
                  isUsingCustomSheet={isUsingCustomSheet}
                  onOpenGoogleSheetsDbModal={handleOpenGoogleSheetsDbModal}
                  sheetsDbConfig={sheetsDbConfig}
                />
              </div>
            )}

            {/* Tab: Unanswered Questions (Operator & Administrator only) */}
            {activeTab === 'unanswered' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <UnansweredQuestionsView
                  questions={unansweredQuestions}
                  onUpdateStatus={handleUpdateUnansweredStatus}
                  onAskQuestion={(q) => {
                    handleExecuteSearch(q);
                    setActiveTab('qa');
                  }}
                  onDeleteQuestion={handleDeleteUnansweredQuestion}
                  onClearResolved={handleClearResolvedUnanswered}
                />
              </div>
            )}

            {/* Tab: All 12 Knowledge Categories & Service Showcase (All Roles) */}
            {activeTab === 'docs' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <ServiceShowcaseSection
                  onSelectQuery={(q) => {
                    setSearchQuery(q);
                    setActiveTab('qa');
                  }}
                />

                <div className="bg-gradient-to-r from-[#1A3A2B] to-[#2D5A43] text-white p-6 rounded-3xl shadow-sm border border-[#2D5A43]/40">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-[#E7C785] text-xs font-semibold backdrop-blur-md mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Google Docs Internal Repository</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold font-heading">
                    ฐานความรู้ Google Docs ทั้ง 12 หมวดหมู่ของบ้านโฮม
                  </h3>
                  <p className="text-xs sm:text-sm text-[#D3E3D8] mt-1.5 max-w-2xl leading-relaxed">
                    เอกสารที่จัดเก็บเป็นความรู้กลางขององค์กร สามารถคลิกดูโครงสร้างเนื้อหาของแต่ละหมวดเพื่อดูว่าจัดเก็บข้อมูลอะไรบ้าง
                  </p>
                </div>

                <CategoriesGrid
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => {
                    setSelectedCategory(cat);
                    setActiveTab('qa');
                  }}
                  onOpenDocModal={(cat) => {
                    setPreviewDocCategory(cat);
                    // Record activity
                    recordUserActivity(
                      'VIEW_DOC',
                      `เปิดศึกษาโครงสร้างคู่มือหมวด: ${cat.title}`,
                      {
                        id: currentStaff.id,
                        username: currentStaff.username || 'user',
                        name: currentStaff.name,
                        role: currentRole,
                      }
                    );
                  }}
                />
              </div>
            )}

            {activeTab === 'analytics' && currentRole === 'Administrator' && (
              <Suspense fallback={<p className="p-6 text-center">กำลังเปิดสถิติ…</p>}>
                <NongHomeAnalyticsView key={currentStaff.id} staff={currentStaff} legacyLogs={questionLogs} />
              </Suspense>
            )}

            {/* Tab: User Management & RBAC & Audit Logs (Administrator Only) */}
            {activeTab === 'users' && currentRole === 'Administrator' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <UserManagementView
                  currentUser={currentStaff}
                  users={users}
                  activityLogs={activityLogs}
                  onRefreshUsers={() => {
                    refreshCentralUsers().then(setUsers).catch(()=>alert('อ่านบัญชีจากฐานข้อมูลกลางไม่สำเร็จ กรุณาลองใหม่'));
                  }}
                />
              </div>
            )}

            {/* Tab: Architecture and Integration Design (Administrator Only) */}
            {activeTab === 'arch' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <ArchitectureView />
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation (Filtered by Role) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentRole={currentRole}
        onOpenProfile={() => setShowWelcomeGate(true)}
      />

      {/* Footer */}
      <footer className="bg-[#173225] text-[#BED2C4] border-t border-[#234735] py-6 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#C59B3F] text-[#173225] font-bold flex items-center justify-center text-xs shadow-xs">
              โฮม
            </div>
            <div>
              <span className="font-semibold text-white">น้องโฮม &middot; Baan Home Internal Assistant</span>
              <span className="text-[#88A693] hidden md:inline"> | Baan Home Resort & Restaurant</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[#A8C2B0]">
            <span className="text-[11px] text-[#8EA897]">
              สิทธิ์ของคุณ: <strong className="text-[#F1DCB0]">{currentRole}</strong>
            </span>
            {currentRole === 'Administrator' && (
              <>
                <span>&middot;</span>
                <button
                  onClick={() => setActiveTab('users')}
                  className="hover:underline hover:text-[#F1DCB0] cursor-pointer"
                >
                  จัดการสิทธิ์ผู้ใช้
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Doc Preview Modal */}
      <DocPreviewModal
        category={previewDocCategory}
        onClose={() => setPreviewDocCategory(null)}
        onSelectQuestion={(q) => {
          handleExecuteSearch(q);
          setActiveTab('qa');
        }}
      />

      {/* Google Sheets Knowledge Base Sync Modal */}
      <GoogleSheetsSyncModal
        isOpen={showSheetsSyncModal}
        onClose={() => setShowSheetsSyncModal(false)}
        currentActiveItems={activeKnowledgeItems}
        onApplySyncedItems={(items, fromSheet) => {
          setActiveKnowledgeItems(fromSheet ? withPdfKnowledge(items) : items);
          setIsUsingCustomSheet(fromSheet);
        }}
        isUsingCustomSheet={isUsingCustomSheet}
        currentUser={currentStaff}
      />

      {/* Google Sheets Live Database Connection & Management Modal */}
      <GoogleSheetsDbConnectModal
        isOpen={showGoogleSheetsDbModal}
        onClose={() => setShowGoogleSheetsDbModal(false)}
        questionLogs={questionLogs}
        appointments={b2bAppointments}
        onConfigChange={(newConfig) => setSheetsDbConfig(newConfig)}
        currentUser={currentStaff}
      />

      {/* Authentication & User Login / Role Switcher Gate */}
      <UserWelcomeGate
        isOpen={showWelcomeGate}
        initialProfile={currentStaff.name ? currentStaff : null}
        allowCancel={allowWelcomeGateCancel}
        onClose={() => {
          if (allowWelcomeGateCancel) {
            setShowWelcomeGate(false);
          }
        }}
        onSaveProfile={handleSaveUserProfile}
      />
    </div>
  );
}
