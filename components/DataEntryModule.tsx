import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { OriginalOpening, Production, OriginalType, PackingType, UserProfile, Module, InvoiceStatus, Item, JournalEntry, JournalEntryType, Currency, SalesInvoice, OriginalPurchased, LogisticsEntry, LogisticsStatus, FinishedGoodsPurchase, DocumentStatus } from '../types.ts';
import { generateInvoiceId } from '../utils/idGenerator.ts';
import SalesInvoiceModule from './SalesInvoiceModule.tsx';
import OngoingOrdersModule from './OngoingOrdersModule.tsx';
import PurchasesModule from './PurchasesModule.tsx';
import ItemSelector from './ui/ItemSelector.tsx';
import Modal from './ui/Modal.tsx';
import StockLotModule from './StockLotModule.tsx';
import CurrencyInput from './ui/CurrencyInput.tsx';

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

const OriginalOpeningForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], supplierId: '', originalTypeId: '', batchNumber: '', opened: '' });
    const [supplierOriginalTypes, setSupplierOriginalTypes] = useState<OriginalType[]>([]);
    const [availableBatches, setAvailableBatches] = useState<{ batch: string, stock: number }[]>([]);
    const [totalKg, setTotalKg] = useState(0);
    const [availableStock, setAvailableStock] = useState(0);
    const supplierRef = useRef<HTMLSelectElement>(null);
    const originalTypeRef = useRef<HTMLSelectElement>(null);
    const batchNumberRef = useRef<HTMLSelectElement>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string; opened: string; originalTypeId: string; supplierId: string, batchNumber: string; } | null>(null);
    
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];


    const rawMaterialStock = useMemo(() => {
        const stock: { [supplierId: string]: { [originalTypeId: string]: { [batchNumber: string]: number } } } = {};

        state.originalPurchases.forEach(p => {
            stock[p.supplierId] = stock[p.supplierId] || {};
            stock[p.supplierId][p.originalTypeId] = stock[p.supplierId][p.originalTypeId] || {};
            stock[p.supplierId][p.originalTypeId][p.batchNumber] = (stock[p.supplierId][p.originalTypeId][p.batchNumber] || 0) + p.quantityPurchased;
        });

        state.originalOpenings.forEach(o => {
            if (stock[o.supplierId]?.[o.originalTypeId]?.[o.batchNumber] !== undefined) {
                stock[o.supplierId][o.originalTypeId][o.batchNumber] -= o.opened;
            } else {
                 stock[o.supplierId] = stock[o.supplierId] || {};
                 stock[o.supplierId][o.originalTypeId] = stock[o.supplierId][o.originalTypeId] || {};
                 stock[o.supplierId][o.originalTypeId][o.batchNumber] = -o.opened;
            }
        });

        return stock;
    }, [state.originalPurchases, state.originalOpenings]);

    const suppliersWithStock = useMemo(() => {
        const supplierIdsWithStock = Object.keys(rawMaterialStock).filter(supplierId => {
            const typesForSupplier = rawMaterialStock[supplierId];
            return Object.values(typesForSupplier).some(batchesForType =>
                Object.values(batchesForType).some(stock => (stock as number) > 0)
            );
        });
        return state.suppliers.filter(s => supplierIdsWithStock.includes(s.id));
    }, [rawMaterialStock, state.suppliers]);

    useEffect(() => {
        if (formData.supplierId && rawMaterialStock[formData.supplierId]) {
            const typesWithStockIds = Object.keys(rawMaterialStock[formData.supplierId]).filter(
                originalTypeId => Object.values(rawMaterialStock[formData.supplierId][originalTypeId]).some(stock => (stock as number) > 0)
            );
            const types = state.originalTypes.filter(ot => typesWithStockIds.includes(ot.id));
            setSupplierOriginalTypes(types);
        } else {
            setSupplierOriginalTypes([]);
        }
        setFormData(f => ({ ...f, originalTypeId: '', batchNumber: '', opened: '' }));
    }, [formData.supplierId, rawMaterialStock, state.originalTypes]);

    useEffect(() => {
        if (formData.supplierId && formData.originalTypeId && rawMaterialStock[formData.supplierId]?.[formData.originalTypeId]) {
            const batches = rawMaterialStock[formData.supplierId][formData.originalTypeId];
            const batchesWithStock = Object.entries(batches)
                .filter(([, stock]) => (stock as number) > 0)
                .map(([batch, stock]) => ({ batch, stock: stock as number }));
            setAvailableBatches(batchesWithStock);
        } else {
            setAvailableBatches([]);
        }
        setFormData(f => ({ ...f, batchNumber: '', opened: '' }));
    }, [formData.originalTypeId, formData.supplierId, rawMaterialStock]);
    

    useEffect(() => {
        if (formData.supplierId && formData.originalTypeId && formData.batchNumber) {
            const stock = rawMaterialStock[formData.supplierId]?.[formData.originalTypeId]?.[formData.batchNumber] || 0;
            setAvailableStock(stock);
        } else {
            setAvailableStock(0);
        }
    }, [formData.supplierId, formData.originalTypeId, formData.batchNumber, rawMaterialStock]);
    
    useEffect(() => {
        const openedValue = Number(formData.opened) || 0;
        const originalType = state.originalTypes.find(ot => ot.id === formData.originalTypeId);

        if (originalType && openedValue > 0) {
            if (originalType.packingType === PackingType.Bales || originalType.packingType === PackingType.Sacks) {
                setTotalKg(openedValue * (originalType.packingSize || 0));
            } else {
                setTotalKg(openedValue);
            }
        } else {
            setTotalKg(0);
        }
    }, [formData.opened, formData.originalTypeId, state.originalTypes]);

    const openingsForDate = useMemo(() => {
        return state.originalOpenings
            .filter(o => o.date === formData.date)
            .map(o => {
                const supplier = state.suppliers.find(s => s.id === o.supplierId);
                const originalType = state.originalTypes.find(ot => ot.id === o.originalTypeId);
                return {
                    ...o,
                    supplierName: supplier?.name || 'Unknown',
                    originalTypeName: originalType?.name || 'Unknown',
                };
            })
            .reverse(); // Show latest entry first
    }, [formData.date, state.originalOpenings, state.suppliers, state.originalTypes]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { date, supplierId, originalTypeId, batchNumber, opened } = formData;
        const openedNum = Number(opened);

        if (!date || !supplierId || !originalTypeId || !batchNumber || !opened || openedNum <= 0) {
            alert("Please fill all fields correctly.");
            return;
        }

        const stock = rawMaterialStock[supplierId]?.[originalTypeId]?.[batchNumber] || 0;
        if (openedNum > stock) {
            alert(`Warning: You are opening ${openedNum} units, but only ${stock} are available. This will result in negative stock.`);
        }

        const newOpening: OriginalOpening = {
            id: `oo_${Date.now()}`,
            date,
            supplierId,
            originalTypeId,
            batchNumber,
            opened: openedNum,
            totalKg: totalKg,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'originalOpenings', data: newOpening } });
        setFormData({ ...formData, supplierId: '', originalTypeId: '', batchNumber: '', opened: '' });
        showNotification("Data Submitted");
        supplierRef.current?.focus();
    };
    
    const handleOpenEditModal = (opening: OriginalOpening) => {
        setEditingItem({
            id: opening.id,
            opened: String(opening.opened),
            originalTypeId: opening.originalTypeId,
            supplierId: opening.supplierId,
            batchNumber: opening.batchNumber,
        });
        setIsEditModalOpen(true);
    };
    
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    const handleUpdateOpening = () => {
        if (!editingItem) return;
        
        const originalOpening = state.originalOpenings.find(o => o.id === editingItem.id);
        if (!originalOpening) return;
        
        const openedNum = Number(editingItem.opened);
        if (isNaN(openedNum) || openedNum <= 0) {
            alert("Please enter a valid, positive quantity.");
            return;
        }

        const stock = rawMaterialStock[originalOpening.supplierId]?.[originalOpening.originalTypeId]?.[originalOpening.batchNumber] || 0;
        const availableStockForEdit = stock + originalOpening.opened;

        if (openedNum > availableStockForEdit) {
           alert(`Warning: You are updating to ${openedNum} units, but only ${availableStockForEdit} are available in total for this batch. This will result in negative stock.`);
        }
        
        const originalType = state.originalTypes.find(ot => ot.id === originalOpening.originalTypeId);
        let newTotalKg = 0;
        if (originalType) {
            if (originalType.packingType === PackingType.Bales || originalType.packingType === PackingType.Sacks) {
                newTotalKg = openedNum * (originalType.packingSize || 0);
            } else {
                newTotalKg = openedNum;
            }
        }

        dispatch({
            type: 'UPDATE_ENTITY',
            payload: {
                entity: 'originalOpenings',
                data: { id: editingItem.id, opened: openedNum, totalKg: newTotalKg }
            }
        });
        handleCloseEditModal();
        showNotification("Entry updated successfully.");
    };

    const handleDeleteOpening = (id: string) => {
        if (window.confirm("Are you sure you want to delete this opening entry? This will return the items to raw material stock.")) {
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'originalOpenings', id } });
            showNotification("Entry deleted successfully.");
        }
    };
    
    const originalTypeForEditing = useMemo(() => {
        if (!editingItem) return null;
        return state.originalTypes.find(ot => ot.id === editingItem.originalTypeId);
    }, [editingItem, state.originalTypes]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
            <div className="md:col-span-3">
                 <h3 className="text-lg font-bold text-slate-700 mb-4">New Opening Entry</h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} min={minDate} className="mt-1 w-full p-2 rounded-md"/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Supplier</label><select ref={supplierRef} value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value, originalTypeId: '', batchNumber: '', opened: ''})} className="mt-1 w-full p-2 rounded-md"><option value="">Select Supplier with Stock</option>{suppliersWithStock.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Original Type</label>
                        <select ref={originalTypeRef} value={formData.originalTypeId} onChange={e => setFormData({...formData, originalTypeId: e.target.value, batchNumber: '', opened: ''})} className="mt-1 w-full p-2 rounded-md" disabled={!formData.supplierId}>
                            <option value="">Select Type</option>
                            {supplierOriginalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                        </select>
                    </div>
                     <div><label className="block text-sm font-medium text-slate-700">Batch Number</label>
                        <select ref={batchNumberRef} value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value, opened: ''})} className="mt-1 w-full p-2 rounded-md" disabled={!formData.originalTypeId}>
                            <option value="">Select Batch</option>
                            {availableBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch} (Stock: {b.stock})</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Available Stock (units)</label>
                        <input type="number" value={availableStock} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500" />
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Opened (units)</label><input type="number" value={formData.opened} onChange={e => setFormData({...formData, opened: e.target.value})} className="mt-1 w-full p-2 rounded-md" min="1" disabled={!formData.batchNumber}/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Total Kg</label><input type="number" value={totalKg} readOnly className="mt-1 w-full p-2 rounded-md bg-slate-200 text-slate-500"/></div>
                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Submit The Entry</button>
                </form>
            </div>
            <div className="md:col-span-7">
                <h3 className="text-lg font-bold text-slate-700 mb-4">Entries for {formData.date}</h3>
                {openingsForDate.length > 0 ? (
                    <div className="overflow-y-auto border rounded-md max-h-96">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="sticky top-0 bg-slate-100 z-10">
                                <tr>
                                    <th className="p-2 font-semibold text-slate-600">Supplier</th>
                                    <th className="p-2 font-semibold text-slate-600">Original Type</th>
                                    <th className="p-2 font-semibold text-slate-600">Batch #</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Opened</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                    {userProfile?.isAdmin && <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {openingsForDate.map((op) => (
                                    <tr key={op.id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-slate-700">{op.supplierName}</td>
                                        <td className="p-2 text-slate-700">{op.originalTypeName}</td>
                                        <td className="p-2 text-slate-700 font-mono">{op.batchNumber}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{op.opened.toLocaleString()}</td>
                                        <td className="p-2 text-slate-700 text-right">{op.totalKg.toLocaleString()}</td>
                                        {userProfile?.isAdmin && (
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleOpenEditModal(op)} className="text-blue-600 hover:text-blue-800 mr-2 text-xs font-semibold">Edit</button>
                                                <button onClick={() => handleDeleteOpening(op.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-8 border rounded-md">No entries for this date yet.</div>
                )}
            </div>

             {editingItem && (
                <Modal isOpen={isEditModalOpen} onClose={handleCloseEditModal} title="Edit Opening Entry" isForm>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Original Type</label>
                            <p className="p-2 border border-slate-200 rounded-md bg-slate-100 text-slate-600">
                                {originalTypeForEditing?.name} ({editingItem.originalTypeId})
                            </p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                            <p className="p-2 border border-slate-200 rounded-md bg-slate-100 text-slate-600 font-mono">
                                {editingItem.batchNumber}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Opened (units)</label>
                             <input 
                                type="number" 
                                value={editingItem.opened} 
                                onChange={e => setEditingItem({...editingItem, opened: e.target.value})}
                                className="mt-1 w-full p-2 rounded-md"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end pt-4 space-x-2">
                            <button onClick={handleCloseEditModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Cancel</button>
                            <button onClick={handleUpdateOpening} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Changes</button>
                        </div>
                    </div>
                </Modal>
             )}
        </div>
    );
};

const ProductionForm: React.FC<{ 
    showNotification: (msg: string) => void;
    requestSetupItem: () => void;
    userProfile: UserProfile | null;
}> = ({ showNotification, requestSetupItem, userProfile }) => {
    const { state, dispatch } = useData();
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], itemId: '', quantityProduced: '' });
    const [error, setError] = useState<string | null>(null);

    type StagedProduction = Production & { itemName: string; itemCategory: string; baleSize: number | 'N/A' };
    const [stagedProductions, setStagedProductions] = useState<StagedProduction[]>([]);
    const [tempNextBaleNumbers, setTempNextBaleNumbers] = useState<Record<string, number>>({});
    
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    type SummaryProductionItem = StagedProduction & { yesterdayBales: number; totalKg: number };
    const [summaryData, setSummaryData] = useState<SummaryProductionItem[]>([]);
    const [isPreviousEntriesOpen, setIsPreviousEntriesOpen] = useState(false);

    const itemRef = useRef<HTMLInputElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];
    
    useEffect(() => {
        // When date changes, clear the staged productions for the new day
        setStagedProductions([]);
        setTempNextBaleNumbers({});
    }, [formData.date]);

    const previouslySavedProductions = useMemo(() => {
        return state.productions
            .filter(p => p.date === formData.date)
            .map(p => {
                const itemDetails = state.items.find(i => i.id === p.itemId);
                return {
                    ...p,
                    itemName: itemDetails?.name || 'N/A',
                    itemCategory: state.categories.find(c => c.id === itemDetails?.categoryId)?.name || 'N/A',
                };
            })
            .sort((a, b) => (a.startBaleNumber || 0) - (b.startBaleNumber || 0));
    }, [formData.date, state.productions, state.items, state.categories]);

    const handleAddToList = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const { date, itemId, quantityProduced } = formData;
        const quantityNum = Number(quantityProduced);

        if (!date || !itemId || !quantityProduced || quantityNum <= 0) {
            setError("Please fill all fields correctly.");
            return;
        }

        const itemDetails = state.items.find(i => i.id === itemId);
        if (!itemDetails) {
            setError("Selected item not found.");
            return;
        }

        let newProduction: StagedProduction = {
            id: `temp_${Date.now()}`,
            date, itemId, quantityProduced: quantityNum,
            itemName: itemDetails.name,
            itemCategory: state.categories.find(c => c.id === itemDetails.categoryId)?.name || 'N/A',
            baleSize: itemDetails.packingType === PackingType.Bales ? itemDetails.baleSize : 'N/A',
        };

        if (itemDetails.packingType === PackingType.Bales) {
            const startBaleNumber = tempNextBaleNumbers[itemId] || itemDetails.nextBaleNumber || 1;
            const endBaleNumber = startBaleNumber + quantityNum - 1;
            newProduction = { ...newProduction, startBaleNumber, endBaleNumber };
            setTempNextBaleNumbers(prev => ({ ...prev, [itemId]: endBaleNumber + 1 }));
        }

        setStagedProductions(prev => [...prev, newProduction]);
        setFormData({ ...formData, itemId: '', quantityProduced: '' });
        showNotification("Entry added to list.");
        itemRef.current?.focus();
    };
    
    const handleRemoveFromList = (idToRemove: string) => {
        const itemToRemove = stagedProductions.find(p => p.id === idToRemove);
        if (!itemToRemove) return;

        const newStagedProductions = stagedProductions.filter(p => p.id !== idToRemove);
        const itemDetails = state.items.find(i => i.id === itemToRemove.itemId);

        if (itemDetails?.packingType !== PackingType.Bales) {
            setStagedProductions(newStagedProductions);
            return;
        }

        const itemsOfSameType = newStagedProductions
            .filter(p => p.itemId === itemToRemove.itemId)
            .sort((a,b) => (a.startBaleNumber || 0) - (b.startBaleNumber || 0));

        if (itemsOfSameType.length > 0) {
            let currentBaleNumber = itemDetails.nextBaleNumber || 1;
            
            const updatedProductions = newStagedProductions.map(p => {
                if (p.itemId === itemToRemove.itemId) {
                    const start = currentBaleNumber;
                    const end = start + p.quantityProduced - 1;
                    currentBaleNumber = end + 1;
                    return { ...p, startBaleNumber: start, endBaleNumber: end };
                }
                return p;
            });
            setStagedProductions(updatedProductions);
            setTempNextBaleNumbers(prev => ({ ...prev, [itemToRemove.itemId]: currentBaleNumber }));
        } else {
            setStagedProductions(newStagedProductions);
            setTempNextBaleNumbers(prev => {
                const newTemp = { ...prev };
                delete newTemp[itemToRemove.itemId];
                return newTemp;
            });
        }
    };

    const prepareProductionSummary = () => {
        if (stagedProductions.length === 0) {
            showNotification("No entries to save.");
            return;
        }
    
        const currentDate = new Date(formData.date);
        currentDate.setDate(currentDate.getDate() - 1);
        const yesterdayStr = currentDate.toISOString().split('T')[0];
    
        const yesterdayProductions = state.productions.filter(p => p.date === yesterdayStr);
    
        const newSummaryData = stagedProductions.map(prod => {
            const yesterdayBales = yesterdayProductions
                .filter(p => p.itemId === prod.itemId)
                .reduce((sum, p) => {
                    const itemDetails = state.items.find(i => i.id === p.itemId);
                    return itemDetails?.packingType === PackingType.Bales ? sum + p.quantityProduced : sum;
                }, 0);
            
            const totalKg = prod.baleSize !== 'N/A' ? prod.quantityProduced * (prod.baleSize as number) : prod.quantityProduced;
            
            return {
                ...prod,
                yesterdayBales,
                totalKg
            };
        });
    
        setSummaryData(newSummaryData);
        setIsSummaryModalOpen(true);
    };
    
    const handleFinalizeProduction = () => {
        if (stagedProductions.length === 0) return;

        stagedProductions.forEach(prod => {
            const finalProd: Production = {
                id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                date: formData.date,
                itemId: prod.itemId,
                quantityProduced: prod.quantityProduced,
                startBaleNumber: prod.startBaleNumber,
                endBaleNumber: prod.endBaleNumber,
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: finalProd } });
        });

        for (const itemId in tempNextBaleNumbers) {
            dispatch({
                type: 'UPDATE_ENTITY',
                payload: { entity: 'items', data: { id: itemId, nextBaleNumber: tempNextBaleNumbers[itemId] } }
            });
        }

        setStagedProductions([]);
        setTempNextBaleNumbers({});
        showNotification(`${stagedProductions.length} production entries saved successfully.`);
        setIsSummaryModalOpen(false);
        setSummaryData([]);
    };

    const { totalBalesForDate, totalKgForDate } = useMemo(() => {
        return stagedProductions.reduce((acc, prod) => {
            if (prod.baleSize !== 'N/A') {
                acc.totalBales += prod.quantityProduced;
                acc.totalKg += prod.quantityProduced * (prod.baleSize as number);
            } else {
                acc.totalKg += prod.quantityProduced;
            }
            return acc;
        }, { totalBalesForDate: 0, totalKgForDate: 0 });
    }, [stagedProductions]);
    
    const itemDetails = state.items.find(i => i.id === formData.itemId);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8">
            <div className="md:col-span-3">
                <h3 className="text-lg font-bold text-slate-700 mb-4">New Production Entry</h3>
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p>{error}</p></div>}
                <form onSubmit={handleAddToList} className="space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} min={minDate} className="mt-1 w-full p-2 rounded-md" /></div>
                    <div className="space-y-1">
                        <button type="button" onClick={requestSetupItem} className="text-xs text-blue-600 hover:underline float-right">Item not found? Add new item.</button>
                        <label className="block text-sm font-medium text-slate-700">Item</label>
                        <ItemSelector
                            inputRef={itemRef}
                            items={state.items.filter(i => i.id !== 'GRBG-001')}
                            selectedItemId={formData.itemId}
                            onSelect={(id) => setFormData(f => ({ ...f, itemId: id }))}
                        />
                        {itemDetails && <div className="text-xs text-slate-500 mt-1">Packing: {itemDetails.packingType}, Size: {itemDetails.baleSize} Kg</div>}
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700">Quantity Produced (units)</label><input ref={quantityRef} type="number" value={formData.quantityProduced} onChange={e => setFormData({ ...formData, quantityProduced: e.target.value })} className="mt-1 w-full p-2 rounded-md" min="1" disabled={!formData.itemId} /></div>

                    <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add to List</button>
                </form>
            </div>
            <div className="md:col-span-7">
                <h3 className="text-lg font-bold text-slate-700 mb-2">Staged Entries for {formData.date}</h3>
                <div className="flex justify-end text-sm font-semibold text-slate-600 mb-2 space-x-4">
                    <span>Total Bales: {totalBalesForDate.toLocaleString()}</span>
                    <span>Total Kg: {totalKgForDate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {stagedProductions.length > 0 ? (
                    <div className="overflow-y-auto border rounded-md max-h-96">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="sticky top-0 bg-slate-100 z-10">
                                <tr>
                                    <th className="p-2 font-semibold text-slate-600">Item</th>
                                    <th className="p-2 font-semibold text-slate-600">Category</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Qty</th>
                                    <th className="p-2 font-semibold text-slate-600 text-right">Bale Nos.</th>
                                    {userProfile?.isAdmin && <th className="p-2 font-semibold text-slate-600 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {stagedProductions.map((p) => (
                                    <tr key={p.id} className="border-b hover:bg-slate-50">
                                        <td className="p-2 text-slate-700">{p.itemName}</td>
                                        <td className="p-2 text-slate-700">{p.itemCategory}</td>
                                        <td className="p-2 text-slate-700 text-right font-medium">{p.quantityProduced.toLocaleString()}</td>
                                        <td className="p-2 text-slate-700 text-right font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                        {userProfile?.isAdmin && (
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleRemoveFromList(p.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Remove</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-8 border rounded-md">No entries staged for this date yet.</div>
                )}
                {stagedProductions.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={prepareProductionSummary} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">
                            Finalize & Save Production
                        </button>
                    </div>
                )}

                {previouslySavedProductions.length > 0 && (
                    <div className="mt-6 border rounded-md">
                        <button
                            type="button"
                            className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-t-md"
                            onClick={() => setIsPreviousEntriesOpen(!isPreviousEntriesOpen)}
                        >
                            <h4 className="font-semibold text-slate-700">Previously Saved Entries for {formData.date}</h4>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transform transition-transform ${isPreviousEntriesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {isPreviousEntriesOpen && (
                             <div className="p-2">
                                <div className="overflow-y-auto border rounded-md max-h-60">
                                    <table className="w-full text-left table-auto text-sm">
                                        <thead className="sticky top-0 bg-slate-100 z-10">
                                            <tr>
                                                <th className="p-2 font-semibold text-slate-600">Item</th>
                                                <th className="p-2 font-semibold text-slate-600">Category</th>
                                                <th className="p-2 font-semibold text-slate-600 text-right">Qty</th>
                                                <th className="p-2 font-semibold text-slate-600 text-right">Bale Nos.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previouslySavedProductions.map((p) => (
                                                <tr key={p.id} className="border-b">
                                                    <td className="p-2 text-slate-600">{p.itemName}</td>
                                                    <td className="p-2 text-slate-600">{p.itemCategory}</td>
                                                    <td className="p-2 text-slate-600 text-right">{p.quantityProduced.toLocaleString()}</td>
                                                    <td className="p-2 text-slate-600 text-right font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {isSummaryModalOpen && (
                <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="Confirm Production Summary" size="5xl">
                    <div className="space-y-4 text-slate-800">
                        <p className="text-sm text-slate-600">Please review the production entries for <strong>{formData.date}</strong> before saving.</p>
                        <div className="overflow-y-auto border rounded-md max-h-96">
                            <table className="w-full text-left table-auto text-sm">
                                <thead className="sticky top-0 bg-slate-100 z-10">
                                    <tr>
                                        <th className="p-2 font-semibold text-slate-600">Item</th>
                                        <th className="p-2 font-semibold text-slate-600">Category</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Qty (Bales)</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Bale Size</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Total Kg</th>
                                        <th className="p-2 font-semibold text-slate-600 text-center">Bale Nos.</th>
                                        <th className="p-2 font-semibold text-slate-600 text-right">Yesterday's Bales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map(p => (
                                        <tr key={p.id} className="border-b">
                                            <td className="p-2">{p.itemName}</td>
                                            <td className="p-2">{p.itemCategory}</td>
                                            <td className="p-2 text-right">{p.quantityProduced.toLocaleString()}</td>
                                            <td className="p-2 text-right">{p.baleSize}</td>
                                            <td className="p-2 text-right font-medium">{p.totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-center font-mono text-xs">{p.startBaleNumber ? `${p.startBaleNumber}-${p.endBaleNumber}` : '-'}</td>
                                            <td className="p-2 text-right">{p.yesterdayBales > 0 ? p.yesterdayBales.toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end text-sm font-semibold space-x-6 pt-4 border-t">
                             <span>Total Bales: {summaryData.reduce((sum, p) => sum + (p.baleSize !== 'N/A' ? p.quantityProduced : 0), 0).toLocaleString()}</span>
                            <span>Total Kg: {summaryData.reduce((sum, p) => sum + p.totalKg, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 space-x-2">
                        <button onClick={() => setIsSummaryModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Go Back</button>
                        <button onClick={handleFinalizeProduction} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save and Continue</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- START: Re-baling Form ---
interface RebalingListItem {
    itemId: string;
    itemName: string;
    quantity: number;
    totalKg: number;
}

const RebalingForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [fromItems, setFromItems] = useState<RebalingListItem[]>([]);
    const [toItems, setToItems] = useState<RebalingListItem[]>([]);

    const [fromItem, setFromItem] = useState({ itemId: '', quantity: '' });
    const [toItem, setToItem] = useState({ itemId: '', quantity: '' });
    
    const fromItemRef = useRef<HTMLInputElement>(null);
    const toItemRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const fromItemStock = useMemo(() => {
        if (!fromItem.itemId) return 0;
        const item = state.items.find(i => i.id === fromItem.itemId);
        if (!item) return 0;

        const production = state.productions.filter(p => p.itemId === item.id).reduce((sum, p) => sum + p.quantityProduced, 0);
        const sales = state.salesInvoices.filter(inv => inv.status !== InvoiceStatus.Unposted).flatMap(inv => inv.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum + i.quantity, 0);

        return (item.openingStock || 0) + production - sales;
    }, [fromItem.itemId, state.productions, state.salesInvoices, state.items]);

    const handleAddItem = (side: 'from' | 'to') => {
        const itemState = side === 'from' ? fromItem : toItem;
        const setItemState = side === 'from' ? setFromItem : setToItem;
        const itemRef = side === 'from' ? fromItemRef : toItemRef;

        if (!itemState.itemId || !itemState.quantity || Number(itemState.quantity) <= 0) {
            showNotification("Please select an item and enter a valid quantity.");
            return;
        }
        const itemDetails = state.items.find(i => i.id === itemState.itemId);
        if (!itemDetails) {
            showNotification("Selected item not found.");
            return;
        }

        const quantity = Number(itemState.quantity);
        if (side === 'from') {
            const alreadyConsumed = fromItems.filter(i => i.itemId === itemState.itemId).reduce((sum, i) => sum + i.quantity, 0);
            if (quantity + alreadyConsumed > fromItemStock) {
                showNotification(`Cannot consume ${quantity} units. Only ${fromItemStock - alreadyConsumed} available in stock.`);
                return;
            }
        }

        const totalKg = quantity * (itemDetails.packingType === PackingType.Bales ? itemDetails.baleSize : 1);
        const newItem: RebalingListItem = { itemId: itemState.itemId, itemName: itemDetails.name, quantity, totalKg };

        if (side === 'from') setFromItems([...fromItems, newItem]);
        else setToItems([...toItems, newItem]);

        setItemState({ itemId: '', quantity: '' });
        itemRef.current?.focus();
    };


    const handleRemoveItem = (side: 'from' | 'to', index: number) => {
        if (side === 'from') setFromItems(fromItems.filter((_, i) => i !== index));
        else setToItems(toItems.filter((_, i) => i !== index));
    };
    
    const { totalFromKg, totalToKg, differenceKg } = useMemo(() => {
        const fromKg = fromItems.reduce((sum, item) => sum + item.totalKg, 0);
        const toKg = toItems.reduce((sum, item) => sum + item.totalKg, 0);
        return { totalFromKg: fromKg, totalToKg: toKg, differenceKg: fromKg - toKg };
    }, [fromItems, toItems]);

    const handleFinalize = () => {
        if (fromItems.length === 0 || toItems.length === 0) {
            showNotification("Please add items to both 'Consume' and 'Produce' lists.");
            return;
        }
        
        const transactionId = `${Date.now()}`;
        
        fromItems.forEach(item => {
            const negativeProduction: Production = { id: `rebaling_from_${item.itemId}_${transactionId}`, date, itemId: item.itemId, quantityProduced: -item.quantity };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: negativeProduction } });
        });
        
        toItems.forEach(item => {
            const itemDetails = state.items.find(i => i.id === item.itemId)!;
            const positiveProduction: Production = {
                id: `rebaling_to_${item.itemId}_${transactionId}`, date, itemId: item.itemId, quantityProduced: item.quantity,
                ...(itemDetails.packingType === PackingType.Bales && {
                    startBaleNumber: itemDetails.nextBaleNumber || 1,
                    endBaleNumber: (itemDetails.nextBaleNumber || 0) + item.quantity - 1,
                }),
            };
            dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: positiveProduction } });
            if (itemDetails.packingType === PackingType.Bales) {
                dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'items', data: { id: item.itemId, nextBaleNumber: (itemDetails.nextBaleNumber || 0) + item.quantity } } });
            }
        });

        showNotification("Re-baling transaction saved successfully.");
        setDate(new Date().toISOString().split('T')[0]);
        setFromItems([]);
        setToItems([]);
    };

    const renderItemList = (items: RebalingListItem[], side: 'from' | 'to') => (
        <div className="border rounded-md min-h-[200px]">
            <table className="w-full text-left table-auto text-sm">
                <thead><tr className="bg-slate-100"><th className="p-2 font-semibold text-slate-600">Item</th><th className="p-2 font-semibold text-slate-600 text-right">Qty</th><th className="p-2 font-semibold text-slate-600 text-right">Kg</th><th></th></tr></thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index} className="border-b">
                            <td className="p-2 text-slate-800">{item.itemName}</td>
                            <td className="p-2 text-right text-slate-800">{item.quantity}</td>
                            <td className="p-2 text-right text-slate-800">{item.totalKg.toFixed(2)}</td>
                            <td className="p-1 text-center"><button onClick={() => handleRemoveItem(side, index)} className="text-red-500 hover:text-red-700 text-xs">✕</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div><label className="block text-sm font-medium text-slate-700">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} min={minDate} className="mt-1 p-2 rounded-md w-full md:w-1/4"/></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50">
                {/* Consume Column */}
                <div className="space-y-3">
                    <h4 className="text-md font-semibold text-slate-700">Add Item to Consume</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                        <ItemSelector inputRef={fromItemRef} items={state.items} selectedItemId={fromItem.itemId} onSelect={(id) => setFromItem(f => ({ ...f, itemId: id }))}/>
                        {fromItem.itemId && <p className="text-xs text-slate-500 mt-1">Available Stock: {fromItemStock.toLocaleString()} units</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" value={fromItem.quantity} onChange={e => setFromItem(f => ({ ...f, quantity: e.target.value }))} className="w-full p-2 rounded-md" placeholder="e.g., 10" />
                    </div>
                    <button type="button" onClick={() => handleAddItem('from')} className="w-full py-2 px-3 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm font-semibold">Add to Consume</button>
                </div>

                {/* Produce Column */}
                <div className="space-y-3">
                    <h4 className="text-md font-semibold text-slate-700">Add Item to Produce</h4>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                        <ItemSelector inputRef={toItemRef} items={state.items} selectedItemId={toItem.itemId} onSelect={(id) => setToItem(f => ({ ...f, itemId: id }))}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" value={toItem.quantity} onChange={e => setToItem(f => ({ ...f, quantity: e.target.value }))} className="w-full p-2 rounded-md" placeholder="e.g., 10" />
                    </div>
                    <button type="button" onClick={() => handleAddItem('to')} className="w-full py-2 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-semibold">Add to Produce</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div><h3 className="text-lg font-bold text-slate-700 mb-2">Items to Consume (From)</h3>{renderItemList(fromItems, 'from')}</div>
                <div><h3 className="text-lg font-bold text-slate-700 mb-2">Items to Produce (To)</h3>{renderItemList(toItems, 'to')}</div>
            </div>

            <div className="p-4 bg-slate-100 rounded-lg flex justify-around items-center text-center">
                <div><p className="text-sm text-slate-500">Total Kg Consumed</p><p className="text-xl font-bold text-red-600">{totalFromKg.toFixed(2)}</p></div>
                <div><p className="text-sm text-slate-500">Total Kg Produced</p><p className="text-xl font-bold text-green-600">{totalToKg.toFixed(2)}</p></div>
                <div><p className="text-sm text-slate-500">Difference / Loss</p><p className={`text-xl font-bold ${differenceKg >= 0 ? 'text-slate-800' : 'text-red-700'}`}>{differenceKg.toFixed(2)}</p></div>
            </div>

            <div className="flex justify-end"><button onClick={handleFinalize} className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Finalize Re-baling</button></div>
        </div>
    );
};
// --- END: Re-baling Form ---

const DirectSalesForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();
    const formatCurrency = (val: number | undefined) => val ? val.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00';

    // State for the form
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [customerId, setCustomerId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [originalPurchaseId, setOriginalPurchaseId] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [currencyData, setCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [rate, setRate] = useState<number | ''>('');
    const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<{
        itemValue: number; freightCost: number; clearingCost: number; commissionCost: number; surchargeDiscount: number;
        totalCost: number; totalKg: number; costPerKg: number;
    } | null>(null);

    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    const availableOriginals = useMemo(() => {
        const openedKgs = new Map<string, number>();
        state.originalOpenings.forEach(op => {
            const purchase = state.originalPurchases.find(p => p.supplierId === op.supplierId && p.originalTypeId === op.originalTypeId && p.batchNumber === op.batchNumber);
            if(purchase) {
                openedKgs.set(purchase.id, (openedKgs.get(purchase.id) || 0) + op.totalKg);
            }
        });

        const soldKgs = new Map<string, number>();
        state.salesInvoices
            .filter(inv => inv.directSalesDetails?.originalPurchaseId)
            .forEach(inv => {
                const purchaseId = inv.directSalesDetails!.originalPurchaseId;
                const soldQty = inv.items.find(i => i.itemId === 'DS-001')?.quantity || 0;
                soldKgs.set(purchaseId, (soldKgs.get(purchaseId) || 0) + soldQty);
            });

        return state.originalPurchases.map(p => {
            const originalType = state.originalTypes.find(ot => ot.id === p.originalTypeId);
            if (!originalType) return null;

            const purchaseKg = originalType.packingType === PackingType.Kg ? p.quantityPurchased : p.quantityPurchased * originalType.packingSize;
            
            const totalOpened = openedKgs.get(p.id) || 0;
            const totalSold = soldKgs.get(p.id) || 0;
            
            const availableKg = purchaseKg - totalOpened - totalSold;
            
            return { id: p.id, supplierId: p.supplierId, batchNumber: p.batchNumber, availableKg };
        }).filter(p => p && p.availableKg > 0.01) as { id: string, supplierId: string, batchNumber: string, availableKg: number }[];
    }, [state.originalPurchases, state.originalOpenings, state.salesInvoices, state.originalTypes]);

    const suppliersWithStock = useMemo(() => {
        const supplierIds = new Set(availableOriginals.map(p => p.supplierId));
        return state.suppliers.filter(s => supplierIds.has(s.id));
    }, [availableOriginals, state.suppliers]);

    const batchesForSupplier = useMemo(() => {
        if (!supplierId) return [];
        return availableOriginals.filter(p => p.supplierId === supplierId);
    }, [supplierId, availableOriginals]);

    const getPurchaseCostDetails = (purchase: OriginalPurchased) => {
        const originalType = state.originalTypes.find(ot => ot.id === purchase.originalTypeId);
        if (!originalType) return null;
        
        const totalPurchaseKg = originalType.packingType === PackingType.Kg ? purchase.quantityPurchased : purchase.quantityPurchased * originalType.packingSize;
        if(totalPurchaseKg === 0) return null;

        const itemValueUSD = (purchase.quantityPurchased * purchase.rate) * (purchase.conversionRate || 1);
        const freightUSD = (purchase.freightAmount || 0) * (purchase.freightConversionRate || 1);
        const clearingUSD = (purchase.clearingAmount || 0) * (purchase.clearingConversionRate || 1);
        const commissionUSD = (purchase.commissionAmount || 0) * (purchase.commissionConversionRate || 1);
        const discountSurchargeUSD = purchase.discountSurcharge || 0;

        const totalCostUSD = itemValueUSD + freightUSD + clearingUSD + commissionUSD + discountSurchargeUSD;
        const costPerKg = totalCostUSD / totalPurchaseKg;
        
        return {
            itemValue: itemValueUSD, freightCost: freightUSD, clearingCost: clearingUSD, commissionCost: commissionUSD,
            surchargeDiscount: discountSurchargeUSD, totalCost: totalCostUSD, totalKg: totalPurchaseKg, costPerKg: costPerKg,
        };
    };

    useEffect(() => {
        if (supplierId && batchNumber) {
            const purchase = state.originalPurchases.find(p => p.supplierId === supplierId && p.batchNumber === batchNumber);
            if (purchase) {
                setOriginalPurchaseId(purchase.id);
                const details = getPurchaseCostDetails(purchase);
                setSelectedPurchaseDetails(details);
            }
        } else {
            setOriginalPurchaseId('');
            setSelectedPurchaseDetails(null);
        }
    }, [supplierId, batchNumber, state.originalPurchases]);

    const selectedBatchDetails = useMemo(() => {
        if (!supplierId || !batchNumber) return null;
        return batchesForSupplier.find(b => b.batchNumber === batchNumber);
    }, [supplierId, batchNumber, batchesForSupplier]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setCustomerId('');
        setSupplierId('');
        setBatchNumber('');
        setOriginalPurchaseId('');
        setQuantity('');
        setRate('');
        setCurrencyData({ currency: Currency.Dollar, conversionRate: 1 });
        setSelectedPurchaseDetails(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qtyNum = Number(quantity);
        const rateNum = Number(rate);

        if (!customerId || !originalPurchaseId || !quantity || qtyNum <= 0 || !rate || rateNum <= 0) {
            showNotification("Please fill all fields with valid values.");
            return;
        }

        if (selectedBatchDetails && qtyNum > selectedBatchDetails.availableKg) {
            showNotification(`Cannot sell ${qtyNum}kg. Only ${selectedBatchDetails.availableKg.toFixed(2)}kg available.`);
            return;
        }
        
        const originalPurchase = state.originalPurchases.find(p => p.id === originalPurchaseId);
        if (!originalPurchase || !selectedPurchaseDetails) {
            showNotification("Selected purchase batch not found or cost could not be calculated.");
            return;
        }

        const totalCostOfGoodsSold = selectedPurchaseDetails.costPerKg * qtyNum;
        const totalSaleValue = qtyNum * rateNum;
        const totalSaleValueUSD = totalSaleValue * currencyData.conversionRate;
        
        const newInvoiceId = generateInvoiceId(state.nextInvoiceNumber);
        const newInvoice: SalesInvoice = {
            id: newInvoiceId, date, customerId,
            items: [{
                itemId: 'DS-001', quantity: qtyNum, rate: rateNum,
                currency: currencyData.currency, conversionRate: currencyData.conversionRate,
            }],
            status: InvoiceStatus.Posted, totalBales: 0, totalKg: qtyNum,
            directSalesDetails: { originalPurchaseId, originalPurchaseCost: totalCostOfGoodsSold }
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'salesInvoices', data: newInvoice } });

        const customer = state.customers.find(c => c.id === customerId);
        const salesDesc = `Direct Sale of Raw Goods (Batch: ${originalPurchase.batchNumber}) to ${customer?.name}`;
        
        const debitAR: JournalEntry = { id: `je-d-ds-${newInvoiceId}`, voucherId: newInvoiceId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: totalSaleValueUSD, credit: 0, description: salesDesc, entityId: customerId, entityType: 'customer', createdBy: userProfile?.uid };
        const creditRevenue: JournalEntry = { id: `je-c-ds-${newInvoiceId}`, voucherId: newInvoiceId, date, entryType: JournalEntryType.Journal, account: 'REV-001', debit: 0, credit: totalSaleValueUSD, description: salesDesc, createdBy: userProfile?.uid };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitAR } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditRevenue } });
        
        const cogsDesc = `Cost for Direct Sale INV ${newInvoiceId}`;
        const debitCOGS: JournalEntry = { id: `je-d-cogs-ds-${newInvoiceId}`, voucherId: `COGS-${newInvoiceId}`, date, entryType: JournalEntryType.Journal, account: 'EXP-010', debit: totalCostOfGoodsSold, credit: 0, description: cogsDesc, createdBy: userProfile?.uid };
        const creditPurchases: JournalEntry = { id: `je-c-cogs-ds-${newInvoiceId}`, voucherId: `COGS-${newInvoiceId}`, date, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: 0, credit: totalCostOfGoodsSold, description: cogsDesc, createdBy: userProfile?.uid };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitCOGS } });
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditPurchases } });

        showNotification("Direct Sale recorded successfully!");
        resetForm();
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-bold text-slate-700 mb-4">New Direct Sale Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} min={minDate} required className="mt-1 w-full p-2 rounded-md"/>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Customer</label>
                        <select value={customerId} onChange={e => setCustomerId(e.target.value)} required className="mt-1 w-full p-2 rounded-md">
                            <option value="">Select Customer</option>
                            {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Supplier</label>
                        <select value={supplierId} onChange={e => {setSupplierId(e.target.value); setBatchNumber('');}} required className="mt-1 w-full p-2 rounded-md">
                            <option value="">Select Supplier</option>
                            {suppliersWithStock.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Batch Number</label>
                        <select value={batchNumber} onChange={e => setBatchNumber(e.target.value)} required className="mt-1 w-full p-2 rounded-md" disabled={!supplierId}>
                            <option value="">Select Batch</option>
                            {batchesForSupplier.map(b => (
                                <option key={b.id} value={b.batchNumber}>{b.batchNumber} (Available: {b.availableKg.toFixed(2)} Kg)</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedPurchaseDetails && (
                    <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                        <h4 className="text-md font-semibold text-slate-700 mb-2">Cost Breakdown for Batch: {batchNumber}</h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                            <span className="text-slate-600">Item Value (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.itemValue)}</span>
                            <span className="text-slate-600">Freight Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.freightCost)}</span>
                            <span className="text-slate-600">Clearing Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.clearingCost)}</span>
                            <span className="text-slate-600">Commission Cost (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.commissionCost)}</span>
                            <span className="text-slate-600">Discount/Surcharge (USD):</span><span className="text-right font-medium text-slate-800">{formatCurrency(selectedPurchaseDetails.surchargeDiscount)}</span>
                            <span className="text-slate-600 font-bold border-t pt-1 mt-1">Total Cost (USD):</span><span className="text-right font-bold text-slate-800 border-t pt-1 mt-1">{formatCurrency(selectedPurchaseDetails.totalCost)}</span>
                            <span className="text-slate-600">Total Weight (Kg):</span><span className="text-right font-medium text-slate-800">{selectedPurchaseDetails.totalKg.toFixed(2)} Kg</span>
                            <span className="text-blue-700 font-bold text-lg border-t pt-2 mt-2">Landed Cost per Kg:</span><span className="text-right font-bold text-blue-700 text-lg border-t pt-2 mt-2">{formatCurrency(selectedPurchaseDetails.costPerKg)}</span>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Quantity to Sell (Kg)</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} max={selectedBatchDetails?.availableKg} required className="mt-1 w-full p-2 rounded-md" placeholder="e.g., 500" disabled={!batchNumber}/>
                         {selectedBatchDetails && <p className="text-xs text-slate-500 mt-1">Max: {selectedBatchDetails.availableKg.toFixed(2)} Kg</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700">Sale Rate (per Kg)</label>
                        <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))} required className="mt-1 w-full p-2 rounded-md" placeholder="e.g., 0.75" disabled={!batchNumber}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Currency & Rate</label>
                        <CurrencyInput value={currencyData} onChange={setCurrencyData} />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Record Direct Sale
                    </button>
                </div>
            </form>
        </div>
    );
};
const OffloadingForm: React.FC<{ showNotification: (msg: string) => void; userProfile: UserProfile | null }> = ({ showNotification, userProfile }) => {
    const { state, dispatch } = useData();

    // Form State
    const [selectedLogisticsId, setSelectedLogisticsId] = useState<number | ''>('');
    const [offloadDate, setOffloadDate] = useState(new Date().toISOString().split('T')[0]);
    const [receivedWeight, setReceivedWeight] = useState<number | ''>('');
    const [warehouseId, setWarehouseId] = useState<string>('');
    
    // Staged items for tallying (for Finished Goods)
    type StagedItem = { itemId: string; itemName: string; quantity: number };
    const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
    
    // Current item being added (for Finished Goods)
    const [currentItem, setCurrentItem] = useState<{ itemId: string; quantity: string }>({ itemId: '', quantity: '' });
    const itemInputRef = useRef<HTMLInputElement>(null);
    const minDate = userProfile?.isAdmin ? '' : new Date().toISOString().split('T')[0];

    // FIX: Define a type for the purchase source to help with type inference.
    type PurchaseSource = (OriginalPurchased | FinishedGoodsPurchase) & { purchaseType: 'original' | 'finished' };
    
    // Combined map of all purchases for easy lookup
    const allPurchasesMap = useMemo(() => {
        const map = new Map<string, PurchaseSource>();
        state.originalPurchases.forEach(p => map.set(p.id, { ...p, purchaseType: 'original' }));
        state.finishedGoodsPurchases.forEach(p => map.set(p.id, { ...p, purchaseType: 'finished' }));
        return map;
    }, [state.originalPurchases, state.finishedGoodsPurchases]);

    // Filter and find eligible containers for off-loading
    const eligibleLogisticsEntries = useMemo(() => {
        // FIX: Cast the array from map values to the correct type to resolve type inference issues.
        const allPurchasesWithContainers = (Array.from(allPurchasesMap.values()) as PurchaseSource[]).filter(p => p.containerNumber);
        const existingLogisticsPurchaseIds = new Set(state.logisticsEntries.map(e => e.purchaseId));

        // Create placeholder entries for purchases that have a container but no logistics entry yet.
        // These are implicitly "In Transit".
        const placeholderEntries: LogisticsEntry[] = allPurchasesWithContainers
            .filter(p => !existingLogisticsPurchaseIds.has(p.id))
            .map((p, index) => ({
                id: -(index + 1), // Use temporary negative ID for uniqueness
                purchaseId: p.id,
                batchNumber: p.batchNumber,
                dateOfLoading: p.date, 
                status: LogisticsStatus.InTransit,
                etd: '', 
                eta: '', 
                portStorage: '', 
                doVld: '', 
                ground: '', 
                unload: '', 
                documentStatus: DocumentStatus.Pending, 
                freightForwarderId: p.freightForwarderId
            }));

        // Combine existing entries with placeholders
        const allPossibleEntries = [...state.logisticsEntries, ...placeholderEntries];
        
        // Now filter the combined list for "In Transit" status
        return allPossibleEntries.filter(entry => entry.status === LogisticsStatus.InTransit);

    }, [state.logisticsEntries, allPurchasesMap]);

    // Details of the selected purchase
    const selectedPurchaseDetails = useMemo(() => {
        if (!selectedLogisticsId) return null;

        const logisticsEntry = eligibleLogisticsEntries.find(e => e.id === selectedLogisticsId);
        if (!logisticsEntry) return null;

        const purchase = allPurchasesMap.get(logisticsEntry.purchaseId);
        if (!purchase) return null;

        const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
        const division = state.divisions.find(d => d.id === purchase.divisionId);
        const subDivision = state.subDivisions.find(sd => sd.id === purchase.subDivisionId);

        return {
            purchase,
            purchaseType: purchase.purchaseType,
            supplierName: supplier?.name || 'N/A',
            batchNumber: purchase.batchNumber || 'N/A',
            containerNumber: purchase.containerNumber || 'N/A',
            invoicedWeight: purchase.containerInvoicedWeight || 0,
            divisionName: division?.name || 'N/A',
            subDivisionName: subDivision?.name || 'N/A',
        };
    }, [selectedLogisticsId, eligibleLogisticsEntries, allPurchasesMap, state.suppliers, state.divisions, state.subDivisions]);

    // Reset form fields when selection changes to avoid stale data
    useEffect(() => {
        setReceivedWeight('');
        setWarehouseId('');
        setStagedItems([]);
        setCurrentItem({ itemId: '', quantity: '' });
    }, [selectedLogisticsId]);
    
    // Totals for tallied items (for Finished Goods)
    const tallyTotals = useMemo(() => {
        let totalBales = 0;
        let totalKg = 0;

        stagedItems.forEach(({ itemId, quantity }) => {
            const itemDetails = state.items.find(i => i.id === itemId);
            if (itemDetails) {
                if (itemDetails.packingType === PackingType.Bales) {
                    totalBales += quantity;
                    totalKg += quantity * itemDetails.baleSize;
                } else {
                    totalKg += quantity;
                }
            }
        });
        return { totalBales, totalKg };
    }, [stagedItems, state.items]);

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { itemId, quantity } = currentItem;
        if (!itemId || !quantity || Number(quantity) <= 0) {
            showNotification("Please select an item and enter a valid quantity.");
            return;
        }

        const itemDetails = state.items.find(i => i.id === itemId);
        if (!itemDetails) return;

        setStagedItems(prev => [...prev, { itemId, itemName: itemDetails.name, quantity: Number(quantity) }]);
        setCurrentItem({ itemId: '', quantity: '' });
        if (itemInputRef.current) {
            itemInputRef.current.focus();
        }
    };

    const handleRemoveItem = (index: number) => {
        setStagedItems(prev => prev.filter((_, i) => i !== index));
    };
    
    const resetForm = () => {
        setSelectedLogisticsId('');
        setOffloadDate(new Date().toISOString().split('T')[0]);
        setReceivedWeight('');
        setWarehouseId('');
        setStagedItems([]);
        setCurrentItem({ itemId: '', quantity: '' });
    };

    const handleFinalize = () => {
        if (!selectedLogisticsId || !warehouseId) {
            showNotification("Please select a container and a warehouse.");
            return;
        }

        const isFinishedGoods = selectedPurchaseDetails?.purchaseType === 'finished';
        let finalReceivedWeight: number;

        if (isFinishedGoods) {
            if (stagedItems.length === 0) {
                showNotification("For Finished Goods, you must tally at least one item.");
                return;
            }
            finalReceivedWeight = tallyTotals.totalKg;
            
            // Create Production entries for each tallied item
            stagedItems.forEach(item => {
                const productionEntry: Production = {
                    id: `prod_offload_${selectedLogisticsId}_${item.itemId}_${Date.now()}`,
                    date: offloadDate,
                    itemId: item.itemId,
                    quantityProduced: item.quantity
                };
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: productionEntry } });
            });
        } else {
            if (!receivedWeight || Number(receivedWeight) <= 0) {
                showNotification("Please enter a valid received weight.");
                return;
            }
            finalReceivedWeight = Number(receivedWeight);
        }

        // Update the Logistics Entry
        const logisticsUpdate = {
            id: selectedLogisticsId,
            status: LogisticsStatus.Cleared,
            unload: offloadDate,
            receiveWeight: finalReceivedWeight,
            warehouseId: warehouseId,
        };
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'logisticsEntries', data: logisticsUpdate } });
        
        showNotification(`Container off-loading for ${selectedPurchaseDetails?.containerNumber} saved successfully.`);
        resetForm();
    };

    const loadingWeight = selectedPurchaseDetails?.invoicedWeight || 0;
    const isFinishedGoodsPurchase = selectedPurchaseDetails?.purchaseType === 'finished';
    const weightDifference = isFinishedGoodsPurchase ? tallyTotals.totalKg - loadingWeight : (loadingWeight > 0 && receivedWeight ? Number(receivedWeight) - loadingWeight : null);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-700">Container Off-loading</h3>

            {/* Top selection area */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end p-4 border rounded-lg bg-slate-50">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" value={offloadDate} onChange={e => setOffloadDate(e.target.value)} min={minDate} className="mt-1 w-full p-2 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Batch Number (In Transit)</label>
                    <select value={selectedLogisticsId} onChange={e => setSelectedLogisticsId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select a batch...</option>
                        {eligibleLogisticsEntries.map(entry => {
                            const purchase = allPurchasesMap.get(entry.purchaseId);
                            if (!purchase || !purchase.batchNumber) return null;
                            return ( <option key={`batch-${entry.id}`} value={entry.id}> {purchase.batchNumber} </option> );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Container Number (In Transit)</label>
                    <select value={selectedLogisticsId} onChange={e => setSelectedLogisticsId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md">
                        <option value="">Select a container...</option>
                        {eligibleLogisticsEntries.map(entry => {
                            const purchase = allPurchasesMap.get(entry.purchaseId);
                            if (!purchase || !purchase.containerNumber) return null;
                            return ( <option key={`container-${entry.id}`} value={entry.id}> {purchase.containerNumber} </option> );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Warehouse</label>
                    <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} disabled={!selectedLogisticsId} className="mt-1 w-full p-2 rounded-md disabled:bg-slate-200">
                        <option value="">Select warehouse...</option>
                        {state.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedPurchaseDetails && (
                <div className="space-y-6">
                    {/* Details Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-left table-auto text-sm">
                            <thead className="bg-slate-100"><tr className="border-b"><th colSpan={4} className="p-2 font-semibold text-slate-700">Selected Container Details</th></tr></thead>
                            <tbody>
                                <tr className="border-b">
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50 w-1/4">Supplier</td><td className="p-2 text-slate-800 w-1/4">{selectedPurchaseDetails.supplierName}</td>
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50 w-1/4">Invoiced Weight</td><td className="p-2 text-slate-800 w-1/4">{selectedPurchaseDetails.invoicedWeight.toLocaleString()} Kg</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50">Division</td><td className="p-2 text-slate-800">{selectedPurchaseDetails.divisionName}</td>
                                    <td className="p-2 font-medium text-slate-600 bg-slate-50">Sub-Division</td><td className="p-2 text-slate-800">{selectedPurchaseDetails.subDivisionName}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Weight Input (for Original Purchase) */}
                    {!isFinishedGoodsPurchase && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Received Weight (Kg)</label>
                                <input type="number" value={receivedWeight} onChange={e => setReceivedWeight(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full p-2 rounded-md" placeholder="Enter total weight received" />
                                {weightDifference !== null && (
                                    <p className={`mt-2 text-sm font-semibold ${weightDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Difference: {weightDifference.toLocaleString()} Kg
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Conditional Tallying Section */}
                    {isFinishedGoodsPurchase && (
                        <div className="grid grid-cols-12 gap-8 pt-4 border-t">
                            <div className="col-span-3">
                                <form onSubmit={handleAddItem} className="space-y-4 p-4 border rounded-lg bg-slate-50">
                                    <h4 className="text-md font-semibold text-slate-700 border-b pb-2">Tally Item</h4>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Item</label><ItemSelector inputRef={itemInputRef} items={state.items} selectedItemId={currentItem.itemId} onSelect={id => setCurrentItem(p => ({...p, itemId: id}))} /></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label><input type="number" min="1" value={currentItem.quantity} onChange={e => setCurrentItem(p => ({...p, quantity: e.target.value}))} className="w-full p-2 rounded-md" required/></div>
                                    <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Item to Tally</button>
                                </form>
                            </div>
                            <div className="col-span-5">
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">Tallied Items</h3>
                                <div className="overflow-y-auto border rounded-md max-h-[250px]">
                                    <table className="w-full text-left table-auto">
                                        <thead className="sticky top-0 bg-slate-100 z-10"><tr className="border-b"><th className="p-3 font-semibold text-slate-800">Item</th><th className="p-3 font-semibold text-slate-800 text-right">Quantity</th><th className="p-3"></th></tr></thead>
                                        <tbody>
                                            {stagedItems.map((item, index) => (
                                                <tr key={`${item.itemId}-${index}`} className="border-b">
                                                    <td className="p-3 text-slate-800">{item.itemName}</td>
                                                    <td className="p-3 text-right text-slate-800">{item.quantity.toLocaleString()}</td>
                                                    <td className="p-3 text-center"><button onClick={() => handleRemoveItem(index)} className="text-red-500">✕</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                 <div className="mt-4 p-4 bg-slate-100 rounded-lg flex justify-around items-center text-center">
                                    <div><p className="text-sm text-slate-500">Total Bales</p><p className="text-xl font-bold text-slate-800">{tallyTotals.totalBales.toLocaleString()}</p></div>
                                    <div><p className="text-sm text-slate-500">Total Kg</p><p className="text-xl font-bold text-slate-800">{tallyTotals.totalKg.toLocaleString(undefined, {maximumFractionDigits: 2})}</p></div>
                                    <div>
                                        <p className="text-sm text-slate-500">Weight Difference</p>
                                        <p className={`text-xl font-bold ${weightDifference !== null && weightDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {weightDifference?.toLocaleString(undefined, {maximumFractionDigits: 2})} kg
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-4">
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">Expected Items (from PO)</h3>
                                <div className="overflow-y-auto border rounded-md max-h-[350px] bg-slate-50">
                                    <table className="w-full text-left table-auto text-sm">
                                        <thead className="sticky top-0 bg-slate-200 z-10">
                                            <tr className="border-b">
                                                <th className="p-2 font-semibold text-slate-800">Item</th>
                                                <th className="p-2 font-semibold text-slate-800 text-right">Expected Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedPurchaseDetails?.purchase as FinishedGoodsPurchase).items.map((item, index) => {
                                                const itemDetails = state.items.find(i => i.id === item.itemId);
                                                return (
                                                    <tr key={`${item.itemId}-${index}`} className="border-b">
                                                        <td className="p-2 text-slate-800">{itemDetails?.name || 'N/A'}</td>
                                                        <td className="p-2 text-right text-slate-800">{item.quantity.toLocaleString()}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Finalize Button */}
                    <div className="flex justify-end pt-4 border-t">
                        <button onClick={handleFinalize} className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700">Finalize & Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

type FormView = 'opening' | 'production' | 'purchases' | 'sales' | 'ongoing' | 'rebaling' | 'directSales' | 'offloading' | 'stockLot';

interface DataEntryProps {
    setModule: (module: Module) => void;
    requestSetupItem: () => void;
    userProfile: UserProfile | null;
    initialView?: string | null;
}

const DataEntryModule: React.FC<DataEntryProps> = ({ setModule, requestSetupItem, userProfile, initialView }) => {
    const [view, setView] = useState<FormView>('opening');
    const [notification, setNotification] = useState<string | null>(null);
    
    const dataEntrySubModules = [
        { key: 'opening', label: 'Original Opening' },
        { key: 'production', label: 'Production' },
        { key: 'purchases', label: 'Purchases' },
        { key: 'sales', label: 'Sales Invoice' },
        { key: 'stockLot', label: 'Bundle Purchase' },
        { key: 'ongoing', label: 'Ongoing Orders' },
        { key: 'rebaling', label: 'Re-baling' },
        { key: 'directSales', label: 'Direct Sales' },
        { key: 'offloading', label: 'Container Off-loading' }
    ];

    useEffect(() => {
        if (initialView && dataEntrySubModules.some(v => v.key === initialView)) {
            setView(initialView as FormView);
        }
    }, [initialView]);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const renderView = () => {
        switch (view) {
            case 'opening': return <OriginalOpeningForm showNotification={showNotification} userProfile={userProfile} />;
            case 'production': return <ProductionForm showNotification={showNotification} requestSetupItem={requestSetupItem} userProfile={userProfile} />;
            case 'purchases': return <PurchasesModule showNotification={showNotification} userProfile={userProfile} />;
            case 'sales': return <SalesInvoiceModule setModule={setModule} userProfile={userProfile} />;
            case 'stockLot': return <StockLotModule setModule={setModule} showNotification={showNotification} userProfile={userProfile} />;
            case 'ongoing': return <OngoingOrdersModule setModule={setModule} userProfile={userProfile} />;
            case 'rebaling': return <RebalingForm showNotification={showNotification} userProfile={userProfile} />;
            case 'directSales': return <DirectSalesForm showNotification={showNotification} userProfile={userProfile} />;
            case 'offloading': return <OffloadingForm showNotification={showNotification} userProfile={userProfile} />;
            default: return <div>Select a data entry form.</div>;
        }
    };
    
    const getButtonClass = (formView: FormView) => `px-4 py-2 rounded-md transition-colors text-sm font-medium ${view === formView ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
            <div className="bg-white p-4 rounded-lg shadow-md no-print">
                <div className="flex flex-wrap items-center gap-2">
                     <h2 className="text-xl font-bold text-slate-700 mr-4">Data Entry</h2>
                    {dataEntrySubModules.map(subModule => (
                        <button
                            key={subModule.key}
                            onClick={() => setView(subModule.key as FormView)}
                            className={getButtonClass(subModule.key as FormView)}
                        >
                            {subModule.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md form-with-bg">
                {renderView()}
            </div>
        </div>
    );
};

export default DataEntryModule;