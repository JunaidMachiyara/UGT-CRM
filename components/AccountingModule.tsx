import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { JournalEntry, JournalEntryType, Currency, UserProfile, AppState, SalesInvoice, PackingType, InvoiceItem } from '../types.ts';
import CurrencyInput from './ui/CurrencyInput.tsx';
import ReportFilters from './reports/ReportFilters.tsx';
import Modal from './ui/Modal.tsx';
import PackingMaterialModule from './PackingMaterialModule.tsx';
import FixedAssetsModule from './FixedAssetsModule.tsx';

const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 2000);
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {message}
        </div>
    );
};

const VoucherViewModal: React.FC<{ voucherId: string; onClose: () => void; state: AppState }> = ({ voucherId, onClose, state }) => {
    const entries = state.journalEntries.filter(je => je.voucherId === voucherId);

    const allAccounts = useMemo(() => [
        ...state.banks.map(b => ({ id: b.id, name: `${b.accountTitle} (Bank)` })),
        ...state.cashAccounts.map(c => ({ id: c.id, name: `${c.name} (Cash)` })),
        ...state.customers.map(c => ({ id: c.id, name: `${c.name} (Customer)`})),
        ...state.suppliers.map(s => ({ id: s.id, name: `${s.name} (Supplier)`})),
        ...state.commissionAgents.map(ca => ({ id: ca.id, name: `${ca.name} (Commission Agent)`})),
        ...state.employees.map(e => ({ id: e.id, name: e.fullName })),
        ...state.freightForwarders.map(e => ({ id: e.id, name: e.name })),
        ...state.clearingAgents.map(e => ({ id: e.id, name: e.name })),
        ...state.loanAccounts, ...state.capitalAccounts, ...state.investmentAccounts, ...state.expenseAccounts,
        ...state.receivableAccounts, ...state.payableAccounts, ...state.revenueAccounts,
    ], [state]);
    
    const getAccountName = (entry: JournalEntry) => {
        if (entry.entityId && entry.entityType) {
            switch(entry.entityType) {
                case 'customer': return state.customers.find(c => c.id === entry.entityId)?.name || entry.entityId;
                case 'supplier': return state.suppliers.find(s => s.id === entry.entityId)?.name || entry.entityId;
                case 'commissionAgent': return state.commissionAgents.find(ca => ca.id === entry.entityId)?.name || entry.entityId;
                case 'employee': return state.employees.find(e => e.id === entry.entityId)?.fullName || entry.entityId;
                case 'freightForwarder': return state.freightForwarders.find(e => e.id === entry.entityId)?.name || entry.entityId;
                case 'clearingAgent': return state.clearingAgents.find(e => e.id === entry.entityId)?.name || entry.entityId;
            }
        }
        return allAccounts.find(acc => acc.id === entry.account)?.name || entry.account;
    };

    if (entries.length === 0) {
        return ( <Modal isOpen={true} onClose={onClose} title="Error"><p>Could not find voucher with ID: {voucherId}</p></Modal> );
    }
    
    const mainEntry = entries[0];
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    const handlePrint = () => window.print();

    return (
        <Modal isOpen={true} onClose={onClose} title={`Voucher Details: ${voucherId}`} size="4xl">
            <div id="voucher-print-area" className="space-y-4 text-sm text-slate-800">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">{mainEntry.entryType} Voucher</h2>
                    <p className="text-slate-600">USMAN GLOBAL</p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-b pb-4 text-slate-700">
                    <p><strong>Voucher ID:</strong> {voucherId}</p>
                    <p><strong>Date:</strong> {mainEntry.date}</p>
                    <p><strong>Amount:</strong> ${totalDebit.toFixed(2)}</p>
                    <p><strong>Description:</strong> {mainEntry.description}</p>
                </div>
                <table className="w-full text-left table-auto my-4 border-t border-b">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-2 font-semibold text-slate-600">Account</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Debit</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id} className="border-b">
                                <td className="p-2 text-slate-700">{getAccountName(entry)}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td>
                                <td className="p-2 text-slate-700 text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-slate-100">
                            <td className="p-2 text-right text-slate-800">Total</td>
                            <td className="p-2 text-right text-slate-800">${totalDebit.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-800">${totalCredit.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div className="flex justify-between items-center pt-16 text-sm text-slate-600">
                     <p>____________________<br/>Prepared By</p>
                     <p>____________________<br/>Approved By</p>
                 </div>
            </div>
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Close</button>
                <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Print Voucher</button>
            </div>
        </Modal>
    );
};

const NewVoucherForm: React.FC<{ userProfile: UserProfile | null; showNotification: (msg: string) => void }> = ({ userProfile, showNotification }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        entryType: JournalEntryType.Receipt,
        fromToAccount: '',
        cashBankAccount: '',
        amount: '',
        description: '',
        currency: Currency.Dollar,
        conversionRate: 1,
    });
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const accountOptions = useMemo(() => {
        const { entryType } = formData;
        if (entryType === JournalEntryType.Receipt) {
            return {
                fromToLabel: 'Received From',
                fromToOptions: [
                    { group: 'Customers', options: state.customers.map(c => ({ id: c.id, name: c.name, type: 'customer' })) },
                    { group: 'Other', options: [{ id: 'misc-receipt', name: 'Miscellaneous Receipt', type: 'misc' }] },
                ],
                cashBankLabel: 'To Account',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        } else if (entryType === JournalEntryType.Payment) {
            return {
                fromToLabel: 'Paid To',
                fromToOptions: [
                    { group: 'Suppliers', options: state.suppliers.map(s => ({ id: s.id, name: s.name, type: 'supplier' })) },
                    { group: 'Commission Agents', options: state.commissionAgents.map(c => ({ id: c.id, name: c.name, type: 'commissionAgent' })) },
                    { group: 'Freight Forwarders', options: state.freightForwarders.map(c => ({ id: c.id, name: c.name, type: 'freightForwarder' })) },
                    { group: 'Clearing Agents', options: state.clearingAgents.map(c => ({ id: c.id, name: c.name, type: 'clearingAgent' })) },
                    { group: 'Employees', options: state.employees.map(e => ({ id: e.id, name: e.fullName, type: 'employee' })) },
                ],
                cashBankLabel: 'From Account',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        } else { // Expense
             return {
                fromToLabel: 'Expense Account',
                fromToOptions: [{ group: 'Expenses', options: state.expenseAccounts }],
                cashBankLabel: 'Paid From',
                cashBankOptions: [ ...state.cashAccounts, ...state.banks.map(b => ({ id: b.id, name: b.accountTitle })) ],
            };
        }
    }, [formData.entryType, state]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, entryType, fromToAccount, cashBankAccount, amount, description, currency, conversionRate } = formData;
        const amountNum = Number(amount);

        if (!fromToAccount || !cashBankAccount || !amount || amountNum <= 0) {
            alert('Please fill all required fields correctly.');
            return;
        }

        const amountInDollar = amountNum * conversionRate;
        
        let voucherId = '';
        let debitEntry: JournalEntry, creditEntry: JournalEntry;
        const fromToAccountData = accountOptions.fromToOptions.flatMap(g => g.options).find(o => o.id === fromToAccount);

        const baseEntry = {
            date, entryType, description,
            originalAmount: currency !== Currency.Dollar ? { amount: amountNum, currency } : undefined,
            createdBy: userProfile?.uid
        };

        if (entryType === JournalEntryType.Receipt) {
            voucherId = `RV-${String(state.nextReceiptVoucherNumber).padStart(3, '0')}`;
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: cashBankAccount, debit: amountInDollar, credit: 0 };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: 'AR-001', debit: 0, credit: amountInDollar, entityId: fromToAccount, entityType: 'customer' };
        } else if (entryType === JournalEntryType.Payment) {
            voucherId = `PV-${String(state.nextPaymentVoucherNumber).padStart(3, '0')}`;
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: 'AP-001', debit: amountInDollar, credit: 0, entityId: fromToAccount, entityType: fromToAccountData?.type as any };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: cashBankAccount, debit: 0, credit: amountInDollar };
        } else { // Expense
            voucherId = `EV-${String(state.nextExpenseVoucherNumber).padStart(3, '0')}`;
            debitEntry = { ...baseEntry, id: `je-d-${voucherId}`, voucherId, account: fromToAccount, debit: amountInDollar, credit: 0 };
            creditEntry = { ...baseEntry, id: `je-c-${voucherId}`, voucherId, account: cashBankAccount, debit: 0, credit: amountInDollar };
        }

        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });

        showNotification(`${entryType} voucher ${voucherId} created successfully.`);
        setFormData({
            ...formData,
            fromToAccount: '',
            amount: '',
            description: '',
            currency: Currency.Dollar,
            conversionRate: 1,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Voucher Type</label>
                    <select value={formData.entryType} onChange={e => setFormData({ ...formData, entryType: e.target.value as JournalEntryType, fromToAccount: '' })} className="mt-1 w-full p-2 rounded-md">
                        <option value={JournalEntryType.Receipt}>Receipt</option>
                        <option value={JournalEntryType.Payment}>Payment</option>
                        <option value={JournalEntryType.Expense}>Expense</option>
                    </select>
                </div>
                <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} min={minDate} required className="mt-1 w-full p-2 rounded-md"/></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700">{accountOptions.fromToLabel}</label>
                    <select value={formData.fromToAccount} onChange={e => setFormData({ ...formData, fromToAccount: e.target.value })} required className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select an account</option>
                        {accountOptions.fromToOptions.map(group => (
                            <optgroup label={group.group} key={group.group}>
                                {group.options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">{accountOptions.cashBankLabel}</label>
                    <select value={formData.cashBankAccount} onChange={e => setFormData({ ...formData, cashBankAccount: e.target.value })} required className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select a cash/bank account</option>
                        {accountOptions.cashBankOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Amount</label>
                    <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required className="mt-1 w-full p-2 rounded-md"/>
                </div>
                <div>
                     <label className="block text-sm font-medium text-slate-700">Currency & Rate</label>
                     <CurrencyInput value={{ currency: formData.currency, conversionRate: formData.conversionRate }} onChange={v => setFormData(f => ({...f, ...v}))} />
                </div>
            </div>
             <div><label className="block text-sm font-medium text-slate-700">Description</label><input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required className="mt-1 w-full p-2 rounded-md"/></div>

            <div className="flex justify-end"><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Voucher</button></div>
        </form>
    );
};

const UpdateVoucherList: React.FC<{}> = () => {
    const { state } = useData();
    const [filters, setFilters] = useState({ startDate: '2024-01-01', endDate: new Date().toISOString().split('T')[0], type: 'All' });
    const [viewingVoucherId, setViewingVoucherId] = useState<string|null>(null);

    const groupedVouchers = useMemo(() => {
        const filteredEntries = state.journalEntries.filter(je => 
            je.date >= filters.startDate && 
            je.date <= filters.endDate &&
            (filters.type === 'All' || je.entryType === filters.type) &&
            !je.voucherId.startsWith('SI') // Exclude sales invoices
        );

        const groups: { [id: string]: { voucherId: string, date: string, type: JournalEntryType, description: string, amount: number, entries: JournalEntry[] } } = {};

        filteredEntries.forEach(entry => {
            if (!groups[entry.voucherId]) {
                groups[entry.voucherId] = { voucherId: entry.voucherId, date: entry.date, type: entry.entryType, description: entry.description, amount: 0, entries: [] };
            }
            groups[entry.voucherId].entries.push(entry);
            groups[entry.voucherId].amount += entry.debit;
        });

        return Object.values(groups).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filters, state.journalEntries]);
    
    return (
        <div className="space-y-4">
            <ReportFilters filters={filters} onFilterChange={(name, value) => setFilters(f => ({...f, [name]: value}))}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Type</label>
                    <select value={filters.type} onChange={e => setFilters(f => ({...f, type: e.target.value}))} className="w-full p-2 rounded-md text-sm">
                        <option>All</option>
                        {Object.values(JournalEntryType).map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
            </ReportFilters>
             <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                    <thead><tr className="bg-slate-100"><th className="p-3">ID</th><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Actions</th></tr></thead>
                    <tbody>
                        {groupedVouchers.map(v => (
                            <tr key={v.voucherId} className="border-b hover:bg-slate-50">
                                <td className="p-3 font-mono">{v.voucherId}</td>
                                <td className="p-3">{v.date}</td>
                                <td className="p-3">{v.type}</td>
                                <td className="p-3">{v.description}</td>
                                <td className="p-3 text-right font-medium">{v.amount.toFixed(2)}</td>
                                <td className="p-3 text-right"><button onClick={() => setViewingVoucherId(v.voucherId)} className="text-blue-600 hover:underline text-sm">View</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {viewingVoucherId && <VoucherViewModal voucherId={viewingVoucherId} onClose={() => setViewingVoucherId(null)} state={state} />}
        </div>
    );
};


const AccountingModule: React.FC<{ userProfile: UserProfile | null; initialView?: string | null }> = ({ userProfile, initialView }) => {
    const [subModule, setSubModule] = useState<'new' | 'update' | 'packing' | 'fixedAssets'>(initialView as any || 'new');
    const [notification, setNotification] = useState<string|null>(null);

    useEffect(() => {
        if(initialView) setSubModule(initialView as any);
    }, [initialView]);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const getButtonClass = (module: 'new' | 'update' | 'packing' | 'fixedAssets') => `px-4 py-2 rounded-md transition-colors text-sm font-medium ${subModule === module ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
             <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-700 mr-4">Accounting</h2>
                <button onClick={() => setSubModule('new')} className={getButtonClass('new')}>New Voucher</button>
                <button onClick={() => setSubModule('update')} className={getButtonClass('update')}>Update / View Vouchers</button>
                <button onClick={() => setSubModule('packing')} className={getButtonClass('packing')}>Packing Material</button>
                <button onClick={() => setSubModule('fixedAssets')} className={getButtonClass('fixedAssets')}>Fixed Assets</button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                {subModule === 'new' && <NewVoucherForm userProfile={userProfile} showNotification={showNotification} />}
                {subModule === 'update' && <UpdateVoucherList />}
                {subModule === 'packing' && <PackingMaterialModule userProfile={userProfile} showNotification={showNotification} />}
                {subModule === 'fixedAssets' && <FixedAssetsModule userProfile={userProfile} showNotification={showNotification} />}
            </div>
        </div>
    );
};

export default AccountingModule;