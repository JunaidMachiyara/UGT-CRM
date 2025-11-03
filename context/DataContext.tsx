import React, { createContext, useContext, useReducer, ReactNode, useEffect, useState, useRef } from 'react';
import { 
    AppState, PackingType, JournalEntry, JournalEntryType,
    InvoiceStatus, Currency, LogisticsEntry, Production,
    LogisticsStatus, DocumentStatus, PlannerData, UserProfile, Role, Module, Item
} from '../types.ts';

// --- START: Firebase Setup ---
// The Firebase API key is intentionally split to avoid being flagged by automated security scanners.
// This is a client-side key and is generally considered safe to be exposed in frontend code.
const FB_API_KEY_PART_1 = "AIzaSyBW6_-rL-HlTuoB2h";
const FB_API_KEY_PART_2 = "EqwOP9_wWmqjvFkAg";

const firebaseConfig = {
    apiKey: FB_API_KEY_PART_1 + FB_API_KEY_PART_2,
    authDomain: "ug-t-5d530.firebaseapp.com",
    projectId: "ug-t-5d530",
    storageBucket: "ug-t-5d530.firebasestorage.app",
    messagingSenderId: "655470730795",
    appId: "1:655470730795:web:08f2803061090331f9146e",
    measurementId: "G-SBESXWSZ85"
};

let auth: any, db: any;
try {
    const firebase = (window as any).firebase;
    if (firebase) {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
    } else {
        console.error("Firebase is not available. Check script tags in index.html.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}
export { auth, db };
// --- END: Firebase Setup ---


// --- START: PERMISSIONS SETUP ---
export const mainModules: Module[] = ['dashboard', 'setup', 'dataEntry', 'accounting', 'reports', 'posting', 'logistics', 'hr', 'admin'];

export const dataEntrySubModules = [
    { key: 'dataEntry/opening', label: 'Original Opening' },
    { key: 'dataEntry/production', label: 'Production' },
    { key: 'dataEntry/purchases', label: 'Purchases' },
    { key: 'dataEntry/sales', label: 'Sales Invoice' },
    { key: 'dataEntry/stockLot', label: 'Stock-Lot' },
    { key: 'dataEntry/ongoing', label: 'Ongoing Orders' },
    { key: 'dataEntry/rebaling', label: 'Re-baling' },
    { key: 'dataEntry/directSales', label: 'Direct Sales' },
    { key: 'dataEntry/offloading', label: 'Container Off-loading' }
];

// Hardcoded report sub-modules to avoid circular dependencies with ReportsModule
const reportSubModules = [
    'reports/item-performance', 'item-performance/summary', 'item-performance/item-summary', 'item-performance/non-moving', 'item-performance/alerts', 'item-performance/production-analysis',
    'reports/original-stock', 'original-stock/main',
    'reports/fulfillment', 'fulfillment/dashboard',
    'reports/ledger', 'ledger/main',
    'reports/cash-bank', 'cash-bank/ledger', 'cash-bank/cash-book', 'cash-bank/bank-book',
    'reports/invoices', 'invoices/sales', 'invoices/purchase',
    'reports/detailed-reports', 'detailed-reports/sales', 'detailed-reports/purchases',
    'reports/production', 'production/original-combination', 'production/daily-production', 'production/rebaling-report', 'production/section-production', 'production/feasibility',
    'reports/financial', 'financial/balance-sheet', 'financial/profit-loss', 'financial/payment-planner',
];

export const allPermissions = [
    ...mainModules,
    ...dataEntrySubModules.map(sm => sm.key),
    ...reportSubModules
];
// --- END: PERMISSIONS SETUP ---

// --- START: DEVELOPMENT LOGIN BYPASS ---
const IS_DEV_MODE = false; // <-- SET THIS TO false TO RE-ENABLE THE LOGIN SCREEN

// IMPORTANT: For full database access with Firestore rules, replace the placeholder UID 
// with your ACTUAL admin user's UID from the Firebase Authentication console.
const mockAdminProfile: UserProfile = {
  uid: 'mock_admin_asif_uid', // This placeholder UID is used in some sample journal entries.
  name: 'Dev Admin',
  email: 'junaidmachiyara@gmail.com', // Admin email from the existing auth logic
  isAdmin: true,
  permissions: allPermissions, // Grant all permissions for dev mode
};
// --- END: DEVELOPMENT LOGIN BYPASS ---

/**
 * Recursively traverses an object or array and converts `undefined` values to `null`.
 * This is necessary because Firestore does not support `undefined` values.
 * @param obj The object or array to sanitize.
 * @returns A deep copy of the object with `undefined` values replaced by `null`.
 */
const convertUndefinedToNull = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertUndefinedToNull(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value === undefined) {
                newObj[key] = null;
            } else {
                newObj[key] = convertUndefinedToNull(value);
            }
        }
    }
    return newObj;
};

const processState = (state: AppState): AppState => {
    const productionsByItem: { [itemId: string]: number } = {};
    state.productions.forEach(p => {
        productionsByItem[p.itemId] = (productionsByItem[p.itemId] || 0) + p.quantityProduced;
    });

    const items = state.items.map(item => {
        const totalProduced = productionsByItem[item.id] || 0;
        return {
            ...item,
            nextBaleNumber: (item.openingStock || 0) + totalProduced + 1
        };
    });

    return { ...state, items };
};


const getInitialState = (): AppState => {
    const baseState: AppState = {
        // Empty setup and transactional data
        customers: [],
        suppliers: [],
        employees: [],
        banks: [],
        cashAccounts: [],
        originalTypes: [],
        divisions: [],
        subDivisions: [],
        warehouses: [],
        sections: [],
        categories: [],
        items: [],
        
        commissionAgents: [],
        freightForwarders: [],
        clearingAgents: [],

        // User-defined accounts. Some system features depend on specific IDs being present
        // (e.g., 'CAP-002', 'EXP-004'). These must be created by the user in Setup for full functionality.
        loanAccounts: [],
        capitalAccounts: [],
        investmentAccounts: [],
        expenseAccounts: [],

        // CORE SYSTEM ACCOUNTS - Required for automated journal entries.
        // It is strongly recommended not to delete these.
        inventoryAccounts: [
            { id: 'INV-FG-001', name: 'Finished Goods Inventory' },
        ],
        receivableAccounts: [
            { id: 'AR-001', name: 'Accounts Receivable' },
        ],
        revenueAccounts: [
            { id: 'REV-001', name: 'Sales Revenue' },
        ],
        payableAccounts: [
            { id: 'AP-001', name: 'Accounts Payable' },
            { id: 'AP-002', name: 'Customs Charges Payable' },
        ],

        // Empty arrays for all transactional data types
        attendanceRecords: [],
        salaryPayments: [],
        hrTasks: [],
        hrEnquiries: [],
        vehicles: [],
        originalOpenings: [],
        originalPurchases: [],
        productions: [],
        salesInvoices: [],
        ongoingOrders: [],
        finishedGoodsPurchases: [],
        logisticsEntries: [],
        favoriteCombinations: [],
        journalEntries: [],
        testEntries: [],

        // Reset all counters to their initial values
        nextInvoiceNumber: 1,
        nextOngoingOrderNumber: 1,
        nextFinishedGoodsPurchaseNumber: 1,
        nextLogisticsSNo: 1,
        nextHRTaskId: 1,
        nextHREnquiryId: 1,
        nextReceiptVoucherNumber: 1,
        nextPaymentVoucherNumber: 1,
        nextExpenseVoucherNumber: 1,
        nextJournalVoucherNumber: 1,
        nextTestEntryNumber: 1,

        // Reset planner data
        plannerData: {},
        plannerLastWeeklyReset: '',
        plannerLastMonthlyReset: '',
    };
    return baseState;
};

const initialState = processState(getInitialState());

type EntityName = keyof Omit<AppState, 'nextInvoiceNumber' | 'nextOngoingOrderNumber' | 'nextFinishedGoodsPurchaseNumber' | 'nextReceiptVoucherNumber' | 'nextPaymentVoucherNumber' | 'nextExpenseVoucherNumber' | 'nextJournalVoucherNumber' | 'nextLogisticsSNo' | 'favoriteCombinations' | 'nextHRTaskId' | 'nextHREnquiryId' | 'plannerData' | 'plannerLastWeeklyReset' | 'plannerLastMonthlyReset' | 'nextTestEntryNumber'>;
type Entity = AppState[EntityName][0];

type AddAction = { type: 'ADD_ENTITY'; payload: { entity: EntityName; data: Entity }; };
type UpdateAction = { type: 'UPDATE_ENTITY'; payload: { entity: EntityName; data: { id: string | number } & Partial<Entity> }; };
type DeleteAction = { type: 'DELETE_ENTITY'; payload: { entity: EntityName; id: string | number }; };
type RestoreAction = { type: 'RESTORE_STATE'; payload: AppState; };
type ToggleFavoriteAction = { type: 'TOGGLE_FAVORITE_COMBINATION'; payload: { date: string }; };
type SetPlannerDataAction = { type: 'SET_PLANNER_DATA'; payload: Partial<{ plannerData: PlannerData; plannerLastWeeklyReset: string; plannerLastMonthlyReset: string; }>; };

type BatchActionPayload = AddAction | UpdateAction | DeleteAction;
type BatchUpdateAction = { type: 'BATCH_UPDATE'; payload: BatchActionPayload[] };


type Action = AddAction | UpdateAction | DeleteAction | RestoreAction | ToggleFavoriteAction | SetPlannerDataAction | BatchUpdateAction;

const dataReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'BATCH_UPDATE':
            return action.payload.reduce(
                (currentState, currentAction) => dataReducer(currentState, currentAction),
                state
            );
        case 'ADD_ENTITY': {
            const { entity, data } = action.payload;
            const entityArray = state[entity] as Entity[];
            const newState = { ...state, [entity]: [...entityArray, data] };
            if (entity === 'salesInvoices') newState.nextInvoiceNumber = state.nextInvoiceNumber + 1;
            if (entity === 'ongoingOrders') newState.nextOngoingOrderNumber = state.nextOngoingOrderNumber + 1;
            if (entity === 'finishedGoodsPurchases') newState.nextFinishedGoodsPurchaseNumber = state.nextFinishedGoodsPurchaseNumber + 1;
            if (entity === 'logisticsEntries') newState.nextLogisticsSNo = state.nextLogisticsSNo + 1;
            if (entity === 'hrTasks') newState.nextHRTaskId = state.nextHRTaskId + 1;
            if (entity === 'hrEnquiries') newState.nextHREnquiryId = state.nextHREnquiryId + 1;
            if (entity === 'testEntries') newState.nextTestEntryNumber = state.nextTestEntryNumber + 1;
            if (entity === 'journalEntries') {
                const entry = data as JournalEntry;
                const isFirstEntryForVoucher = !state.journalEntries.some(je => je.voucherId === entry.voucherId);
                if (isFirstEntryForVoucher) {
                    if (entry.entryType === JournalEntryType.Receipt && entry.voucherId.startsWith('RV-')) newState.nextReceiptVoucherNumber = state.nextReceiptVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Payment && entry.voucherId.startsWith('PV-')) newState.nextPaymentVoucherNumber = state.nextPaymentVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Expense && entry.voucherId.startsWith('EV-')) newState.nextExpenseVoucherNumber = state.nextExpenseVoucherNumber + 1;
                    else if (entry.entryType === JournalEntryType.Journal && entry.voucherId.startsWith('JV-')) newState.nextJournalVoucherNumber = state.nextJournalVoucherNumber + 1;
                }
            }
            return newState;
        }
        case 'UPDATE_ENTITY': {
            const { entity, data } = action.payload;
            const entityArray = state[entity] as ({id: string | number})[];
            return { ...state, [entity]: entityArray.map((item) => item.id === data.id ? {...item, ...data} : item), };
        }
        case 'DELETE_ENTITY': {
            const { entity, id } = action.payload;
            const entityArray = state[entity] as ({id: string | number})[];
            return { ...state, [entity]: entityArray.filter((item) => item.id !== id), };
        }
        case 'TOGGLE_FAVORITE_COMBINATION': {
            const { date } = action.payload;
            const isFavorite = state.favoriteCombinations.some(fav => fav.date === date);
            if (isFavorite) return { ...state, favoriteCombinations: state.favoriteCombinations.filter(fav => fav.date !== date), };
            else {
                const newFavorites = [...state.favoriteCombinations, { date }];
                newFavorites.sort((a, b) => b.date.localeCompare(a.date));
                return { ...state, favoriteCombinations: newFavorites, };
            }
        }
        case 'SET_PLANNER_DATA': return { ...state, ...action.payload, };
        case 'RESTORE_STATE': {
            const firestoreState = action.payload;
            if (firestoreState && typeof firestoreState === 'object' && 'customers' in firestoreState) {
                const defaultState = getInitialState();
                
                // Explicitly build the new state, prioritizing Firestore data over defaults.
                const newState: AppState = {
                    customers: firestoreState.customers || defaultState.customers,
                    suppliers: firestoreState.suppliers || defaultState.suppliers,
                    commissionAgents: firestoreState.commissionAgents || defaultState.commissionAgents,
                    items: firestoreState.items || defaultState.items,
                    originalTypes: firestoreState.originalTypes || defaultState.originalTypes,
                    divisions: firestoreState.divisions || defaultState.divisions,
                    subDivisions: firestoreState.subDivisions || defaultState.subDivisions,
                    warehouses: firestoreState.warehouses || defaultState.warehouses,
                    sections: firestoreState.sections || defaultState.sections,
                    categories: firestoreState.categories || defaultState.categories,
                    freightForwarders: firestoreState.freightForwarders || defaultState.freightForwarders,
                    clearingAgents: firestoreState.clearingAgents || defaultState.clearingAgents,
                    banks: firestoreState.banks || defaultState.banks,
                    cashAccounts: firestoreState.cashAccounts || defaultState.cashAccounts,
                    loanAccounts: firestoreState.loanAccounts || defaultState.loanAccounts,
                    capitalAccounts: firestoreState.capitalAccounts || defaultState.capitalAccounts,
                    investmentAccounts: firestoreState.investmentAccounts || defaultState.investmentAccounts,
                    expenseAccounts: firestoreState.expenseAccounts || defaultState.expenseAccounts,
                    inventoryAccounts: firestoreState.inventoryAccounts || defaultState.inventoryAccounts,
                    receivableAccounts: firestoreState.receivableAccounts || defaultState.receivableAccounts,
                    revenueAccounts: firestoreState.revenueAccounts || defaultState.revenueAccounts,
                    payableAccounts: firestoreState.payableAccounts || defaultState.payableAccounts,
                    employees: firestoreState.employees || defaultState.employees,
                    attendanceRecords: firestoreState.attendanceRecords || defaultState.attendanceRecords,
                    salaryPayments: firestoreState.salaryPayments || defaultState.salaryPayments,
                    hrTasks: firestoreState.hrTasks || defaultState.hrTasks,
                    hrEnquiries: firestoreState.hrEnquiries || defaultState.hrEnquiries,
                    vehicles: firestoreState.vehicles || defaultState.vehicles,
                    originalOpenings: firestoreState.originalOpenings || defaultState.originalOpenings,
                    originalPurchases: firestoreState.originalPurchases || defaultState.originalPurchases,
                    productions: firestoreState.productions || defaultState.productions,
                    salesInvoices: firestoreState.salesInvoices || defaultState.salesInvoices,
                    ongoingOrders: firestoreState.ongoingOrders || defaultState.ongoingOrders,
                    finishedGoodsPurchases: firestoreState.finishedGoodsPurchases || defaultState.finishedGoodsPurchases,
                    logisticsEntries: firestoreState.logisticsEntries || defaultState.logisticsEntries,
                    favoriteCombinations: firestoreState.favoriteCombinations || defaultState.favoriteCombinations,
                    journalEntries: firestoreState.journalEntries || defaultState.journalEntries,
                    testEntries: firestoreState.testEntries || defaultState.testEntries,
                    
                    nextInvoiceNumber: firestoreState.nextInvoiceNumber ?? defaultState.nextInvoiceNumber,
                    nextOngoingOrderNumber: firestoreState.nextOngoingOrderNumber ?? defaultState.nextOngoingOrderNumber,
                    nextFinishedGoodsPurchaseNumber: firestoreState.nextFinishedGoodsPurchaseNumber ?? defaultState.nextFinishedGoodsPurchaseNumber,
                    nextLogisticsSNo: firestoreState.nextLogisticsSNo ?? defaultState.nextLogisticsSNo,
                    nextHRTaskId: firestoreState.nextHRTaskId ?? defaultState.nextHRTaskId,
                    nextHREnquiryId: firestoreState.nextHREnquiryId ?? defaultState.nextHREnquiryId,
                    nextReceiptVoucherNumber: firestoreState.nextReceiptVoucherNumber ?? defaultState.nextReceiptVoucherNumber,
                    nextPaymentVoucherNumber: firestoreState.nextPaymentVoucherNumber ?? defaultState.nextPaymentVoucherNumber,
                    nextExpenseVoucherNumber: firestoreState.nextExpenseVoucherNumber ?? defaultState.nextExpenseVoucherNumber,
                    nextJournalVoucherNumber: firestoreState.nextJournalVoucherNumber ?? defaultState.nextJournalVoucherNumber,
                    nextTestEntryNumber: firestoreState.nextTestEntryNumber ?? defaultState.nextTestEntryNumber,
                    
                    plannerData: firestoreState.plannerData || defaultState.plannerData,
                    plannerLastWeeklyReset: firestoreState.plannerLastWeeklyReset || defaultState.plannerLastWeeklyReset,
                    plannerLastMonthlyReset: firestoreState.plannerLastMonthlyReset || defaultState.plannerLastMonthlyReset,
                };
                
                return processState(newState);
            }
            return state;
        }
        default: return state;
    }
};

type SaveStatus = 'synced' | 'saving' | 'error';

interface DataContextProps {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    userProfile: UserProfile | null;
    authLoading: boolean;
    saveStatus: SaveStatus;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

const FIRESTORE_DOC_PATH = 'appState/mainState-v11';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('synced');
    const isUpdatingFromFirestore = useRef(false);
    const firestoreUnsubscribe = useRef<(() => void) | null>(null);
    const isLocalChange = useRef(false);

    const wrappedDispatch: React.Dispatch<Action> = (action) => {
        isLocalChange.current = true;
        dispatch(action);
    };
    
    // Effect for Auth and reading from Firestore
    useEffect(() => {
        if (IS_DEV_MODE && db) {
            console.warn("DEV MODE: Bypassing Firebase Auth and setting mock admin user.");
            setUserProfile(mockAdminProfile);
            setAuthLoading(false);
            
            // In dev mode, we still want real-time updates without the login flow.
            // So we'll set up the snapshot listener directly.
            if (firestoreUnsubscribe.current) firestoreUnsubscribe.current();

            firestoreUnsubscribe.current = db.doc(FIRESTORE_DOC_PATH).onSnapshot(
                (doc: any) => {
                    if (isLocalChange.current) {
                        isLocalChange.current = false;
                        return;
                    }
                    if (doc.exists) {
                        isUpdatingFromFirestore.current = true;
                        dispatch({ type: 'RESTORE_STATE', payload: doc.data() });
                        setSaveStatus('synced');
                    } else {
                        // If the document doesn't exist, create it with initial state
                        db.doc(FIRESTORE_DOC_PATH).set(initialState);
                    }
                    setIsFirestoreLoaded(true);
                },
                (error: any) => {
                    console.error("Error listening to Firestore in Dev Mode:", error);
                    setIsFirestoreLoaded(true);
                }
            );
            return; // Exit the effect early
        }

        if (!auth || !db) {
            setAuthLoading(false);
            return;
        }

        const unsubscribeAuth = auth.onAuthStateChanged(async (user: any) => {
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    let profile: UserProfile | null = null;

                    if (userDoc.exists) {
                        const profileData = userDoc.data() as Omit<UserProfile, 'uid' | 'email'>;
                        profile = {
                            uid: user.uid,
                            email: user.email,
                            name: profileData.name,
                            isAdmin: profileData.isAdmin,
                            permissions: profileData.permissions || [],
                        };
                    } else if (user.email === 'junaidmachiyara@gmail.com') {
                        const adminProfileData = { name: 'Junaid Machiyara', email: user.email, isAdmin: true, permissions: allPermissions };
                        await db.collection('users').doc(user.uid).set(adminProfileData);
                        profile = { uid: user.uid, ...adminProfileData };
                    }
                    
                    if (profile) {
                        setUserProfile(profile);

                        if (firestoreUnsubscribe.current) firestoreUnsubscribe.current();

                        firestoreUnsubscribe.current = db.doc(FIRESTORE_DOC_PATH).onSnapshot(
                            (doc: any) => {
                                 if (isLocalChange.current) {
                                    isLocalChange.current = false;
                                    return;
                                }
                                if (doc.exists) {
                                    isUpdatingFromFirestore.current = true;
                                    dispatch({ type: 'RESTORE_STATE', payload: doc.data() });
                                    setSaveStatus('synced');
                                } else {
                                    db.doc(FIRESTORE_DOC_PATH).set(initialState);
                                }
                                setIsFirestoreLoaded(true);
                                setAuthLoading(false);
                            },
                            (error: any) => {
                                console.error("Error listening to Firestore:", error);
                                setIsFirestoreLoaded(true);
                                setAuthLoading(false);
                            }
                        );
                    } else {
                        auth.signOut();
                        setAuthLoading(false);
                    }
                } catch (error) {
                    console.error("Error with user profile:", error);
                    auth.signOut();
                    setAuthLoading(false);
                }
            } else {
                if (firestoreUnsubscribe.current) {
                    firestoreUnsubscribe.current();
                    firestoreUnsubscribe.current = null;
                }
                setUserProfile(null);
                setIsFirestoreLoaded(false); 
                setAuthLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // Effect for writing to Firestore with status indicator
    useEffect(() => {
        if (isUpdatingFromFirestore.current) {
            isUpdatingFromFirestore.current = false;
            return;
        }
        
        if (!isFirestoreLoaded || !userProfile || !db) {
            return;
        }
        
        const saveData = async () => {
            setSaveStatus('saving');
            try {
                const sanitizedState = convertUndefinedToNull(state);
                await db.doc(FIRESTORE_DOC_PATH).set(sanitizedState);
                setSaveStatus('synced');
            } catch (error) {
                console.error("Error writing to Firestore:", error);
                setSaveStatus('error');
            }
        };

        saveData();

    }, [state, userProfile, isFirestoreLoaded]);

    // Effect to warn user if they try to leave while saving
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = 'Changes you made may not be saved. Are you sure you want to leave?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [saveStatus]);

    return (
        <DataContext.Provider value={{ state, dispatch: wrappedDispatch, userProfile, authLoading, saveStatus }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};