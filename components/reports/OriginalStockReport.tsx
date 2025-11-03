import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import ReportFilters from './ReportFilters.tsx';
import { OriginalPurchased } from '../../types.ts';

const OriginalStockReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: '2020-01-01',
        endDate: today,
        supplierId: '',
        originalTypeId: '',
        batchNumber: '',
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const resetFilters = () => {
        setFilters({
            startDate: '2020-01-01',
            endDate: today,
            supplierId: '',
            originalTypeId: '',
            batchNumber: '',
        });
    };

    const reportData = React.useMemo(() => {
        const openingsByBatch = new Map<string, number>();
        state.originalOpenings.forEach(opening => {
            const key = `${opening.supplierId}-${opening.originalTypeId}-${opening.batchNumber}`;
            openingsByBatch.set(key, (openingsByBatch.get(key) || 0) + opening.opened);
        });

        return state.originalPurchases
            .map(purchase => {
                const openingKey = `${purchase.supplierId}-${purchase.originalTypeId}-${purchase.batchNumber}`;
                const openedQty = openingsByBatch.get(openingKey) || 0;
                const inHandQty = purchase.quantityPurchased - openedQty;

                const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
                const originalType = state.originalTypes.find(ot => ot.id === purchase.originalTypeId);

                return {
                    ...purchase,
                    supplierName: supplier?.name || 'N/A',
                    originalTypeName: originalType?.name || 'N/A',
                    opened: openedQty,
                    inHand: inHandQty,
                };
            })
            .filter(row => {
                const date = new Date(row.date);
                const startDate = new Date(filters.startDate);
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999); // Include the whole end day

                const dateMatch = date >= startDate && date <= endDate;
                const supplierMatch = !filters.supplierId || row.supplierId === filters.supplierId;
                const typeMatch = !filters.originalTypeId || row.originalTypeId === filters.originalTypeId;
                const batchMatch = !filters.batchNumber || row.batchNumber.toLowerCase().includes(filters.batchNumber.toLowerCase());

                return row.inHand > 0.001 && dateMatch && supplierMatch && typeMatch && batchMatch;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filters, state.originalPurchases, state.originalOpenings, state.suppliers, state.originalTypes]);

    const totals = React.useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.purchaseQuantity += row.quantityPurchased;
            acc.opened += row.opened;
            acc.inHand += row.inHand;
            return acc;
        }, { purchaseQuantity: 0, opened: 0, inHand: 0 });
    }, [reportData]);

    const exportHeaders = [
        { label: 'Supplier', key: 'supplierName' },
        { label: 'Batch Number', key: 'batchNumber' },
        { label: 'Original Type', key: 'originalTypeName' },
        { label: 'Purchase Quantity', key: 'quantityPurchased' },
        { label: 'Rate', key: 'rate' },
        { label: 'Opened', key: 'opened' },
        { label: 'In Hand', key: 'inHand' },
    ];
    
    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Original Stock Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`OriginalStockInHand`}
            />
            
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                    <select value={filters.supplierId} onChange={(e) => handleFilterChange('supplierId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Suppliers</option>
                        {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Original Type</label>
                    <select value={filters.originalTypeId} onChange={(e) => handleFilterChange('originalTypeId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Types</option>
                        {state.originalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                    <input type="text" value={filters.batchNumber} onChange={(e) => handleFilterChange('batchNumber', e.target.value)} placeholder="Search batch..." className="w-full p-2 border border-slate-300 rounded-md text-sm" />
                </div>
                 <button onClick={resetFilters} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm mt-auto">Reset Filters</button>
            </ReportFilters>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Supplier</th>
                            <th className="p-2 font-semibold text-slate-600">Batch Number</th>
                            <th className="p-2 font-semibold text-slate-600">Original Type</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Purchase Qty</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Rate</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Opened</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">In Hand</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{row.supplierName}</td>
                                <td className="p-2 text-slate-700 font-mono">{row.batchNumber}</td>
                                <td className="p-2 text-slate-700">{row.originalTypeName}</td>
                                <td className="p-2 text-slate-700 text-right">{(Number(row.quantityPurchased) || 0).toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right">{(Number(row.rate) || 0).toFixed(2)} {row.currency}</td>
                                <td className="p-2 text-slate-700 text-right">{(Number(row.opened) || 0).toLocaleString()}</td>
                                <td className="p-2 text-slate-700 text-right font-bold">{(Number(row.inHand) || 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold">
                            <td colSpan={5} className="p-2 text-right text-slate-800">Totals</td>
                            <td className="p-2 text-right text-slate-800">{(Number(totals.opened) || 0).toLocaleString()}</td>
                            <td className="p-2 text-right text-slate-800">{(Number(totals.inHand) || 0).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">No original stock found for the selected criteria.</p>
                )}
            </div>
        </div>
    );
};

export default OriginalStockReport;