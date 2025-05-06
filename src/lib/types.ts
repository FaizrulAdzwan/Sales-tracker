
import type { LucideIcon } from 'lucide-react';

// Define keys for performance-related sales categories
export type PerformanceSalesCategoryKey = 'postpaid' | 'hvc' | 'fibre' | 'fwa' | 'csat';

// Define keys for daily-only tracking items (not accumulated, not weighted)
export type DailyTrackingCategoryKey = 'celcomPostpaid' | 'digiPostpaid' | 'suppline' | 'device'; // Separated Celcom/Digi

// Combine all possible keys
export type SalesCategoryKey = PerformanceSalesCategoryKey | DailyTrackingCategoryKey;


export interface PerformanceSalesCategoryInfo {
  key: PerformanceSalesCategoryKey;
  name: string;
  weightage: number; // Represents maximum points achievable for this category
  icon: LucideIcon;
  defaultTarget: number;
}

// Represents sales figures for one staff member for *all* categories (performance + daily) *for a single day*
export type SalesData = {
  [key in PerformanceSalesCategoryKey]: number; // Performance categories always exist
} & {
  [key in DailyTrackingCategoryKey]?: number; // Daily tracking are optional numbers
};


// Represents target figures for one staff member for *performance* categories (applied across all dates)
export type TargetsData = {
  [key in PerformanceSalesCategoryKey]: number;
};

// Input for the daily sales form - includes performance and daily tracking fields
export type DailySalesInput = {
  [key in PerformanceSalesCategoryKey]?: number; // Optional because users might not enter all performance fields
} & {
   [key in DailyTrackingCategoryKey]?: number; // Daily tracking are optional
};


// Represents a staff member
export interface StaffMember {
  id: string;
  name: string;
}

// Deprecated: This stored accumulated data, now we store daily data.
// Keeping for potential migration if needed, but not actively used for new data.
export type StaffSalesCollection = {
  [staffId: string]: SalesData; // Using the extended SalesData type
};

// Collection of target data for all staff members (only for performance categories)
export type StaffTargetsCollection = {
  [staffId: string]: TargetsData;
};

// Collection of daily sales data: { 'YYYY-MM-DD': { 'staffId': SalesData } }
// SalesData includes both performance and daily tracking items for that day.
export type DailyStaffSalesCollection = {
  [dateString: string]: { // Key is the date string 'yyyy-MM-dd'
    [staffId: string]: SalesData; // Key is the staff ID, stores all daily data
  };
};

