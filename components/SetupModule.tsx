import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext.tsx';
import { AppState, Customer, Supplier, Item, OriginalType, Division, Bank, PackingType, LoanAccount, CapitalAccount, InvestmentAccount, CashAccount, ExpenseAccount, Currency, SubDivision, FreightForwarder, ClearingAgent, CommissionAgent, Employee, JournalEntry, JournalEntryType, Production, Section, Module, Category, UserProfile, HRTask, HREnquiry, Vehicle, VehicleStatus, Account, Warehouse, AttendanceRecord, AttendanceStatus, OriginalPurchased, SubSupplier, OriginalProduct, Logo, Vendor, AssetType } from '../types.ts';
import { generateCustomerId, generateSupplierId, generateBankId, generateOriginalTypeId, generateDivisionId, generateLoanAccountId, generateCapitalAccountId, generateInvestmentAccountId, generateCashAccountId, generateExpenseAccountId, generateSubDivisionId, generateFreightForwarderId, generateClearingAgentId, generateCommissionAgentId, generateEmployeeId, generateSectionId, generateCategoryId, generateVehicleId, generateWarehouseId, generateItemId, generateSubSupplierId, generateOriginalProductId, generateLogoId, generateVendorId, generateAssetTypeId } from '../utils/idGenerator.ts';
import Modal from './ui/Modal.tsx';
import AttendanceRegister from './AttendanceRegister.tsx';
import SalaryCalculator from './SalaryCalculator.tsx';

// START: Full-featured ExcelImportModal component
type ImportableEntity = 'items' | 'customers' | 'suppliers' | 'commissionAgents' | 'freightForwarders' | 'clearingAgents' | 'divisions' | 'subDivisions' | 'loanAccounts' | 'expenseAccounts' | 'categories' | 'sections' | 'originalStock' | 'employees';

interface ExcelImportModalProps {
  entityName: ImportableEntity;
  onClose: () => void;
  showNotification: (msg: string) => void;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ entityName, onClose, showNotification }) => {
    const { state, dispatch } = useData();
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<{ validRows: any[], invalidRows: { rowData: any, error: string, rowIndex: number }[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const entityDisplayNames: Record<ImportableEntity, string> = {
        items: 'Items',
        customers: 'Customers',
        suppliers: 'Suppliers',
        commissionAgents: 'Commission Agents',
        freightForwarders: 'Freight Forwarders',
        clearingAgents: 'Clearing Agents',
        divisions: 'Divisions',
        subDivisions: 'Sub-Divisions',
        loanAccounts: 'Loan Accounts',
        expenseAccounts: 'Expense Accounts',
        categories: 'Categories',
        sections: 'Sections',
        originalStock: 'Historical Original Purchases',
        employees: 'Employees',
    };

    const importConfig = useMemo(() => ({
        items: {
            headers: ['Item Code (Optional)', 'Item Name (Required)', 'Category ID (Required)', 'Section ID', 'Packing Type (Bales/Sacks/Kg)', 'Packing Size (if not Kg)', 'Packing Color', 'Avg Production Price (Required)', 'Avg Sales Price', 'Demand Factor (1-10)', 'Opening Stock'],
            idGenerator: generateItemId,
            entity: 'items' as const,
            keys: ['id', 'name', 'categoryId', 'sectionId', 'packingType', 'baleSize', 'packingColor', 'avgProductionPrice', 'avgSalesPrice', 'demandFactor', 'openingStock'],
            uniqueIdentifier: 'id',
            validate: (row: any) => {
                // This validation now only checks for foreign keys and data types, as uniqueness is handled in the processFile function.
                if (!state.categories.some(cat => cat.id === row.categoryId)) return `Category ID '${row.categoryId}' not found.`;
                if (row.sectionId && !state.sections.some(sec => sec.id === row.sectionId)) return `Section ID '${row.sectionId}' not found.`;
                if (!row.packingType || !Object.values(PackingType).includes(row.packingType as PackingType)) return `Invalid Packing Type. Must be one of: ${Object.values(PackingType).join(', ')}.`;
                return null;
            },
            transform: (row: any) => ({ ...row, baleSize: Number(row.baleSize) || 0, avgProductionPrice: Number(row.avgProductionPrice), avgSalesPrice: Number(row.avgSalesPrice) || 0, demandFactor: Number(row.demandFactor) || 5, openingStock: Number(row.openingStock) || 0 }),
        },
        customers: {
            headers: ['Customer Name (Required)', 'Contact', 'Address', 'Division ID', 'Opening Balance'],
            idGenerator: generateCustomerId,
            entity: 'customers' as const,
            keys: ['name', 'contact', 'address', 'divisionId', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Customer Name is required.';
                if (state.customers.some(c => c.name.toLowerCase() === name)) return `Customer '${row.name}' already exists.`;
                if (row.divisionId && !state.divisions.some(d => d.id === row.divisionId)) return `Division ID '${row.divisionId}' not found.`;
                if (row.startingBalance && isNaN(Number(row.startingBalance))) return 'Opening Balance must be a number.';
                return null;
            },
            transform: (row: any) => ({ name: row.name, contact: row.contact || '', address: row.address || '', divisionId: row.divisionId || undefined, status: Math.floor(Math.random() * 11), startingBalance: Number(row.startingBalance) || 0 }),
        },
        suppliers: {
            headers: ['Supplier Name (Required)', 'Contact', 'Address', 'Default Currency', 'Opening Balance'],
            idGenerator: generateSupplierId,
            entity: 'suppliers' as const,
            keys: ['name', 'contact', 'address', 'defaultCurrency', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Supplier Name is required.';
                if (state.suppliers.some(s => s.name.toLowerCase() === name)) return `Supplier '${row.name}' already exists.`;
                if (row.defaultCurrency && !Object.values(Currency).includes(row.defaultCurrency as Currency)) return `Invalid Currency: ${row.defaultCurrency}.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, contact: row.contact || '', address: row.address || '', defaultCurrency: row.defaultCurrency || Currency.Dollar, startingBalance: Number(row.startingBalance) || 0 }),
        },
        commissionAgents: {
            headers: ['Agent Name (Required)', 'Contact', 'Address', 'Default Currency', 'Opening Balance'],
            idGenerator: generateCommissionAgentId,
            entity: 'commissionAgents' as const,
            keys: ['name', 'contact', 'address', 'defaultCurrency', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Agent Name is required.';
                if (state.commissionAgents.some(c => c.name.toLowerCase() === name)) return `Agent '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, contact: row.contact || '', address: row.address || '', defaultCurrency: row.defaultCurrency || Currency.Dollar, startingBalance: Number(row.startingBalance) || 0 }),
        },
        freightForwarders: {
            headers: ['Forwarder Name (Required)', 'Contact', 'Address', 'Default Currency', 'Opening Balance'],
            idGenerator: generateFreightForwarderId,
            entity: 'freightForwarders' as const,
            keys: ['name', 'contact', 'address', 'defaultCurrency', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Forwarder Name is required.';
                if (state.freightForwarders.some(f => f.name.toLowerCase() === name)) return `Forwarder '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, contact: row.contact || '', address: row.address || '', defaultCurrency: row.defaultCurrency || Currency.Dollar, startingBalance: Number(row.startingBalance) || 0 }),
        },
        clearingAgents: {
            headers: ['Agent Name (Required)', 'Contact', 'Address', 'Default Currency', 'Opening Balance'],
            idGenerator: generateClearingAgentId,
            entity: 'clearingAgents' as const,
            keys: ['name', 'contact', 'address', 'defaultCurrency', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Agent Name is required.';
                if (state.clearingAgents.some(c => c.name.toLowerCase() === name)) return `Agent '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, contact: row.contact || '', address: row.address || '', defaultCurrency: row.defaultCurrency || Currency.Dollar, startingBalance: Number(row.startingBalance) || 0 }),
        },
        divisions: {
            headers: ['Division Name (Required)'],
            idGenerator: generateDivisionId,
            entity: 'divisions' as const,
            keys: ['name'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Division Name is required.';
                if (state.divisions.some(d => d.name.toLowerCase() === name)) return `Division '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name }),
        },
        subDivisions: {
            headers: ['Sub-Division Name (Required)', 'Parent Division ID (Required)'],
            idGenerator: generateSubDivisionId,
            entity: 'subDivisions' as const,
            keys: ['name', 'divisionId'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Sub-Division Name is required.';
                if (!row.divisionId) return 'Parent Division ID is required.';
                if (!state.divisions.some(d => d.id === row.divisionId)) return `Parent Division ID '${row.divisionId}' not found.`;
                if (state.subDivisions.some(sd => sd.name.toLowerCase() === name && sd.divisionId === row.divisionId)) return `Sub-Division '${row.name}' already exists in this division.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, divisionId: row.divisionId }),
        },
        loanAccounts: {
            headers: ['Account Name (Required)', 'Opening Balance'],
            idGenerator: generateLoanAccountId,
            entity: 'loanAccounts' as const,
            keys: ['name', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Account Name is required.';
                if (state.loanAccounts.some(a => a.name.toLowerCase() === name)) return `Account '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, startingBalance: Number(row.startingBalance) || 0 }),
        },
        expenseAccounts: {
            headers: ['Account Name (Required)', 'Opening Balance'],
            idGenerator: generateExpenseAccountId,
            entity: 'expenseAccounts' as const,
            keys: ['name', 'startingBalance'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Account Name is required.';
                if (state.expenseAccounts.some(a => a.name.toLowerCase() === name)) return `Account '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name, startingBalance: Number(row.startingBalance) || 0 }),
        },
        categories: {
            headers: ['Category Name (Required)'],
            idGenerator: generateCategoryId,
            entity: 'categories' as const,
            keys: ['name'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Category Name is required.';
                if (state.categories.some(c => c.name.toLowerCase() === name)) return `Category '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name }),
        },
        sections: {
            headers: ['Section Name (Required)'],
            idGenerator: generateSectionId,
            entity: 'sections' as const,
            keys: ['name'],
            uniqueIdentifier: 'name',
            validate: (row: any) => {
                const name = row.name?.toLowerCase();
                if (!name) return 'Section Name is required.';
                if (state.sections.some(s => s.name.toLowerCase() === name)) return `Section '${row.name}' already exists.`;
                return null;
            },
            transform: (row: any) => ({ name: row.name }),
        },
        originalStock: {
            headers: ['Supplier ID', 'Original Type ID', 'Batch Number', 'Date (YYYY-MM-DD)', 'Division ID', 'Quantity', 'Rate', 'Currency', 'Conversion Rate'],
            entity: 'originalPurchases' as const,
            keys: ['supplierId', 'originalTypeId', 'batchNumber', 'date', 'divisionId', 'quantityPurchased', 'rate', 'currency', 'conversionRate'],
            uniqueIdentifier: 'batchNumber', 
            validate: (row: any) => {
                if (!row.supplierId || !row.originalTypeId || !row.batchNumber || !row.date || !row.divisionId || !row.quantityPurchased || !row.rate || !row.currency || !row.conversionRate) return 'All fields are required.';
                if (!state.suppliers.some(s => s.id === row.supplierId)) return `Supplier ID '${row.supplierId}' not found.`;
                if (!state.originalTypes.some(ot => ot.id === row.originalTypeId)) return `Original Type ID '${row.originalTypeId}' not found.`;
                if (!state.divisions.some(d => d.id === row.divisionId)) return `Division ID '${row.divisionId}' not found.`;
                if (isNaN(Number(row.quantityPurchased)) || isNaN(Number(row.rate)) || isNaN(Number(row.conversionRate))) return 'Quantity, Rate, and Conversion Rate must be numbers.';
                if (!Object.values(Currency).includes(row.currency as Currency)) return `Invalid Currency: ${row.currency}.`;
                if (state.originalPurchases.some(p => p.supplierId === row.supplierId && p.originalTypeId === row.originalTypeId && p.batchNumber === row.batchNumber)) return `Purchase with this Supplier/Type/Batch already exists in the system.`;
                return null;
            },
            transform: (row: any) => ({
                ...row,
                quantityPurchased: Number(row.quantityPurchased),
                rate: Number(row.rate),
                conversionRate: Number(row.conversionRate)
            }),
        },
        employees: {
            headers: ['Full Name (Required)', 'Date of Birth (YYYY-MM-DD) (Required)', 'Joining Date (YYYY-MM-DD) (Required)', 'Nationality (Required)', 'Basic Salary (Required)', 'Designation', 'Status (Active/Inactive)', 'On Duty (true/false)', 'Biennial Leave Status (Consumed/Pending)', 'Address', 'Phone', 'Email', 'Bank Name', 'Account Number', 'IBAN', 'Passport Number', 'Passport Expiry Date', 'Visa Status', 'Visa Expiry Date', 'Advances', 'Starting Balance'],
            idGenerator: generateEmployeeId,
            entity: 'employees' as const,
            keys: ['fullName', 'dateOfBirth', 'joiningDate', 'nationality', 'basicSalary', 'designation', 'status', 'onDuty', 'biennialLeaveStatus', 'address', 'phone', 'email', 'bankName', 'accountNumber', 'iban', 'passportNumber', 'passportExpiryDate', 'visaStatus', 'visaExpiryDate', 'advances', 'startingBalance'],
            uniqueIdentifier: 'fullName',
            validate: (row: any) => {
                if (!row.fullName) return 'Full Name is required.';
                if (!row.dateOfBirth) return 'Date of Birth is required.';
                if (!row.joiningDate) return 'Joining Date is required.';
                if (!row.nationality) return 'Nationality is required.';
                if (!row.basicSalary || isNaN(Number(row.basicSalary))) return 'Basic Salary is required and must be a number.';
        
                const nameLower = row.fullName.toLowerCase();
                if (state.employees.some(e => e.fullName.toLowerCase() === nameLower)) return `Employee '${row.fullName}' already exists.`;
        
                if (row.status && !['Active', 'Inactive'].includes(row.status)) return "Status must be 'Active' or 'Inactive'.";
                if (row.onDuty && !['true', 'false', '1', '0', ''].includes(String(row.onDuty).toLowerCase())) return "On Duty must be 'true' or 'false'.";
                if (row.biennialLeaveStatus && !['Consumed', 'Pending'].includes(row.biennialLeaveStatus)) return "Biennial Leave Status must be 'Consumed' or 'Pending'.";
        
                return null;
            },
            transform: (row: any) => ({
                ...row,
                basicSalary: Number(row.basicSalary),
                advances: Number(row.advances) || 0,
                startingBalance: Number(row.startingBalance) || 0,
                designation: row.designation || '',
                status: row.status || 'Active',
                onDuty: row.onDuty ? ['true', '1'].includes(String(row.onDuty).toLowerCase()) : true,
                biennialLeaveStatus: row.biennialLeaveStatus || 'Pending',
                companyVisa: true,
            }),
        },
    }), [state]);

    const config = importConfig[entityName];

    const handleDownloadTemplate = () => {
        const csvContent = config.headers.join(',') + '\n';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${entityName}_import_template.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = event.target.files?.[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            processFile(uploadedFile);
        }
    };
    
    const parseCsvRow = (row: string): string[] => {
        const values: string[] = [];
        let currentVal = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                if (inQuotes && i < row.length - 1 && row[i + 1] === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal.trim());
        return values;
    };


    const processFile = async (uploadedFile: File) => {
        setIsLoading(true);
        const reader = new FileReader();
        reader.onerror = () => { setIsLoading(false); showNotification("Error reading the file."); };

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) { showNotification("File is empty."); setIsLoading(false); return; }
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) { showNotification("File needs a header and at least one data row."); setIsLoading(false); return; }

                const rows = lines.slice(1);
                const { keys, validate, transform } = config;

                const validRows: any[] = [];
                const invalidRows: { rowData: any, error: string, rowIndex: number }[] = [];
                
                if (entityName === 'items') {
                    const uniqueCodesInFile = new Set<string>();
                    const uniqueNamesInFile = new Set<string>();

                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row.trim()) continue;
                        
                        const values = parseCsvRow(row);
                        if (values.length !== config.headers.length) {
                            invalidRows.push({ rowData: { raw: row }, error: `Column count mismatch. Expected ${config.headers.length}, found ${values.length}.`, rowIndex: i + 2 });
                            continue;
                        }

                        const rowData: any = {};
                        keys.forEach((key, index) => { rowData[key] = values[index] || ''; });
                        
                        let error: string | null = null;
                        const itemCode = rowData.id?.trim();
                        const itemName = rowData.name?.trim();

                        // --- Validation Steps ---
                        // 1. Required fields check
                        if (!itemName) {
                            error = 'Item Name is required.';
                        } else if (!rowData.categoryId) {
                            error = 'Category ID is required.';
                        } else if (!rowData.avgProductionPrice || isNaN(Number(rowData.avgProductionPrice))) {
                            error = 'Avg Production Price is required and must be a number.';
                        }

                        // 2. Uniqueness checks
                        if (!error) {
                            if (itemCode) { // Code provided
                                const codeLower = itemCode.toLowerCase();
                                if (state.items.some(item => item.id.toLowerCase() === codeLower)) {
                                    error = `Item Code '${itemCode}' already exists in the system.`;
                                } else if (uniqueCodesInFile.has(codeLower)) {
                                    error = `Duplicate Item Code '${itemCode}' found in this file.`;
                                } else {
                                    uniqueCodesInFile.add(codeLower);
                                }
                            }
                        }
                        if (!error && itemName) { // Item Name must always be unique
                            const nameLower = itemName.toLowerCase();
                            if (state.items.some(item => item.name.toLowerCase() === nameLower)) {
                                 error = `Item Name '${itemName}' already exists in the system.`;
                            } else if (uniqueNamesInFile.has(nameLower)) {
                                error = `Duplicate Item Name '${itemName}' found in this file.`;
                            } else {
                                uniqueNamesInFile.add(nameLower);
                            }
                        }

                        // 3. Other field validations (foreign keys, etc.)
                        if (!error) {
                            error = validate(rowData);
                        }

                        // --- Final Decision ---
                        if (error) {
                            invalidRows.push({ rowData, error, rowIndex: i + 2 });
                        } else {
                            validRows.push(transform(rowData));
                        }
                    }
                } else {
                    // Keep old, simpler logic for other entities
                    const uniqueIdentifier = config.uniqueIdentifier;
                    const allUniqueIdentifiersInFile = new Set<string>();
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row.trim()) continue;

                        const values = parseCsvRow(row);
                        if (values.length !== config.headers.length) {
                            invalidRows.push({ rowData: { raw: row }, error: `Column count mismatch. Expected ${config.headers.length}, found ${values.length}.`, rowIndex: i + 2 });
                            continue;
                        }

                        const rowData: any = {};
                        keys.forEach((key, index) => { rowData[key] = values[index] || ''; });
                        
                        const validationError = validate(rowData);
                        if (validationError) {
                            invalidRows.push({ rowData, error: validationError, rowIndex: i + 2 });
                            continue;
                        }
                        
                        const identifierValue = (entityName === 'originalStock'
                            ? `${rowData.supplierId}-${rowData.originalTypeId}-${rowData.batchNumber}`
                            : rowData[uniqueIdentifier]
                        )?.toLowerCase();
                        
                        if (identifierValue && allUniqueIdentifiersInFile.has(identifierValue)) {
                            invalidRows.push({ rowData, error: `Duplicate identifier in file: '${rowData[uniqueIdentifier]}'.`, rowIndex: i + 2 });
                        } else {
                            if (typeof identifierValue === 'string') {
                                allUniqueIdentifiersInFile.add(identifierValue);
                            }
                            validRows.push(transform(rowData));
                        }
                    }
                }
                setParsedData({ validRows, invalidRows });
            } catch (err) {
                console.error("Error processing file:", err);
                showNotification("An error occurred. Please ensure it's a valid CSV.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(uploadedFile);
    };

    const handleImport = () => {
        if (!parsedData || parsedData.validRows.length === 0) return;
        setIsLoading(true);
        
        const { entity } = config;
        const idGenerator = (config as any).idGenerator;
        
        if (entityName === 'originalStock') {
            const batchActions: any[] = [];
            let nextVoucherNumber = state.nextJournalVoucherNumber;
    
            parsedData.validRows.forEach((row: any) => {
                const purchase: OriginalPurchased = {
                    ...row,
                    id: `pur_import_${row.supplierId}_${row.batchNumber}_${Date.now()}`,
                };
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'originalPurchases', data: purchase } });
    
                const itemValueUSD = (purchase.quantityPurchased * purchase.rate) * (purchase.conversionRate || 1);
                const voucherId = `JV-${String(nextVoucherNumber).padStart(3, '0')}`;
                const supplierName = state.suppliers.find(s => s.id === purchase.supplierId)?.name || purchase.supplierId;
                const description = `Imported Stock Purchase from ${supplierName} (Batch: ${purchase.batchNumber})`;
    
                const debitEntry: JournalEntry = { id: `je-d-import-${purchase.id}`, voucherId, date: purchase.date, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: itemValueUSD, credit: 0, description };
                const creditEntry: JournalEntry = { id: `je-c-import-${purchase.id}`, voucherId, date: purchase.date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: itemValueUSD, description, entityId: purchase.supplierId, entityType: 'supplier' };
                
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                nextVoucherNumber++;
            });
    
            if (batchActions.length > 0) {
                dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
            }
    
            setIsLoading(false);
            showNotification(`${parsedData.validRows.length} original stock records imported successfully!`);
            onClose();
            return; 
        }

        const batchActions: any[] = [];
        const currentEntities = [...state[entity as keyof AppState] as any[]];
        let nextVoucherNumber = state.nextJournalVoucherNumber;

        parsedData.validRows.forEach((row) => {
            const dataWithId = { ...row };

            if (entity === 'items') {
                if (!dataWithId.id && idGenerator) { // Only generate if ID is not provided
                    dataWithId.id = idGenerator(currentEntities as any);
                }
                dataWithId.nextBaleNumber = (Number(dataWithId.openingStock) || 0) + 1;
            } else {
                if (idGenerator) {
                    dataWithId.id = idGenerator(currentEntities as any);
                }
            }
            
            currentEntities.push(dataWithId);
            batchActions.push({ type: 'ADD_ENTITY', payload: { entity, data: dataWithId } });

            const newBalance = parseFloat(String(dataWithId.startingBalance || '0'));
            if (newBalance !== 0 && !isNaN(newBalance)) {
                const defaultConversionRates: { [key: string]: number } = {
                    [Currency.AustralianDollar]: 0.66, [Currency.Pound]: 1.34, [Currency.AED]: 0.2725,
                    [Currency.SaudiRiyal]: 0.27, [Currency.Euro]: 1.17, [Currency.Dollar]: 1,
                };

                let newBalanceInUSD = newBalance;
                let originalAmountData: { amount: number; currency: Currency } | undefined;

                const relevantEntityTypes = ['customers', 'suppliers', 'cashAccounts', 'banks', 'commissionAgents', 'freightForwarders', 'clearingAgents', 'employees'];
                if (relevantEntityTypes.includes(entityName)) {
                    const newCurrency = dataWithId.currency || dataWithId.defaultCurrency || Currency.Dollar;
                    const newConversionRate = defaultConversionRates[newCurrency] || 1;
                    newBalanceInUSD = newBalance * newConversionRate;

                    if (newCurrency && newCurrency !== Currency.Dollar) {
                        originalAmountData = { amount: newBalance, currency: newCurrency };
                    }
                }

                const voucherId = `JV-${String(nextVoucherNumber).padStart(3, '0')}`;
                const date = new Date().toISOString().split('T')[0];
                const displayName = dataWithId.name || dataWithId.fullName;
                const description = `Opening Balance for ${displayName} (${dataWithId.id})`;

                let debitEntry: JournalEntry | null = null;
                let creditEntry: JournalEntry | null = null;
                let entityType: 'customer' | 'supplier' | 'commissionAgent' | 'employee' | 'freightForwarder' | 'clearingAgent' | undefined;

                const isPositive = newBalance > 0;
                const amount = Math.abs(newBalanceInUSD);

                switch(entityName) {
                    case 'customers':
                        entityType = 'customer';
                        if (isPositive) { // Customer owes us (Debit AR)
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: amount, credit: 0, description, entityId: dataWithId.id, entityType, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        } else { // We owe customer (Credit AR)
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: 0, credit: amount, description, entityId: dataWithId.id, entityType, originalAmount: originalAmountData };
                        }
                        break;
                    case 'suppliers':
                    case 'commissionAgents':
                    case 'freightForwarders':
                    case 'clearingAgents':
                    case 'employees':
                        if (entityName === 'suppliers') entityType = 'supplier';
                        if (entityName === 'commissionAgents') entityType = 'commissionAgent';
                        if (entityName === 'employees') entityType = 'employee';
                        if (entityName === 'freightForwarders') entityType = 'freightForwarder';
                        if (entityName === 'clearingAgents') entityType = 'clearingAgent';
        
                        if (isPositive) { // We owe them (Credit AP)
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: amount, description, entityId: dataWithId.id, entityType, originalAmount: originalAmountData };
                        } else { // They owe us (Debit AP)
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: amount, credit: 0, description, entityId: dataWithId.id, entityType, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        }
                        break;
                    case 'loanAccounts':
                        if (isPositive) { // Liability has a credit balance
                             debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                             creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: dataWithId.id, debit: 0, credit: amount, description, originalAmount: originalAmountData };
                        } else { // Liability has a debit balance
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: dataWithId.id, debit: amount, credit: 0, description, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        }
                        break;
                    case 'expenseAccounts':
                        if (isPositive) { // Asset has a debit balance
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: dataWithId.id, debit: amount, credit: 0, description, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        } else { // Asset has a credit balance (e.g. overdraft)
                            debitEntry = { id: `je-d-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${dataWithId.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: dataWithId.id, debit: 0, credit: amount, description, originalAmount: originalAmountData };
                        }
                        break;
                }
        
                if (debitEntry && creditEntry) {
                    batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                    batchActions.push({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                    nextVoucherNumber++;
                }
            }
        });

        if (batchActions.length > 0) {
            dispatch({ type: 'BATCH_UPDATE', payload: batchActions });
        }

        setIsLoading(false);
        showNotification(`${parsedData.validRows.length} records imported successfully!`);
        onClose();
    };

    const handleReset = () => {
        setFile(null); setParsedData(null);
        if (fileInputRef.current) { fileInputRef.current.value = ''; }
    };

    const { validRows = [], invalidRows = [] } = parsedData || {};

    return (
        <Modal isOpen={true} onClose={onClose} title={`Import ${entityDisplayNames[entityName]}`} size="5xl">
            {isLoading && <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10"><p>Processing file...</p></div>}
            
            {!parsedData ? (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700">Step 1: Download Template</h3>
                        <p className="text-sm text-slate-600 mt-1">Download the CSV template file to ensure your data is in the correct format.</p>
                        <button onClick={handleDownloadTemplate} className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Download Template.csv</span>
                        </button>
                    </div>
                     <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold text-slate-700">Step 2: Upload Your File</h3>
                        <p className="text-sm text-slate-600 mt-1">Once you've filled out the template, upload the CSV file here.</p>
                        <div className="mt-2">
                             <input ref={fileInputRef} id="csv-file-input" type="file" accept=".csv" onChange={handleFileChange} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-green-700">Valid Rows ({validRows.length})</h3>
                        {validRows.length > 0 ? (
                             <div className="max-h-60 overflow-y-auto border rounded-md mt-2">
                                <table className="w-full text-left table-auto text-xs">
                                    <thead className="bg-green-50 sticky top-0"><tr className="border-b border-green-200"><th className="p-2 font-semibold text-green-800">{config.keys[0]}</th><th className="p-2 font-semibold text-green-800">{config.keys[1]}</th></tr></thead>
                                    <tbody>{validRows.slice(0, 10).map((row, i) => (<tr key={i} className="border-b border-green-100"><td className="p-2">{row[config.keys[0]]}</td><td className="p-2">{row[config.keys[1]]}</td></tr>))}</tbody>
                                </table>
                                {validRows.length > 10 && <p className="p-2 text-center text-xs text-slate-500">...and {validRows.length - 10} more rows.</p>}
                            </div>
                        ) : <p className="text-sm text-slate-500 mt-1">No valid rows found to import.</p>}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-red-700">Invalid Rows ({invalidRows.length})</h3>
                        {invalidRows.length > 0 ? (
                            <div className="max-h-60 overflow-y-auto border rounded-md mt-2">
                                <table className="w-full text-left table-auto text-xs">
                                    <thead className="bg-red-50 sticky top-0"><tr className="border-b border-red-200"><th className="p-2 font-semibold text-red-800">Row #</th><th className="p-2 font-semibold text-red-800">Identifier / Raw Data</th><th className="p-2 font-semibold text-red-800">Error</th></tr></thead>
                                    <tbody>{invalidRows.map((row, i) => (<tr key={i} className="border-b border-red-100"><td className="p-2">{row.rowIndex}</td><td className="p-2 font-mono text-red-900">{row.rowData[config.uniqueIdentifier] || row.rowData.name || row.rowData.raw || 'N/A'}</td><td className="p-2">{row.error}</td></tr>))}</tbody>
                                </table>
                            </div>
                        ) : <p className="text-sm text-slate-500 mt-1">No invalid rows found. Great!</p>}
                    </div>

                    <div className="flex justify-end items-center gap-4 pt-4 border-t">
                        <button onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 text-sm">Upload a different file</button>
                        <button onClick={handleImport} disabled={validRows.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 text-sm font-semibold">
                            Import {validRows.length} Valid Records
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
// END: Full-featured ExcelImportModal component

const Notification: React.FC<{ message: string; onTimeout: () => void }> = ({ message, onTimeout }) => {
    useEffect(() => {
        const timer = setTimeout(onTimeout, 2000); // Increased duration for better visibility
        return () => clearTimeout(timer);
    }, [onTimeout]);

    return (
        <>
            <style>{`
                @keyframes fade-in-out {
                    0% { opacity: 0; transform: translate(-50%, -20px); }
                    10% { opacity: 1; transform: translate(-50%, 0); }
                    90% { opacity: 1; transform: translate(-50%, 0); }
                    100% { opacity: 0; transform: translate(-50%, -20px); }
                }
                .animate-fade-in-out {
                    animation: fade-in-out 2s ease-in-out forwards;
                }
            `}</style>
            <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
                {message}
            </div>
        </>
    );
};

type Entity = Customer | Supplier | Vendor | Item | OriginalType | Division | Bank | LoanAccount | CapitalAccount | InvestmentAccount | CashAccount | ExpenseAccount | SubDivision | FreightForwarder | ClearingAgent | CommissionAgent | Employee | Section | Category | Vehicle | Warehouse | SubSupplier | OriginalProduct | Logo | AssetType;

interface FieldConfig<T> {
    key: keyof T;
    label: string;
    type: 'text' | 'number' | 'select' | 'date' | 'textarea';
    options?: { value: string | number | boolean; label: string }[];
    required?: boolean;
    rows?: number;
    showWhen?: (item: T) => boolean;
    subtitle?: string;
}

interface ColumnConfig<T> {
    key: keyof T;
    header: string;
    render?: (item: T) => React.ReactNode;
}

interface CrudManagerProps<T extends Entity & { id: string, name?: string, fullName?: string, accountTitle?: string, plateNumber?: string }> {
    title: string;
    data: T[];
    columns: ColumnConfig<T>[];
    fields: FieldConfig<T>[];
    idGenerator?: (items: T[]) => string;
    entityName: 'customers' | 'suppliers' | 'vendors' | 'commissionAgents' | 'items' | 'originalTypes' | 'divisions' | 'subDivisions' | 'freightForwarders' | 'clearingAgents' | 'banks' | 'loanAccounts' | 'capitalAccounts' | 'investmentAccounts' | 'cashAccounts' | 'expenseAccounts' | 'employees' | 'sections' | 'categories' | 'vehicles' | 'warehouses' | 'subSuppliers' | 'originalProducts' | 'logos' | 'assetTypes';
    initialState: Omit<T, 'id'> & { id?: string };
    showNotification: (msg: string) => void;
    state: AppState;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSaveSuccess: () => void;
    onOpenImportModal?: (entityName: string) => void;
    userProfile: UserProfile | null;
    icon: React.ReactNode;
    isInitiallyExpanded?: boolean;
}

const CrudManager = <T extends Entity & { id: string, name?: string, fullName?: string, accountTitle?: string, plateNumber?: string, startingBalance?: number, openingStock?: number, onDuty?: boolean, offDutyStatus?: 'Holidays' | 'Fired', currency?: Currency, defaultCurrency?: Currency },>({ title, data, columns, fields, idGenerator, entityName, initialState, showNotification, state, isOpen, onOpen, onClose, onSaveSuccess, onOpenImportModal, userProfile, icon, isInitiallyExpanded = false }: CrudManagerProps<T>) => {
    const { dispatch } = useData();
    const [currentItem, setCurrentItem] = useState<(T & Record<string, any>) | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
    const [searchTerm, setSearchTerm] = useState('');
    
    useEffect(() => {
        setIsExpanded(isInitiallyExpanded);
    }, [isInitiallyExpanded]);
    
    const entitiesWithImport: ImportableEntity[] = ['items', 'customers', 'suppliers', 'commissionAgents', 'freightForwarders', 'clearingAgents', 'divisions', 'subDivisions', 'loanAccounts', 'expenseAccounts', 'categories', 'sections', 'employees'];

    const getDisplayValue = (item: T, key: keyof T) => {
        const value = item[key];
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (value === null || typeof value === 'undefined') return 'N/A';
        return String(value);
    };

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const lowercasedFilter = searchTerm.toLowerCase();

        return data.filter(item => {
            return columns.some(col => {
                const value = col.render ? col.render(item) : getDisplayValue(item, col.key);
                return String(value).toLowerCase().includes(lowercasedFilter);
            });
        });
    }, [data, searchTerm, columns]);

    useEffect(() => {
        // This effect handles the case where the modal is opened externally (e.g., from another module).
        // It initializes the form for a new entry.
        if (isOpen && !currentItem) {
            setIsEditing(false);
             const baseItem = { ...initialState } as T;
            const fullItem = {
                ...baseItem,
                ...(entityName === 'vehicles' && { expenseType: '', expenseAmount: '', responsibleEmployeeId: '' })
            };
            setCurrentItem(fullItem);
            setError(null);
        }
    }, [isOpen, currentItem, initialState, entityName]);


    const handleOpenModal = (item: T | null = null) => {
        setIsEditing(!!item);
        const baseItem = item ? { ...item } : ({ ...initialState } as T);
        const fullItem = {
            ...baseItem,
             ...(entityName === 'vehicles' && { expenseType: '', expenseAmount: '', responsibleEmployeeId: '' })
        };
        setCurrentItem(fullItem as any);
        setError(null);
        onOpen();
    };

    const handleCloseModal = () => {
        onClose();
        setCurrentItem(null);
        setError(null);
    };
    
    const handleSave = () => {
        if (!currentItem) return;
        setError(null);

        // Create a new object and parse all number fields from string to number
        const itemToSave = { ...currentItem };
        for (const field of fields) {
            if (field.type === 'number') {
                const key = field.key as keyof typeof itemToSave;
                const value = itemToSave[key];
                const parsed = parseFloat(String(value));
                // Use undefined for empty/invalid so it gets stripped or handled by downstream logic (e.g. `|| 0`)
                (itemToSave[key] as any) = isNaN(parsed) ? undefined : parsed;
            }
        }

        // Generic required field validation
        for (const field of fields) {
            if (field.required) {
                const value = itemToSave[field.key as keyof T];
                if (value === null || value === undefined || value === '') {
                    setError(`${field.label} is required.`);
                    return;
                }
            }
        }
        
        // Specific entity validation
        if (entityName === 'items') {
            const itemData = itemToSave as unknown as Item;
            if (itemData.packingType !== PackingType.Kg && (!itemData.baleSize || itemData.baleSize <= 0)) {
                setError(`For ${itemData.packingType}, the Packing Size must be a positive number.`);
                return;
            }
        }
        
        if (entityName === 'originalTypes') {
            const originalTypeData = itemToSave as unknown as OriginalType;
            if (originalTypeData.packingType !== PackingType.Kg && (!originalTypeData.packingSize || originalTypeData.packingSize <= 0)) {
                setError(`For ${originalTypeData.packingType}, the Packing Size must be a positive number.`);
                return;
            }
        }

        const { expenseType, expenseAmount, responsibleEmployeeId, ...entityData } = itemToSave as any;
        
        if (entityName === 'vehicles' && Number(expenseAmount) > 0 && responsibleEmployeeId) {
            const amountNum = Number(expenseAmount);
            const employee = state.employees.find(e => e.id === responsibleEmployeeId);
            if (employee) {
                // 1. Update employee advances
                const newAdvances = (employee.advances || 0) + amountNum;
                dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'employees', data: { id: employee.id, advances: newAdvances } } });

                // 2. Create Journal Entries for the receivable from employee and payable for the expense
                const voucherId = `JV-${String(state.nextJournalVoucherNumber).padStart(3, '0')}`;
                const baseDescription = `${expenseType || 'Vehicle Charge'} of $${amountNum.toFixed(2)} for Vehicle Plate# ${entityData.plateNumber}`;
                const debitDescription = `Receivable from ${employee.fullName} for ${baseDescription}`;
                const creditDescription = `Payable for ${baseDescription}`;

                // This DEBITS the employee's receivable account, making them owe the company money.
                const debitEntry: JournalEntry = {
                    id: `je-d-veh-exp-${Date.now()}`,
                    voucherId, 
                    date: new Date().toISOString().split('T')[0], 
                    entryType: JournalEntryType.Journal,
                    account: 'AP-001',
                    debit: amountNum, 
                    credit: 0, 
                    description: debitDescription,
                    entityId: employee.id, 
                    entityType: 'employee',
                };
                
                // This CREDITS the general Accounts Payable, representing the company's liability for the fine/expense.
                const creditEntry: JournalEntry = {
                    id: `je-c-veh-exp-${Date.now()}`,
                    voucherId, 
                    date: new Date().toISOString().split('T')[0], 
                    entryType: JournalEntryType.Journal,
                    account: 'AP-001',
                    debit: 0, 
                    credit: amountNum, 
                    description: creditDescription,
                };
                
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                
                showNotification(`Charge of $${amountNum.toFixed(2)} posted against ${employee.fullName}.`);
            }
        }

        const handleOpeningBalance = (
            item: T,
            oldItem: T | undefined,
            isNew: boolean
        ) => {
            const oldBalance = parseFloat(String(oldItem?.startingBalance || '0'));
            const newBalance = parseFloat(String(item.startingBalance || '0'));

            if (isNaN(oldBalance) || isNaN(newBalance)) {
                console.error("Invalid balance value detected during save.");
                return;
            }

            const defaultConversionRates: { [key: string]: number } = {
                [Currency.AustralianDollar]: 0.66,
                [Currency.Pound]: 1.34,
                [Currency.AED]: 0.2725,
                [Currency.SaudiRiyal]: 0.27,
                [Currency.Euro]: 1.17,
                [Currency.Dollar]: 1,
            };
    
            let oldBalanceInUSD = oldBalance;
            let newBalanceInUSD = newBalance;
            let originalAmountData: { amount: number; currency: Currency } | undefined;
    
            const relevantEntityTypes = ['customers', 'suppliers', 'vendors', 'cashAccounts', 'banks', 'commissionAgents', 'freightForwarders', 'clearingAgents', 'employees'];
            if (relevantEntityTypes.includes(entityName)) {
                const newAccount = item as T & { currency?: Currency, defaultCurrency?: Currency };
                const oldAccount = oldItem as T & { currency?: Currency, defaultCurrency?: Currency } | undefined;
        
                const newCurrency = newAccount.currency || newAccount.defaultCurrency || Currency.Dollar;
                const oldCurrency = oldAccount?.currency || oldAccount?.defaultCurrency || Currency.Dollar;
        
                const oldConversionRate = defaultConversionRates[oldCurrency] || 1;
                const newConversionRate = defaultConversionRates[newCurrency] || 1;
        
                oldBalanceInUSD = oldBalance * oldConversionRate;
                newBalanceInUSD = newBalance * newConversionRate;

                if (newCurrency && newCurrency !== Currency.Dollar) {
                    originalAmountData = { amount: newBalance, currency: newCurrency };
                }
            }


            const hasChanged = oldBalanceInUSD !== newBalanceInUSD;
            if (!isNew && !hasChanged) return;
            if (isNew && newBalance === 0) return;
        
             // 1. Delete old journal entries if they existed and balance changed
            if (!isNew && hasChanged && oldBalance !== 0) {
                const debitEntryId = `je-d-ob-${item.id}`;
                const creditEntryId = `je-c-ob-${item.id}`;
                dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: debitEntryId } });
                dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: creditEntryId } });
            }
        
            // 2. Create new entries if the new balance is not zero.
            if (newBalance !== 0) {
                const voucherId = state.journalEntries.find(je => je.id === `je-d-ob-${item.id}`)?.voucherId || `JV-${String(state.nextJournalVoucherNumber).padStart(3, '0')}`;
                const date = new Date().toISOString().split('T')[0];
                const displayName = item.name || item.fullName || item.accountTitle || item.plateNumber || item.id;
                const description = `Opening Balance for ${displayName} (${item.id})`;
        
                let debitEntry: JournalEntry | null = null;
                let creditEntry: JournalEntry | null = null;
                let entityType: 'customer' | 'supplier' | 'vendor' | 'commissionAgent' | 'employee' | 'freightForwarder' | 'clearingAgent' | undefined;
        
                const isPositive = newBalance > 0;
                const amount = Math.abs(newBalanceInUSD);
        
                switch(entityName) {
                    case 'customers':
                        entityType = 'customer';
                        if (isPositive) { // Customer owes us (Debit AR)
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: amount, credit: 0, description, entityId: item.id, entityType, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        } else { // We owe customer (Credit AR)
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AR-001', debit: 0, credit: amount, description, entityId: item.id, entityType, originalAmount: originalAmountData };
                        }
                        break;
                    case 'suppliers':
                    case 'vendors':
                    case 'commissionAgents':
                    case 'freightForwarders':
                    case 'clearingAgents':
                    case 'employees':
                        if (entityName === 'suppliers') entityType = 'supplier';
                        if (entityName === 'vendors') entityType = 'vendor';
                        if (entityName === 'commissionAgents') entityType = 'commissionAgent';
                        if (entityName === 'employees') entityType = 'employee';
                        if (entityName === 'freightForwarders') entityType = 'freightForwarder';
                        if (entityName === 'clearingAgents') entityType = 'clearingAgent';
        
                        if (isPositive) { // We owe them (Credit AP)
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: amount, description, entityId: item.id, entityType, originalAmount: originalAmountData };
                        } else { // They owe us (Debit AP)
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'AP-001', debit: amount, credit: 0, description, entityId: item.id, entityType, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        }
                        break;
                    
                    // Asset Accounts
                    case 'banks':
                    case 'cashAccounts':
                    case 'investmentAccounts':
                    case 'expenseAccounts': // Treating opening balance as a debit (e.g., prepaid)
                        if (isPositive) { // Asset has a debit balance
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: item.id, debit: amount, credit: 0, description, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        } else { // Asset has a credit balance (e.g. overdraft)
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: item.id, debit: 0, credit: amount, description, originalAmount: originalAmountData };
                        }
                        break;
                    
                    // Liability & Equity Accounts
                    case 'loanAccounts':
                    case 'capitalAccounts':
                        if (isPositive) { // Liability has a credit balance
                             debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: amount, credit: 0, description };
                             creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: item.id, debit: 0, credit: amount, description, originalAmount: originalAmountData };
                        } else { // Liability has a debit balance
                            debitEntry = { id: `je-d-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: item.id, debit: amount, credit: 0, description, originalAmount: originalAmountData };
                            creditEntry = { id: `je-c-ob-${item.id}`, voucherId, date, entryType: JournalEntryType.Journal, account: 'CAP-002', debit: 0, credit: amount, description };
                        }
                        break;
                }
        
                if (debitEntry && creditEntry) {
                    dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                    dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                }
            }
        }


        if (isEditing) {
            const originalItem = data.find(item => item.id === entityData.id);
            handleOpeningBalance(entityData as T, originalItem, false);
            dispatch({ type: 'UPDATE_ENTITY', payload: { entity: entityName, data: entityData as T } });

        } else {
            if (entityName === 'items') {
                const currentName = (entityData as any).name?.toLowerCase();
                if (currentName && data.some(d => (d as any).name?.toLowerCase() === currentName)) {
                    setError(`An item with this name already exists.`);
                    return;
                }
            } else if (entityName === 'vehicles') {
                const currentId = (entityData as any)['plateNumber'];
                if (currentId && data.some(d => (d as any)['plateNumber'] === currentId)) {
                    setError(`An item with this plate number already exists. Please use a unique value.`);
                    return;
                }
            }
            
            const newItem = { ...entityData };
            
            if (idGenerator) {
                newItem.id = idGenerator(data as any);
            }
            
            if(entityName === 'customers') {
                (newItem as unknown as Customer).status = Math.floor(Math.random() * 11);
            }

            if (entityName === 'items') {
                const itemData = newItem as unknown as Item;
                if (itemData.packingType === PackingType.Bales) {
                    itemData.nextBaleNumber = (Number(itemData.openingStock) || 0) + 1;
                }
            }

            dispatch({ type: 'ADD_ENTITY', payload: { entity: entityName, data: newItem as T } });

            // Handle Item Opening Stock
            if (entityName === 'items') {
                const itemData = newItem as unknown as Item;
                const openingStock = Number(itemData.openingStock) || 0;
                
                if (openingStock > 0) {
                    // 1. Create Production Entry to add stock
                    const productionEntry: Production = {
                        id: `prod_open_stock_${itemData.id}`,
                        date: new Date().toISOString().split('T')[0],
                        itemId: itemData.id,
                        quantityProduced: openingStock
                    };
                    dispatch({ type: 'ADD_ENTITY', payload: { entity: 'productions', data: productionEntry } });

                    // 2. Create Journal Entries for the value
                    const totalWeight = itemData.packingType !== PackingType.Kg
                        ? openingStock * (itemData.baleSize || 0)
                        : openingStock;
                    
                    const totalValue = totalWeight * itemData.avgProductionPrice;

                    if (totalValue > 0) {
                        const voucherId = `JV-${String(state.nextJournalVoucherNumber).padStart(3, '0')}`;
                        const date = new Date().toISOString().split('T')[0];
                        const description = `Opening Stock for ${itemData.name} (${itemData.id})`;

                        const debitEntry: JournalEntry = {
                            id: `je-d-os-${itemData.id}`, voucherId, date, entryType: JournalEntryType.Journal,
                            account: 'INV-FG-001',
                            debit: totalValue, credit: 0, description
                        };

                        const creditEntry: JournalEntry = {
                            id: `je-c-os-${itemData.id}`, voucherId, date, entryType: JournalEntryType.Journal,
                            account: 'CAP-002',
                            debit: 0, credit: totalValue, description
                        };

                        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debitEntry } });
                        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: creditEntry } });
                    }
                }
            }
            handleOpeningBalance(newItem as T, undefined, true);
        }
        showNotification(isEditing ? `${title.slice(0, -1)} updated successfully!` : `${title.slice(0, -1)} created successfully!`);
        onSaveSuccess();
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (!window.confirm('Are you sure you want to delete this item? This action may not be reversible if the item is in use.')) {
            return;
        }

        let isReferenced = false;
        let referenceMessage = '';
        const entityToDelete = data.find(item => item.id === id);

        const hasNonOBJournalEntries = state.journalEntries.some(je => (je.entityId === id || je.account === id) && !je.voucherId.startsWith('JV-'));

        if (hasNonOBJournalEntries) {
            isReferenced = true;
            referenceMessage = 'This account has transactions and cannot be deleted.';
        } else {
            switch (entityName) {
                case 'customers':
                    if (state.salesInvoices.some(inv => inv.customerId === id)) {
                        isReferenced = true;
                        referenceMessage = 'This customer is linked to sales invoices and cannot be deleted.';
                    }
                    break;
                case 'suppliers':
                    if (state.originalPurchases.some(p => p.supplierId === id) || state.finishedGoodsPurchases.some(p => p.supplierId === id)) {
                        isReferenced = true;
                        referenceMessage = 'This supplier is linked to purchases and cannot be deleted.';
                    }
                    break;
                case 'items':
                    const hasTransactions = state.productions.some(p => p.itemId === id && !p.id.startsWith('prod_open_stock_')) || state.salesInvoices.some(inv => inv.items.some(i => i.itemId === id));
                    if (hasTransactions) {
                        isReferenced = true;
                        referenceMessage = 'This item has been used in production or sales and cannot be deleted.';
                    }
                    break;
                case 'divisions':
                    if (state.subDivisions.some(sd => sd.divisionId === id) || state.customers.some(c => c.divisionId === id) || state.originalPurchases.some(p => p.divisionId === id)) {
                        isReferenced = true;
                        referenceMessage = 'This division is in use by sub-divisions, customers, or purchases and cannot be deleted.';
                    }
                    break;
                case 'categories':
                    if (state.items.some(i => i.categoryId === id)) {
                        isReferenced = true;
                        referenceMessage = 'This category is assigned to items and cannot be deleted.';
                    }
                    break;
                case 'sections':
                    if (state.items.some(i => i.sectionId === id)) {
                        isReferenced = true;
                        referenceMessage = 'This section is assigned to items and cannot be deleted.';
                    }
                    break;
            }
        }
        
        if (isReferenced) {
            alert(referenceMessage);
            return;
        }

        // Proceed with deletion if not referenced
        const debitEntryId = `je-d-ob-${id}`;
        const creditEntryId = `je-c-ob-${id}`;
        dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: debitEntryId } });
        dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: creditEntryId } });
        
        if (entityName === 'items' && entityToDelete && 'openingStock' in entityToDelete && (entityToDelete.openingStock || 0) > 0) {
            const prodId = `prod_open_stock_${id}`;
            const osDebitId = `je-d-os-${id}`;
            const osCreditId = `je-c-os-${id}`;
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'productions', id: prodId } });
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osDebitId } });
            dispatch({ type: 'DELETE_ENTITY', payload: { entity: 'journalEntries', id: osCreditId } });
        }

        dispatch({ type: 'DELETE_ENTITY', payload: { entity: entityName, id } });
        showNotification(`${title.slice(0, -1)} deleted successfully.`);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (!currentItem) return;
        const { name, value } = e.target;
        const fieldConfig = fields.find(f => f.key as string === name);
        
        let finalValue: any = value;

        if (fieldConfig?.type === 'number') {
            // Allow empty string, negative sign, and valid partial/full decimal numbers.
            // This prevents invalid characters from being entered.
            if (value !== '' && value !== '-' && !/^-?\d*\.?\d*$/.test(value)) {
                return; // Don't update state for invalid input
            }
        } else {
            // Keep existing boolean parsing for other types
            if (value === 'true') {
                finalValue = true;
            } else if (value === 'false') {
                finalValue = false;
            }
        }

        let updatedValues = {
            ...currentItem,
            [name]: finalValue,
        };

        if (name === 'divisionId') {
            (updatedValues as any).subDivisionId = '';
        }

        if (entityName === 'items') {
            if (name === 'packingType' && value === PackingType.Kg) {
                (updatedValues as unknown as Item).baleSize = 1;
            }
        }
        
        if (entityName === 'originalTypes' && name === 'packingType' && value === PackingType.Kg) {
            (updatedValues as unknown as OriginalType).packingSize = 1;
        }

        if (entityName === 'employees') {
             if (name === 'onDuty' && finalValue === true) {
                updatedValues.offDutyStatus = undefined;
                updatedValues.holidayStartDate = undefined;
                updatedValues.holidayEndDate = undefined;
            }

            if (name === 'offDutyStatus' && finalValue !== 'Holidays') {
                 updatedValues.holidayStartDate = undefined;
                 updatedValues.holidayEndDate = undefined;
            }
        }

        setCurrentItem(updatedValues);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200">
            <div
                className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 cursor-pointer rounded-t-xl"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={`crud-content-${entityName}`}
            >
                 <div className="flex items-center space-x-3">
                    <span className="text-slate-500">{icon}</span>
                    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                </div>
                <div className="flex items-center space-x-2">
                    {onOpenImportModal && entitiesWithImport.includes(entityName as any) && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onOpenImportModal(entityName); }} 
                            className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs font-semibold flex items-center space-x-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <span>Import from Excel</span>
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(); }} 
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-semibold flex items-center space-x-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <span>Add New</span>
                    </button>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            <div
                id={`crud-content-${entityName}`}
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px]' : 'max-h-0'}`}
            >
                <div className="p-4">
                    <div className="mb-4">
                        <div className="relative">
                             <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </span>
                            <input 
                                type="text"
                                placeholder={`Search in ${title}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 p-2 rounded-md"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto">
                            <thead>
                                <tr className="bg-slate-100">
                                    {columns.map(col => <th key={String(col.key)} className="p-3 font-semibold text-slate-600 text-sm">{col.header}</th>)}
                                    {userProfile?.isAdmin && <th className="p-3 font-semibold text-slate-600 text-sm text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        {columns.map(col => <td key={`${item.id}-${String(col.key)}`} className="p-3 text-slate-700 text-sm">{col.render ? col.render(item) : getDisplayValue(item, col.key)}</td>)}
                                        {userProfile?.isAdmin && (
                                            <td className="p-3 text-right">
                                                <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-800 mr-2 font-medium">Edit</button>
                                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredData.length === 0 && (
                            <p className="text-center text-slate-500 py-4">No results found for "{searchTerm}".</p>
                        )}
                    </div>
                </div>
            </div>

             {currentItem && (
                <Modal isOpen={isOpen} onClose={handleCloseModal} title={`${isEditing ? 'Edit' : 'Add'} ${title.slice(0, -1)}`} isForm>
                    {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p>{error}</p></div>}
                    <div className="space-y-4">
                        {fields
                            .filter(field => !field.showWhen || field.showWhen(currentItem as T))
                            .map(field => {
                            const isBaleSizeFieldForItems = entityName === 'items' && field.key === 'baleSize';
                            const isItemBaleSizeDisabled = isBaleSizeFieldForItems && (currentItem as unknown as Item).packingType === PackingType.Kg;

                            const isPackingSizeForOriginals = entityName === 'originalTypes' && field.key === 'packingSize';
                            const isOriginalPackingSizeDisabled = isPackingSizeForOriginals && (currentItem as unknown as OriginalType).packingType === PackingType.Kg;
                            
                            const isOpeningStockDisabled = entityName === 'items' && field.key === 'openingStock' && isEditing;
                            
                            const value = currentItem[field.key as keyof T];
                            let dynamicOptions = field.options;
                            let isDisabled = (isEditing && field.key === 'id') || isItemBaleSizeDisabled || isOriginalPackingSizeDisabled || isOpeningStockDisabled;

                            if (field.key === 'subDivisionId') {
                                const divisionId = (currentItem as any).divisionId;
                                if (divisionId) {
                                    dynamicOptions = state.subDivisions
                                        .filter(sd => sd.divisionId === divisionId)
                                        .map(sd => ({ value: sd.id, label: sd.name }));
                                } else {
                                    dynamicOptions = [];
                                    isDisabled = true;
                                }
                            }

                            return (
                                <React.Fragment key={String(field.key)}>
                                    {field.subtitle && <h5 className="text-md font-semibold text-slate-700 border-t pt-4 -mb-2">{field.subtitle}</h5>}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        {field.type === 'select' ? (
                                            <select
                                                name={String(field.key)}
                                                value={String(value ?? '')}
                                                onChange={handleChange}
                                                disabled={isDisabled}
                                                className="w-full p-2 rounded-md"
                                            >
                                                <option value="">Select {field.label}</option>
                                                {dynamicOptions?.map(opt => <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>)}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                name={String(field.key)}
                                                value={String(value || '')}
                                                onChange={handleChange}
                                                disabled={isDisabled}
                                                rows={field.rows || 3}
                                                className="w-full p-2 rounded-md"
                                            />
                                        ) : (
                                            <input
                                                type={field.type}
                                                name={String(field.key)}
                                                value={String(value ?? '')}
                                                onChange={handleChange}
                                                disabled={isDisabled}
                                                className="w-full p-2 rounded-md"
                                                step={field.type === 'number' ? 'any' : undefined}
                                            />
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        <div className="flex justify-end pt-4">
                            <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md mr-2 hover:bg-slate-300">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- SVG Icons ---
const Icons = {
    'users': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 01-5.197-9" /></svg>,
    'truck': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17H6V6h12v4l-4 4H9" /></svg>,
    'briefcase': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    'cube': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 0v10l8 4m0-14L4 7" /></svg>,
    'tag': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M7 15h2v2H7z" /><path d="M15 15h2v2h-2z" /><path d="M7 20h2v2H7z" /><path d="M15 20h2v2h-2z" /></svg>,
    'view-grid': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    'office-building': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1m-1-8h1m-5 8h1m-1-4h1" /></svg>,
    'cash': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    'credit-card': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    'archive': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    'receipt-tax': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5.99h.01M17 21V5a2 2 0 00-2-2H9a2 2 0 00-2 2v16l-3-2 3 2 3-2 3 2 3-2z" /></svg>,
    'clipboard-list': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    'question-mark-circle': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    'car': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m-4 4l-4 4m4-4H3m14 4l4-4m-4 4l-4 4m4-4H3" /></svg>,
    'warehouse': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
};


interface SetupModuleProps {
    setModule?: (module: Module) => void;
    userProfile: UserProfile | null;
    isModalMode?: boolean;
    modalTarget?: string;
    onModalClose?: () => void;
    onModalSave?: () => void;
    initialSection?: string | null;
}

const SetupModule: React.FC<SetupModuleProps> = ({ userProfile, isModalMode = false, modalTarget, onModalClose, onModalSave, initialSection }) => {
    const { state } = useData();
    const [notification, setNotification] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [importModalConfig, setImportModalConfig] = useState<{ isOpen: boolean; entityName: ImportableEntity | null }>({ isOpen: false, entityName: null });
    
    const crudComponents = useMemo(() => ({
        partners: [
            { title: 'Customers', entityName: 'customers', data: state.customers, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'contact', header: 'Contact' }, { key: 'address', header: 'Address' }, { key: 'divisionId', header: 'Division', render: (item: Customer) => state.divisions.find(d => d.id === item.divisionId)?.name || '' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'divisionId', label: 'Division', type: 'select', options: state.divisions.map(d => ({ value: d.id, label: d.name })) }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateCustomerId, initialState: { name: '', contact: '', address: '', divisionId: '', defaultCurrency: Currency.Dollar } as any, icon: Icons.users },
            { title: 'Suppliers (Raw Material)', entityName: 'suppliers', data: state.suppliers, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'contact', header: 'Contact' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateSupplierId, initialState: { name: '', contact: '', address: '' } as any, icon: Icons.truck },
            { title: 'Vendors (Services/Packing)', entityName: 'vendors', data: state.vendors, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'contact', header: 'Contact' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateVendorId, initialState: { name: '', contact: '', address: '' } as any, icon: Icons.briefcase },
            { title: 'Sub-Suppliers', entityName: 'subSuppliers', data: state.subSuppliers, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'supplierId', header: 'Main Supplier', render: (item: SubSupplier) => state.suppliers.find(s => s.id === item.supplierId)?.name || '' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'supplierId', label: 'Main Supplier', type: 'select', options: state.suppliers.map(s => ({ value: s.id, label: s.name })), required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }], idGenerator: generateSubSupplierId, initialState: { name: '', supplierId: '' } as any, icon: Icons.users },
            { title: 'Commission Agents', entityName: 'commissionAgents', data: state.commissionAgents, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Agent Name' }, { key: 'contact', header: 'Contact' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Agent Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateCommissionAgentId, initialState: { name: '', contact: '', address: '', defaultCurrency: Currency.Dollar } as any, icon: Icons.briefcase },
            { title: 'Freight Forwarders', entityName: 'freightForwarders', data: state.freightForwarders, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Forwarder Name' }, { key: 'contact', header: 'Contact' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Forwarder Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateFreightForwarderId, initialState: { name: '', contact: '', address: '', defaultCurrency: Currency.Dollar } as any, icon: Icons.truck },
            { title: 'Clearing Agents', entityName: 'clearingAgents', data: state.clearingAgents, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Agent Name' }, { key: 'contact', header: 'Contact' }, { key: 'defaultCurrency', header: 'Currency' }], fields: [{ key: 'name', label: 'Agent Name', type: 'text', required: true }, { key: 'contact', label: 'Contact', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })) }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateClearingAgentId, initialState: { name: '', contact: '', address: '', defaultCurrency: Currency.Dollar } as any, icon: Icons.truck },
        ],
        inventory: [
            { title: 'Items', entityName: 'items', data: state.items, columns: [{ key: 'id', header: 'Code' }, { key: 'name', header: 'Name' }, { key: 'categoryId', header: 'Category', render: (item: Item) => state.categories.find(c => c.id === item.categoryId)?.name || '' }, { key: 'avgProductionPrice', header: 'Avg Prod Price' }, { key: 'avgSalesPrice', header: 'Avg Sales Price' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'categoryId', label: 'Category', type: 'select', options: state.categories.map(c => ({ value: c.id, label: c.name })), required: true }, { key: 'sectionId', label: 'Section', type: 'select', options: state.sections.map(s => ({ value: s.id, label: s.name })) }, { key: 'packingType', label: 'Packing Type', type: 'select', options: Object.values(PackingType).map(pt => ({ value: pt, label: pt })), required: true }, { key: 'baleSize', label: 'Packing Size (Kg/Unit)', type: 'number' }, { key: 'packingColor', label: 'Packing Color', type: 'text' }, { key: 'avgProductionPrice', label: 'Average Production Price ($/Kg)', type: 'number', required: true }, { key: 'avgSalesPrice', label: 'Average Sales Price ($/Kg)', type: 'number' }, { key: 'demandFactor', label: 'Demand Factor (1-10)', type: 'number' }, { key: 'openingStock', label: 'Opening Stock (Units)', type: 'number' }], idGenerator: generateItemId, initialState: { name: '', categoryId: '', packingType: PackingType.Bales, baleSize: 0, packingColor: '', avgProductionPrice: 0, avgSalesPrice: 0, demandFactor: 5 } as any, icon: Icons.cube },
            { title: 'Original Types', entityName: 'originalTypes', data: state.originalTypes, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'packingType', header: 'Packing Type' }, { key: 'packingSize', header: 'Size (Kg)' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'packingType', label: 'Packing Type', type: 'select', options: Object.values(PackingType).map(pt => ({ value: pt, label: pt })), required: true }, { key: 'packingSize', label: 'Packing Size (Kg)', type: 'number' }], idGenerator: generateOriginalTypeId, initialState: { name: '', packingType: PackingType.Bales, packingSize: 0 } as any, icon: Icons.cube },
            { title: 'Original Products', entityName: 'originalProducts', data: state.originalProducts, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'originalTypeId', header: 'Original Type', render: (item: OriginalProduct) => state.originalTypes.find(ot => ot.id === item.originalTypeId)?.name || '' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'originalTypeId', label: 'Original Type', type: 'select', options: state.originalTypes.map(ot => ({ value: ot.id, label: ot.name })), required: true }, { key: 'description', label: 'Description', type: 'textarea' }], idGenerator: generateOriginalProductId, initialState: { name: '', originalTypeId: '' } as any, icon: Icons.cube },
            { title: 'Categories', entityName: 'categories', data: state.categories, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateCategoryId, initialState: { name: '' } as any, icon: Icons.tag },
            { title: 'Sections', entityName: 'sections', data: state.sections, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateSectionId, initialState: { name: '' } as any, icon: Icons['view-grid'] },
        ],
        structure: [
            { title: 'Divisions', entityName: 'divisions', data: state.divisions, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateDivisionId, initialState: { name: '' } as any, icon: Icons['office-building'] },
            { title: 'Sub-Divisions', entityName: 'subDivisions', data: state.subDivisions, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'divisionId', header: 'Parent Division', render: (item: SubDivision) => state.divisions.find(d => d.id === item.divisionId)?.name || '' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'divisionId', label: 'Parent Division', type: 'select', options: state.divisions.map(d => ({ value: d.id, label: d.name })), required: true }], idGenerator: generateSubDivisionId, initialState: { name: '', divisionId: '' } as any, icon: Icons['office-building'] },
            { title: 'Warehouses', entityName: 'warehouses', data: state.warehouses, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateWarehouseId, initialState: { name: '' } as any, icon: Icons.warehouse },
            { title: 'Logos', entityName: 'logos', data: state.logos, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateLogoId, initialState: { name: '' } as any, icon: Icons.tag },
        ],
        assets: [
            { title: 'Asset Types', entityName: 'assetTypes', data: state.assetTypes, columns: [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], idGenerator: generateAssetTypeId, initialState: { name: '' } as any, icon: Icons.briefcase },
        ],
        accounts: [
            { title: 'Banks', entityName: 'banks', data: state.banks, columns: [{ key: 'id', header: 'ID' }, { key: 'accountTitle', header: 'Account Title' }, { key: 'accountNumber', header: 'Account Number' }, { key: 'currency', header: 'Currency' }], fields: [{ key: 'accountTitle', label: 'Account Title', type: 'text', required: true }, { key: 'accountNumber', label: 'Account Number', type: 'text' }, { key: 'currency', label: 'Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })), required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateBankId, initialState: { accountTitle: '', accountNumber: '', currency: Currency.Dollar } as any, icon: Icons['credit-card'] },
            { title: 'Cash Accounts', entityName: 'cashAccounts', data: state.cashAccounts, columns: [{key: 'id', header: 'ID'}, {key: 'name', header: 'Account Name'}, {key: 'currency', header: 'Currency'}], fields: [ { key: 'name', label: 'Account Name', type: 'text', required: true }, { key: 'currency', label: 'Currency', type: 'select', options: Object.values(Currency).map(c => ({ value: c, label: c })), required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateCashAccountId, initialState: { name: '', currency: Currency.Dollar } as any, icon: Icons.cash },
            { title: 'Loan Accounts', entityName: 'loanAccounts', data: state.loanAccounts, columns: [{key: 'id', header: 'ID'}, {key: 'name', header: 'Account Name'}], fields: [{ key: 'name', label: 'Account Name', type: 'text', required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateLoanAccountId, initialState: { name: '' } as any, icon: Icons['credit-card'] },
            { title: 'Capital Accounts', entityName: 'capitalAccounts', data: state.capitalAccounts, columns: [{key: 'id', header: 'ID'}, {key: 'name', header: 'Account Name'}], fields: [{ key: 'name', label: 'Account Name', type: 'text', required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateCapitalAccountId, initialState: { name: '' } as any, icon: Icons.archive },
            { title: 'Investment Accounts', entityName: 'investmentAccounts', data: state.investmentAccounts, columns: [{key: 'id', header: 'ID'}, {key: 'name', header: 'Account Name'}], fields: [{ key: 'name', label: 'Account Name', type: 'text', required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateInvestmentAccountId, initialState: { name: '' } as any, icon: Icons.archive },
            { title: 'Expense Accounts', entityName: 'expenseAccounts', data: state.expenseAccounts, columns: [{key: 'id', header: 'ID'}, {key: 'name', header: 'Account Name'}], fields: [{ key: 'name', label: 'Account Name', type: 'text', required: true }, { key: 'startingBalance', label: 'Opening Balance', type: 'number' }], idGenerator: generateExpenseAccountId, initialState: { name: '' } as any, icon: Icons['receipt-tax'] },
        ]
    }), [state]);

    useEffect(() => {
        if (isModalMode && modalTarget) {
            setActiveModal(modalTarget);
        }
    }, [isModalMode, modalTarget]);
    
    // This effect now ONLY sets the active modal for the special case of being in modalMode.
    // The main navigation behavior is handled by the CrudManager's isInitiallyExpanded prop.
    useEffect(() => {
        if (initialSection && !isModalMode) {
            // Do nothing here, expansion is handled by CrudManager
        } else if (initialSection && isModalMode) {
            // Retain modal opening logic for modalMode
            const allCruds = Object.values(crudComponents).flat() as { entityName: string }[];
            const targetCrud = allCruds.find(c => c.entityName === initialSection);
            if (targetCrud) {
                setActiveModal(initialSection);
            }
        }
    }, [initialSection, crudComponents, isModalMode]);
    
    const showNotification = (message: string) => {
        setNotification(message);
    };

    const handleModalClose = () => {
        setActiveModal(null);
        if (isModalMode && onModalClose) {
            onModalClose();
        }
    };

    const handleSaveSuccess = () => {
        if (isModalMode && onModalSave) {
            onModalSave();
        }
    };
    
    if (isModalMode) {
        const allCruds = Object.values(crudComponents).flat() as { entityName: string }[];
        const modalCrud = allCruds.find(c => c.entityName === modalTarget);
        if (!modalCrud) {
            return null;
        }
        return (
             <>
                {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
                <CrudManager
                    {...(modalCrud as any)}
                    state={state}
                    showNotification={showNotification}
                    isOpen={true}
                    onOpen={() => {}}
                    onClose={handleModalClose}
                    onSaveSuccess={handleSaveSuccess}
                    onOpenImportModal={() => {}}
                    userProfile={userProfile}
                />
            </>
        );
    }
    
    return (
        <>
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
             {importModalConfig.isOpen && (
                <ExcelImportModal
                    entityName={importModalConfig.entityName as ImportableEntity}
                    onClose={() => setImportModalConfig({ isOpen: false, entityName: null })}
                    showNotification={showNotification}
                />
            )}
            <div className="space-y-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-slate-700 mb-4">Data Management</h2>
                    <button 
                        onClick={() => setImportModalConfig({ isOpen: true, entityName: 'originalStock' })} 
                        className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors text-sm font-semibold flex items-center space-x-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Import Original Purchases</span>
                    </button>
                    <p className="text-xs text-slate-500 mt-2">Upload a CSV of previously purchased original/raw stock. This will create 'Original Purchase' records and the corresponding accounting entries.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-800">Business Partners</h2>
                            {crudComponents.partners.map(crudProps => (
                                <CrudManager key={crudProps.entityName} {...(crudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === crudProps.entityName} onOpen={() => setActiveModal(crudProps.entityName)} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} isInitiallyExpanded={initialSection === crudProps.entityName} />
                            ))}
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-800">Company Structure</h2>
                            {crudComponents.structure.map(crudProps => (
                                <CrudManager key={crudProps.entityName} {...(crudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === crudProps.entityName} onOpen={() => setActiveModal(crudProps.entityName)} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} isInitiallyExpanded={initialSection === crudProps.entityName} />
                            ))}
                        </div>
                         <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-800">Asset Management</h2>
                            {crudComponents.assets.map(crudProps => (
                                <CrudManager key={crudProps.entityName} {...(crudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === crudProps.entityName} onOpen={() => setActiveModal(crudProps.entityName)} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} isInitiallyExpanded={initialSection === crudProps.entityName} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-800">Inventory & Products</h2>
                            {crudComponents.inventory.map(crudProps => (
                                <CrudManager key={crudProps.entityName} {...(crudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === crudProps.entityName} onOpen={() => setActiveModal(crudProps.entityName)} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} isInitiallyExpanded={initialSection === crudProps.entityName} />
                            ))}
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-800">Chart of Accounts</h2>
                            {crudComponents.accounts.map(crudProps => (
                                <CrudManager key={crudProps.entityName} {...(crudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === crudProps.entityName} onOpen={() => setActiveModal(crudProps.entityName)} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} isInitiallyExpanded={initialSection === crudProps.entityName} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};



// --- START HR MODULE ---

const TasksModule: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');
    const [editingStates, setEditingStates] = useState<Record<string, Partial<HRTask>>>({});
    const [isExpanded, setIsExpanded] = useState(true);

    const handleAcknowledgeTask = (id: string, isAcknowledged: boolean) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrTasks', data: { id, isAcknowledged } } });
    };

    const sortedTasks = useMemo(() => {
        return [...state.hrTasks].sort((a, b) => {
            const aAck = a.isAcknowledged || false;
            const bAck = b.isAcknowledged || false;
            if (aAck === bAck) {
                return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
            }
            return aAck ? 1 : -1;
        });
    }, [state.hrTasks]);

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newTask: HRTask = {
            id: `hr_task_${Date.now()}`,
            description,
            isDone: false,
            comments: '',
            creationDate: new Date().toISOString().split('T')[0],
            isAcknowledged: false,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrTasks', data: newTask } });
        setDescription('');
    };

    const handleUpdate = (id: string, field: keyof HRTask, value: any) => {
        setEditingStates(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleSaveTask = (id: string) => {
        const originalTask = state.hrTasks.find(t => t.id === id);
        if (!originalTask) return;
        
        const updates = editingStates[id];
        if (!updates) return;

        const updatedTask = {
            ...originalTask,
            ...updates,
            completionDate: updates.isDone && !originalTask.isDone ? new Date().toISOString().split('T')[0] : originalTask.completionDate,
        };

        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrTasks', data: updatedTask } });
        
        setEditingStates(prev => {
            const newStates = { ...prev };
            delete newStates[id];
            return newStates;
        });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200">
            <div
                className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 cursor-pointer rounded-t-xl"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-3">
                    <span className="text-slate-500">{Icons['clipboard-list']}</span>
                    <h3 className="text-lg font-semibold text-slate-800">Task Management</h3>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px]' : 'max-h-0'}`}>
                <div className="p-4 space-y-6">
                    <form onSubmit={handleAddTask} className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Task for HR</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., 'Prepare visa renewal documents for employee X'" className="w-full p-2 rounded-md"/>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 h-10">Add Task</button>
                    </form>
                    <div className="space-y-4">
                        {sortedTasks.map(task => {
                            const isEditing = !!editingStates[task.id];
                            const currentData = { ...task, ...(editingStates[task.id] || {}) };
                            const isAcknowledged = task.isAcknowledged || false;
                            return (
                                <div key={task.id} className={`p-4 border rounded-md transition-colors ${isAcknowledged ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-300'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="pt-1">
                                            <label htmlFor={`ack-task-${task.id}`} className="sr-only">Acknowledge Task</label>
                                            <input
                                                id={`ack-task-${task.id}`}
                                                type="checkbox"
                                                title="Acknowledge this task to remove it from the new tasks alert."
                                                checked={isAcknowledged}
                                                onChange={e => handleAcknowledgeTask(task.id, e.target.checked)}
                                                className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex-grow">
                                            <p className={`text-slate-800 ${isAcknowledged ? 'font-normal' : 'font-semibold'}`}>{currentData.description}</p>
                                            <p className="text-xs text-slate-500">Created: {currentData.creationDate}</p>
                                            <div className="mt-4 flex items-start gap-4">
                                                <label className="flex items-center space-x-2">
                                                    <input type="checkbox" checked={currentData.isDone} onChange={e => handleUpdate(task.id, 'isDone', e.target.checked)} className="h-5 w-5 rounded text-green-600 focus:ring-green-500"/>
                                                    <span className={currentData.isDone ? 'text-green-700 font-semibold' : ''}>Done</span>
                                                </label>
                                                <div className="flex-grow">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Comments</label>
                                                    <textarea value={currentData.comments} onChange={e => handleUpdate(task.id, 'comments', e.target.value)} rows={2} className="w-full p-2 rounded-md text-sm"/>
                                                </div>
                                            </div>
                                            {isEditing && <div className="text-right mt-2"><button onClick={() => handleSaveTask(task.id)} className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700">Save Changes</button></div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EnquiriesModule: React.FC<{ userProfile: UserProfile | null }> = ({ userProfile }) => {
    const { state, dispatch } = useData();
    const [description, setDescription] = useState('');
    const [editingStates, setEditingStates] = useState<Record<string, Partial<HREnquiry>>>({});
    const [isExpanded, setIsExpanded] = useState(true);

    const handleAcknowledgeEnquiry = (id: string, isAcknowledged: boolean) => {
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrEnquiries', data: { id, isAcknowledged } } });
    };

    const sortedEnquiries = useMemo(() => {
        return [...state.hrEnquiries].sort((a, b) => {
            const aAck = a.isAcknowledged || false;
            const bAck = b.isAcknowledged || false;
            if (aAck === bAck) {
                return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
            }
            return aAck ? 1 : -1;
        });
    }, [state.hrEnquiries]);

    const handleAddEnquiry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;
        const newEnquiry: HREnquiry = {
            id: `hr_enq_${Date.now()}`,
            description,
            isApproved: false,
            comments: '',
            creationDate: new Date().toISOString().split('T')[0],
            isAcknowledged: false,
        };
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'hrEnquiries', data: newEnquiry } });
        setDescription('');
    };
    
    const handleUpdate = (id: string, field: keyof HREnquiry, value: any) => {
        setEditingStates(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleSaveEnquiry = (id: string) => {
        const original = state.hrEnquiries.find(t => t.id === id);
        if (!original) return;
        
        const updates = editingStates[id];
        if (!updates) return;

        const updatedEnquiry = { ...original, ...updates, approvalDate: updates.isApproved && !original.isApproved ? new Date().toISOString().split('T')[0] : original.approvalDate, };
        dispatch({ type: 'UPDATE_ENTITY', payload: { entity: 'hrEnquiries', data: updatedEnquiry } });
        
        setEditingStates(prev => { const newStates = { ...prev }; delete newStates[id]; return newStates; });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200">
             <div
                className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-200 cursor-pointer rounded-t-xl"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-3">
                    <span className="text-slate-500">{Icons['question-mark-circle']}</span>
                    <h3 className="text-lg font-semibold text-slate-800">Enquiry Management</h3>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
             <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px]' : 'max-h-0'}`}>
                <div className="p-4 space-y-6">
                    <form onSubmit={handleAddEnquiry} className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Enquiry / Request for Approval</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., 'Request for advance salary for employee Y'" className="w-full p-2 rounded-md"/>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 h-10">Submit Enquiry</button>
                    </form>
                     <div className="space-y-4">
                        {sortedEnquiries.map(enquiry => {
                            const isEditing = !!editingStates[enquiry.id];
                            const currentData = { ...enquiry, ...(editingStates[enquiry.id] || {}) };
                             const isAcknowledged = enquiry.isAcknowledged || false;
                            return (
                                <div key={enquiry.id} className={`p-4 border rounded-md transition-colors ${isAcknowledged ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-300'}`}>
                                     <div className="flex items-start gap-3">
                                         <div className="pt-1">
                                            <input id={`ack-enq-${enquiry.id}`} type="checkbox" title="Acknowledge this enquiry" checked={isAcknowledged} onChange={e => handleAcknowledgeEnquiry(enquiry.id, e.target.checked)} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"/>
                                        </div>
                                         <div className="flex-grow">
                                            <p className={`text-slate-800 ${isAcknowledged ? 'font-normal' : 'font-semibold'}`}>{currentData.description}</p>
                                            <p className="text-xs text-slate-500">Created: {currentData.creationDate}</p>
                                             <div className="mt-4 flex items-start gap-4">
                                                <label className="flex items-center space-x-2">
                                                    <input type="checkbox" checked={currentData.isApproved} onChange={e => handleUpdate(enquiry.id, 'isApproved', e.target.checked)} className="h-5 w-5 rounded text-green-600 focus:ring-green-500"/>
                                                     <span className={currentData.isApproved ? 'text-green-700 font-semibold' : ''}>{currentData.isApproved ? 'Approved' : 'Approve'}</span>
                                                </label>
                                                 <div className="flex-grow">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Comments/Decision</label>
                                                    <textarea value={currentData.comments} onChange={e => handleUpdate(enquiry.id, 'comments', e.target.value)} rows={2} className="w-full p-2 rounded-md text-sm"/>
                                                </div>
                                            </div>
                                             {isEditing && <div className="text-right mt-2"><button onClick={() => handleSaveEnquiry(enquiry.id)} className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700">Save Changes</button></div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface HRModuleProps {
    userProfile: UserProfile | null;
    initialView?: string | null;
}

export const HRModule: React.FC<HRModuleProps> = ({ userProfile, initialView }) => {
    const { state } = useData();
    const [activeView, setActiveView] = useState<'employees' | 'attendance' | 'payroll' | 'tasks' | 'enquiries' | 'vehicles'>(initialView as any || 'employees');
    const [notification, setNotification] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [importModalConfig, setImportModalConfig] = useState<{ isOpen: boolean; entityName: ImportableEntity | null }>({ isOpen: false, entityName: null });

    useEffect(() => {
        if(initialView) {
            setActiveView(initialView as any);
        }
    }, [initialView]);

    const showNotification = (message: string) => {
        setNotification(message);
    };

    const handleModalClose = () => setActiveModal(null);
    const handleSaveSuccess = () => {};

    const employeeCrudProps = {
        title: 'Employees',
        entityName: 'employees' as const,
        data: state.employees,
        columns: [
            { key: 'id' as const, header: 'ID' },
            { key: 'fullName' as const, header: 'Name' },
            { key: 'designation' as const, header: 'Designation' },
            { key: 'status' as const, header: 'Status' }
        ],
        fields: [
            { key: 'fullName' as const, label: 'Full Name', type: 'text' as const, required: true, subtitle: 'Personal Information' },
            { key: 'dateOfBirth' as const, label: 'Date of Birth', type: 'date' as const, required: true },
            { key: 'nationality' as const, label: 'Nationality', type: 'text' as const, required: true },
            { key: 'address' as const, label: 'Address', type: 'textarea' as const },
            { key: 'phone' as const, label: 'Phone', type: 'text' as const },
            { key: 'email' as const, label: 'Email', type: 'text' as const },
            { key: 'joiningDate' as const, label: 'Joining Date', type: 'date' as const, required: true, subtitle: 'Employment Details' },
            { key: 'designation' as const, label: 'Designation', type: 'text' as const, required: true },
            { key: 'status' as const, label: 'Status', type: 'select' as const, options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }], required: true },
            { key: 'onDuty' as const, label: 'On Duty', type: 'select' as const, options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], required: true },
            { key: 'offDutyStatus' as const, label: 'Off Duty Reason', type: 'select' as const, options: [{ value: 'Holidays', label: 'Holidays' }, { value: 'Fired', label: 'Fired' }], showWhen: (item: any) => !item.onDuty },
            { key: 'holidayStartDate' as const, label: 'Holiday Start', type: 'date' as const, showWhen: (item: any) => !item.onDuty && item.offDutyStatus === 'Holidays' },
            { key: 'holidayEndDate' as const, label: 'Holiday End', type: 'date' as const, showWhen: (item: any) => !item.onDuty && item.offDutyStatus === 'Holidays' },
            { key: 'companyVisa' as const, label: 'Company Visa', type: 'select' as const, options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], subtitle: 'Visa & Passport' },
            { key: 'passportNumber' as const, label: 'Passport Number', type: 'text' as const },
            { key: 'passportExpiryDate' as const, label: 'Passport Expiry', type: 'date' as const },
            { key: 'visaStatus' as const, label: 'Visa Status', type: 'text' as const },
            { key: 'visaExpiryDate' as const, label: 'Visa Expiry', type: 'date' as const },
            { key: 'biennialLeaveDueDate' as const, label: 'Biennial Leave Due', type: 'date' as const, subtitle: 'Leave Details' },
            { key: 'biennialLeaveStatus' as const, label: 'Biennial Leave Status', type: 'select' as const, options: [{ value: 'Pending', label: 'Pending' }, { value: 'Consumed', label: 'Consumed' }], required: true },
            { key: 'bankName' as const, label: 'Bank Name', type: 'text' as const, subtitle: 'Financial Information' },
            { key: 'accountNumber' as const, label: 'Account Number', type: 'text' as const },
            { key: 'iban' as const, label: 'IBAN', type: 'text' as const },
            { key: 'basicSalary' as const, label: 'Basic Salary', type: 'number' as const, required: true },
            { key: 'salaryIncrementDate' as const, label: 'Next Increment Date', type: 'date' as const },
            { key: 'advances' as const, label: 'Advances Balance', type: 'number' as const },
            { key: 'startingBalance' as const, label: 'Opening Balance (Payable/Receivable)', type: 'number' as const },
            { key: 'complaintsOrIssues' as const, label: 'Complaints or Issues', type: 'textarea' as const, subtitle: 'Other' },
        ],
        idGenerator: generateEmployeeId,
        initialState: { fullName: '', dateOfBirth: '', joiningDate: '', designation: '', status: 'Active', onDuty: true, companyVisa: true, nationality: '', biennialLeaveStatus: 'Pending', basicSalary: 0 } as any,
        icon: Icons.users
    };
    
    const vehicleCrudProps = {
        title: 'Vehicles',
        entityName: 'vehicles' as const,
        data: state.vehicles,
        columns: [
            { key: 'plateNumber' as const, header: 'Plate #' },
            { key: 'model' as const, header: 'Model' },
            { key: 'status' as const, header: 'Status' },
            { key: 'assignedTo' as const, header: 'Assigned To', render: (item: any) => state.employees.find(e => e.id === item.assignedTo)?.fullName || 'N/A' },
        ],
        fields: [
            { key: 'plateNumber' as const, label: 'Plate Number', type: 'text' as const, required: true },
            { key: 'model' as const, label: 'Model', type: 'text' as const, required: true },
            { key: 'registrationExpiry' as const, label: 'Registration Expiry', type: 'date' as const, required: true },
            { key: 'insuranceExpiry' as const, label: 'Insurance Expiry', type: 'date' as const, required: true },
            { key: 'assignedTo' as const, label: 'Assigned To', type: 'select' as const, options: state.employees.map(e => ({ value: e.id, label: e.fullName })) },
            { key: 'status' as const, label: 'Status', type: 'select' as const, options: Object.values(VehicleStatus).map(s => ({ value: s, label: s })), required: true },
            { key: 'remarks' as const, label: 'Remarks', type: 'textarea' as const },
            // Fields for adding a fine/expense
            { subtitle: 'Add a Charge to Responsible Employee', key: 'expenseSubtitle' as any, label: '', type: 'text' as const },
            { key: 'expenseType' as any, label: 'Charge Type', type: 'text' as const, placeholder: 'e.g., Traffic Fine, Damage Repair' },
            { key: 'expenseAmount' as any, label: 'Amount ($)', type: 'number' as const },
            { key: 'responsibleEmployeeId' as any, label: 'Responsible Employee', type: 'select' as const, options: state.employees.map(e => ({ value: e.id, label: e.fullName })) },
        ],
        idGenerator: generateVehicleId,
        initialState: { plateNumber: '', model: '', registrationExpiry: '', insuranceExpiry: '', status: VehicleStatus.Active } as any,
        icon: Icons.car
    };
    
    const renderView = () => {
        switch(activeView) {
            case 'employees': return <CrudManager {...(employeeCrudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === 'employees'} onOpen={() => setActiveModal('employees')} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} onOpenImportModal={(entity) => setImportModalConfig({ isOpen: true, entityName: entity as ImportableEntity })} userProfile={userProfile} />;
            case 'attendance': return <div className="bg-white p-6 rounded-lg shadow-md"><AttendanceRegister userProfile={userProfile} /></div>;
            case 'payroll': return <div className="bg-white p-6 rounded-lg shadow-md"><SalaryCalculator /></div>;
            case 'tasks': return <TasksModule userProfile={userProfile} />;
            case 'enquiries': return <EnquiriesModule userProfile={userProfile} />;
            case 'vehicles': return <CrudManager {...(vehicleCrudProps as any)} state={state} showNotification={showNotification} isOpen={activeModal === 'vehicles'} onOpen={() => setActiveModal('vehicles')} onClose={handleModalClose} onSaveSuccess={handleSaveSuccess} userProfile={userProfile} />;
            default: return <div>Select a module</div>;
        }
    };
    
    const navButtons = [
        { key: 'employees', label: 'Employees', icon: Icons.users },
        { key: 'attendance', label: 'Attendance', icon: Icons['clipboard-list'] },
        { key: 'payroll', label: 'Payroll', icon: Icons['receipt-tax'] },
        { key: 'tasks', label: 'Tasks', icon: Icons['clipboard-list'] },
        { key: 'enquiries', label: 'Enquiries', icon: Icons['question-mark-circle'] },
        { key: 'vehicles', label: 'Vehicles', icon: Icons.car },
    ];

    return (
        <div className="space-y-6">
            {notification && <Notification message={notification} onTimeout={() => setNotification(null)} />}
             {importModalConfig.isOpen && (
                <ExcelImportModal
                    entityName={importModalConfig.entityName as ImportableEntity}
                    onClose={() => setImportModalConfig({ isOpen: false, entityName: null })}
                    showNotification={showNotification}
                />
            )}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-700 mr-4">Human Resources</h2>
                    {navButtons.map(btn => (
                        <button key={btn.key} onClick={() => setActiveView(btn.key as any)} className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeView === btn.key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                {renderView()}
            </div>
        </div>
    );
};
export default SetupModule;