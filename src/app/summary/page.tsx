
"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { Phone, Wifi, UserCheck, Router, Smile, ArrowLeft, Users, Target } from 'lucide-react';
import type { PerformanceSalesCategoryKey, PerformanceSalesCategoryInfo, SalesData, TargetsData, StaffMember, StaffTargetsCollection, DailyStaffSalesCollection } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import Link from 'next/link';
import { format, startOfDay, isBefore, isEqual } from "date-fns";


// Define performance sales categories (same as in daily-sales)
const performanceSalesCategories: PerformanceSalesCategoryInfo[] = [
  { key: 'postpaid', name: 'Postpaid', weightage: 20, icon: Phone, defaultTarget: 100 },
  { key: 'hvc', name: 'HVC', weightage: 20, icon: UserCheck, defaultTarget: 100 },
  { key: 'fibre', name: 'Fibre', weightage: 20, icon: Wifi, defaultTarget: 50 },
  { key: 'fwa', name: 'FWA', weightage: 10, icon: Router, defaultTarget: 50 },
  { key: 'csat', name: 'CSAT', weightage: 30, icon: Smile, defaultTarget: 90 },
]; // Total Weightage: 100

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

// Calculate achievement percentage (same as in daily-sales)
const calculateAchievementPercent = (current: number, target: number) => {
  if (target <= 0) return 0;
  return (current / target) * 100;
};

// Calculate weighted points (same as in daily-sales)
const calculateWeightedPoints = (key: PerformanceSalesCategoryKey, current: number, target: number, weightage: number) => {
  if (target <= 0) return 0;
  let achievementPercent = (current / target) * 100;
  let pointsBasedOnAchievement = 0;

  if (key === 'postpaid') {
    const cappedAchievementPercent = Math.min(achievementPercent, 120);
    pointsBasedOnAchievement = (cappedAchievementPercent / 100) * weightage;
  } else {
    pointsBasedOnAchievement = (achievementPercent / 100) * weightage;
    pointsBasedOnAchievement = Math.max(0, pointsBasedOnAchievement);
  }

  return pointsBasedOnAchievement;
};

// Total possible base weightage (same as in daily-sales)
const totalBaseWeightage = performanceSalesCategories.reduce((sum, cat) => sum + cat.weightage, 0); // Expected: 100


export default function SummaryPage() {
  // Fetch data from local storage
  const [dailyStaffSalesData] = useLocalStorage<DailyStaffSalesCollection>(DAILY_STAFF_SALES_KEY, {});
  const [staffTargetsData] = useLocalStorage<StaffTargetsCollection>(STAFF_TARGETS_KEY, {});

  // Calculate accumulated performance for all staff based on *all* historical data
  const allStaffPerformance = useMemo(() => {
    const performanceSummary: { [staffId: string]: { accumulated: Pick<SalesData, PerformanceSalesCategoryKey>, targets: TargetsData, totalScore: number, overallPercent: number } } = {};

    staffMembers.forEach(staff => {
      const accumulated: Pick<SalesData, PerformanceSalesCategoryKey> = Object.fromEntries(
          performanceSalesCategories.map(cat => [cat.key, 0])
      ) as Pick<SalesData, PerformanceSalesCategoryKey>;

      // Iterate through all dates in the stored data for this staff member
      Object.values(dailyStaffSalesData).forEach((salesForDate) => {
          const staffSales = salesForDate[staff.id];
          if (staffSales) {
              // Add the *performance* sales figures from this day
              performanceSalesCategories.forEach(cat => {
                 accumulated[cat.key] += staffSales[cat.key] || 0;
              });
          }
      });

      const currentTargets = staffTargetsData[staff.id] || getDefaultTargetsData();
      let totalWeightedScore = 0;
      performanceSalesCategories.forEach(cat => {
          totalWeightedScore += calculateWeightedPoints(
              cat.key,
              accumulated[cat.key],
              currentTargets[cat.key],
              cat.weightage
          );
      });

      const overallProgressPercent = totalBaseWeightage > 0 ? (totalWeightedScore / totalBaseWeightage) * 100 : 0;

      performanceSummary[staff.id] = {
          accumulated: accumulated,
          targets: currentTargets,
          totalScore: totalWeightedScore,
          overallPercent: overallProgressPercent,
      };
    });

    return performanceSummary;
  }, [dailyStaffSalesData, staffTargetsData]);


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-secondary">
      <div className="w-full max-w-6xl mb-4 flex justify-between items-center">
          <Link href="/" passHref>
              <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-primary">Staff Performance Summary</h1>
          <div className="w-[100px]"></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-6xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
              <Users className="mr-2 h-5 w-5" /> Overall Performance
          </CardTitle>
          <CardDescription>
            Accumulated performance scores for all staff based on all recorded daily sales data. Targets are applied monthly.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableCaption>Performance data accumulated from all saved daily entries.</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Staff Member</TableHead>
                        {performanceSalesCategories.map(cat => (
                            <TableHead key={cat.key} className="text-center">
                               <div className='flex items-center justify-center'>
                                   <cat.icon className="mr-1 h-4 w-4 text-primary" />
                                   {cat.name}
                               </div>
                               <span className='text-xs font-normal text-muted-foreground'>(Wt: {cat.weightage}%)</span>
                            </TableHead>
                        ))}
                        <TableHead className="text-center font-semibold">Total Score</TableHead>
                        <TableHead className="text-center font-semibold">Overall %</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {staffMembers.map(staff => {
                        const performance = allStaffPerformance[staff.id];
                        if (!performance) {
                            return ( // Render a row indicating no data if needed
                                <TableRow key={staff.id}>
                                    <TableCell className="font-medium">{staff.name}</TableCell>
                                    <TableCell colSpan={performanceSalesCategories.length + 2} className="text-center text-muted-foreground">No performance data found.</TableCell>
                                </TableRow>
                            );
                        }
                        const { accumulated, targets, totalScore, overallPercent } = performance;

                        return (
                            <TableRow key={staff.id}>
                                <TableCell className="font-medium">{staff.name}</TableCell>
                                {performanceSalesCategories.map(cat => {
                                    const currentValue = accumulated[cat.key];
                                    const targetValue = targets[cat.key];
                                    const achievementPercent = calculateAchievementPercent(currentValue, targetValue);
                                    const points = calculateWeightedPoints(cat.key, currentValue, targetValue, cat.weightage);
                                    const progressBarValue = Math.min(achievementPercent, cat.key === 'postpaid' ? 120 : 100); // Visual cap
                                    const progressBarMax = cat.key === 'postpaid' ? 120 : 100;

                                    return (
                                        <TableCell key={cat.key} className="text-center">
                                            <div className='mb-1'>{currentValue} / {targetValue}</div>
                                            <Progress value={progressBarValue} max={progressBarMax} className="h-2 mx-auto w-20 mb-1" aria-label={`${cat.name} progress ${achievementPercent.toFixed(1)}%`} />
                                            <div className='text-xs text-muted-foreground'>
                                               ({achievementPercent.toFixed(1)}%)
                                            </div>
                                             <div className='text-xs font-medium'>
                                                {points.toFixed(1)} pts
                                             </div>
                                        </TableCell>
                                    );
                                })}
                                <TableCell className="text-center font-semibold">{totalScore.toFixed(1)}</TableCell>
                                <TableCell className={`text-center font-semibold ${overallPercent >= 100 ? 'text-accent' : ''}`}>
                                   {overallPercent.toFixed(1)}%
                                   {overallPercent > 100 && <span className="text-xs block text-accent">(Exceeds 100%)</span>}
                                </TableCell>

                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Postpaid achievement is capped at 120% for points calculation (max {(1.2 * 20).toFixed(1)} pts). Overall % can exceed 100.</p>
         </CardFooter>
      </Card>
    </main>
  );
}
