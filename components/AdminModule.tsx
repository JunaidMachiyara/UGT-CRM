import React, { useState, useEffect, useRef } from 'react';
import { useData, auth, db, allPermissions, dataEntrySubModules, mainModules } from '../context/DataContext.tsx';
import { Module, UserProfile, AppState, PackingType, Production, JournalEntry } from '../types.ts';
import { reportStructure } from './ReportsModule.tsx';
import Modal from './ui/Modal.tsx';

const DataCorrectionManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, dispatch } = useData();
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isBalanceResetConfirmOpen, setIsBalanceResetConfirmOpen] = useState(false);
    const [isHardResetConfirmOpen, setIsHardResetConfirmOpen] = useState(false);
    const [isClearStockConfirmOpen, setIsClearStockConfirmOpen] = useState(false);

    const executePriceCorrection = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        state.items.forEach(item => {
            if (item.packingType !== PackingType.Kg && item.baleSize > 0) {
                const newAvgProductionPrice = item.avgProductionPrice / item.baleSize;
                const newAvgSalesPrice = item.avgSalesPrice / item.baleSize;

                // Check if there's an actual change to avoid unnecessary updates
                if (newAvgProductionPrice !== item.avgProductionPrice || newAvgSalesPrice !== item.avgSalesPrice) {
                    batchUpdates.push({
                        type: 'UPDATE_ENTITY',
                        payload: {
                            entity: 'items',
                            data: {
                                id: item.id,
                                avgProductionPrice: newAvgProductionPrice,
                                avgSalesPrice: newAvgSalesPrice,
                            },
                        },
                    });
                    updatedCount++;
                }
            }
        });

        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully corrected prices for ${updatedCount} items.`, type: 'success' });
        } else {
            setNotification({ msg: "No items required price correction.", type: 'success' });
        }
        setIsConfirmModalOpen(false); // Close modal on completion
    };
    
    const handlePriceCorrection = () => {
        setIsConfirmModalOpen(true);
    };

    const handleCancel = () => {
        setIsConfirmModalOpen(false);
        setNotification({ msg: "Price Correction cancelled.", type: 'success' });
    };
    
    const executeBalanceReset = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        const processEntityList = (entityName: 'customers' | 'suppliers' | 'commissionAgents' | 'freightForwarders' | 'clearingAgents' | 'expenseAccounts') => {
            const list = state[entityName] as ({ id: string, startingBalance?: number })[];
            list.forEach(entity => {
                if (entity.startingBalance && entity.startingBalance !== 0) {
                    batchUpdates.push({
                        type: 'UPDATE_ENTITY',
                        payload: {
                            entity: entityName,
                            data: { id: entity.id, startingBalance: 0 }
                        }
                    });
                    updatedCount++;
                }

                // Delete associated opening balance journal entries
                const debitEntryId = `je-d-ob-${entity.id}`;
                const creditEntryId = `je-c-ob-${entity.id}`;
                
                if (state.journalEntries.some(je => je.id === debitEntryId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: debitEntryId } });
                }
                if (state.journalEntries.some(je => je.id === creditEntryId)) {
                     batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: creditEntryId } });
                }
            });
        };

        processEntityList('customers');
        processEntityList('suppliers');
        processEntityList('commissionAgents');
        processEntityList('freightForwarders');
        processEntityList('clearingAgents');
        processEntityList('expenseAccounts');
        
        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully reset opening balances for ${updatedCount} entities and cleared related journal entries.`, type: 'success' });
        } else {
            setNotification({ msg: "No entity opening balances needed resetting.", type: 'success' });
        }
        setIsBalanceResetConfirmOpen(false);
    };

    const executeHardReset = () => {
        dispatch({ type: 'HARD_RESET_TRANSACTIONS' });
        setNotification({ msg: `Successfully reset all transactional data.`, type: 'success' });
        setIsHardResetConfirmOpen(false);
    };
    
    const executeClearOpeningStock = () => {
        const batchUpdates: any[] = [];
        let updatedCount = 0;

        state.items.forEach(item => {
            if (item.openingStock && item.openingStock > 0) {
                // 1. Set opening stock to 0
                batchUpdates.push({
                    type: 'UPDATE_ENTITY',
                    payload: {
                        entity: 'items',
                        data: { id: item.id, openingStock: 0 }
                    }
                });

                // 2. Delete the associated production entry
                const prodId = `prod_open_stock_${item.id}`;
                if (state.productions.some(p => p.id === prodId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'productions', id: prodId } });
                }

                // 3. Delete the associated journal entries
                const osDebitId = `je-d-os-${item.id}`;
                const osCreditId = `je-c-os-${item.id}`;
                if (state.journalEntries.some(je => je.id === osDebitId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osDebitId } });
                }
                if (state.journalEntries.some(je => je.id === osCreditId)) {
                    batchUpdates.push({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osCreditId } });
                }
                
                updatedCount++;
            }
        });

        if (batchUpdates.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchUpdates });
            setNotification({ msg: `Successfully cleared opening stock for ${updatedCount} items and removed associated entries.`, type: 'success' });
        } else {
            setNotification({ msg: "No items had opening stock to clear.", type: 'success' });
        }
        setIsClearStockConfirmOpen(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Data Correction Tools</h2>
             <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6" role="alert">
                <h3 className="font-bold text-red-800">Use with Extreme Caution</h3>
                <p className="text-sm text-red-700 mt-1">
                    The tools in this section perform irreversible bulk data operations. Always download a backup before proceeding.
                </p>
            </div>
            <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-slate-800">Correct Item Prices (Unit to Kg)</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This tool converts 'Average Production Price' and 'Average Sales Price' from a per-unit (Bale, Box, Sack) price to a per-Kg price by dividing by the item's 'Packing Size'. This is useful if you accidentally imported unit prices instead of Kg prices.
                </p>
                <button
                    onClick={handlePriceCorrection}
                    className="px-4 py-2 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Run Price Correction Script
                </button>
            </div>
            
            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-slate-800">Clear All Item Opening Stock</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will set the 'openingStock' of all items to 0. It will also delete the special production and journal entries that were created to account for this opening stock. Regular production entries will not be affected.
                </p>
                <button
                    onClick={() => setIsClearStockConfirmOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5a7 7 0 112.1-5.1" /></svg>
                    Clear Item Opening Stock
                </button>
            </div>

            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-slate-800">Reset All Entity Opening Balances</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will set the 'startingBalance' of all Customers, Suppliers, all Agents, and Expense Accounts to 0. It will also delete their associated opening balance journal entries.
                </p>
                <button
                    onClick={() => setIsBalanceResetConfirmOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5a7 7 0 112.1-5.1" /></svg>
                    Reset Opening Balances
                </button>
            </div>

            <div className="border-t pt-4 mt-6">
                <h3 className="text-lg font-semibold text-red-800">Hard Reset All Transactions</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    This action will permanently delete <strong>ALL</strong> transactional data, including:
                    <ul className="list-disc list-inside ml-4 mt-2">
                        <li>All Sales Invoices & Purchase Invoices</li>
                        <li>All Accounting Vouchers (Receipts, Payments, etc.)</li>
                        <li>All Journal Entries</li>
                        <li>All Production, Opening, & Stock Movement records</li>
                    </ul>
                    This will effectively reset all account balances (like Accounts Receivable, Revenue) to zero. Setup data (customers, items, etc.) will NOT be deleted.
                </p>
                <button
                    onClick={() => setIsHardResetConfirmOpen(true)}
                    className="px-4 py-2 bg-red-700 text-white font-semibold rounded-md hover:bg-red-800 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hard Reset All Transactions
                </button>
            </div>

             {isConfirmModalOpen && (
                 <Modal
                    isOpen={isConfirmModalOpen}
                    onClose={handleCancel}
                    title="Confirm Price Correction"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">WARNING: This is an irreversible action.</p>
                        <p className="text-slate-700">This will permanently modify the prices of all items not packed in 'Kg'.</p>
                        <p className="text-slate-600 bg-slate-100 p-2 rounded-md font-mono text-sm">
                            New Price = Current Price / Packing Size
                        </p>
                        <p className="text-slate-700">Are you sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={handleCancel} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executePriceCorrection} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}
            
            {isClearStockConfirmOpen && (
                 <Modal
                    isOpen={isClearStockConfirmOpen}
                    onClose={() => setIsClearStockConfirmOpen(false)}
                    title="Confirm Clear Opening Stock"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">DANGER: This action is irreversible.</p>
                        <p className="text-slate-700">This will permanently set the `openingStock` of <strong>ALL</strong> items to 0.</p>
                        <p className="text-slate-700">It will also delete the associated opening stock production and journal entries. <strong>Regular production entries will not be affected.</strong></p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsClearStockConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeClearOpeningStock} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Clear Opening Stock
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}

            {isBalanceResetConfirmOpen && (
                 <Modal
                    isOpen={isBalanceResetConfirmOpen}
                    onClose={() => setIsBalanceResetConfirmOpen(false)}
                    title="Confirm Opening Balances Reset"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600">DANGER: This is an irreversible bulk data operation.</p>
                        <p className="text-slate-700">This will permanently set the `startingBalance` of <strong>ALL</strong> Customers, Suppliers, all Agents, and Expense Accounts to 0.</p>
                        <p className="text-slate-700">It will also delete all associated opening balance journal entries, which could affect historical reports if not done carefully.</p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsBalanceResetConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeBalanceReset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Reset Opening Balances
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}

            {isHardResetConfirmOpen && (
                 <Modal
                    isOpen={isHardResetConfirmOpen}
                    onClose={() => setIsHardResetConfirmOpen(false)}
                    title="CONFIRM HARD RESET"
                    size="lg"
                 >
                    <div className="space-y-4">
                        <p className="font-bold text-red-600 text-lg">DANGER: THIS WILL DELETE ALL TRANSACTIONAL DATA.</p>
                        <p className="text-slate-700">You are about to delete all sales, purchases, vouchers, and journal entries. This action cannot be undone and will reset your accounting and inventory to a clean slate.</p>
                        <p className="text-slate-700">Are you absolutely sure you want to proceed?</p>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button onClick={() => setIsHardResetConfirmOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                                Cancel
                            </button>
                            <button onClick={executeHardReset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Yes, Delete All Transactions
                            </button>
                        </div>
                    </div>
                 </Modal>
            )}
        </div>
    );
};


const BackupRestoreManager: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, dispatch } = useData();
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadBackup = () => {
        try {
            const stateJson = JSON.stringify(state, null, 2);
            const blob = new Blob([stateJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.download = `backup_${date}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setNotification({ msg: "Backup downloaded successfully.", type: 'success' });
        } catch (error) {
            console.error("Backup failed:", error);
            setNotification({ msg: "Backup failed. See console for details.", type: 'error' });
        }
    };
    
    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = JSON.parse(text) as AppState;

                // Basic validation
                if (typeof parsedData !== 'object' || !parsedData.customers || !parsedData.items) {
                    throw new Error("Invalid backup file format.");
                }
                
                const confirmation = window.confirm(
                    "WARNING: You are about to overwrite ALL existing data with the content of this backup file. This action CANNOT be undone. Are you absolutely sure you want to proceed?"
                );

                if (confirmation) {
                    dispatch({ type: 'RESTORE_STATE', payload: parsedData });
                    setNotification({ msg: "Data restored successfully. The page will now reload.", type: 'success' });
                    // Reload to ensure all components re-render with fresh state
                    setTimeout(() => window.location.reload(), 2000);
                }
            } catch (error) {
                console.error("Restore failed:", error);
                setNotification({ msg: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}.`, type: 'error' });
            } finally {
                setIsRestoring(false);
                 if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        
        reader.onerror = () => {
             setNotification({ msg: "Failed to read the file.", type: 'error' });
             setIsRestoring(false);
        };

        reader.readAsText(file);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Data Backup & Restore</h2>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6" role="alert">
                <h3 className="font-bold text-amber-800">Important Information</h3>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
                    <li><b>Download Backup:</b> Saves a complete copy of all your application data to your computer as a <code>.json</code> file.</li>
                    <li><b>Upload & Restore:</b> Overwrites <b>ALL</b> current data in the application with the data from a selected backup file. This action cannot be undone.</li>
                    <li className="font-semibold">It is strongly recommended to download a fresh backup before restoring from an old one.</li>
                </ul>
            </div>
            <div className="flex space-x-4">
                <button 
                    onClick={handleDownloadBackup}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Backup
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept=".json" />
                <button 
                    onClick={handleRestoreClick}
                    disabled={isRestoring}
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors disabled:bg-green-300 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {isRestoring ? 'Restoring...' : 'Upload & Restore'}
                </button>
            </div>
        </div>
    );
};


const AdminModule: React.FC<{ setNotification: (n: any) => void; }> = ({ setNotification }) => {
    const { state, userProfile } = useData();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', permissions: [] as string[], isAdmin: false });
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('users').onSnapshot((snapshot: any) => {
            const userList: UserProfile[] = [];
            snapshot.forEach((doc: any) => {
                userList.push({ uid: doc.id, ...doc.data() } as UserProfile);
            });
            setUsers(userList.sort((a,b) => a.name.localeCompare(b.name)));
        }, (error: any) => {
            console.error("Error fetching users:", error);
            setNotification({ msg: "Could not fetch user list.", type: 'error' });
        });

        return () => unsubscribe();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.email || !newUser.password || !newUser.name) {
            setNotification({ msg: "Name, email, and password are required.", type: 'error' });
            return;
        }
        if (newUser.password.length < 6) {
            setNotification({ msg: "Password must be at least 6 characters long.", type: 'error' });
            return;
        }
        setIsCreatingUser(true);
        try {
            // Step 1: Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(newUser.email, newUser.password);
            const user = userCredential.user;

            if (user) {
                // Step 2: Create user profile document in Firestore
                const userProfileData = {
                    name: newUser.name,
                    email: newUser.email,
                    isAdmin: newUser.isAdmin,
                    permissions: newUser.isAdmin ? allPermissions : newUser.permissions
                };
                await db.collection('users').doc(user.uid).set(userProfileData);

                setNotification({ msg: `User ${newUser.email} created successfully in Firebase and Firestore.`, type: 'success' });
                setNewUser({ name: '', email: '', password: '', permissions: [], isAdmin: false });
            } else {
                throw new Error("Firebase user creation failed unexpectedly.");
            }
        } catch (error: any) {
            console.error("Error creating user:", error);
            const errorMessage = error.code === 'auth/email-already-in-use'
                ? 'This email is already registered.'
                : error.message;
            setNotification({ msg: `Error: ${errorMessage}`, type: 'error' });
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleAdminToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isAdmin = e.target.checked;
        setNewUser(prev => ({ ...prev, isAdmin, permissions: isAdmin ? allPermissions : [] }));
    };
    
    const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        setNewUser(prev => {
            const newPermissions = checked 
                ? [...prev.permissions, value]
                : prev.permissions.filter(p => p !== value);
            
            // If a data entry sub-module is checked, ensure the parent 'dataEntry' is also checked
            if (checked && value.startsWith('dataEntry/')) {
                if (!newPermissions.includes('dataEntry')) {
                    newPermissions.push('dataEntry');
                }
            }

            return { ...prev, permissions: newPermissions };
        });
    };

    const handleGroupToggle = (e: React.ChangeEvent<HTMLInputElement>, permissions: string[]) => {
        const { checked } = e.target;
        setNewUser(prev => {
             const currentPermissions = new Set(prev.permissions);
             if (checked) {
                 permissions.forEach(p => currentPermissions.add(p));
             } else {
                 permissions.forEach(p => currentPermissions.delete(p));
             }
             return { ...prev, permissions: Array.from(currentPermissions) };
        });
    };
    
    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-slate-700 mb-4">Create New User</h2>
                <form onSubmit={handleCreateUser} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div><label className="block text-sm font-medium text-slate-700">Name</label><input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required className="mt-1 w-full p-2 border border-slate-300 rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Email</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required className="mt-1 w-full p-2 border border-slate-300 rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Password</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required className="mt-1 w-full p-2 border border-slate-300 rounded-md"/></div>
                    </div>
                    
                    <fieldset className="border rounded-md p-4 space-y-4">
                        <legend className="font-semibold text-lg text-slate-800 px-2">Permissions</legend>
                        <div className="flex items-center space-x-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                             <input id="isAdmin" type="checkbox" checked={newUser.isAdmin} onChange={handleAdminToggle} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"/>
                             <label htmlFor="isAdmin" className="font-semibold text-blue-800">Is Admin (Full Access)</label>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {mainModules.filter(m => m !== 'reports' && m !== 'dataEntry' && m !== 'admin').map(module => (
                                <div key={module}>
                                    <label className="flex items-center space-x-2 capitalize text-slate-800">
                                        <input type="checkbox" value={module} checked={newUser.permissions.includes(module)} onChange={handlePermissionChange} disabled={newUser.isAdmin} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                                        <span>{module}</span>
                                    </label>
                                </div>
                            ))}
                            {mainModules.includes('admin') && (
                                <div key="admin">
                                    <label className="flex items-center space-x-2 capitalize text-slate-800 font-semibold text-red-600">
                                        <input type="checkbox" value="admin" checked={newUser.permissions.includes("admin")} onChange={handlePermissionChange} disabled={newUser.isAdmin} className="h-4 w-4 rounded text-red-600 focus:ring-red-500" />
                                        <span>Admin</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        
                        {/* Data Entry Section */}
                        <div className="col-span-full border rounded-md p-3 bg-slate-50">
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    id="dataEntry-group"
                                    checked={dataEntrySubModules.map(sm => sm.key).every(p => newUser.permissions.includes(p))} 
                                    ref={el => { if (el) { el.indeterminate = dataEntrySubModules.map(sm => sm.key).some(p => newUser.permissions.includes(p)) && !dataEntrySubModules.map(sm => sm.key).every(p => newUser.permissions.includes(p)); }}} 
                                    onChange={(e) => handleGroupToggle(e, ['dataEntry', ...dataEntrySubModules.map(sm => sm.key)])} 
                                    disabled={newUser.isAdmin} 
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="dataEntry-group" className="ml-2 font-medium text-slate-700 capitalize">Data Entry</label>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-2 pl-6">
                                {dataEntrySubModules.map(subModule => (
                                    <label key={subModule.key} className="flex items-center space-x-2 text-sm text-slate-800">
                                        <input 
                                            type="checkbox" 
                                            value={subModule.key} 
                                            checked={newUser.permissions.includes(subModule.key)} 
                                            onChange={handlePermissionChange} 
                                            disabled={newUser.isAdmin} 
                                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" 
                                        />
                                        <span>{subModule.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Reports Section */}
                        <div className="col-span-full border-t pt-4">
                            <h3 className="font-semibold text-slate-800 mb-2">Reports Access</h3>
                             <div className="space-y-4">
                                {reportStructure.map(category => {
                                    const categoryPermissions = category.subReports ? category.subReports.map(sr => sr.key) : [`${category.key}/main`];
                                    const allInCategory = categoryPermissions.every(p => newUser.permissions.includes(p));
                                    const someInCategory = categoryPermissions.some(p => newUser.permissions.includes(p));
                                    
                                    return (
                                        <div key={category.key} className="p-3 bg-slate-50 rounded border">
                                            <div className="flex items-center">
                                                <input type="checkbox" checked={allInCategory} ref={el => { if (el) { el.indeterminate = someInCategory && !allInCategory; } }} onChange={(e) => handleGroupToggle(e, [`reports/${category.key}`, ...categoryPermissions])} disabled={newUser.isAdmin} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                                                <label className="ml-2 font-medium text-slate-700">{category.label}</label>
                                            </div>
                                             {category.subReports && <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pl-6">
                                                {category.subReports.map(report => (
                                                    <label key={report.key} className="flex items-center space-x-2 text-sm text-slate-800">
                                                        <input type="checkbox" value={report.key} checked={newUser.permissions.includes(report.key)} onChange={handlePermissionChange} disabled={newUser.isAdmin} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                                                        <span>{report.label}</span>
                                                    </label>
                                                ))}
                                            </div>}
                                            {!category.subReports && <div className="mt-2 pl-6">
                                                 <label className="flex items-center space-x-2 text-sm text-slate-800">
                                                    <input type="checkbox" value={`${category.key}/main`} checked={newUser.permissions.includes(`${category.key}/main`)} onChange={handlePermissionChange} disabled={newUser.isAdmin} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                                                    <span>Access Report</span>
                                                 </label>
                                            </div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={isCreatingUser} className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                            {isCreatingUser ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
                <p className="text-xs text-slate-500 mt-2">Note: This creates the user directly in Firebase Authentication and saves their profile in Firestore.</p>
            </div>
             <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-slate-700 mb-4">Manage Users</h2>
                 <div className="overflow-x-auto"><table className="w-full text-left table-auto"><thead><tr className="bg-slate-100"><th className="p-3 font-semibold text-slate-600">Name</th><th className="p-3 font-semibold text-slate-600">Email</th><th className="p-3 font-semibold text-slate-600">Role</th></tr></thead><tbody>{users.map(user => (<tr key={user.uid} className="border-b hover:bg-slate-50"><td className="p-3 text-slate-700">{user.name}</td><td className="p-3 text-slate-700">{user.email}</td><td className="p-3 text-slate-700 capitalize">{user.isAdmin ? 'Admin' : 'Custom'}</td></tr>))}</tbody></table></div>
            </div>
            {userProfile?.isAdmin && <DataCorrectionManager setNotification={setNotification} />}
            {userProfile?.isAdmin && <BackupRestoreManager setNotification={setNotification} />}
        </div>
    );
};

export default AdminModule;