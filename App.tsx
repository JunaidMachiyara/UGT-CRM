import React, { useState, useRef, useEffect, useMemo } from 'react';
import SetupModule, { HRModule } from './components/SetupModule.tsx';
import DataEntryModule from './components/DataEntryModule.tsx';
import Dashboard from './components/Dashboard.tsx';
import AnalyticsDashboard from './components/AnalyticsDashboard.tsx';
import AccountingModule from './components/AccountingModule.tsx';
import ReportsModule from './components/ReportsModule.tsx';
import PostingModule from './components/PostingModule.tsx';
import LogisticsModule from './components/LogisticsModule.tsx';
import AdminModule from './components/AdminModule.tsx';
import { useData, auth } from './context/DataContext.tsx';
import { Module, UserProfile } from './types.ts';
import Chatbot from './components/Chatbot.tsx';
import Modal from './components/ui/Modal.tsx';
import TestPage from './components/TestPage.tsx';

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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
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
    
    return (
        <div className="min-h-screen flex items-center justify-center login-screen p-4">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-20 w-20 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-slate-800">Usman Global</h1>
                    <p className="text-slate-600 mt-2">Stock & Accounting System</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full p-3 rounded-lg"/></div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors">{isLoading ? 'Signing In...' : 'Sign In'}</button>
                </form>
                 <div className="text-center text-xs text-slate-500 pt-4 border-t">
                     <p className="mt-2 text-slate-400">Please use the credentials you have set up in your Firebase Authentication console.</p>
                </div>
            </div>
        </div>
    );
};

const mainModules: Module[] = ['dashboard', 'setup', 'dataEntry', 'accounting', 'reports', 'posting', 'logistics', 'hr', 'admin'];

const App: React.FC = () => {
    const [activeModule, setActiveModule] = useState<Module>('dashboard');
    const [activeSubView, setActiveSubView] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const { userProfile, authLoading, saveStatus } = useData();

    const [isNewItemModalOpen, setIsNewItemModalOpen] = useState<boolean>(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const [navigationHistory, setNavigationHistory] = useState<Module[]>([]);
    const prevModuleRef = useRef<Module>();
    const [showEscapeConfirm, setShowEscapeConfirm] = useState(false);
    const escapeConfirmTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (prevModuleRef.current && prevModuleRef.current !== activeModule) {
            setNavigationHistory(prev => [...prev, prevModuleRef.current!]);
        }
        prevModuleRef.current = activeModule;
    }, [activeModule]);

    const handleNavigation = (module: Module, subView?: string) => {
        if (activeModule !== module) {
            setActiveModule(module);
        }
        setActiveSubView(subView || null);
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Because modals and the chatbot now handle their own Escape events and stop propagation,
            // we no longer need to check if they are open here. This makes the logic much more robust.
            if (event.key === 'Escape') {
                const target = event.target as HTMLElement;
                // Still check if the user is typing in a form field.
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                    return;
                }
    
                if (showEscapeConfirm) {
                    if (navigationHistory.length > 0) {
                        event.preventDefault();
                        const newHistory = [...navigationHistory];
                        const lastModule = newHistory.pop();
                        if (lastModule) {
                            setNavigationHistory(newHistory);
                            setActiveModule(lastModule);
                        }
                    }
                    setShowEscapeConfirm(false);
                    if (escapeConfirmTimeoutRef.current) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    return;
                }
    
                if (navigationHistory.length > 0) {
                    event.preventDefault();
                    setShowEscapeConfirm(true);
                    if (escapeConfirmTimeoutRef.current) {
                        clearTimeout(escapeConfirmTimeoutRef.current);
                    }
                    escapeConfirmTimeoutRef.current = window.setTimeout(() => {
                        setShowEscapeConfirm(false);
                    }, 3000);
                }
                return; // Explicitly return after handling Escape
            }
            
            // Alt + Key for Direct Navigation (only if not typing in a field)
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
                return;
            }

            if (event.altKey) {
                event.preventDefault();
                switch (event.key) {
                    case '1': handleNavigation('analytics'); break;
                    case '2': handleNavigation('dashboard'); break;
                    case '3': handleNavigation('setup'); break;
                    case '4': handleNavigation('dataEntry'); break;
                    case '5': handleNavigation('accounting'); break;
                    case '6': handleNavigation('reports'); break;
                    case '7': handleNavigation('posting'); break;
                    case '8': handleNavigation('logistics'); break;
                    case '9': handleNavigation('hr'); break;
                    case '0': handleNavigation('admin'); break;
                    
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
            if (escapeConfirmTimeoutRef.current) {
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

    const handleLogout = () => {
        if (auth) {
            auth.signOut();
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
            case 'admin': return <AdminModule setNotification={setNotification} />;
            case 'test': return <TestPage />;
            default: return <Dashboard setModule={(m, s) => handleNavigation(m, s)} />;
        }
    };

    const NavButton: React.FC<{ module: Module; label: string; shortcut: string }> = ({ module, label, shortcut }) => {
        if (!hasAccess(module)) return null;
        return (<button onClick={() => handleNavigation(module)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeModule === module ? 'bg-white text-blue-600 shadow' : 'text-white hover:bg-blue-700'}`} title={`Shortcut: ${shortcut}`}>{label}</button>);
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
            <header className="bg-blue-600 text-white shadow-md sticky top-0 z-40 no-print">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <img src="https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/globe-icon.png" alt="Usman Global Logo" className="h-10 w-10" />
                        <h1 className="text-2xl font-bold tracking-tight">Usman Global</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <nav className="flex space-x-1 bg-blue-800 p-1 rounded-lg">
                            <NavButton module="analytics" label="Analytics" shortcut="Alt + 1" />
                            <NavButton module="dashboard" label="Dashboard" shortcut="Alt + 2" />
                            <NavButton module="setup" label="Setup" shortcut="Alt + 3" />
                            <NavButton module="dataEntry" label="Data Entry" shortcut="Alt + 4" />
                            <NavButton module="accounting" label="Accounting" shortcut="Alt + 5" />
                            <NavButton module="reports" label="Reports" shortcut="Alt + 6" />
                            <NavButton module="posting" label="Posting" shortcut="Alt + 7" />
                            <NavButton module="logistics" label="Logistics" shortcut="Alt + 8" />
                            <NavButton module="hr" label="HR" shortcut="Alt + 9" />
                            <NavButton module="admin" label="Admin" shortcut="Alt + 0" />
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
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Global Navigation</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 1</kbd> &rarr; Analytics</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 2</kbd> &rarr; Dashboard</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 3</kbd> &rarr; Setup</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 4</kbd> &rarr; Data Entry</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 5</kbd> &rarr; Accounting</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 6</kbd> &rarr; Reports</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 7</kbd> &rarr; Posting</p>
                            <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 8</kbd> &rarr; Logistics</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 9</kbd> &rarr; HR</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Alt + 0</kbd> &rarr; Admin</p>
                             <p><kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Escape</kbd> &rarr; Go Back (with confirmation)</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Quick Access Shortcuts</h3>
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
                </div>
            </Modal>
            <Chatbot onNavigate={handleNavigation} />
            {showEscapeConfirm && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out-short font-semibold">
                    Press Escape again to go back
                </div>
            )}
        </div>
    );
};

export default App;