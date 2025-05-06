
"use client";

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Phone, Wifi, UserCheck, Router, Smile, ArrowLeft, User, Users, Target, Calendar as CalendarIcon, Smartphone, Database, Package } from 'lucide-react'; // Added Smartphone, Database, Package
import type { PerformanceSalesCategoryKey, PerformanceSalesCategoryInfo, DailySalesInput, SalesData, TargetsData, StaffMember, StaffSalesCollection, StaffTargetsCollection, DailyStaffSalesCollection, DailyTrackingCategoryKey } from '@/lib/types'; // Updated types
import useLocalStorage from '@/hooks/use-local-storage';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isBefore, isEqual, startOfDay } from "date-fns";

// Define performance sales categories with updated weightages and default targets
const performanceSalesCategories: PerformanceSalesCategoryInfo[] = [
  { key: 'postpaid', name: 'Postpaid', weightage: 20, icon: Phone, defaultTarget: 100 }, // Achievement capped at 120% for points calculation
  { key: 'hvc', name: 'HVC', weightage: 20, icon: UserCheck, defaultTarget: 100 },
  { key: 'fibre', name: 'Fibre', weightage: 20, icon: Wifi, defaultTarget: 50 },
  { key: 'fwa', name: 'FWA', weightage: 10, icon: Router, defaultTarget: 50 }, // Weightage adjusted
  { key: 'csat', name: 'CSAT', weightage: 30, icon: Smile, defaultTarget: 90 }, // Weightage adjusted
]; // Total Weightage: 20 + 20 + 20 + 10 + 30 = 100

// Define daily-only tracking categories (no weightage, no target setting here)
const dailyTrackingCategories = [
    { key: 'celcomPostpaid' as DailyTrackingCategoryKey, name: 'Celcom Postpaid', icon: Phone }, // Separated
    { key: 'digiPostpaid' as DailyTrackingCategoryKey, name: 'Digi Postpaid', icon: Phone }, // Separated
    { key: 'suppline' as DailyTrackingCategoryKey, name: 'Suppline', icon: Package },
    { key: 'device' as DailyTrackingCategoryKey, name: 'Device', icon: Smartphone },
]

// Predefined staff members
const staffMembers: StaffMember[] = [
    { id: 'staff1', name: 'Fadzil' },
    { id: 'staff2', name: 'Norisah' },
    { id: 'staff3', name: 'Shazlina' },
    { id: 'staff4', name: 'Alid' },
    { id: 'staff5', name: 'Vanezza' },
];

// Zod schema for daily form validation (includes performance and daily tracking)
const salesSchema = z.object({
  // Performance categories (optional number)
  ...Object.fromEntries(
    performanceSalesCategories.map(category => [
      category.key,
      z.coerce.number().min(0, "Value must be non-negative").optional(),
    ])
  ),
  // Daily tracking categories (optional number)
  ...Object.fromEntries(
    dailyTrackingCategories.map(category => [
       category.key,
       z.coerce.number().min(0, "Value must be non-negative").optional(),
    ])
  )
}).refine(data => Object.values(data).some(value => value !== undefined && value >= 0 && typeof value === 'number'), { // Allow 0 input
  message: "Please enter a value (can be 0) for at least one category for the selected date.",
  path: ["postpaid"], // Assign error to one field for display
});


// Zod schema for target setting (only for performance categories)
const targetSchema = z.object(
  Object.fromEntries(
    performanceSalesCategories.map(category => [
      category.key,
      z.coerce.number().min(0, "Target must be non-negative"),
    ])
  )
);


const DAILY_STAFF_SALES_KEY = 'dailyStaffSalesData'; // Key for daily data
const STAFF_TARGETS_KEY = 'staffTargetsData'; // Key for targets (performance categories only)

// Helper to get initial empty sales data for a staff member (includes performance and daily fields)
const getInitialSalesData = (): SalesData => {
    const initialData: Partial<SalesData> = {};
     performanceSalesCategories.forEach(cat => {
         initialData[cat.key] = 0;
     });
     dailyTrackingCategories.forEach(cat => {
         initialData[cat.key] = 0; // Initialize daily tracking to 0 as well
     });
    return initialData as SalesData;
};

// Helper to get default targets for a staff member (performance categories only)
const getDefaultTargetsData = (): TargetsData => {
    return Object.fromEntries(performanceSalesCategories.map(cat => [cat.key, cat.defaultTarget])) as TargetsData;
};


export default function DailySalesPage() {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()); // Default to today
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);

  const [dailyStaffSalesData, setDailyStaffSalesData] = useLocalStorage<DailyStaffSalesCollection>(
    DAILY_STAFF_SALES_KEY,
    {} // Initialize as empty object
  );

  const [staffTargetsData, setStaffTargetsData] = useLocalStorage<StaffTargetsCollection>(
    STAFF_TARGETS_KEY,
    // Initialize targets for predefined staff if they don't exist
    () => {
        const initialTargets: StaffTargetsCollection = {};
        staffMembers.forEach(staff => {
            initialTargets[staff.id] = getDefaultTargetsData();
        });
        return initialTargets;
    }
  );


  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
     setValue: setSalesValue, // Use setValue to pre-fill form
  } = useForm<DailySalesInput>({
    resolver: zodResolver(salesSchema),
    defaultValues: {}, // Form cleared on staff change or submission initially
  });

  // Target setting form
   const {
    register: registerTarget,
    handleSubmit: handleSubmitTarget,
    reset: resetTargetForm,
    formState: { errors: targetErrors, isSubmitting: isSubmittingTarget },
    setValue: setTargetValue,
  } = useForm<TargetsData>({
    resolver: zodResolver(targetSchema),
  });


  // Update form defaults when target dialog opens for selected staff
  useEffect(() => {
    if (isTargetDialogOpen && selectedStaffId) {
      const currentTargets = staffTargetsData[selectedStaffId] || getDefaultTargetsData();
      performanceSalesCategories.forEach(cat => {
        setTargetValue(cat.key, currentTargets[cat.key]);
      });
    }
  }, [isTargetDialogOpen, selectedStaffId, staffTargetsData, setTargetValue]);

   // Effect to pre-fill form when staff or date changes
   useEffect(() => {
       if (selectedStaffId && selectedDate) {
           const dateString = format(selectedDate, 'yyyy-MM-dd');
           const existingDailyData = dailyStaffSalesData[dateString]?.[selectedStaffId];

           // Reset form first to clear previous values
           reset();

           if (existingDailyData) {
               // Pre-fill performance categories
               performanceSalesCategories.forEach(cat => {
                   setSalesValue(cat.key, existingDailyData[cat.key] ?? undefined); // Use undefined if not present to clear
               });
               // Pre-fill daily tracking categories
               dailyTrackingCategories.forEach(cat => {
                   setSalesValue(cat.key, existingDailyData[cat.key] ?? undefined);
               });
           }
       } else {
           reset(); // Clear form if no staff or date selected
       }
   }, [selectedStaffId, selectedDate, dailyStaffSalesData, setSalesValue, reset]);


  const onSubmit: SubmitHandler<DailySalesInput> = (data) => {
    if (!selectedStaffId) {
      toast({
        title: "No Staff Selected",
        description: "Please select a staff member first.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDate) {
         toast({
           title: "No Date Selected",
           description: "Please select a date first.",
           variant: "destructive",
         });
         return;
    }

     // Basic check if any data is entered - refine handles more complex cases
     const hasValidInput = Object.values(data).some(val => typeof val === 'number' && val >= 0); // Allow 0 input
     if (!hasValidInput) {
        toast({
          title: "No Input Provided",
          description: "Please enter a value (can be 0) for at least one sales category.",
          variant: "destructive",
        });
        return;
     }

    const dateString = format(selectedDate, 'yyyy-MM-dd'); // Use consistent date format for key

    setDailyStaffSalesData((prevDailyCollection) => {
      const salesForDate = prevDailyCollection[dateString] || {};
      // Fetch existing data for the day or initialize if none exists
      const existingStaffSales = salesForDate[selectedStaffId] || getInitialSalesData();
      const updatedStaffSales = { ...existingStaffSales }; // Start with existing data

      // Update performance categories
      performanceSalesCategories.forEach((category) => {
        const inputValue = data[category.key];
        if (typeof inputValue === 'number' && inputValue >= 0) {
            updatedStaffSales[category.key] = inputValue;
        } else if (updatedStaffSales[category.key] === undefined) {
             // Ensure performance categories always have a number (0 if not entered)
             updatedStaffSales[category.key] = 0;
        }
      });

       // Update daily tracking categories
       dailyTrackingCategories.forEach((category) => {
           const inputValue = data[category.key];
           if (typeof inputValue === 'number' && inputValue >= 0) {
              updatedStaffSales[category.key] = inputValue;
           } else {
               // If not entered or invalid, ensure it's 0 or explicitly set to undefined if you prefer
               updatedStaffSales[category.key] = 0; // Defaulting to 0 if not entered/valid
           }
       });

      return {
        ...prevDailyCollection,
        [dateString]: {
          ...salesForDate,
          [selectedStaffId]: updatedStaffSales,
        },
      };
    });

    toast({
      title: "Sales Saved",
      description: `Daily sales for ${staffMembers.find(s => s.id === selectedStaffId)?.name} on ${format(selectedDate, "PPP")} have been saved.`,
      variant: "default",
    });
    // Don't reset here, let the useEffect handle pre-filling based on the new saved data
    // reset();
  };

   const onTargetSubmit: SubmitHandler<TargetsData> = (data) => {
      if (!selectedStaffId) return; // Should not happen if dialog is open

      setStaffTargetsData(prevTargets => ({
        ...prevTargets,
        [selectedStaffId]: data,
      }));

       toast({
         title: "Targets Updated",
         description: `Targets for ${staffMembers.find(s => s.id === selectedStaffId)?.name} have been saved.`,
         variant: "default",
       });
       setIsTargetDialogOpen(false); // Close dialog on success
   };


  // Calculate ACCUMULATED *performance* sales data up to the selected date
  const accumulatedPerformanceSalesData = useMemo(() => {
     if (!selectedStaffId || !selectedDate) {
         const initialPerfData: Partial<SalesData> = {};
         performanceSalesCategories.forEach(cat => initialPerfData[cat.key] = 0);
         return initialPerfData as Pick<SalesData, PerformanceSalesCategoryKey>;
     }

     const accumulated: Pick<SalesData, PerformanceSalesCategoryKey> = Object.fromEntries(
         performanceSalesCategories.map(cat => [cat.key, 0])
     ) as Pick<SalesData, PerformanceSalesCategoryKey>;

     const selectedDateStart = startOfDay(selectedDate); // Ensure comparison is date-only

     // Iterate through all dates in the stored data
     Object.entries(dailyStaffSalesData).forEach(([dateString, salesForDate]) => {
         const entryDate = startOfDay(new Date(dateString)); // Parse date string

         // Check if the entry date is before or equal to the selected date
         if (isBefore(entryDate, selectedDateStart) || isEqual(entryDate, selectedDateStart)) {
             const staffSales = salesForDate[selectedStaffId];
             if (staffSales) {
                 // Add the *performance* sales figures from this day to the accumulator
                 performanceSalesCategories.forEach(cat => {
                    accumulated[cat.key] += staffSales[cat.key] || 0;
                 });
             }
         }
     });

     return accumulated;
  }, [selectedStaffId, selectedDate, dailyStaffSalesData]);

   // Get daily tracking data for the *selected* date only
   const selectedDateDailyTrackingData = useMemo(() => {
       if (!selectedStaffId || !selectedDate) {
           const initialDailyData: Partial<SalesData> = {};
           dailyTrackingCategories.forEach(cat => initialDailyData[cat.key] = 0);
           return initialDailyData as Pick<SalesData, DailyTrackingCategoryKey>;
       }

       const dateString = format(selectedDate, 'yyyy-MM-dd');
       const dailyData = dailyStaffSalesData[dateString]?.[selectedStaffId];

       const result: Pick<SalesData, DailyTrackingCategoryKey> = Object.fromEntries(
           dailyTrackingCategories.map(cat => [cat.key, dailyData?.[cat.key] ?? 0])
       ) as Pick<SalesData, DailyTrackingCategoryKey>;

       return result;

   }, [selectedStaffId, selectedDate, dailyStaffSalesData]);


  const currentTargets = useMemo(() => {
     return selectedStaffId ? (staffTargetsData[selectedStaffId] || getDefaultTargetsData()) : getDefaultTargetsData();
  }, [selectedStaffId, staffTargetsData]);

  // Calculate achievement percentage for display (only for performance categories)
  const calculateAchievementPercent = (current: number, target: number) => {
    if (target <= 0) return 0;
    return (current / target) * 100;
  };

  // Calculate weighted points for a performance category (UPDATED LOGIC FOR POSTPAID)
  const calculateWeightedPoints = (key: PerformanceSalesCategoryKey, current: number, target: number, weightage: number) => {
    if (target <= 0) return 0;
    let achievementPercent = (current / target) * 100;
    let pointsBasedOnAchievement = 0;

    if (key === 'postpaid') {
      // Postpaid achievement capped at 120% for calculation base
      const cappedAchievementPercent = Math.min(achievementPercent, 120);
      pointsBasedOnAchievement = (cappedAchievementPercent / 100) * weightage;
      // Postpaid points reflect performance up to 120% achievement.
      // e.g., 120% achievement gives 1.2 * 20 = 24 points.
      // e.g., 100% achievement gives 1.0 * 20 = 20 points.
      // e.g., 50% achievement gives 0.5 * 20 = 10 points.
      // Max points for postpaid IS weightage * 1.2 = 20 * 1.2 = 24

    } else {
      // Other categories: Points are directly proportional to achievement, no capping.
      pointsBasedOnAchievement = (achievementPercent / 100) * weightage;
       // Ensure points do not go below 0 (shouldn't happen with validation but safety check)
       pointsBasedOnAchievement = Math.max(0, pointsBasedOnAchievement);
    }

    return pointsBasedOnAchievement;
  };


  // Total possible weightage (sum of base weightages for performance categories) - used for reference
  const totalBaseWeightage = useMemo(() => performanceSalesCategories.reduce((sum, cat) => sum + cat.weightage, 0), []); // Expected: 100

  const totalWeightedScore = useMemo(() => {
    let score = 0;
    performanceSalesCategories.forEach(cat => {
      score += calculateWeightedPoints(
        cat.key,
        accumulatedPerformanceSalesData[cat.key], // Use accumulated PERFORMANCE data
        currentTargets[cat.key],
        cat.weightage
      );
    });
     // The total score can now exceed 100 if postpaid performance is high
    return score;
  }, [accumulatedPerformanceSalesData, currentTargets]);

  // Calculate overall progress percentage based on total points achieved vs total *base* weightage (100)
  // This percentage can exceed 100% due to the postpaid scoring logic.
  const overallProgressPercent = useMemo(() => {
    // Calculate percentage relative to the base weightage (100)
    // It can exceed 100% if postpaid pushes the score over 100.
    return totalBaseWeightage > 0 ? (totalWeightedScore / totalBaseWeightage) * 100 : 0;
  }, [totalWeightedScore, totalBaseWeightage]);


  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    // Reset handled by useEffect based on staff/date change
    // reset();
  };

  const selectedStaffName = useMemo(() => {
     return staffMembers.find(s => s.id === selectedStaffId)?.name ?? "Select Staff";
  }, [selectedStaffId]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-secondary">
      <div className="w-full max-w-3xl mb-4 flex flex-wrap justify-between items-center gap-2">
        <Link href="/" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        {/* Date Picker */}
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
              />
            </PopoverContent>
        </Popover>


        <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" size="sm" disabled={!selectedStaffId}>
                 <Target className="mr-2 h-4 w-4" /> Set Targets for {selectedStaffName}
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[425px]">
                 <DialogHeader>
                   <DialogTitle>Set Targets for {selectedStaffName}</DialogTitle>
                   <DialogDescription>
                     Define the monthly sales targets for each <span className='font-semibold'>performance</span> category for this staff member. These targets apply across all dates and are used for performance calculations.
                   </DialogDescription>
                 </DialogHeader>
                 <form onSubmit={handleSubmitTarget(onTargetSubmit)} className="space-y-4 py-4">
                      {/* Only show performance categories in the target setting dialog */}
                      {performanceSalesCategories.map((category) => (
                           <div key={category.key} className="grid grid-cols-3 items-center gap-4">
                             <Label htmlFor={`target-${category.key}`} className="text-right col-span-1 flex items-center justify-end">
                                <category.icon className="mr-1 h-4 w-4 text-primary" />
                                {category.name}
                             </Label>
                              <Input
                                id={`target-${category.key}`}
                                type="number"
                                step="any"
                                min="0"
                                {...registerTarget(category.key)}
                                className={`col-span-2 ${targetErrors[category.key] ? "border-destructive" : ""}`}
                              />
                              {targetErrors[category.key] && (
                                <p className="col-span-3 text-sm text-destructive text-right">{targetErrors[category.key]?.message}</p>
                               )}
                           </div>
                      ))}
                      <DialogFooter>
                          <DialogClose asChild>
                             <Button type="button" variant="secondary">Cancel</Button>
                          </DialogClose>
                          <Button type="submit" disabled={isSubmittingTarget}>
                            {isSubmittingTarget ? "Saving Targets..." : "Save Targets"}
                          </Button>
                      </DialogFooter>
                 </form>
             </DialogContent>
         </Dialog>
      </div>

      {/* Staff Selection Card */}
      <Card className="w-full max-w-3xl mb-6 shadow-lg">
          <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary flex items-center">
                  <User className="mr-2 h-5 w-5" /> Select Staff Member
              </CardTitle>
          </CardHeader>
          <CardContent>
               <Select onValueChange={handleStaffChange} value={selectedStaffId ?? undefined}>
                   <SelectTrigger className="w-full">
                       <SelectValue placeholder="Select a staff member..." />
                   </SelectTrigger>
                   <SelectContent>
                       {staffMembers.map((staff) => (
                           <SelectItem key={staff.id} value={staff.id}>
                               {staff.name}
                           </SelectItem>
                       ))}
                   </SelectContent>
               </Select>
          </CardContent>
      </Card>

      {/* Daily Sales Input Card */}
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Daily Sales Input</CardTitle>
          <CardDescription>
            Enter daily sales figures for <span className='font-medium'>{selectedStaffName}</span> for <span className='font-medium'>{selectedDate ? format(selectedDate, 'PPP') : 'the selected date'}</span>. Saving updates the record for this specific date. Performance categories contribute to accumulated scores.
            {(!selectedStaffId || !selectedDate) && <span className="text-destructive"> (Please select staff and date first)</span>}
           </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Performance Categories */}
              {performanceSalesCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.key} className="space-y-2">
                    <Label htmlFor={category.key} className="flex items-center text-base">
                      <Icon className="mr-2 h-5 w-5 text-primary" />
                      {category.name} (Wt: {category.weightage}%)
                    </Label>
                    <Input
                      id={category.key}
                      type="number"
                      step="any"
                      min="0"
                      placeholder={`Enter ${category.name} sales`}
                      {...register(category.key)}
                      className={errors[category.key] ? "border-destructive" : ""}
                      disabled={!selectedStaffId || !selectedDate || isSubmitting}
                    />
                    {errors[category.key] && (
                      <p className="text-sm text-destructive">{errors[category.key]?.message}</p>
                    )}
                     {category.key === 'postpaid' && (
                       <p className="text-xs text-muted-foreground">Performance capped at 120% for points (max {(1.2 * category.weightage).toFixed(1)} pts).</p>
                     )}
                  </div>
                );
              })}

              {/* Daily Tracking Categories */}
               {dailyTrackingCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                      <div key={category.key} className="space-y-2">
                          <Label htmlFor={category.key} className="flex items-center text-base">
                              <Icon className="mr-2 h-5 w-5 text-muted-foreground" /> {/* Muted icon for tracking */}
                              {category.name} (Daily)
                          </Label>
                          <Input
                              id={category.key}
                              type="number"
                              step="any"
                              min="0"
                              placeholder={`Enter ${category.name}`}
                              {...register(category.key)}
                              className={errors[category.key] ? "border-destructive" : ""}
                              disabled={!selectedStaffId || !selectedDate || isSubmitting}
                          />
                          {errors[category.key] && (
                              <p className="text-sm text-destructive">{errors[category.key]?.message}</p>
                          )}
                           <p className="text-xs text-muted-foreground">Tracked daily, not accumulated.</p>
                      </div>
                   );
               })}


             </div>
              {/* Display global form error from refine */}
               {errors.root?.message && (
                   <p className="text-sm text-destructive text-center mt-4">{errors.root.message}</p>
               )}
                {/* More specific refine error message display */}
               {errors.postpaid?.type === 'manual' && (
                   <p className="text-sm text-destructive text-center mt-4">{errors.postpaid.message}</p>
               )}


            <Button type="submit" className="w-full mt-6 bg-accent hover:bg-accent/90" disabled={!selectedStaffId || !selectedDate || isSubmitting}>
              {isSubmitting ? "Saving..." : `Save Daily Sales for ${selectedDate ? format(selectedDate, 'PPP') : ''}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Accumulated Performance Card */}
      {selectedStaffId && selectedDate && (
        <Card className="w-full max-w-3xl mt-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Performance Summary for {selectedStaffName}</CardTitle>
            <CardDescription>Accumulated performance score up to <span className='font-medium'>{format(selectedDate, 'PPP')}</span> and daily tracking figures for the selected date.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {/* Overall Accumulated Score */}
            <div className="space-y-2 border-b pb-4 mb-4">
              <Label className="text-base font-medium">Overall Score (Accumulated Performance)</Label>
              {/* Progress bar shows percentage relative to base 100 points, capped visually at 100% unless score exceeds */}
               <Progress value={Math.min(overallProgressPercent, 100)} max={100} className="h-4 [&>div]:bg-accent" aria-label={`Overall score ${overallProgressPercent.toFixed(1)}%`} />
              <p className="text-sm text-muted-foreground text-right">
                {totalWeightedScore.toFixed(1)} Total Points ({overallProgressPercent.toFixed(1)}% of base {totalBaseWeightage} points)
                {overallProgressPercent > 100 && <span className="text-accent"> (Exceeds 100% due to Postpaid)</span>}
                </p>
            </div>

            {/* Performance Category Breakdown (Accumulated) */}
            <Label className="text-base font-medium block mb-2">Accumulated Performance Breakdown:</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4">
                {performanceSalesCategories.map((category) => {
                  const Icon = category.icon;
                  const currentValue = accumulatedPerformanceSalesData[category.key]; // Use accumulated performance value
                  const targetValue = currentTargets[category.key];
                  const achievementPercent = calculateAchievementPercent(currentValue, targetValue);
                  const points = calculateWeightedPoints(category.key, currentValue, targetValue, category.weightage);

                  // Visual progress bar: Cap visual at 120% for postpaid, 100% for others for clarity
                  const progressBarValue = Math.min(achievementPercent, category.key === 'postpaid' ? 120 : 100);
                  const progressBarMax = category.key === 'postpaid' ? 120 : 100;


                  return (
                    <div key={category.key} className="space-y-1">
                      <Label htmlFor={`${category.key}-progress`} className="flex items-center text-base">
                        <Icon className="mr-2 h-5 w-5 text-primary" />
                        {category.name} (Accum.)
                      </Label>
                      {/* Use a max value for the progress bar */}
                      <Progress id={`${category.key}-progress`} value={progressBarValue} max={progressBarMax} className="h-3" aria-label={`${category.name} progress ${achievementPercent.toFixed(1)}%`} />
                      <p className="text-sm text-muted-foreground text-right">
                         {currentValue} / {targetValue} ({achievementPercent.toFixed(1)}%) - {points.toFixed(1)} pts ({category.weightage}% Wt.)
                      </p>
                      {/* Note for postpaid capping */}
                       {category.key === 'postpaid' && (
                         <p className="text-xs text-muted-foreground text-right">
                             {achievementPercent > 120 ? `Ach. capped at 120% (${(1.2 * category.weightage).toFixed(1)} pts max).` : `Max pts: ${(1.2 * category.weightage).toFixed(1)}.`}
                         </p>
                       )}
                       {/* Note for uncapped categories exceeding 100% */}
                        {category.key !== 'postpaid' && achievementPercent > 100 && (
                            <p className="text-xs text-muted-foreground text-right">Exceeds 100%, points scale.</p>
                        )}
                    </div>
                  );
                })}
            </div>

            {/* Daily Tracking Figures */}
            <Label className="text-base font-medium block mb-2">Daily Tracking for {format(selectedDate, 'PPP')}:</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {dailyTrackingCategories.map((category) => {
                      const Icon = category.icon;
                      const dailyValue = selectedDateDailyTrackingData[category.key] ?? 0;
                      return (
                          <div key={category.key} className="space-y-1 p-3 border rounded-md bg-card">
                              <Label className="flex items-center text-sm font-medium">
                                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                  {category.name}
                              </Label>
                              <p className="text-lg font-semibold text-right">{dailyValue}</p>
                              <p className="text-xs text-muted-foreground text-right">Daily Figure</p>
                          </div>
                      );
                 })}
            </div>

          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">Performance targets are monthly. Daily sales data is accumulated for performance scoring up to the selected date. Daily tracking shows figures for the selected date only. Data stored locally.</p>
          </CardFooter>
        </Card>
      )}
    </main>
  );
}
