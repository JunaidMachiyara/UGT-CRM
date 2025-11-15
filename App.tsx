import React, { useState, useRef, useEffect, useMemo, useReducer } from 'react';
import SetupModule, { HRModule } from './components/SetupModule.tsx';
import DataEntryModule from './components/DataEntryModule.tsx';
import Dashboard from './components/Dashboard.tsx';
import AnalyticsDashboard from './components/AnalyticsDashboard.tsx';
import AccountingModule from './components/AccountingModule.tsx';
import ReportsModule from './components/ReportsModule.tsx';
import PostingModule from './components/PostingModule.tsx';
import LogisticsModule from './components/LogisticsModule.tsx';
import AdminModule from './components/AdminModule.tsx';
import CustomsModule from './components/CustomsModule.tsx';
import { useData, auth, db, allPermissions } from './context/DataContext.tsx';
import { Module, UserProfile, OriginalOpening, Production } from './types.ts';
import Modal from './components/ui/Modal.tsx';
import TestPage from './components/TestPage.tsx';
import ChatModule from './components/ChatModule.tsx';

// --- START: Unread Message Hooks ---
function useUnreadMessages(userProfile: UserProfile | null) {
    const [unreadSenderNames, setUnreadSenderNames] = useState<string[]>([]);

    useEffect(() => {
        if (!userProfile || !db) {
            setUnreadSenderNames([]);
            return;
        }

        const checkForUnread = async () => {
            if (!userProfile) return;
            const allUnreadSenders = new Map<string, string>();

            // 1. Check user-to-user chats
            const chatsQuery = db.collection('chats').where('participants', 'array-contains', userProfile.uid);
            const chatsSnapshot = await chatsQuery.get();

            const messageChecks = chatsSnapshot.docs.map(async (chatDoc: any) => {
                const chatData = chatDoc.data();
                const otherParticipantId = chatData.participants.find((p: string) => p !== userProfile.uid);
                
                if (!otherParticipantId) return;

                // Get the last message sent by the other person.
                const messagesSnapshot = await chatDoc.ref.collection('messages')
                    .where('senderId', '==', otherParticipantId)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();
                
                if (!messagesSnapshot.empty) {
                    const lastMessage = messagesSnapshot.docs[0].data();
                    if (lastMessage && lastMessage.readBy && !lastMessage.readBy.includes(userProfile.uid)) {
                        if (!allUnreadSenders.has(lastMessage.senderId)) {
                            allUnreadSenders.set(lastMessage.senderId, lastMessage.senderName);
                        }
                    }
                }
            });

            // 2. Check meeting room
            const meetingRoomQuery = db.collection('meetingRoomMessages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            messageChecks.push(meetingRoomQuery.then((snapshot: any) => {
                if (!snapshot.empty) {
                    const lastMessage = snapshot.docs[0].data();
                    if (lastMessage && lastMessage.readBy && lastMessage.senderId !== userProfile.uid && !lastMessage.readBy.includes(userProfile.uid)) {
                        allUnreadSenders.set('meeting_room', 'Meeting Room');
                    }
                }
            }));
            
            await Promise.all(messageChecks);
            setUnreadSenderNames(Array.from(allUnreadSenders.values()));
        };

        checkForUnread();
    }, [userProfile]);

    return unreadSenderNames;
}

function useUnreadMessageCount(userProfile: UserProfile | null) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [users, setUsers] = useState<UserProfile[]>([]);

    useEffect(() => {
        if (!db || !userProfile) return;
        const unsub = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                if (doc.id !== userProfile.uid) {
                    userList.push({ ...doc.data(), uid: doc.id });
                }
            });
            setUsers(userList);
        });
        return () => unsub();
    }, [userProfile]);

    useEffect(() => {
        if (!userProfile || users.length === 0) {
            setUnreadCount(0);
            return;
        }

        const unreadSources = new Set<string>();
        const updateCount = () => setUnreadCount(unreadSources.size);

        // Listeners for individual user chats
        const userListeners = users.map(user => {
            const ids = [userProfile.uid, user.uid].sort();
            const chatId = ids.join('_');
            
            // CORRECTED QUERY: Remove the invalid 'not-array-contains'
            const query = db.collection('chats').doc(chatId).collection('messages')
                .where('senderId', '==', user.uid);
            
            return query.onSnapshot((snapshot: any) => {
                // CORRECTED LOGIC: Filter on the client
                const hasUnread = snapshot.docs.some((doc: any) => 
                    !doc.data().readBy.includes(userProfile.uid)
                );

                if (hasUnread) {
                    unreadSources.add(user.uid);
                } else {
                    unreadSources.delete(user.uid);
                }
                updateCount();
            });
        });

        // Listener for the meeting room
        // CORRECTED QUERY: Remove invalid 'not-array-contains'. Fetch recent and filter.
        const meetingRoomQuery = db.collection('meetingRoomMessages').orderBy('timestamp', 'desc').limit(50); // limit to recent messages for performance

        const meetingRoomListener = meetingRoomQuery.onSnapshot((snapshot: any) => {
            // CORRECTED LOGIC: Filter on the client
            const hasUnreadFromOthers = snapshot.docs.some((doc: any) => {
                const data = doc.data();
                return data.senderId !== userProfile.uid && !data.readBy.includes(userProfile.uid);
            });
            
            if (hasUnreadFromOthers) {
                unreadSources.add('meeting_room');
            } else {
                unreadSources.delete('meeting_room');
            }
            updateCount();
        });
        
        const allListeners = [...userListeners, meetingRoomListener];

        return () => {
            allListeners.forEach(unsubscribe => unsubscribe());
        };
    }, [users, userProfile]);

    return unreadCount;
}
// --- END: Unread Message Hooks ---


const Notification: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    return (<div className={`fixed top-5 left-1/2 -translate-x-1/2 ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg z-50 flex items-center`}><span>{message}</span><button onClick={onDismiss} className="ml-4 font-bold text-white/70 hover:text-white">✕</button></div>);
};

const LoginScreen: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Auto-fill credentials for faster login in development/editing environments.
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
            setEmail('junaidmachiyara@gmail.com');
            setPassword('123456'); // Using a common dev password for autofill.
        }
    }, []);

    const performLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (!auth) {
                throw new Error("Authentication services are unavailable.");
            }
            await auth.signInWithEmailAndPassword(email, password);
            // The onAuthStateChanged listener in DataContext will handle the successful login.
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to login. Please check your credentials.';
            setError(errorMessage);
            setNotification({ msg: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performLogin();
    };
    
    const handleFastLogin = async () => {
        await performLogin();
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center login-screen p-4">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-20 w-20 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-slate-800">Usman Global Talha Division</h1>
                    <p className="text-slate-600 mt-2">Stock & Accounting System</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors">{isLoading ? 'Signing In...' : 'Sign In'}</button>
                     <div className="text-center">
                        <button
                            type="button"
                            onClick={handleFastLogin}
                            disabled={isLoading}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Fast Login (Dev)
                        </button>
                    </div>
                </form>
                 <div className="text-center text-xs text-slate-500 pt-4 border-t">
                     <p className="mt-2 text-slate-400">Please use the credentials you have set up in your Firebase Authentication console.</p>
                </div>
            </div>
        </div>
    );
};

const mainModules: Module[] = ['dashboard', 'setup', 'dataEntry', 'accounting', 'reports', 'posting', 'logistics', 'hr', 'customs', 'admin', 'chat'];

const App: React.FC = () => {
    const [activeModule, setActiveModule] = useState<Module>('dashboard');
    const [activeSubView, setActiveSubView] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { state, dispatch, userProfile, authLoading, saveStatus } = useData();
    const [unreadNotification, setUnreadNotification] = useState<string | null>(null);
    const unreadSenderNames = useUnreadMessages(userProfile);
    const unreadMessageCount = useUnreadMessageCount(userProfile);


    const [isNewItemModalOpen, setIsNewItemModalOpen] = useState<boolean>(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const [navigationHistory, setNavigationHistory] = useState<Array<{ module: Module; subView: string | null }>>([]);
    const prevModuleRef = useRef<Module>();
    const prevSubViewRef = useRef<string | null>();
    const isNavigatingBackRef = useRef(false);
    const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);
    const escapeConfirmTimeoutRef = useRef<number | null>(null);
    const cleanupRan = useRef(false); // Ref to ensure it runs only once

    // ONE-TIME MANUAL DELETION SCRIPT FOR DEC 14, 2025 ENTRIES
    // TODO: Remove this one-time cleanup script in the next deployment.
    useEffect(() => {
        if (!state || cleanupRan.current || !state.originalOpenings.length) {
            return;
        }
    
        const targetDate = '2025-12-14';
        const entriesToDelete = state.originalOpenings
            .filter(o => o.date === targetDate)
            .slice(0, 2); 
    
        if (entriesToDelete.length > 0) {
            console.log(`Found ${entriesToDelete.length} entries from ${targetDate} to delete.`);
            const batchActions: any[] = [];
    
            const deleteBalesOpeningAssociations = (openingEntry: OriginalOpening) => {
                const potentialTransactionIds = new Set<string>();
                potentialTransactionIds.add(openingEntry.id);
                if (openingEntry.transactionId) {
                    potentialTransactionIds.add(openingEntry.transactionId);
                }
                if (openingEntry.id.startsWith('oo_')) {
                    potentialTransactionIds.add(openingEntry.id.substring(3));
                }
            
                let productionEntryToDelete: Production | undefined;
                for (const id of potentialTransactionIds) {
                    productionEntryToDelete = state.productions.find(p => p.id === `prod_deduct_${id}`);
                    if (productionEntryToDelete) break;
                }
            
                if (productionEntryToDelete) {
                    batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'productions', id: productionEntryToDelete.id } });
                }
            
                const journalEntriesToDelete = state.journalEntries.filter(je => {
                    for (const id of potentialTransactionIds) {
                        if ( je.voucherId === `JV-${id}` || je.voucherId.includes(id) ) {
                            return true;
                        }
                    }
                    return false;
                });
            
                journalEntriesToDelete.forEach(je => {
                    batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: je.id } });
                });
            
                if (openingEntry.originalTypeId && openingEntry.originalTypeId.startsWith('OT-FROM-')) {
                     batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'originalTypes', id: openingEntry.originalTypeId } });
                }
            };
    
            const deleteOriginalOpeningAssociations = (openingEntry: OriginalOpening) => {
                 const journalVoucherId = `AUTO-OPEN-${openingEntry.id}`;
                 const jeToDelete = state.journalEntries.filter(je => je.voucherId === journalVoucherId);
                 jeToDelete.forEach(je => {
                    batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: je.id } });
                 });
            };
    
            entriesToDelete.forEach(entry => {
                if (entry.supplierId === 'SUP-INTERNAL-STOCK') {
                     deleteBalesOpeningAssociations(entry);
                } else {
                    deleteOriginalOpeningAssociations(entry);
                }
                // Finally, add the main entry itself for deletion
                batchActions.push({ type: 'DELETE_ENTITY', payload: { entity: 'originalOpenings', id: entry.id } });
            });
    
            if (batchActions.length > 0) {
                dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
                console.log(`Dispatched ${batchActions.length} actions to delete entries and their associations.`);
            }
        } else {
             console.log(`No entries found for deletion on date: ${targetDate}`);
        }
    
        cleanupRan.current = true;
    }, [state, dispatch]);

     useEffect(() => {
        if (unreadSenderNames.length > 0) {
            const names = unreadSenderNames.join(', ');
            setUnreadNotification(`You have unread messages from ${names}.`);
        } else {
            setUnreadNotification(null);
        }
    }, [unreadSenderNames]);

    useEffect(() => {
        if (isNavigatingBackRef.current) {
            isNavigatingBackRef.current = false;
        } else if (prevModuleRef.current) {
            const prevState = { module: prevModuleRef.current, subView: prevSubViewRef.current };
            setNavigationHistory(prev => [...prev, prevState]);
        }
        prevModuleRef.current = activeModule;
        prevSubViewRef.current = activeSubView;
    }, [activeModule, activeSubView]);


    const handleNavigation = (module: Module, subView?: string) => {
        if (activeModule !== module) {
            setActiveModule(module);
        }
        setActiveSubView(subView || null);
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            // Ignore shortcuts if user is typing in an input/textarea/select
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            // --- Function Key Navigation ---
            const functionKeyMap: { [key: string]: Module } = {
                'F1': 'analytics', 'F2': 'dashboard', 'F3': 'setup', 'F4': 'dataEntry',
                'F5': 'accounting', 'F6': 'reports', 'F7': 'posting', 'F8': 'logistics',
                'F9': 'hr', 'F10': 'customs', 'F11': 'admin', 'F12': 'chat'
            };

            if (functionKeyMap[event.key]) {
                event.preventDefault();
                handleNavigation(functionKeyMap[event.key]);
                return;
            }
            
            // --- Escape Key for Back Navigation ---
            if (event.key === 'Escape') {
                if (event.defaultPrevented) { return; } // Handled by a child (modal or form)

                if (showEscapeConfirm) {
                    if (navigationHistory.length > 0) {
                        event.preventDefault();
                        const newHistory = [...navigationHistory];
                        const lastState = newHistory.pop();
                        
                        if (lastState) {
                            isNavigatingBackRef.current = true;
                            setNavigationHistory(newHistory);
                            setActiveModule(lastState.module);
                            setActiveSubView(lastState.subView);
                        }
                    }
                    setShowEscapeConfirm(false);
                    if (escapeConfirmTimeoutRef.current !== null) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    return;
                }
    
                if (navigationHistory.length > 0) {
                    event.preventDefault();
                    setShowEscapeConfirm(true);
                    if (escapeConfirmTimeoutRef.current !== null) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    escapeConfirmTimeoutRef.current = window.setTimeout(() => {
                        setShowEscapeConfirm(false);
                    }, 3000);
                }
                return; 
            }
            
            // --- Alt + Key for Sub-menu Navigation ---
            if (event.altKey) {
                event.preventDefault();
                switch (event.key.toLowerCase()) {
                    case 'o': handleNavigation('dataEntry', 'opening'); break;
                    case 'p': handleNavigation('dataEntry', 'production'); break;
                    case 's': handleNavigation('dataEntry', 'sales'); break;
                    case 'u': handleNavigation('dataEntry', 'ongoing'); break; 
                    case 'n': handleNavigation('accounting', 'new'); break;
                    case 'e': handleNavigation('accounting', 'update'); break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (escapeConfirmTimeoutRef.current !== null) {
                clearTimeout(escapeConfirmTimeoutRef.current);
            }
        };
    }, [navigationHistory, showEscapeConfirm]);

    const handleNewItemSaved = () => {
        setNotification({ msg: "Item created successfully!", type: 'success' });
        setIsNewItemModalOpen(false);
    };
    
    useEffect(() => {
        if (userProfile && !userProfile.isAdmin && !userProfile.permissions.includes(activeModule)) {
            const firstPermission = userProfile.permissions[0] || 'dashboard';
            const firstModule = firstPermission.split('/')[0] as Module;
            handleNavigation(firstModule);
        }
    }, [activeModule, userProfile]);
    
    const handleLogout = async () => {
        if (auth) {
            try {
                // The Firebase v8 `signOut` method takes no arguments, but the types might be incorrect.
                // Casting to `any` bypasses the TypeScript error.
                await (auth as any).signOut();
            } catch (error) {
                console.error("Error signing out: ", error);
            }
        }
    };
    
    const hasAccess = (module: Module): boolean => {
        if (!userProfile) return false;
        if (userProfile.isAdmin) return true;
        if (userProfile.permissions.includes(module)) return true;
        
        if (module === 'dataEntry' && userProfile.permissions.some(p => p.startsWith('dataEntry/'))) {
            return true;
        }
        if (module === 'reports' && userProfile.permissions.some(p => p.startsWith('reports/'))) {
            return true;
        }

        return false;
    }


    const renderModule = () => {
        if(!userProfile || !hasAccess(activeModule)) {
             return null;
        }

        switch (activeModule) {
            case 'analytics': return <AnalyticsDashboard />;
            case 'dashboard': return <Dashboard setModule={(m, s) => handleNavigation(m, s)} />;
            case 'setup': return <SetupModule setModule={(m) => handleNavigation(m)} userProfile={userProfile} initialSection={activeSubView} />;
            case 'dataEntry': return <DataEntryModule setModule={(m) => handleNavigation(m)} requestSetupItem={() => setIsNewItemModalOpen(true)} userProfile={userProfile} initialView={activeSubView} />;
            case 'accounting': return <AccountingModule userProfile={userProfile} initialView={activeSubView} />;
            case 'reports': return <ReportsModule userProfile={userProfile} initialReport={activeSubView} />;
            case 'posting': return <PostingModule setModule={(m) => handleNavigation(m)} userProfile={userProfile} />;
            case 'logistics': return <LogisticsModule userProfile={userProfile} />;
            case 'hr': return <HRModule userProfile={userProfile} initialView={activeSubView} />;
            case 'customs': return <CustomsModule userProfile={userProfile} />;
            case 'admin': return <AdminModule setNotification={setNotification} />;
            case 'test': return <TestPage />;
            case 'chat': return <ChatModule />;
            default: return <Dashboard setModule={(m, s) => handleNavigation(m, s)} />;
        }
    };

    const NavButton: React.FC<{ module: Module; label: string; shortcut: string; unreadCount?: number }> = ({ module, label, shortcut, unreadCount = 0 }) => {
        if (!hasAccess(module)) return null;
        return (
            <button
                onClick={() => handleNavigation(module)}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeModule === module ? 'bg-white text-blue-600 shadow' : 'text-white hover:bg-blue-700'}`}
                title={`Shortcut: ${shortcut}`}
            >
                {label}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </button>
        );
    };

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center"><p>Loading Application...</p></div>;
    }
    
    if (!userProfile) {
        return <LoginScreen setNotification={setNotification} />;
    }

    const isFullScreenModule = activeModule === 'logistics' || activeModule === 'reports' || activeModule === 'dataEntry' || activeModule === 'analytics';

    return (
        <div className="min-h-screen bg-slate-100 no-print">
            {notification && <Notification message={notification.msg} type={notification.type} onDismiss={() => setNotification(null)} />}
            {unreadNotification && (
                <div className="fixed top-20 right-5 bg-blue-600 text-white py-3 px-5 rounded-lg shadow-lg z-50 flex items-center gap-4 animate-fade-in-out-short">
                    <span>{unreadNotification}</span>
                    <button
                        onClick={() => { handleNavigation('chat'); setUnreadNotification(null); }}
                        className="font-bold bg-white/20 hover:bg-white/40 px-3 py-1 rounded"
                    >
                        View
                    </button>
                    <button onClick={() => setUnreadNotification(null)} className="font-bold text-white/70 hover:text-white">✕</button>
                </div>
            )}
            <header className="bg-blue-600 text-white shadow-md sticky top-0 z-40 no-print">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-10 w-10" />
                        <h1 className="text-2xl font-bold tracking-tight">Usman Global</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <nav className="flex space-x-1 bg-blue-800 p-1 rounded-lg">
                            <NavButton module="analytics" label="Analytics" shortcut="F1" />
                            <NavButton module="dashboard" label="Dashboard" shortcut="F2" />
                            <NavButton module="setup" label="Setup" shortcut="F3" />
                            <NavButton module="dataEntry" label="Data Entry" shortcut="F4" />
                            <NavButton module="accounting" label="Accounting" shortcut="F5" />
                            <NavButton module="reports" label="Reports" shortcut="F6" />
                            <NavButton module="posting" label="Posting" shortcut="F7" />
                            <NavButton module="logistics" label="Logistics" shortcut="F8" />
                            <NavButton module="hr" label="HR" shortcut="F9" />
                            <NavButton module="customs" label="Customs" shortcut="F10" />
                            <NavButton module="admin" label="Admin" shortcut="F11" />
                            <NavButton module="chat" label="Chat" shortcut="F12" unreadCount={unreadMessageCount} />
                        </nav>
                        <div className="flex items-center space-x-3 border-l border-blue-500 pl-4">
                            <div className="w-36 text-right">
                                {saveStatus === 'saving' && <span className="text-xs text-yellow-300 animate-pulse flex items-center justify-end">Saving...</span>}
                                {saveStatus === 'synced' && (
                                    <span className="text-xs text-green-300 flex items-center justify-end">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        All changes saved
                                    </span>
                                )}
                                {saveStatus === 'error' && (
                                    <span className="text-xs text-red-400 font-semibold flex items-center justify-end">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Save Error!
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setIsHelpModalOpen(true)} title="Keyboard Shortcuts" className="p-2 text-white hover:bg-blue-700 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>
                            <div className="text-right">
                                <p className="font-semibold text-sm">{userProfile?.name}</p>
                                <p className="text-xs text-blue-200 capitalize">{userProfile?.isAdmin ? 'Administrator' : 'Custom User'}</p>
                            </div>
                            <button onClick={handleLogout} title="Logout" className="px-3 py-2 text-white bg-red-500 hover:bg-red-600 rounded-md text-sm font-semibold">Logout</button>
                        </div>
                    </div>
                </div>
            </header>
            <main className={isFullScreenModule ? "p-4 md:p-8" : "container mx-auto p-4 md:p-8"}>
                {renderModule()}
            </main>
            {isNewItemModalOpen && (
                <SetupModule
                    isModalMode={true}
                    modalTarget="items"
                    onModalClose={() => setIsNewItemModalOpen(false)}
                    onModalSave={handleNewItemSaved}
                    userProfile={userProfile}
                />
            )}
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Keyboard Shortcuts" size="2xl">
                <div className="space-y-6 text-slate-700">
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Main Navigation</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F1</kbd> &rarr; Analytics</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F2</kbd> &rarr; Dashboard</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F3</kbd> &rarr; Setup</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F4</kbd> &rarr; Data Entry</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F5</kbd> &rarr; Accounting</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F6</kbd> &rarr; Reports</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F7</kbd> &rarr; Posting</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F8</kbd> &rarr; Logistics</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F9</kbd> &rarr; HR</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F10</kbd> &rarr; Customs</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F11</kbd> &rarr; Admin</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">F12</kbd> &rarr; Chat</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Sub-Menu Navigation</h3>
                        <p className="text-sm text-slate-500 mb-2">These work from anywhere in the application.</p>
                         <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + O</kbd> &rarr; Original Opening</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + P</kbd> &rarr; Production</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + S</kbd> &rarr; Sales Invoice</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + U</kbd> &rarr; Ongoing Orders</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + N</kbd> &rarr; New Voucher</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + E</kbd> &rarr; Update Voucher</p>
                        </div>
                    </div>
                    <div>
                         <h3 className="text-lg font-semibold mb-2 text-slate-800">Other</h3>
                         <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Escape</kbd> (twice) &rarr; Go Back One Step</p>
                    </div>
                </div>
            </Modal>
            {showEscapeConfirm && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out-short font-semibold">
                    Press Escape again to go back
                </div>
            )}
        </div>
    );
};

export default App;