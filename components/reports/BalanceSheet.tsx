import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';

const BalanceSheet: React.FC = () => {
    const { state } = useData();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

    const { assets, liabilities, equity, netIncomeForPeriod } = useMemo(() => {
        const entries = state.journalEntries.filter(je => je.date <= asOfDate);
        
        const getAccountBalance = (accountId: string) => entries
            .filter(je => je.account === accountId)
            .reduce((sum, je) => sum + je.debit - je.credit, 0);

        const getEntityBalance = (generalAccountId: string, entityType: 'customer' | 'supplier' | 'employee' | 'freightForwarder' | 'clearingAgent' | 'commissionAgent') => {
            return entries.filter(je => je.account === generalAccountId && je.entityType === entityType)
                .reduce((sum, je) => sum + (generalAccountId === state.receivableAccounts[0]?.id ? (je.debit - je.credit) : (je.credit - je.debit)), 0);
        };

        const calculateTotalBalance = (accountList: { id: string }[]) => accountList.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
        
        // P&L Calculation for Retained Earnings
        const revenueAccounts = state.revenueAccounts.map(a => a.id);
        const expenseAccounts = state.expenseAccounts.map(a => a.id);
        const revenue = entries.filter(je => revenueAccounts.includes(je.account)).reduce((sum, je) => sum + je.credit - je.debit, 0);
        const expenses = entries.filter(je => expenseAccounts.includes(je.account)).reduce((sum, je) => sum + je.debit - je.credit, 0);
        const netIncome = revenue - expenses;

        // ASSETS
        const cash = calculateTotalBalance(state.cashAccounts);
        const bank = calculateTotalBalance(state.banks);
        const receivables = getAccountBalance(state.receivableAccounts[0]?.id);
        const inventory = getAccountBalance(state.inventoryAccounts[0]?.id);
        const investments = calculateTotalBalance(state.investmentAccounts);
        
        const totalCurrentAssets = cash + bank + receivables + inventory;
        const totalAssets = totalCurrentAssets + investments;

        // LIABILITIES
        const payables = getAccountBalance(state.payableAccounts[0]?.id) + getAccountBalance(state.payableAccounts[1]?.id); // AP + Customs Payable
        const loans = calculateTotalBalance(state.loanAccounts);
        const totalCurrentLiabilities = payables;
        const totalLongTermLiabilities = loans;
        const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

        // EQUITY
        const capital = getAccountBalance(state.capitalAccounts.find(c => c.id === 'CAP-001')?.id || '');
        const openingBalanceEquity = getAccountBalance(state.capitalAccounts.find(c => c.id === 'CAP-002')?.id || '');
        const totalEquity = capital + openingBalanceEquity + netIncome;
        
        return {
            assets: {
                cash, bank, receivables, inventory, investments,
                totalCurrentAssets, totalAssets
            },
            liabilities: {
                payables, loans,
                totalCurrentLiabilities, totalLongTermLiabilities, totalLiabilities
            },
            equity: {
                capital, openingBalanceEquity,
                retainedEarnings: netIncome,
                totalEquity
            },
            netIncomeForPeriod: netIncome
        };
    }, [asOfDate, state]);

    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const AccountRow: React.FC<{ label: string, value: number, isSubtotal?: boolean, isTotal?: boolean }> = ({ label, value, isSubtotal, isTotal }) => (
        <div className={`flex justify-between py-1.5 text-slate-800 ${isSubtotal ? 'border-t mt-1 pt-1.5 font-semibold' : ''} ${isTotal ? 'border-t-2 border-slate-400 mt-2 pt-2 font-bold text-lg' : ''}`}>
            <span className={isSubtotal || isTotal ? '' : 'pl-4'}>{label}</span>
            <span>{formatCurrency(value)}</span>
        </div>
    );

    return (
        <div className="report-print-area">
            <ReportToolbar title="Balance Sheet" exportData={[]} exportHeaders={[]} exportFilename={`BalanceSheet_${asOfDate}`} />
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex items-end no-print">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">As of Date</label>
                    <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="p-2 border border-slate-300 rounded-md text-sm"/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 border-b-2 pb-1">Assets</h3>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Current Assets</h4>
                        <AccountRow label="Cash" value={assets.cash} />
                        <AccountRow label="Bank" value={assets.bank} />
                        <AccountRow label="Accounts Receivable" value={assets.receivables} />
                        <AccountRow label="Inventory" value={assets.inventory} />
                        <AccountRow label="Total Current Assets" value={assets.totalCurrentAssets} isSubtotal />
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Non-Current Assets</h4>
                        <AccountRow label="Investments" value={assets.investments} />
                    </div>
                    <AccountRow label="Total Assets" value={assets.totalAssets} isTotal />
                </div>
                {/* Liabilities & Equity */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 border-b-2 pb-1">Liabilities & Equity</h3>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Current Liabilities</h4>
                        <AccountRow label="Accounts Payable" value={liabilities.payables} />
                        <AccountRow label="Total Current Liabilities" value={liabilities.totalCurrentLiabilities} isSubtotal />
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-slate-700 text-lg">Long-Term Liabilities</h4>
                        <AccountRow label="Loans" value={liabilities.loans} />
                        <AccountRow label="Total Long-Term Liabilities" value={liabilities.totalLongTermLiabilities} isSubtotal />
                    </div>
                    <AccountRow label="Total Liabilities" value={liabilities.totalLiabilities} isSubtotal />
                    
                    <div className="space-y-2 pt-4">
                        <h4 className="font-semibold text-slate-700 text-lg">Equity</h4>
                        <AccountRow label="Owner's Capital" value={equity.capital} />
                        <AccountRow label="Opening Balance Equity" value={equity.openingBalanceEquity} />
                        <AccountRow label="Retained Earnings (Net Income)" value={equity.retainedEarnings} />
                        <AccountRow label="Total Equity" value={equity.totalEquity} isSubtotal />
                    </div>
                    <AccountRow label="Total Liabilities & Equity" value={liabilities.totalLiabilities + equity.totalEquity} isTotal />
                </div>
            </div>
        </div>
    );
};

export default BalanceSheet;