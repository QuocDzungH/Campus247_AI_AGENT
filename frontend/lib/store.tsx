"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  User,
  Ticket,
  TicketStatus,
  ChatMessage,
  ChatSession,
  ReviewCase,
  FindingOfficerStatus,
  FindingAiLabel,
  SupplementRequest,
  IssuedCertificateDocument,
  StoredAttachment,
} from "./types";
import { createGateway } from "./data/create-gateway";
import { getDataConfig, DataConfig } from "./data/config";
import { CampusDataGateway } from "./data/gateway";
import { officerDraftFor } from "./staff-policy";
import {
  ConfigurationError,
  DataGatewayError,
  UnsupportedOperationError,
} from "./data/errors";
import type {
  BriefView,
  CampusPreview,
  ChatTurnResult,
  ConversationView,
  PreviewFieldsPatch,
} from "./data/api/mappers";
import {
  alreadySubmittedTicketId,
  applyBriefToTicket,
  commitThenReconcile,
  decideReviewedBriefVersion,
  isConnectionError,
  loginThenHydrate,
  reuseOrMintIntentKey,
  shouldCommitLoginSession,
  shouldRetainIntentKey,
  submittedPreviewResult,
  type SubmitPreviewResult,
} from "./data/api/g2-flow";

export type DataStatus =
  | "loading"
  | "ready"
  | "configuration_error"
  | "unsupported"
  | "connection_error"
  | "data_error";

function toDataGatewayError(error: unknown): DataGatewayError {
  if (error instanceof DataGatewayError) return error;
  return new DataGatewayError(
    "unknown",
    error instanceof Error ? error.message : String(error),
    error
  );
}

export function statusForError(error: DataGatewayError): DataStatus {
  if (error.reason === "configuration") return "configuration_error";
  if (error.reason === "unsupported") return "unsupported";
  if (error.reason === "network" || error.reason === "server") return "connection_error";
  return "data_error";
}

export function requireGateway(
  gateway: CampusDataGateway | null,
  dataError: DataGatewayError | null
): CampusDataGateway {
  if (gateway) return gateway;
  if (dataError) throw dataError;
  throw new ConfigurationError("Data gateway is not initialized.");
}

interface InitialDataState {
  config: DataConfig | null;
  gateway: CampusDataGateway | null;
  error: DataGatewayError | null;
  status: DataStatus;
}

export function initializeDataState(): InitialDataState {
  try {
    const config = getDataConfig();
    try {
      return {
        config,
        gateway: createGateway(config),
        error: null,
        status: "loading",
      };
    } catch (error: unknown) {
      const dataError = toDataGatewayError(error);
      return {
        config,
        gateway: null,
        error: dataError,
        status: statusForError(dataError),
      };
    }
  } catch (error: unknown) {
    const dataError = toDataGatewayError(error);
    return {
      config: null,
      gateway: null,
      error: dataError,
      status: "configuration_error",
    };
  }
}

interface BootstrapData {
  tickets: Ticket[];
  chatSessions: ChatSession[];
  reviewCases: ReviewCase[];
  demoUsers: User[];
  currentUser: User | null;
  status: "ready";
}

export async function hydrateApiAccount(
  gateway: CampusDataGateway,
  user: User
): Promise<{ tickets: Ticket[]; chatSessions: ChatSession[]; reviewCases: ReviewCase[]; demoUsers: User[] }> {
  const tickets = await gateway.getTickets();
  const chatSessions = user.role === "student" ? await gateway.getChatSessions() : [];
  const reviewCases = user.role === "admin" ? [] : await gateway.getReviewCases();
  return { tickets, chatSessions, reviewCases, demoUsers: [] };
}

export async function bootstrapData(
  config: DataConfig | null,
  gateway: CampusDataGateway | null
): Promise<BootstrapData> {
  if (!config || !gateway) {
    throw new ConfigurationError("Data bootstrap requires a valid configuration and gateway.");
  }

  const activeGateway = requireGateway(gateway, null);

  if (config.mode === "api") {
    const currentUser = activeGateway.restoreSession ? await activeGateway.restoreSession() : null;
    if (!currentUser) {
      return {
        tickets: [],
        chatSessions: [],
        reviewCases: [],
        demoUsers: [],
        currentUser,
        status: "ready",
      };
    }
    const account = await hydrateApiAccount(activeGateway, currentUser);
    return {
      ...account,
      currentUser,
      status: "ready",
    };
  }

  const [tickets, chatSessions, reviewCases, demoUsers] = await Promise.all([
    activeGateway.getTickets(),
    activeGateway.getChatSessions(),
    activeGateway.getReviewCases(),
    activeGateway.getDemoUsers(),
  ]);
  const currentUser = await activeGateway.login("SV001");
  return {
    tickets,
    chatSessions,
    reviewCases,
    demoUsers,
    currentUser,
    status: "ready",
  };
}

interface StoreContextType {
  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;

  // Data Layer State
  isDataLoading: boolean;
  dataError: DataGatewayError | null;
  dataStatus: DataStatus;
  dataConfig: DataConfig | null;

  reloadData: () => Promise<void>;

  // Auth / Current User
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  login: (userId: string, remember?: boolean, password?: string) => Promise<User | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
  listConversationMessages: (conversationId: string) => Promise<ChatMessage[]>;
  demoUsers: User[];

  // Tickets
  tickets: Ticket[];
  getTicket: (id: string) => Ticket | undefined;
  createTicket: (data: Partial<Ticket>) => Promise<Ticket>;
  uploadTicketFile: (ticketId: string, file: File, field?: string) => Promise<void>;
  updateTicketStatus: (id: string, status: TicketStatus, actorName: string) => Promise<void>;
  updateOfficerDraft: (id: string, draft: string) => Promise<void>;
  resetOfficerDraft: (id: string) => Promise<void>;
  toggleChecklistItem: (ticketId: string, itemId: string) => Promise<void>;
  addTicketMessage: (
    ticketId: string,
    message: { senderId: string; senderName: string; senderRole: "student" | "officer" | "system"; content: string }
  ) => Promise<void>;
  submitGate2Response: (
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string,
    expectedSnapshot?: string
  ) => Promise<void>;
  resetAllDemoData: () => Promise<void>;

  // Certificate Verification & BM-03 Issuance
  runTicketVerification: (ticketId: string, criterionKey?: string) => Promise<void>;
  retryCriterionVerification: (ticketId: string, criterionId: string) => Promise<void>;
  confirmCriterionReview: (
    ticketId: string,
    criterionId: string,
    note?: string,
    outcome?: "viewed" | "manual_pass" | "manual_fail"
  ) => Promise<void>;
  updateCertificateDraft: (ticketId: string, edits: Partial<IssuedCertificateDocument>) => Promise<void>;
  issueCertificate: (ticketId: string) => Promise<IssuedCertificateDocument | null>;
  downloadIssuedDocument: (ticketId: string, documentId: string) => Promise<void>;

  // Chat Assistant State & Sessions
  chatSessions: ChatSession[];
  activeSessionId: string;
  selectChatSession: (sessionId: string) => void;
  createNewChatSession: () => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  chatMessages: ChatMessage[];
  addChatMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => Promise<void>;
  isL4HandoverActive: boolean;
  setL4HandoverActive: (active: boolean) => void;
  isGate1Open: boolean;
  setGate1Open: (open: boolean) => void;
  gate1FormData: {
    fullName: string;
    mssv: string;
    classYear: string;
    department: string;
    reason: string;
    destinationOrg: string;
    receiveMethod: "digital_pdf" | "paper_stamped";
    academicStatus: string;
  };
  setGate1FormData: React.Dispatch<
    React.SetStateAction<{
      fullName: string;
      mssv: string;
      classYear: string;
      department: string;
      reason: string;
      destinationOrg: string;
      receiveMethod: "digital_pdf" | "paper_stamped";
      academicStatus: string;
    }>
  >;
  lastUpdatedField: "reason" | "receiveMethod" | null;
  updateGate1Field: (field: "reason" | "receiveMethod" | "destinationOrg", value: string) => void;
  createConversation: (options?: { idempotencyKey?: string }) => Promise<ConversationView>;
  sendConversationMessage: (
    conversationId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ) => Promise<ChatTurnResult>;
  patchPreview: (previewId: string, expectedVersion: number, fields: PreviewFieldsPatch) => Promise<CampusPreview>;
  submitPreview: (previewId: string, previewVersion: number) => Promise<SubmitPreviewResult>;
  claimTicket: (ticketId: string) => Promise<Ticket>;
  prepareBrief: (ticketId: string) => Promise<BriefView>;
  refreshTicket: (ticketId: string) => Promise<Ticket | undefined>;
  ensureProcessChecklist: (ticketId: string) => Promise<Ticket | undefined>;

  // Academic Review Cases (Rà soát học phần)
  reviewCases: ReviewCase[];
  getReviewCase: (id: string) => ReviewCase | undefined;
  createReviewCase: (data: Partial<ReviewCase>) => Promise<ReviewCase>;
  runAiReview: (caseId: string) => Promise<void>;
  updateFindingReview: (
    caseId: string,
    findingId: string,
    updates: {
      officerStatus: FindingOfficerStatus;
      officerAdjustedLabel?: FindingAiLabel;
      officerNote?: string;
    },
    expectedSnapshot?: string
  ) => Promise<void>;
  sendSupplementRequest: (caseId: string, request: SupplementRequest, expectedSnapshot?: string) => Promise<void>;
  submitStudentSupplement: (
    caseId: string,
    payload: {
      note: string;
      docTitle?: string;
      fileName?: string;
      versionToActivate?: number;
      attachment?: StoredAttachment;
    }
  ) => Promise<void>;
  finalizeReviewCase: (caseId: string, report: NonNullable<ReviewCase["finalReport"]>, expectedSnapshot?: string) => Promise<void>;
  resetReviewDemo: () => Promise<void>;
  isAiAnalyzing: boolean;
  aiAnalyzingStep: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_THEME = "campus247_theme_v2";
export const MOCK_REMEMBERED_USER_KEY = "campus247_current_user_v1";

export function writeMockRememberedUser(
  mode: DataConfig["mode"] | null | undefined,
  remember: boolean,
  userId: string
): void {
  if (typeof window === "undefined" || mode === "api") return;
  try {
    if (remember) localStorage.setItem(MOCK_REMEMBERED_USER_KEY, userId);
    else localStorage.removeItem(MOCK_REMEMBERED_USER_KEY);
  } catch {
    /* Mock remember is best-effort and isolated from the API session. */
  }
}

export function clearMockRememberedUser(mode: DataConfig["mode"] | null | undefined): void {
  if (typeof window === "undefined" || mode === "api") return;
  try {
    localStorage.removeItem(MOCK_REMEMBERED_USER_KEY);
  } catch {
    /* Keep going; API session storage is untouched. */
  }
}

export function dataStateAfterGatewaySuccess(): { dataError: null; dataStatus: "ready" } {
  return { dataError: null, dataStatus: "ready" };
}

export async function performGatewayLogin(
  gateway: CampusDataGateway,
  userId: string,
  options: {
    remember?: boolean;
    mode?: DataConfig["mode"] | null;
    isCurrent: () => boolean;
    password?: string;
  }
): Promise<User | null> {
  gateway.abortRequests?.();
  if (options.mode === "api" && gateway.endSession) {
    await gateway.endSession();
  }
  if (!options.isCurrent()) return null;
  if (options.password && gateway.loginWithPassword) {
    return gateway.loginWithPassword(userId, options.password, { remember: options.remember });
  }
  return gateway.login(userId, { remember: options.remember });
}

// Demo users moved to gateway

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Storage is initialized after hydration, never during server/client rendering.
  const [dataConfig, setDataConfig] = useState<DataConfig | null>(null);
  const [gateway, setGateway] = useState<CampusDataGateway | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<DataGatewayError | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const authGeneration = useRef(0);
  const authRestored = useRef(false);
  const loadGeneration = useRef(0);
  const pendingCreateConversationKey = useRef<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reviewCases, setReviewCases] = useState<ReviewCase[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalyzingStep, setAiAnalyzingStep] = useState(1);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isL4HandoverActive, setL4HandoverActive] = useState<boolean>(false);
  const [isGate1Open, setGate1Open] = useState(false);
  const [gate1FormData, setGate1FormData] = useState<StoreContextType["gate1FormData"]>({
    fullName: "Nguyễn Văn An",
    mssv: "20210018",
    classYear: "Khóa 18 (2021 - 2025) · K18 KTPM",
    department: "Khoa Công nghệ Phần mềm",
    reason: "Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)",
    destinationOrg: "Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức",
    receiveMethod: "digital_pdf",
    academicStatus: "Bình thường",
  });
  const [lastUpdatedField, setLastUpdatedField] = useState<"reason" | "receiveMethod" | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const clearApiAccountState = () => {
    setTickets([]);
    setChatSessions([]);
    setReviewCases([]);
    setDemoUsers([]);
    setChatMessages([]);
    setActiveSessionId("");
    setL4HandoverActive(false);
  };

  const loadAllData = useCallback(async () => {
    const run = ++loadGeneration.current;
    const authAtStart = authGeneration.current;
    setIsDataLoading(true);
    setHasDataLoaded(false);
    setDataStatus("loading");
    setDataError(null);
    try {
      // Retry recreates a gateway that may have failed while reading storage.
      const initialized = initializeDataState();
      setDataConfig(initialized.config);
      setGateway(initialized.gateway);
      if (initialized.error) throw initialized.error;
      if (initialized.config?.mode === "api") {
        const restoredUser = initialized.gateway?.restoreSession
          ? await initialized.gateway.restoreSession()
          : null;
        if (run !== loadGeneration.current) return;
        if (!authRestored.current && authAtStart === authGeneration.current) {
          setCurrentUser(restoredUser);
          authRestored.current = true;
        }
        if (!restoredUser) {
          clearApiAccountState();
          setHasDataLoaded(true);
          setDataStatus("ready");
          return;
        }
        const account = await hydrateApiAccount(initialized.gateway!, restoredUser);
        if (run !== loadGeneration.current) return;
        setTickets(account.tickets);
        setChatSessions(account.chatSessions);
        setReviewCases(account.reviewCases);
        setDemoUsers(account.demoUsers);
        if (account.chatSessions.length > 0) {
          setActiveSessionId(account.chatSessions[0].id);
          setChatMessages(account.chatSessions[0].messages || []);
          setL4HandoverActive(!!account.chatSessions[0].isL4HandoverActive);
        }
        setHasDataLoaded(true);
        setDataStatus("ready");
        return;
      }

      const bootstrap = await bootstrapData(initialized.config, initialized.gateway);
      if (run !== loadGeneration.current) return;
      setTickets(bootstrap.tickets);
      setChatSessions(bootstrap.chatSessions);
      setReviewCases(bootstrap.reviewCases);
      setDemoUsers(bootstrap.demoUsers);

      if (bootstrap.chatSessions.length > 0) {
        setActiveSessionId(bootstrap.chatSessions[0].id);
        setChatMessages(bootstrap.chatSessions[0].messages || []);
        setL4HandoverActive(!!bootstrap.chatSessions[0].isL4HandoverActive);
        if (bootstrap.chatSessions[0].gate1FormData) {
          setGate1FormData(bootstrap.chatSessions[0].gate1FormData);
        }
      }

      if (!authRestored.current) {
        let restoredUser: User | null = null;
        const persistedUserId = localStorage.getItem(MOCK_REMEMBERED_USER_KEY);
        if (persistedUserId) {
          restoredUser = await initialized.gateway!.login(persistedUserId);
        }
        if (run !== loadGeneration.current) return;
        if (authAtStart === authGeneration.current) setCurrentUser(restoredUser);
        authRestored.current = true;
      }
      setHasDataLoaded(true);
      setDataStatus(bootstrap.status);
    } catch (e: unknown) {
      if (run !== loadGeneration.current) return;
      const dataGatewayError = toDataGatewayError(e);
      setDataError(dataGatewayError);
      setDataStatus(statusForError(dataGatewayError));
      throw dataGatewayError;
    } finally {
      if (run === loadGeneration.current) setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let savedTheme: string | null = null;
      try { savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME); } catch { /* Use the in-memory theme. */ }
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme("dark");
      }
    }
    void loadAllData().catch(() => { /* The retry state displays the error. */ });
  }, [loadAllData]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGate1FormData((prev) => ({
      ...prev,
      fullName: currentUser.name || prev.fullName,
      mssv: currentUser.mssv || prev.mssv,
      classYear: currentUser.classYear || prev.classYear,
      department: currentUser.major || currentUser.department || prev.department,
      academicStatus: currentUser.academicStatus || prev.academicStatus,
    }));
  }, [currentUser]);

  const executeGateway = useCallback(
    async <T,>(operation: (activeGateway: CampusDataGateway) => Promise<T>): Promise<T> => {
      try {
        const activeGateway = requireGateway(gateway, dataError);
        const result = await operation(activeGateway);
        const successState = dataStateAfterGatewaySuccess();
        setDataError(successState.dataError);
        setDataStatus(successState.dataStatus);
        return result;
      } catch (error: unknown) {
        const dataGatewayError = toDataGatewayError(error);
        setDataError(dataGatewayError);
        setDataStatus(statusForError(dataGatewayError));
        throw dataGatewayError;
      }
    },
    [dataError, gateway]
  );

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (next === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      try { localStorage.setItem(LOCAL_STORAGE_KEY_THEME, next); } catch { /* Theme remains usable for this session. */ }
      return next;
    });
  };

  const login = async (userId: string, remember = true, password?: string): Promise<User | null> => {
    const generation = ++authGeneration.current;
    const result = await loginThenHydrate({
      isCurrent: () => generation === authGeneration.current,
      login: () =>
        executeGateway((activeGateway) =>
          performGatewayLogin(activeGateway, userId, {
            remember,
            mode: dataConfig?.mode,
            isCurrent: () => generation === authGeneration.current,
            password,
          })
        ),
      hydrate: async (user) => {
        if (dataConfig?.mode !== "api") return { tickets: [], chatSessions: [] };
        clearApiAccountState();
        if (user.role === "admin") return { tickets: [], chatSessions: [] };
        const tickets = await executeGateway((activeGateway) => activeGateway.getTickets());
        const chatSessions =
          user.role === "student"
            ? await executeGateway((activeGateway) => activeGateway.getChatSessions())
            : [];
        return { tickets, chatSessions };
      },
    });
    if (!shouldCommitLoginSession(generation, authGeneration.current, result)) {
      if (
        generation === authGeneration.current &&
        !result.ok &&
        result.stage === "auth" &&
        result.error &&
        isConnectionError(result.error)
      ) {
        throw result.error;
      }
      return null;
    }
    if (!result.ok && result.stage === "auth") return null;
    const sessionUser = result.user;
    writeMockRememberedUser(dataConfig?.mode, remember, sessionUser.id);
    setCurrentUser(sessionUser);
    authRestored.current = true;
    if (result.ok) {
      if (dataConfig?.mode === "api") {
        setTickets(result.tickets);
        setChatSessions(result.chatSessions);
      }
      return sessionUser;
    }
    throw result.error;
  };

  const logout = () => {
    ++authGeneration.current;
    authRestored.current = true;
    pendingCreateConversationKey.current = null;
    gateway?.abortRequests?.();
    if (dataConfig?.mode === "api") {
      clearApiAccountState();
      void gateway?.endSession?.().catch(() => {
        /* Local session is already discarded. */
      });
    }
    setCurrentUser(null);
    clearMockRememberedUser(dataConfig?.mode);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await executeGateway(async (activeGateway) => {
      if (!activeGateway.changePassword) {
        throw new UnsupportedOperationError("changePassword");
      }
      await activeGateway.changePassword(currentPassword, newPassword);
    });
  };

  const getTicket = (id: string) => tickets.find((t) => t.id === id || t.code === id);

  const reloadData = async () => {
    if (!hasDataLoaded) { await loadAllData(); return; }
    if (dataConfig?.mode === "api") {
      await executeGateway(async (activeGateway) => {
        if (!activeGateway.restoreSession) return;
        const restored = await activeGateway.restoreSession();
        setCurrentUser(restored);
        if (!restored) {
          clearApiAccountState();
          return;
        }
        const nextTickets = await activeGateway.getTickets();
        const nextSessions = restored.role === "student" ? await activeGateway.getChatSessions() : [];
        setTickets(nextTickets);
        setChatSessions(nextSessions);
      });
      return;
    }
    await executeGateway(async (activeGateway) => {
      const [nextTickets, nextReviews] = await Promise.all([activeGateway.getTickets(), activeGateway.getReviewCases()]);
      setTickets(nextTickets);
      setReviewCases(nextReviews);
    });
  };

  const upsertTicket = (ticket: Ticket) => {
    setTickets((previous) => {
      const without = previous.filter((item) => item.id !== ticket.id && item.code !== ticket.code);
      return [ticket, ...without];
    });
  };

  const createTicket = async (data: Partial<Ticket>): Promise<Ticket> => {
    if (!currentUser) throw new DataGatewayError("unauthorized", "Not logged in");
    return executeGateway(async (activeGateway) => {
      if (dataConfig?.mode === "api") {
        if (!activeGateway.submitForm) {
          throw new UnsupportedOperationError("createTicket");
        }
        const extras: Record<string, string> = {};
        for (const field of data.requestPayload?.submittedFields || []) {
          extras[field.name] = field.value;
        }
        const ticket = await activeGateway.submitForm({
          serviceType: data.type === "complaint" ? "academic_complaint" : "student_certificate",
          summary: data.title || data.purpose || "Yêu cầu học vụ",
          fields: {
            purpose: data.purpose || "",
            destination_org: data.destinationOrg || "",
            receive_method: data.receiveMethod || "",
          },
          extras,
        });
        if (data.attachments?.length && activeGateway.uploadTicketFile) {
          // Browser File objects are not on StoredAttachment; VinUniForm uploads separately.
        }
        setTickets(await activeGateway.getTickets());
        return ticket;
      }
      const ticket = await activeGateway.createTicket(currentUser, data);
      setTickets(await activeGateway.getTickets());
      return ticket;
    });
  };

  const uploadTicketFile = async (ticketId: string, file: File, field?: string) => {
    await executeGateway(async (activeGateway) => {
      if (!activeGateway.uploadTicketFile) {
        throw new UnsupportedOperationError("uploadTicketFile");
      }
      await activeGateway.uploadTicketFile(ticketId, file, field);
    });
  };

  const updateTicketStatus = async (id: string, status: TicketStatus, actorName: string) => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.updateTicketStatus(id, status, actorName);
      setTickets(await activeGateway.getTickets());
    });
  };

  const updateOfficerDraft = async (id: string, draft: string) => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được lưu nháp phản hồi.");
    const ticket = getTicket(id);
    if (!ticket) throw new DataGatewayError("not_found", "Không tìm thấy hồ sơ.");
    await executeGateway(async (activeGateway) => {
      await activeGateway.updateOfficerDraft(
        id,
        draft,
        currentUser,
        officerDraftFor(ticket, currentUser.id),
        ticket.serverRevision
      );
      upsertTicket({ ...ticket, officerDraft: draft });
    });
  };

  const resetOfficerDraft = async (id: string) => {
    const ticket = getTicket(id);
    if (!ticket) throw new DataGatewayError("not_found", "Không tìm thấy hồ sơ.");
    await updateOfficerDraft(id, ticket.officerDraftDefault);
  };

  const toggleChecklistItem = async (ticketId: string, itemId: string) => {
    await executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      await activeGateway.toggleChecklistItem(ticketId, itemId, current?.serverRevision);
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      } else {
        setTickets(await activeGateway.getTickets());
      }
    });
  };

  const addTicketMessage = async (ticketId: string, message: { senderId: string; senderName: string; senderRole: "student" | "officer" | "system"; content: string }) => {
    await executeGateway(async (activeGateway) => {
      if (dataConfig?.mode === "api" && activeGateway.sendTicketMessage) {
        const turn = await activeGateway.sendTicketMessage(ticketId, message.content);
        const current = getTicket(ticketId);
        const committedMessage = {
          id: turn.userMessageId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: "student" as const,
          content: message.content,
          timestamp: new Date().toISOString(),
        };
        const committed = current
          ? {
              ...current,
              messages: current.messages.some((item) => item.id === committedMessage.id)
                ? current.messages
                : [...current.messages, committedMessage],
            }
          : current;
        if (committed) upsertTicket(committed);
        const reconciled = await commitThenReconcile(committed ?? current, async () =>
          activeGateway.getTicketDetail ? activeGateway.getTicketDetail(ticketId) : committed ?? current
        );
        if (reconciled) upsertTicket(reconciled);
        return;
      }
      await activeGateway.addTicketMessage(ticketId, message);
      setTickets(await activeGateway.getTickets());
    });
  };

  const submitGate2Response = async (ticketId: string, actionType: "respond" | "request_info" | "resolve", customContent?: string, expectedSnapshot?: string) => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được xử lý hồ sơ.");
    await executeGateway(async (activeGateway) => {
      if (dataConfig?.mode === "api" && activeGateway.submitOfficerAction) {
        const ticket = getTicket(ticketId);
        if (!ticket) throw new DataGatewayError("not_found", "Không tìm thấy hồ sơ.");
        const briefGate = decideReviewedBriefVersion(ticket, {
          manualBrief: expectedSnapshot === "manual-brief",
        });
        if (!briefGate.ok) throw new DataGatewayError("validation", briefGate.reason);
        const updated = await activeGateway.submitOfficerAction(ticketId, {
          action: actionType,
          content: customContent?.trim() || "Đã xử lý yêu cầu.",
          expectedRevision: ticket.serverRevision ?? 1,
          reviewedBriefVersion: briefGate.reviewedBriefVersion,
          supplementItems:
            actionType === "request_info"
              ? [{ label: "Bổ sung theo phản hồi cán bộ", reason: customContent?.trim() || "Cần bổ sung hồ sơ." }]
              : undefined,
        });
        upsertTicket(updated);
        const reconciled = await commitThenReconcile(updated, async () =>
          activeGateway.getTicketDetail ? activeGateway.getTicketDetail(ticketId) : updated
        );
        upsertTicket(reconciled);
        return;
      }
      await activeGateway.submitGate2Response(ticketId, actionType, customContent, currentUser, expectedSnapshot);
      setTickets(await activeGateway.getTickets());
    });
  };

  const createConversation = async (options?: { idempotencyKey?: string }): Promise<ConversationView> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.createConversation) throw new UnsupportedOperationError("createConversation");
      const key = reuseOrMintIntentKey(options?.idempotencyKey ?? pendingCreateConversationKey.current);
      if (!options?.idempotencyKey) pendingCreateConversationKey.current = key;
      try {
        const conversation = await activeGateway.createConversation({ idempotencyKey: key });
        if (!options?.idempotencyKey) pendingCreateConversationKey.current = null;
        return conversation;
      } catch (error) {
        const mapped = toDataGatewayError(error);
        if (!options?.idempotencyKey && !shouldRetainIntentKey(mapped)) {
          pendingCreateConversationKey.current = null;
        }
        throw mapped;
      }
    });
  };

  const sendConversationMessage = async (
    conversationId: string,
    content: string,
    options?: { signal?: AbortSignal; idempotencyKey?: string }
  ): Promise<ChatTurnResult> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.sendConversationMessage) throw new UnsupportedOperationError("sendConversationMessage");
      const turn = await activeGateway.sendConversationMessage(conversationId, content, options);
      if (turn.ticket) {
        try {
          const detail = activeGateway.getTicketDetail
            ? await activeGateway.getTicketDetail(turn.ticket.id)
            : turn.ticket;
          upsertTicket(detail);
        } catch {
          upsertTicket(turn.ticket);
        }
      }
      return turn;
    });
  };

  const patchPreview = async (
    previewId: string,
    expectedVersion: number,
    fields: PreviewFieldsPatch
  ): Promise<CampusPreview> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.patchPreview) throw new UnsupportedOperationError("patchPreview");
      return activeGateway.patchPreview(previewId, expectedVersion, fields);
    });
  };

  const submitPreview = async (previewId: string, previewVersion: number): Promise<SubmitPreviewResult> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.submitPreview) throw new UnsupportedOperationError("submitPreview");
      try {
        const ticket = await activeGateway.submitPreview(previewId, previewVersion);
        upsertTicket(ticket);
        const reconciled = await commitThenReconcile(ticket, async () =>
          activeGateway.getTicketDetail ? activeGateway.getTicketDetail(ticket.id) : ticket
        );
        upsertTicket(reconciled);
        return { status: "submitted", ticket: reconciled };
      } catch (error) {
        const existingId = alreadySubmittedTicketId(error);
        if (!existingId) throw error;
        const cached = getTicket(existingId);
        let fetched: Ticket | undefined;
        try {
          fetched = activeGateway.getTicketDetail
            ? await activeGateway.getTicketDetail(existingId)
            : await activeGateway.getTicket(existingId);
        } catch {
          fetched = undefined;
        }
        const result = submittedPreviewResult(existingId, fetched, cached);
        if (result.status === "submitted") upsertTicket(result.ticket);
        return result;
      }
    });
  };

  const refreshTicket = useCallback(async (ticketId: string): Promise<Ticket | undefined> => {
    const activeGateway = requireGateway(gateway, null);
    try {
      const detail = activeGateway.getTicketDetail
        ? await activeGateway.getTicketDetail(ticketId)
        : await activeGateway.getTicket(ticketId);
      if (detail) upsertTicket(detail);
      return detail;
    } catch (error) {
      throw toDataGatewayError(error);
    }
  }, [gateway]);

  const claimTicket = async (ticketId: string): Promise<Ticket> => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được nhận ca.");
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.claimTicket) throw new UnsupportedOperationError("claimTicket");
      const current = getTicket(ticketId);
      const claimed = await activeGateway.claimTicket(ticketId, current?.serverRevision ?? 1);
      upsertTicket(claimed);
      const reconciled = await commitThenReconcile(claimed, async () =>
        activeGateway.getTicketDetail ? activeGateway.getTicketDetail(ticketId) : claimed
      );
      upsertTicket(reconciled);
      return reconciled;
    });
  };

  const ensureProcessChecklist = async (ticketId: string): Promise<Ticket | undefined> => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được bổ sung checklist quy trình.");
    return executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      if (activeGateway.ensureProcessChecklist) {
        await activeGateway.ensureProcessChecklist(ticketId, current?.serverRevision);
      }
      const detail = activeGateway.getTicketDetail
        ? await activeGateway.getTicketDetail(ticketId)
        : current;
      if (detail) upsertTicket(detail);
      return detail;
    });
  };

  const prepareBrief = async (ticketId: string): Promise<BriefView> => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được chuẩn bị hồ sơ.");
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.prepareBrief) throw new UnsupportedOperationError("prepareBrief");
      const current = getTicket(ticketId);
      const brief = await activeGateway.prepareBrief(ticketId, current?.serverRevision ?? 1);
      const detail = await commitThenReconcile(current, async () =>
        activeGateway.getTicketDetail ? activeGateway.getTicketDetail(ticketId) : current
      );
      if (detail) upsertTicket(applyBriefToTicket(detail, brief));
      return brief;
    });
  };

  const listConversationMessages = async (conversationId: string): Promise<ChatMessage[]> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.listConversationMessages) throw new UnsupportedOperationError("listConversationMessages");
      return activeGateway.listConversationMessages(conversationId);
    });
  };

  const runTicketVerification = async (ticketId: string, criterionKey?: string) => {
    await executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      await activeGateway.runTicketVerification(ticketId, current?.serverRevision, criterionKey);
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      } else {
        setTickets(await activeGateway.getTickets());
      }
    });
  };

  const retryCriterionVerification = async (ticketId: string, criterionId: string) => {
    await executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      await activeGateway.retryCriterionVerification(ticketId, criterionId, current?.serverRevision);
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      } else {
        setTickets(await activeGateway.getTickets());
      }
    });
  };

  const confirmCriterionReview = async (
    ticketId: string,
    criterionId: string,
    note?: string,
    outcome: "viewed" | "manual_pass" | "manual_fail" = "viewed"
  ) => {
    await executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      await activeGateway.confirmCriterionReview(ticketId, criterionId, note, outcome, current?.serverRevision);
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      } else {
        setTickets(await activeGateway.getTickets());
      }
    });
  };

  const updateCertificateDraft = async (ticketId: string, edits: Partial<IssuedCertificateDocument>) => {
    await executeGateway(async (activeGateway) => {
      const current = getTicket(ticketId);
      await activeGateway.updateCertificateDraft(
        ticketId,
        edits,
        current?.serverRevision,
        current?.documentDraft?.version
      );
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      } else {
        setTickets(await activeGateway.getTickets());
      }
    });
  };

  const issueCertificate = async (ticketId: string): Promise<IssuedCertificateDocument | null> => {
    return executeGateway(async (activeGateway) => {
      if (!activeGateway.issueCertificate) {
        throw new UnsupportedOperationError(`Phát hành tài liệu cho ${ticketId}`);
      }
      const current = getTicket(ticketId);
      if (!current?.documentDraft || current.documentDraft.templateStatus !== "approved") {
        throw new DataGatewayError("conflict", "Loại dịch vụ này chưa có mẫu được phê duyệt.");
      }
      const issued = await activeGateway.issueCertificate(ticketId, {
        expectedRevision: current.serverRevision ?? 1,
        expectedDraftVersion: current.documentDraft.version,
      });
      if (activeGateway.getTicketDetail) {
        const detail = await activeGateway.getTicketDetail(ticketId);
        upsertTicket(detail);
      }
      return issued;
    });
  };

  const downloadIssuedDocument = async (ticketId: string, documentId: string) => {
    await executeGateway(async (activeGateway) => {
      if (!activeGateway.downloadIssuedDocument) {
        throw new UnsupportedOperationError("downloadIssuedDocument");
      }
      await activeGateway.downloadIssuedDocument(ticketId, documentId);
    });
  };

  const selectChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setChatMessages(session.messages || []);
    setL4HandoverActive(!!session.isL4HandoverActive);
    if (session.gate1FormData) setGate1FormData(session.gate1FormData);
  };

  const createNewChatSession = async () => {
    await executeGateway(async (activeGateway) => {
      const session = await activeGateway.createChatSession();
      setChatSessions(await activeGateway.getChatSessions());
      setActiveSessionId(session.id);
      setChatMessages(session.messages || []);
      setL4HandoverActive(false);
      setGate1Open(false);
    });
  };

  const deleteChatSession = async (sessionId: string) => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.deleteChatSession(sessionId);
      let remaining = await activeGateway.getChatSessions();
      if (remaining.length === 0) {
        const session = await activeGateway.createChatSession();
        remaining = await activeGateway.getChatSessions();
        setActiveSessionId(session.id);
        setChatMessages(session.messages || []);
        setL4HandoverActive(false);
      } else if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
        setChatMessages(remaining[0].messages || []);
        setL4HandoverActive(!!remaining[0].isL4HandoverActive);
        if (remaining[0].gate1FormData) setGate1FormData(remaining[0].gate1FormData);
      }
      setChatSessions(remaining);
    });
  };

  const addChatMessage = async (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.addChatMessage(activeSessionId, msg);
      const remaining = await activeGateway.getChatSessions();
      setChatSessions(remaining);
      const current = remaining.find((session) => session.id === activeSessionId);
      if (current) setChatMessages(current.messages);
    });
  };

  const updateGate1Field = (field: "reason" | "receiveMethod" | "destinationOrg", value: string) => {
    setGate1FormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "reason" && (!prev.destinationOrg || prev.destinationOrg.includes("Ngân hàng"))
        ? { destinationOrg: value }
        : {}),
    }));
    if (field === "reason" || field === "receiveMethod") {
      setLastUpdatedField(field);
      setTimeout(() => setLastUpdatedField(null), 3500);
    }
  };

  // Review Cases
  const getReviewCase = (id: string) => reviewCases.find((c) => c.id === id || c.code === id);

  const createReviewCase = async (data: Partial<ReviewCase>): Promise<ReviewCase> => {
    return executeGateway(async (activeGateway) => {
      const reviewCase = await activeGateway.createReviewCase(data);
      setReviewCases(await activeGateway.getReviewCases());
      return reviewCase;
    });
  };

  const runAiReview = async (caseId: string) => {
    setIsAiAnalyzing(true);
    setAiAnalyzingStep(1);
    try {
      setAiAnalyzingStep(4);
      await executeGateway(async (activeGateway) => {
        await activeGateway.runAiReview(caseId);
        setReviewCases(await activeGateway.getReviewCases());
      });
    } finally {
      setIsAiAnalyzing(false);
      setAiAnalyzingStep(1);
    }
  };

  const updateFindingReview = async (
    caseId: string,
    findingId: string,
    updates: { officerStatus: FindingOfficerStatus; officerAdjustedLabel?: FindingAiLabel; officerNote?: string },
    expectedSnapshot?: string
  ) => {
    if (currentUser?.role !== "officer") throw new DataGatewayError("unauthorized", "Chỉ cán bộ được xác nhận nhận định.");
    await executeGateway(async (activeGateway) => {
      await activeGateway.updateFindingReview(caseId, findingId, updates, currentUser, expectedSnapshot);
      setReviewCases(await activeGateway.getReviewCases());
    });
  };

  const sendSupplementRequest = async (caseId: string, request: SupplementRequest, expectedSnapshot?: string) => {
    if (currentUser?.role !== "officer" || request.sentBy !== currentUser.id) throw new DataGatewayError("unauthorized", "Chỉ cán bộ hiện tại được gửi yêu cầu bổ sung.");
    await executeGateway(async (activeGateway) => {
      await activeGateway.sendSupplementRequest(caseId, request, currentUser, expectedSnapshot);
      setReviewCases(await activeGateway.getReviewCases());
    });
  };

  const submitStudentSupplement = async (
    caseId: string,
    payload: { note: string; docTitle?: string; fileName?: string; versionToActivate?: number; attachment?: StoredAttachment }
  ) => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.submitStudentSupplement(caseId, payload);
      setReviewCases(await activeGateway.getReviewCases());
    });
  };

  const finalizeReviewCase = async (caseId: string, report: NonNullable<ReviewCase["finalReport"]>, expectedSnapshot?: string) => {
    if (currentUser?.role !== "officer" || report.officerId !== currentUser.id) throw new DataGatewayError("unauthorized", "Không có quyền hoàn tất phiếu này.");
    await executeGateway(async (activeGateway) => {
      await activeGateway.finalizeReviewCase(caseId, report, expectedSnapshot);
      setReviewCases(await activeGateway.getReviewCases());
    });
  };

  const resetReviewDemo = async () => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.resetDemoData();
    });
    await loadAllData();
  };

  const resetAllDemoData = async () => {
    await executeGateway(async (activeGateway) => {
      await activeGateway.resetDemoData();
    });
    await loadAllData();
  };

  return (
    <StoreContext.Provider
      value={{
        theme,
        toggleTheme,
        isDataLoading,
        dataError,
        dataStatus,
        dataConfig,
        reloadData,
        currentUser,
        setCurrentUser: user => { ++authGeneration.current; authRestored.current = true; setCurrentUser(user); },
        login,
        changePassword,
        logout,
        demoUsers,
        tickets,
        getTicket,
        createTicket,
        uploadTicketFile,
        updateTicketStatus,
        updateOfficerDraft,
        resetOfficerDraft,
        toggleChecklistItem,
        addTicketMessage,
        submitGate2Response,
        resetAllDemoData,
        runTicketVerification,
        retryCriterionVerification,
        confirmCriterionReview,
        updateCertificateDraft,
        issueCertificate,
        downloadIssuedDocument,
        chatSessions,
        activeSessionId,
        selectChatSession,
        createNewChatSession,
        deleteChatSession,
        chatMessages,
        addChatMessage,
        isL4HandoverActive,
        setL4HandoverActive,
        isGate1Open,
        setGate1Open,
        gate1FormData,
        setGate1FormData,
        lastUpdatedField,
        updateGate1Field,
        createConversation,
        sendConversationMessage,
        listConversationMessages,
        patchPreview,
        submitPreview,
        claimTicket,
        prepareBrief,
        refreshTicket,
        ensureProcessChecklist,
        reviewCases,
        getReviewCase,
        createReviewCase,
        runAiReview,
        updateFindingReview,
        sendSupplementRequest,
        submitStudentSupplement,
        finalizeReviewCase,
        resetReviewDemo,
        isAiAnalyzing,
        aiAnalyzingStep,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}
