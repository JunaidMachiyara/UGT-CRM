import React from 'react';
import { Currency } from '../../types.ts';

interface CurrencyInputProps {
    value: { currency: Currency; conversionRate: number };
    onChange: (newValue: { currency: Currency; conversionRate: number }) => void;
    idPrefix?: string;
    selectTabIndex?: number;
    rateTabIndex?: number;
    disabled?: boolean;
}

const currencies = Object.values(Currency);

const defaultConversionRates: { [key: string]: number } = {
    [Currency.AustralianDollar]: 0.66,
    [Currency.Pound]: 1.34,
    [Currency.AED]: 0.2725,
    [Currency.SaudiRiyal]: 0.27,
    [Currency.Euro]: 1.17,
    [Currency.Dollar]: 1,
};


const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, idPrefix = 'currency', selectTabIndex, rateTabIndex, disabled = false }) => {
    
    const handleCurrencySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCurrency = e.target.value as Currency;
        const newRate = defaultConversionRates[newCurrency] || 1;
        
        onChange({ currency: newCurrency, conversionRate: newRate });
    };

    const handleRateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...value, conversionRate: Number(e.target.value) || 0 });
    };

    const isRateDisabled = value.currency === Currency.Dollar;
    const isRateVisible = value.currency !== Currency.Dollar;
    
    const ratePlaceholder = `$ per ${value.currency}`;

    return (
        <div className="flex items-center space-x-2">
            <div className={isRateVisible ? 'w-1/2' : 'w-full'}>
                <label htmlFor={`${idPrefix}-type`} className="sr-only">Currency</label>
                <select
                    id={`${idPrefix}-type`}
                    value={value.currency}
                    onChange={handleCurrencySelect}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm h-10 disabled:bg-slate-200"
                    tabIndex={selectTabIndex}
                    disabled={disabled}
                >
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            {isRateVisible && (
                <div className="w-1/2">
                    <label htmlFor={`${idPrefix}-rate`} className="sr-only">Conversion Rate</label>
                    <input
                        id={`${idPrefix}-rate`}
                        type="number"
                        value={value.conversionRate}
                        onChange={handleRateInputChange}
                        disabled={disabled || isRateDisabled}
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-200 text-sm h-10"
                        placeholder={ratePlaceholder}
                        step="0.0001"
                        min="0"
                        aria-label="Conversion Rate"
                        tabIndex={rateTabIndex}
                    />
                </div>
            )}
        </div>
    );
};

export default CurrencyInput;