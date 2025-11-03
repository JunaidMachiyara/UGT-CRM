import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import ReportFilters from './ReportFilters.tsx';
import ReportToolbar from './ReportToolbar.tsx';
import { InvoiceStatus, PackingType } from '../../types.ts';

const FeasibilityReport: React.FC = () => {
    const { state } = useData();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        startDate: firstDayOfYear,
        endDate: today,
        categoryId: '',
        sectionId: '',
    });

    const handleFilterChange = (filterName: string, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const reportData = useMemo(() => {
        const productionsInPeriod = state.productions.filter(p => p.date >= filters.startDate && p.date <= filters.endDate);
        const salesInvoicesInPeriod = state.salesInvoices.filter(s => s.date >= filters.startDate && s.date <= filters.endDate && s.status !== InvoiceStatus.Unposted);

        let itemsToAnalyze = state.items;
        if (filters.categoryId) {
            itemsToAnalyze = itemsToAnalyze.filter(item => item.categoryId === filters.categoryId);
        }
        if (filters.sectionId) {
            itemsToAnalyze = itemsToAnalyze.filter(item => item.sectionId === filters.sectionId);
        }

        return itemsToAnalyze.map(item => {
            const itemProductions = productionsInPeriod.filter(p => p.itemId === item.id);
            const itemSales = salesInvoicesInPeriod.flatMap(inv => inv.items).filter(i => i.itemId === item.id);

            const productionFreq = new Set(itemProductions.map(p => p.date)).size;
            const salesFreq = new Set(salesInvoicesInPeriod.filter(inv => inv.items.some(i => i.itemId === item.id)).map(inv => inv.id)).size;

            const totalProdKg = itemProductions.reduce((sum, p) => {
                const kg = item.packingType === PackingType.Bales ? p.quantityProduced * item.baleSize : p.quantityProduced;
                return sum + kg;
            }, 0);

            const totalSalesKg = itemSales.reduce((sum, i) => {
                const kg = item.packingType === PackingType.Bales ? i.quantity * item.baleSize : i.quantity;
                return sum + kg;
            }, 0);

            const totalSalesValue = itemSales.reduce((sum, i) => {
                const kg = item.packingType === PackingType.Bales ? i.quantity * item.baleSize : i.quantity;
                return sum + (kg * (i.rate || 0));
            }, 0);

            const avgActualSalesPrice = totalSalesKg > 0 ? totalSalesValue / totalSalesKg : 0;
            const marginPerKg = avgActualSalesPrice - item.avgProductionPrice;
            const totalProfitLoss = totalSalesKg * marginPerKg;

            let score = 0;
            if (item.avgProductionPrice > 0) {
                 if (marginPerKg > 0) score += (marginPerKg / item.avgProductionPrice) * 50;
                 else score += (marginPerKg / item.avgProductionPrice) * 100;
            }
           
            if (salesFreq > 5) score += 25;
            else if (salesFreq > 1) score += salesFreq * 5;

            if (totalSalesKg > 0) {
                const ratio = totalProdKg / totalSalesKg;
                if (ratio >= 0.8 && ratio <= 1.5) score += 25;
                else if (ratio >= 0.5 && ratio <= 2.0) score += 10;
            } else if (totalProdKg > 0) {
                score -= 10;
            }

            let feasibility;
            if (score > 75) feasibility = 'Excellent';
            else if (score > 50) feasibility = 'Good';
            else if (score > 25) feasibility = 'Average';
            else if (score > 0) feasibility = 'Review';
            else feasibility = 'Poor';
            
            const category = state.categories.find(c => c.id === item.categoryId);
            const section = state.sections.find(s => s.id === item.sectionId);

            return {
                id: item.id,
                name: item.name,
                categoryName: category?.name || 'N/A',
                sectionName: section?.name || 'N/A',
                productionFreq,
                salesFreq,
                totalProdKg,
                totalSalesKg,
                avgProductionPrice: item.avgProductionPrice,
                avgActualSalesPrice,
                marginPerKg,
                totalProfitLoss,
                feasibility
            };
        }).filter(item => item.totalProdKg > 0 || item.totalSalesKg > 0)
          .sort((a,b) => b.totalProfitLoss - a.totalProfitLoss);

    }, [filters, state]);
    
    const totals = useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.totalProfitLoss += row.totalProfitLoss;
            return acc;
        }, { totalProfitLoss: 0 });
    }, [reportData]);

    const exportHeaders = [
        { label: 'Item Name', key: 'name' },
        { label: 'Category', key: 'categoryName' },
        { label: 'Section', key: 'sectionName' },
        { label: 'Production Freq (Days)', key: 'productionFreq' },
        { label: 'Sales Freq (Invoices)', key: 'salesFreq' },
        { label: 'Total Prod (Kg)', key: 'totalProdKg' },
        { label: 'Total Sales (Kg)', key: 'totalSalesKg' },
        { label: 'Avg Prod Price/Kg', key: 'avgProductionPrice' },
        { label: 'Avg Sales Price/Kg', key: 'avgActualSalesPrice' },
        { label: 'Margin/Kg', key: 'marginPerKg' },
        { label: 'Total P/L', key: 'totalProfitLoss' },
        { label: 'Feasibility', key: 'feasibility' },
    ];
    
    const formatCurrency = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    const getFeasibilityColor = (feasibility: string) => {
        switch (feasibility) {
            case 'Excellent': return 'bg-green-100 text-green-800';
            case 'Good': return 'bg-blue-100 text-blue-800';
            case 'Average': return 'bg-slate-100 text-slate-800';
            case 'Review': return 'bg-yellow-100 text-yellow-800';
            case 'Poor': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };


    return (
        <div className="report-print-area">
            <ReportToolbar
                title="Feasibility Report"
                exportData={reportData}
                exportHeaders={exportHeaders}
                exportFilename={`FeasibilityReport_${filters.startDate}_to_${filters.endDate}`}
            />
            <ReportFilters filters={filters} onFilterChange={handleFilterChange}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select value={filters.categoryId} onChange={(e) => handleFilterChange('categoryId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Categories</option>
                        {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                    <select value={filters.sectionId} onChange={(e) => handleFilterChange('sectionId', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm">
                        <option value="">All Sections</option>
                        {state.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </ReportFilters>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="p-2 font-semibold text-slate-600">Item</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Prod. Freq (Days)</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Sales Freq (Inv)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Prod. (Kg)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Sales (Kg)</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Avg. Prod Price</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Avg. Sales Price</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Margin/Kg</th>
                            <th className="p-2 font-semibold text-slate-600 text-right">Total P/L</th>
                            <th className="p-2 font-semibold text-slate-600 text-center">Feasibility</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(item => (
                            <tr key={item.id} className="border-b hover:bg-slate-50">
                                <td className="p-2 text-slate-800">{item.name} <span className="text-xs text-slate-500">({item.id})</span></td>
                                <td className="p-2 text-slate-800 text-center">{item.productionFreq}</td>
                                <td className="p-2 text-slate-800 text-center">{item.salesFreq}</td>
                                <td className="p-2 text-slate-800 text-right">{item.totalProdKg.toFixed(2)}</td>
                                <td className="p-2 text-slate-800 text-right">{item.totalSalesKg.toFixed(2)}</td>
                                <td className="p-2 text-slate-800 text-right">{formatCurrency(item.avgProductionPrice)}</td>
                                <td className="p-2 text-slate-800 text-right">{formatCurrency(item.avgActualSalesPrice)}</td>
                                <td className={`p-2 text-right font-medium ${item.marginPerKg >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(item.marginPerKg)}</td>
                                <td className={`p-2 text-right font-bold ${item.totalProfitLoss >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatCurrency(item.totalProfitLoss)}</td>
                                <td className="p-2 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getFeasibilityColor(item.feasibility)}`}>
                                        {item.feasibility}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                     <tfoot>
                        <tr className="bg-slate-100 font-bold">
                            <td colSpan={8} className="p-2 text-right text-slate-800">Grand Total P/L</td>
                            <td className={`p-2 text-right text-lg ${totals.totalProfitLoss >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatCurrency(totals.totalProfitLoss)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                 {reportData.length === 0 && (
                    <p className="text-center text-slate-500 py-6">
                        No items with sales or production activity match the current filters.
                    </p>
                )}
            </div>
        </div>
    );
};

export default FeasibilityReport;