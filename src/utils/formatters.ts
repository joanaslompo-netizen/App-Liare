import { UnitOfMeasure } from '../types';

export const formatCurrency = (val: number): string => {
  if (isNaN(val) || !isFinite(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatPercent = (val: number): string => {
  if (isNaN(val) || !isFinite(val)) return '0%';
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

export const formatNumber = (val: number, maxDecimals: number = 2): string => {
  if (isNaN(val) || !isFinite(val)) return '0';
  return val.toLocaleString('pt-BR', {
    maximumFractionDigits: maxDecimals,
  });
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateString;
};

export const formatBirthday = (dateString?: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    const monthName = monthNames[monthIdx] || month;
    return `${parseInt(day, 10)} de ${monthName}`;
  }
  return dateString;
};

export const isBirthdayInMonth = (birthdate?: string, targetMonth?: number): boolean => {
  if (!birthdate) return false;
  const parts = birthdate.split('-');
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    const checkMonth = targetMonth !== undefined ? targetMonth : (new Date().getMonth() + 1);
    return month === checkMonth;
  }
  return false;
};

export const formatMonthYear = (monthKey: string): string => {
  // monthKey is YYYY-MM
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} de ${year}`;
};

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  un: 'Unidade (un)',
  m: 'Metro (m)',
  cm: 'Centímetro (cm)',
  mm: 'Milímetro (mm)',
  kg: 'Quilograma (kg)',
  g: 'Grama (g)',
  l: 'Litro (l)',
  ml: 'Mililitro (ml)',
  folha: 'Folha',
  rolo: 'Rolo',
  par: 'Par',
  pct: 'Pacote (pct)',
};

export const UNIT_SHORT: Record<UnitOfMeasure, string> = {
  un: 'un',
  m: 'm',
  cm: 'cm',
  mm: 'mm',
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  folha: 'fl',
  rolo: 'rolo',
  par: 'par',
  pct: 'pct',
};

// Conversion helper: how many base units are in 1 package unit
export const getUnitConversionMultiplier = (packageUnit: UnitOfMeasure, baseUnit: UnitOfMeasure): number => {
  if (packageUnit === baseUnit) return 1;

  // Length
  if (packageUnit === 'm' && baseUnit === 'cm') return 100;
  if (packageUnit === 'm' && baseUnit === 'mm') return 1000;
  if (packageUnit === 'cm' && baseUnit === 'm') return 0.01;
  if (packageUnit === 'cm' && baseUnit === 'mm') return 10;
  if (packageUnit === 'mm' && baseUnit === 'cm') return 0.1;

  // Weight
  if (packageUnit === 'kg' && baseUnit === 'g') return 1000;
  if (packageUnit === 'g' && baseUnit === 'kg') return 0.001;

  // Volume
  if (packageUnit === 'l' && baseUnit === 'ml') return 1000;
  if (packageUnit === 'ml' && baseUnit === 'l') return 0.001;

  return 1;
};

// Calculate cost per base unit
export const calculateUnitCost = (
  packagePrice: number,
  packageQuantity: number,
  packageUnit: UnitOfMeasure,
  baseUnit: UnitOfMeasure
): number => {
  if (!packageQuantity || packageQuantity <= 0) return 0;
  const multiplier = getUnitConversionMultiplier(packageUnit, baseUnit);
  const totalBaseUnits = packageQuantity * multiplier;
  if (totalBaseUnits <= 0) return 0;
  return packagePrice / totalBaseUnits;
};
