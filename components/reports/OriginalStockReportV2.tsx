import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { OriginalPurchased } from '../../types.ts';

const OriginalStockReportV2: React.FC = () => {
    const { state } = useData();

    // Stable and performant data calculation
    const reportData = React.useMemo(() => {
        const openingsByBatch = new Map<string, number>();
        state.originalOpenings.forEach(opening => {
            const key = `${opening.supplierId}-${opening.originalTypeId}-${opening.batchNumber}`;
            openingsByBatch.set(key, (openingsByBatch.get(key) || 0) + opening.opened);
        });

        return state.originalPurchases.map(purchase => {
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
        }).filter(row => row.inHand > 0) // Only show items with stock
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [state.originalPurchases, state.originalOpenings, state.suppliers, state.originalTypes]); // Minimal dependencies

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
                title="Original Stock In Hand Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`OriginalStockInHand`}
            />
            
            <p className="text-sm text-slate-600 mb-4">
                This report shows all original purchase batches that still have stock in hand.
            </p>

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
                    <p className="text-center text-slate-500 py-6">No original stock currently in hand.</p>
                )}
            </div>
        </div>
    );
};

export default OriginalStockReportV2;