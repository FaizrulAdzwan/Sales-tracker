
"use client";

import * as React from 'react'; // Added React import
import { useState, useMemo, useEffect } from 'react'; // Added useEffect
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LucideIcon } from 'lucide-react'; // Import LucideIcon type
import { Phone, Wifi, UserCheck, Router, Smile, ArrowLeft, Users, Target, Calendar as CalendarIcon, Smartphone, Database, Package } from 'lucide-react';
import type { PerformanceSalesCategoryKey, PerformanceSalesCategoryInfo, SalesData, TargetsData, StaffMember, StaffTargetsCollection, DailyStaffSalesCollection, DailyTrackingCategoryKey, SalesCategoryKey } from '@/lib/types'; // Import SalesCategoryKey
import useLocalStorage from '@/hooks/use-local-storage';
import Link from 'next/link';
import { format, startOfDay, isBefore, isEqual, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label"; // Import Label component
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

// Define performance sales categories (same as in daily-sales)
const performanceSalesCategories: PerformanceSalesCategoryInfo[] = [
  { key: 'postpaid', name: 'Postpaid', weightage: 20, icon: Phone, defaultTarget: 100 },
  { key: 'hvc', name: 'HVC', weightage: 20, icon: UserCheck, defaultTarget: 100 },
  { key: 'fibre', name: 'Fibre', weightage: 20, icon: Wifi, defaultTarget: 50 },
  { key: 'fwa', name: 'FWA', weightage: 10, icon: Router, defaultTarget: 50 },
  { key: 'csat', name: 'CSAT', weightage: 30, icon: Smile, defaultTarget: 90 }, // CSAT target is likely an average goal
]; // Total Weightage: 100

// Define daily-only tracking categories (same as in daily-sales, now separated)
// Order matters for rendering under performance categories later
const dailyTrackingCategories: Array<{ key: DailyTrackingCategoryKey, name: string, icon: LucideIcon, follows?: PerformanceSalesCategoryKey }> = [
    { key: 'celcomPostpaid', name: 'Celcom Postpaid', icon: Phone, follows: 'postpaid' },
    { key: 'digiPostpaid', name: 'Digi Postpaid', icon: Phone, follows: 'postpaid' },
    { key: 'suppline', name: 'Suppline', icon: Package, follows: 'hvc' },
    { key: 'device', name: 'Device', icon: Smartphone, follows: 'hvc' },
    // Add future daily categories here, specifying which performance category they conceptually follow if needed
]

// Predefined staff members (same as in daily-sales)
const staffMembers: StaffMember[] = [
    { id: 'staff1', name: 'Fadzil' },
    { id: 'staff2', name: 'Norisah' },
    { id: 'staff3', name: 'Shazlina' },
    { id: 'staff4', name: 'Alid' },
    { id: 'staff5', name: 'Vanezza' },
];

// Keys for local storage (same as in daily-sales)
const DAILY_STAFF_SALES_KEY = 'dailyStaffSalesData';
const STAFF_TARGETS_KEY = 'staffTargetsData';

// Helper to get default targets (same as in daily-sales)
const getDefaultTargetsData = (): TargetsData => {
    return Object.fromEntries(performanceSalesCategories.map(cat => [cat.key, cat.defaultTarget])) as TargetsData;
};

// Calculate achievement percentage (same logic as individual)
const calculateAchievementPercent = (current: number, target: number) => {
  if (target <= 0) return 0;
  return (current / target) * 100;
};

// Calculate weighted points (same logic as individual, including postpaid cap)
const calculateWeightedPoints = (key: PerformanceSalesCategoryKey, current: number, target: number, weightage: number) => {
  if (target <= 0) return 0;
  let achievementPercent = (current / target) * 100;
  let pointsBasedOnAchievement = 0;

  if (key === 'postpaid') {
    const cappedAchievementPercent = Math.min(achievementPercent, 120);
    pointsBasedOnAchievement = (cappedAchievementPercent / 100) * weightage;
  } else {
    // For CSAT, 'current' is the average score, 'target' is the average target.
    // For others, 'current' is the sum, 'target' is the sum of targets.
    pointsBasedOnAchievement = (achievementPercent / 100) * weightage;
    pointsBasedOnAchievement = Math.max(0, pointsBasedOnAchievement);
  }

  return pointsBasedOnAchievement;
};

// Total possible base weightage (same as individual)
const totalBaseWeightage = performanceSalesCategories.reduce((sum, cat) => sum + cat.weightage, 0); // Expected: 100

// Type for team accumulated performance summary UP TO a certain date
type TeamAccumulatedSummary = {
    totalAccumulatedSales: Pick<SalesData, PerformanceSalesCategoryKey>; // Holds SUM for most, AVERAGE for CSAT
    totalMonthlyTargets: Pick<TargetsData, PerformanceSalesCategoryKey>; // Holds SUM for most, AVERAGE for CSAT target
    totalScore: number;
    overallPercent: number;
    categoryPoints: { [key in PerformanceSalesCategoryKey]: number };
    categoryAchievement: { [key in PerformanceSalesCategoryKey]: number };
};

// Type for team's daily tracking totals for a specific date
type TeamDailyTrackingTotals = {
     dailyTotals: Pick<SalesData, DailyTrackingCategoryKey>;
     staffCount: number; // Staff who submitted *any* data on this day
};


export default function TeamPerformancePage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Default to today for daily view
  const [isClient, setIsClient] = useState(false); // State to track client-side mount

  // Fetch data from local storage using useState for initial values
  const [dailyStaffSalesData, setDailyStaffSalesData] = useState<DailyStaffSalesCollection>({});
  const [staffTargetsData, setStaffTargetsData] = useState<StaffTargetsCollection>({});

   // Use effect to load data from local storage only on the client side
   useEffect(() => {
     setIsClient(true); // Now we are on the client

     const loadData = () => {
       try {
         const dailyDataRaw = window.localStorage.getItem(DAILY_STAFF_SALES_KEY);
         const targetsDataRaw = window.localStorage.getItem(STAFF_TARGETS_KEY);

         const initialDaily: DailyStaffSalesCollection = dailyDataRaw ? JSON.parse(dailyDataRaw) : {};
         let initialTargets: StaffTargetsCollection = targetsDataRaw ? JSON.parse(targetsDataRaw) : {};

         // Initialize targets for staff if missing
          staffMembers.forEach(staff => {
              if (!initialTargets[staff.id]) {
                  initialTargets[staff.id] = getDefaultTargetsData();
              }
          });


         setDailyStaffSalesData(initialDaily);
         setStaffTargetsData(initialTargets);
       } catch (error) {
         console.error("Error reading from localStorage:", error);
         // Initialize with defaults if error occurs
         const defaultTargets: StaffTargetsCollection = {};
         staffMembers.forEach(staff => {
             defaultTargets[staff.id] = getDefaultTargetsData();
         });
         setDailyStaffSalesData({});
         setStaffTargetsData(defaultTargets);
       }
     };

     loadData();

     // Optional: Add storage event listener if you need to sync across tabs
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === DAILY_STAFF_SALES_KEY || event.key === STAFF_TARGETS_KEY) {
            loadData(); // Reload data if relevant keys change
        }
     };
     window.addEventListener('storage', handleStorageChange);
     return () => window.removeEventListener('storage', handleStorageChange);

   }, []); // Empty dependency array ensures this runs only once on mount


  // Calculate Team Accumulated Performance UP TO the selected date
   const teamAccumulatedPerformanceUpToDate = useMemo((): TeamAccumulatedSummary | null => {
       if (!selectedDate || !isClient) return null; // Don't calculate on server or before client mount

        // Initialize sales with 0 for all performance categories
        const initialSales: Pick<SalesData, PerformanceSalesCategoryKey> = Object.fromEntries(
            performanceSalesCategories.map(cat => [cat.key, 0])
        ) as Pick<SalesData, PerformanceSalesCategoryKey>;

        // Initialize targets with 0 for all performance categories
        const initialTargets: Pick<TargetsData, PerformanceSalesCategoryKey> = Object.fromEntries(
            performanceSalesCategories.map(cat => [cat.key, 0])
        ) as Pick<TargetsData, PerformanceSalesCategoryKey>;

        const summary: TeamAccumulatedSummary = {
            totalAccumulatedSales: initialSales,
            totalMonthlyTargets: initialTargets,
            totalScore: 0,
            overallPercent: 0,
            categoryPoints: Object.fromEntries(
                performanceSalesCategories.map(cat => [cat.key, 0])
            ) as { [key in PerformanceSalesCategoryKey]: number },
            categoryAchievement: Object.fromEntries(
                performanceSalesCategories.map(cat => [cat.key, 0])
            ) as { [key in PerformanceSalesCategoryKey]: number },
        };

       let totalCsatTargetSum = 0;
       let staffWithCsatTargetCount = 0;

       // Calculate Total Monthly Targets (Sum for most, Average for CSAT)
       staffMembers.forEach(staff => {
           const targets = staffTargetsData[staff.id] || getDefaultTargetsData();
           performanceSalesCategories.forEach(cat => {
               if (cat.key === 'csat') {
                   totalCsatTargetSum += targets.csat;
                   staffWithCsatTargetCount++;
               } else {
                   summary.totalMonthlyTargets[cat.key] += targets[cat.key];
               }
           });
       });
       // Calculate and store the average CSAT target
       summary.totalMonthlyTargets.csat = staffWithCsatTargetCount > 0 ? totalCsatTargetSum / staffWithCsatTargetCount : 0;


       const selectedDateStart = startOfDay(selectedDate); // Ensure comparison is date-only
       let csatSum = 0;
       let csatCount = 0; // Number of staff-days with CSAT data

       // Iterate through all dates in the stored data UP TO the selected date
       Object.entries(dailyStaffSalesData).forEach(([dateString, salesForDate]) => {
           const entryDate = startOfDay(new Date(dateString));

           // Check if the entry date is before or equal to the selected date
           if (isBefore(entryDate, selectedDateStart) || isEqual(entryDate, selectedDateStart)) {
               // Sum performance sales for all staff active on this day
               Object.values(salesForDate).forEach(staffSales => {
                   performanceSalesCategories.forEach(cat => {
                       if (cat.key === 'csat') {
                           if (staffSales.csat !== undefined && staffSales.csat !== null) {
                               csatSum += staffSales.csat;
                               csatCount++; // Increment count only if CSAT data exists for this entry
                           }
                       } else {
                            summary.totalAccumulatedSales[cat.key] += staffSales[cat.key] || 0;
                       }
                   });
               });
           }
       });

       // Calculate and store the average CSAT score
        summary.totalAccumulatedSales.csat = csatCount > 0 ? csatSum / csatCount : 0;

       // Calculate points and total score based on accumulated sales and total monthly targets
       performanceSalesCategories.forEach(cat => {
           const currentVal = summary.totalAccumulatedSales[cat.key]; // Sum for others, Average for CSAT
           const targetVal = summary.totalMonthlyTargets[cat.key]; // Sum for others, Average for CSAT target
           const points = calculateWeightedPoints(
               cat.key,
               currentVal,
               targetVal,
               cat.weightage
           );
           summary.categoryPoints[cat.key] = points;
           summary.totalScore += points;

           const achievement = calculateAchievementPercent(
               currentVal,
               targetVal
           );
           summary.categoryAchievement[cat.key] = achievement;
       });

       summary.overallPercent = totalBaseWeightage > 0 ? (summary.totalScore / totalBaseWeightage) * 100 : 0;

       return summary;
   }, [selectedDate, dailyStaffSalesData, staffTargetsData, isClient]); // Add isClient dependency


  // Calculate Team DAILY TRACKING figures for the selected date ONLY
  const teamDailyTrackingTotals = useMemo((): TeamDailyTrackingTotals | null => {
      if (!selectedDate || !isClient) return null; // Don't calculate on server or before client mount

      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const salesForDay = dailyStaffSalesData[dateString];

       const initialTrackingTotals: Pick<SalesData, DailyTrackingCategoryKey> = Object.fromEntries(
            dailyTrackingCategories.map(cat => [cat.key, 0])
       ) as Pick<SalesData, DailyTrackingCategoryKey>;

      if (!salesForDay || Object.keys(salesForDay).length === 0) {
           // Return default structure if no data for the day
           return {
               dailyTotals: initialTrackingTotals,
               staffCount: 0,
           };
       }

       const summary: TeamDailyTrackingTotals = {
           dailyTotals: initialTrackingTotals,
           staffCount: 0,
       };

       const staffWithDataToday = Object.keys(salesForDay);
       summary.staffCount = staffWithDataToday.length;

       // Sum only the daily tracking figures for staff active on the selected day
       staffWithDataToday.forEach(staffId => {
           const staffSales = salesForDay[staffId];
           dailyTrackingCategories.forEach(cat => {
               summary.dailyTotals[cat.key] = (summary.dailyTotals[cat.key] || 0) + (staffSales[cat.key] || 0);
           });
       });

       return summary;

  }, [selectedDate, dailyStaffSalesData, isClient]); // Add isClient dependency


  // Calculate Team Monthly Performance (Overall - for the "Monthly" tab)
  // This uses the *current* month, regardless of the selectedDate in the daily tab.
   const teamMonthlyPerformance = useMemo((): TeamAccumulatedSummary => {
       if (!isClient) { // Return default structure if not on client
            const initialSales: Pick<SalesData, PerformanceSalesCategoryKey> = Object.fromEntries(
                performanceSalesCategories.map(cat => [cat.key, 0])
            ) as Pick<SalesData, PerformanceSalesCategoryKey>;
            const initialTargets: Pick<TargetsData, PerformanceSalesCategoryKey> = Object.fromEntries(
                performanceSalesCategories.map(cat => [cat.key, 0])
            ) as Pick<TargetsData, PerformanceSalesCategoryKey>;
           return {
               totalAccumulatedSales: initialSales,
               totalMonthlyTargets: initialTargets,
               totalScore: 0,
               overallPercent: 0,
               categoryPoints: Object.fromEntries(performanceSalesCategories.map(cat => [cat.key, 0])) as { [key in PerformanceSalesCategoryKey]: number },
               categoryAchievement: Object.fromEntries(performanceSalesCategories.map(cat => [cat.key, 0])) as { [key in PerformanceSalesCategoryKey]: number },
           };
       }

       const today = new Date();
       const monthStart = startOfMonth(today);
       const monthEnd = endOfMonth(today);

       // Initialize sales and targets
        const initialSales: Pick<SalesData, PerformanceSalesCategoryKey> = Object.fromEntries(
            performanceSalesCategories.map(cat => [cat.key, 0])
        ) as Pick<SalesData, PerformanceSalesCategoryKey>;
        const initialTargets: Pick<TargetsData, PerformanceSalesCategoryKey> = Object.fromEntries(
            performanceSalesCategories.map(cat => [cat.key, 0])
        ) as Pick<TargetsData, PerformanceSalesCategoryKey>;

       const summary: TeamAccumulatedSummary = {
           totalAccumulatedSales: initialSales,
           totalMonthlyTargets: initialTargets,
           totalScore: 0,
           overallPercent: 0,
           categoryPoints: Object.fromEntries(
               performanceSalesCategories.map(cat => [cat.key, 0])
           ) as { [key in PerformanceSalesCategoryKey]: number },
           categoryAchievement: Object.fromEntries(
               performanceSalesCategories.map(cat => [cat.key, 0])
           ) as { [key in PerformanceSalesCategoryKey]: number },
       };

       // Calculate Total Monthly Targets (Sum for most, Average for CSAT)
       let totalCsatTargetSum = 0;
       let staffWithCsatTargetCount = 0;
       staffMembers.forEach(staff => {
           const targets = staffTargetsData[staff.id] || getDefaultTargetsData();
           performanceSalesCategories.forEach(cat => {
               if (cat.key === 'csat') {
                   totalCsatTargetSum += targets.csat;
                   staffWithCsatTargetCount++;
               } else {
                   summary.totalMonthlyTargets[cat.key] += targets[cat.key];
               }
           });
       });
       summary.totalMonthlyTargets.csat = staffWithCsatTargetCount > 0 ? totalCsatTargetSum / staffWithCsatTargetCount : 0;


       let csatSum = 0;
       let csatCount = 0; // Number of staff-days with CSAT data in the current month

       // Iterate through all dates in the stored data for the current month
       Object.entries(dailyStaffSalesData).forEach(([dateString, salesForDate]) => {
           const entryDate = startOfDay(new Date(dateString));

           // Check if the entry date is within the current month
           if ((isBefore(entryDate, monthEnd) || isEqual(entryDate, monthEnd)) && (isBefore(monthStart, entryDate) || isEqual(entryDate, monthStart))) {
               // Sum performance sales for all staff on this day
               Object.values(salesForDate).forEach(staffSales => {
                   performanceSalesCategories.forEach(cat => {
                      if (cat.key === 'csat') {
                         if (staffSales.csat !== undefined && staffSales.csat !== null) {
                             csatSum += staffSales.csat;
                             csatCount++;
                         }
                       } else {
                            summary.totalAccumulatedSales[cat.key] += staffSales[cat.key] || 0;
                       }
                   });
               });
           }
       });

       // Calculate average CSAT for the month
        summary.totalAccumulatedSales.csat = csatCount > 0 ? csatSum / csatCount : 0;

       // Calculate points and total score based on monthly accumulated/average sales and total/average monthly targets
       performanceSalesCategories.forEach(cat => {
           const currentVal = summary.totalAccumulatedSales[cat.key];
           const targetVal = summary.totalMonthlyTargets[cat.key];
           const points = calculateWeightedPoints(
               cat.key,
               currentVal,
               targetVal,
               cat.weightage
           );
           summary.categoryPoints[cat.key] = points;
           summary.totalScore += points;

           const achievement = calculateAchievementPercent(
               currentVal,
               targetVal
           );
           summary.categoryAchievement[cat.key] = achievement;
       });

       summary.overallPercent = totalBaseWeightage > 0 ? (summary.totalScore / totalBaseWeightage) * 100 : 0;

       return summary;
   }, [dailyStaffSalesData, staffTargetsData, isClient]); // Add isClient dependency


  // Helper function to render loading skeleton for tabs
  const renderLoadingSkeleton = () => (
      <Card className="w-full shadow-lg">
          <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
              <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="mt-6 space-y-4">
                  <Skeleton className="h-4 w-1/3 mb-2" />
                  <Skeleton className="h-40 w-full" />
              </div>
          </CardContent>
          <CardFooter>
               <Skeleton className="h-4 w-full" />
          </CardFooter>
      </Card>
  );


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-secondary">
      <div className="w-full max-w-6xl mb-4 flex justify-between items-center">
          <Link href="/" passHref>
              <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-primary">Team Performance</h1>
          <div className="w-[100px]"></div> {/* Spacer */}
      </div>

      <Tabs defaultValue="monthly" className="w-full max-w-6xl">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="daily">Daily Team View</TabsTrigger>
          <TabsTrigger value="monthly">Current Month Team Performance</TabsTrigger>
        </TabsList>

        {/* Daily Team View Tab */}
        <TabsContent value="daily">
         {isClient ? ( // Only render content on client-side
            <Card className="w-full shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center justify-between">
                  <span>
                    <Users className="mr-2 h-5 w-5 inline" /> Daily View
                  </span>
                   {/* Date Picker for Daily View */}
                  <Popover>
                      <PopoverTrigger asChild>
                      <Button
                          variant={"outline"}
                          size="sm"
                          className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                          )}
                      >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          disabled={(date) => date > new Date() || date < new Date("2000-01-01")} // Optional: disable future/past dates
                      />
                      </PopoverContent>
                  </Popover>
                </CardTitle>
                <CardDescription>
                    Performance accumulated up to the selected date ({selectedDate ? format(selectedDate, 'PPP') : 'N/A'}) against total monthly targets. Daily tracking shows figures for the selected date only ({teamDailyTrackingTotals?.staffCount ?? 0} staff active). CSAT figures are averaged.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!teamAccumulatedPerformanceUpToDate || !teamDailyTrackingTotals ? (
                   <p className="text-center text-muted-foreground">Select a date to view daily performance.</p>
                ) : teamDailyTrackingTotals.staffCount === 0 && Object.values(teamAccumulatedPerformanceUpToDate.totalAccumulatedSales).every((v, i) => performanceSalesCategories[i].key === 'csat' || v === 0) ? ( // Adjusted check for CSAT
                     <p className="text-center text-muted-foreground">No sales data found up to or on the selected date.</p>
                ) : (
                   <>
                      {/* Overall Accumulated Score UP TO DATE */}
                      <div className="space-y-2 border-b pb-4 mb-4">
                          <Label className="text-base font-medium">Overall Score (Accumulated up to {selectedDate ? format(selectedDate, 'PPP') : 'date'})</Label>
                          <Progress value={Math.min(teamAccumulatedPerformanceUpToDate.overallPercent, 100)} max={100} className="h-4 [&>div]:bg-accent" aria-label={`Overall score up to date ${teamAccumulatedPerformanceUpToDate.overallPercent.toFixed(1)}%`} />
                          <p className="text-sm text-muted-foreground text-right">
                              {teamAccumulatedPerformanceUpToDate.totalScore.toFixed(1)} Total Points ({teamAccumulatedPerformanceUpToDate.overallPercent.toFixed(1)}% of base {totalBaseWeightage} points)
                               {teamAccumulatedPerformanceUpToDate.overallPercent > 100 && <span className="text-accent"> (Exceeds 100%)</span>}
                          </p>
                      </div>

                      {/* Combined Performance and Daily Tracking Table */}
                      <Label className="text-base font-medium block mb-2">Performance & Daily Tracking Breakdown:</Label>
                      <Table>
                         <TableHeader>
                            <TableRow>
                               <TableHead>Category</TableHead>
                               <TableHead className="text-right">Accum. Value (Avg. for CSAT)</TableHead>
                               <TableHead className="text-right">Monthly Target (Avg. for CSAT)</TableHead>
                               <TableHead className="text-right">Ach. %</TableHead>
                               <TableHead className="text-right">Variance</TableHead>
                               <TableHead className="text-right">Points</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                             {/* Iterate through performance categories */}
                             {performanceSalesCategories.map(perfCat => {
                                 const isCsat = perfCat.key === 'csat';
                                 const sales = teamAccumulatedPerformanceUpToDate.totalAccumulatedSales[perfCat.key];
                                 const target = teamAccumulatedPerformanceUpToDate.totalMonthlyTargets[perfCat.key];
                                 const achievement = teamAccumulatedPerformanceUpToDate.categoryAchievement[perfCat.key];
                                 const points = teamAccumulatedPerformanceUpToDate.categoryPoints[perfCat.key];
                                 const variance = sales - target; // Variance is sales vs target (works for avg vs avg too)

                                 // Formatting based on whether it's CSAT (average) or others (sum)
                                 const salesDisplay = isCsat ? sales.toFixed(1) + "%" : sales.toLocaleString(undefined, { maximumFractionDigits: 0 });
                                 const targetDisplay = isCsat ? target.toFixed(1) + "%" : target.toLocaleString(undefined, { maximumFractionDigits: 0 });
                                 const varianceDisplay = isCsat ? variance.toFixed(1) + "%" : variance.toLocaleString(undefined, { maximumFractionDigits: 0 });


                                 return (
                                     <React.Fragment key={perfCat.key}>
                                         {/* Performance Row */}
                                         <TableRow className="bg-card">
                                             <TableCell className="font-medium flex items-center"><perfCat.icon className="mr-2 h-4 w-4 text-primary" />{perfCat.name} {isCsat ? '(Avg)' : '(Accum.)'}</TableCell>
                                             <TableCell className="text-right font-semibold">{salesDisplay}</TableCell>
                                             <TableCell className="text-right">{targetDisplay}</TableCell>
                                             <TableCell className="text-right">{achievement.toFixed(1)}%</TableCell>
                                             <TableCell className={`text-right ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{varianceDisplay}</TableCell>
                                             <TableCell className="text-right font-semibold">{points.toFixed(1)}</TableCell>
                                         </TableRow>

                                         {/* Daily Tracking Rows Following This Performance Category */}
                                         {dailyTrackingCategories
                                             .filter(dailyCat => dailyCat.follows === perfCat.key)
                                             .map(dailyCat => {
                                                 const dailyValue = teamDailyTrackingTotals.dailyTotals[dailyCat.key] ?? 0;
                                                 return (
                                                     <TableRow key={dailyCat.key} className="bg-secondary/50 hover:bg-secondary/70">
                                                         <TableCell className="font-medium flex items-center pl-6 text-sm"> {/* Indent */}
                                                             <dailyCat.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                             {dailyCat.name} (Daily Total)
                                                         </TableCell>
                                                         <TableCell className="text-right font-semibold">{dailyValue.toLocaleString()}</TableCell>
                                                         {/* Empty cells for target, ach%, variance, points */}
                                                         <TableCell colSpan={4}></TableCell>
                                                     </TableRow>
                                                 );
                                             })
                                         }
                                     </React.Fragment>
                                 );
                             })}
                              {/* Render any daily tracking categories not explicitly following a performance one */}
                              {dailyTrackingCategories
                                  .filter(dailyCat => !dailyCat.follows)
                                  .map(dailyCat => {
                                      const dailyValue = teamDailyTrackingTotals.dailyTotals[dailyCat.key] ?? 0;
                                      return (
                                          <TableRow key={dailyCat.key} className="bg-secondary/50 hover:bg-secondary/70">
                                              <TableCell className="font-medium flex items-center text-sm">
                                                  <dailyCat.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                  {dailyCat.name} (Daily Total)
                                              </TableCell>
                                              <TableCell className="text-right font-semibold">{dailyValue.toLocaleString()}</TableCell>
                                              <TableCell colSpan={4}></TableCell>
                                          </TableRow>
                                      );
                              })}
                         </TableBody>
                      </Table>
                   </>
                )}
              </CardContent>
              <CardFooter>
                 <p className="text-xs text-muted-foreground">Performance data is accumulated (or averaged for CSAT) up to the selected date and measured against total (or average for CSAT) monthly targets. Daily tracking shows team totals for the selected day only. Variance = Value - Target.</p>
              </CardFooter>
            </Card>
            ) : ( renderLoadingSkeleton() ) } {/* Show skeleton while loading */}
        </TabsContent>

        {/* Monthly Team Performance Tab */}
        <TabsContent value="monthly">
          {isClient ? ( // Only render content on client-side
            <Card className="w-full shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center">
                  <Users className="mr-2 h-5 w-5" /> Current Month Summary ({format(new Date(), 'MMMM yyyy')})
                </CardTitle>
                <CardDescription>
                  Overall team performance based on accumulated sales (or average for CSAT) for the current calendar month against the sum (or average for CSAT) of all staff's monthly targets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                   {/* Overall Monthly Score */}
                  <div className="space-y-2 border-b pb-4 mb-4">
                      <Label className="text-base font-medium">Overall Monthly Score</Label>
                      <Progress value={Math.min(teamMonthlyPerformance.overallPercent, 100)} max={100} className="h-4 [&>div]:bg-accent" aria-label={`Overall monthly score ${teamMonthlyPerformance.overallPercent.toFixed(1)}%`} />
                      <p className="text-sm text-muted-foreground text-right">
                          {teamMonthlyPerformance.totalScore.toFixed(1)} Total Points ({teamMonthlyPerformance.overallPercent.toFixed(1)}% of base {totalBaseWeightage} points)
                          {teamMonthlyPerformance.overallPercent > 100 && <span className="text-accent"> (Exceeds 100%)</span>}
                      </p>
                  </div>

                   {/* Monthly Performance Category Breakdown */}
                  <Label className="text-base font-medium block mb-2">Monthly Performance Breakdown:</Label>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Monthly Value (Avg. for CSAT)</TableHead>
                              <TableHead className="text-right">Total Monthly Target (Avg. for CSAT)</TableHead>
                              <TableHead className="text-right">Ach. %</TableHead>
                               <TableHead className="text-right">Variance</TableHead>
                              <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {performanceSalesCategories.map(cat => {
                               const isCsat = cat.key === 'csat';
                               const sales = teamMonthlyPerformance.totalAccumulatedSales[cat.key];
                               const target = teamMonthlyPerformance.totalMonthlyTargets[cat.key];
                               const achievement = teamMonthlyPerformance.categoryAchievement[cat.key];
                               const points = teamMonthlyPerformance.categoryPoints[cat.key];
                               const variance = sales - target;

                               const salesDisplay = isCsat ? sales.toFixed(1) + "%" : sales.toLocaleString(undefined, { maximumFractionDigits: 0 });
                               const targetDisplay = isCsat ? target.toFixed(1) + "%" : target.toLocaleString(undefined, { maximumFractionDigits: 0 });
                               const varianceDisplay = isCsat ? variance.toFixed(1) + "%" : variance.toLocaleString(undefined, { maximumFractionDigits: 0 });

                              return (
                                  <TableRow key={cat.key}>
                                      <TableCell className="font-medium flex items-center"><cat.icon className="mr-2 h-4 w-4 text-primary" />{cat.name} {isCsat ? '(Avg)' : '(Accum.)'}</TableCell>
                                      <TableCell className="text-right font-semibold">{salesDisplay}</TableCell>
                                      <TableCell className="text-right">{targetDisplay}</TableCell>
                                      <TableCell className="text-right">{achievement.toFixed(1)}%</TableCell>
                                       <TableCell className={`text-right ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{varianceDisplay}</TableCell>
                                      <TableCell className="text-right font-semibold">{points.toFixed(1)}</TableCell>
                                  </TableRow>
                              );
                          })}
                      </TableBody>
                  </Table>
              </CardContent>
              <CardFooter>
                   <p className="text-xs text-muted-foreground">Monthly performance aggregates all daily sales within the current calendar month (or averages CSAT) and compares against the sum (or average CSAT) of targets set for all staff members. Postpaid calculation rules apply. Variance = Value - Target.</p>
              </CardFooter>
            </Card>
            ) : ( renderLoadingSkeleton() )} {/* Show skeleton while loading */}
        </TabsContent>
      </Tabs>
    </main>
  );
}
