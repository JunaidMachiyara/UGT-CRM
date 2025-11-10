import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { PackingType } from '../../types.ts';

const DailyProductionReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState({
        date: today,
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        return state.productions
            .filter(p => p.date === filters.date)
            .map(p => {
                const item = state.items.find(i => i.id === p.itemId);
                const packageTypesWithSize = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags];
                return {
                    id: p.id,
                    itemId: p.itemId,
                    itemName: item?.name || 'Unknown',
                    category: state.categories.find(c => c.id === item?.categoryId)?.name || 'N/A',
                    section: state.sections.find(s => s.id === item?.sectionId)?.name || 'N/A',
                    packingType: item?.packingType || PackingType.Kg,
                    packageSize: item?.packingType === PackingType.Kg ? 1 : (item && packageTypesWithSize.includes(item.packingType) ? item.baleSize : 'N/A'),
                    quantityProduced: p.quantityProduced,
                };
            })
            .sort((a, b) => a.itemName.localeCompare(b.itemName));
    }, [filters.date, state.productions, state.items, state.categories, state.sections]);
    
    const { totalPackages, totalKg } = useMemo(() => {
        let packages = 0;
        let kg = 0;
        reportData.forEach(row => {
            const itemDetails = state.items.find(i => i.id === row.itemId);
            if (!itemDetails) return;
    
            const isPackage = [PackingType.Bales, PackingType.Sacks, PackingType.Box, PackingType.Bags].includes(itemDetails.packingType);

            if (isPackage) {
                packages += row.quantityProduced;
                kg += row.quantityProduced * itemDetails.baleSize;
            } else { // It must be PackingType.Kg
                kg += row.quantityProduced;
            }
        });
        return { totalPackages: packages, totalKg: kg };
    }, [reportData, state.items]);

    const exportHeaders = [
        { label: 'Item ID', key: 'itemId' },
        { label: 'Item Name', key: 'itemName' },
        { label: 'Category', key: 'category' },
        { label: 'Section', key: 'section' },
        { label: 'Packing Type', key: 'packingType' },
        { label: 'Package Size (Kg)', key: 'packageSize' },
        { label: 'Quantity Produced', key: 'quantityProduced' },
    ];

    return (
        <div className="report-print-area">
            <ReportToolbar
                title={`Daily Production Report for ${filters.date}`}
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`DailyProduction_${filters.date}`}
            />
            <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end no-print">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                        type="date"
                        value={filters.date}
                        onChange={(e) => handleFilterChange('date', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md text-sm"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item Name</th>
                            <th className="p-2 font-semibold text-slate-600">Category</th>
                            <th className="p-2 font-semibold text-slate-600">Section</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Package Size (Kg)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Quantity Produced</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-700">{row.itemName} ({row.itemId})</td>
                                <td className="p-2 text-slate-700">{row.category}</td>
                                <td className="p-2 text-slate-700">{row.section}</td>
                                <td className="p-2 text-slate-700 text-right">{row.packageSize}</td>
                                <td className="p-2 text-slate-700 text-right font-medium">{row.quantityProduced.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td colSpan={3} className="p-2 text-right">Totals</td>
                            <td className="p-2 text-right"></td>
                            <td className="p-2 text-right">{totalPackages.toLocaleString()} Packages / {totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} Kg</td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">No production entries for this date.</p>
                )}
            </div>
        </div>
    );
};

export default DailyProductionReport;