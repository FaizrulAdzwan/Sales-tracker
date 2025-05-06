
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, CalendarDays, Settings, User, Users } from "lucide-react"; // Added User, Users, BarChart

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center">
           {/* Intentionally left blank for user to potentially add their logo */}
          <CardTitle className="text-3xl font-bold text-center text-primary">Sales Insights</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Your central hub for tracking sales performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center">
            Select an option below to view performance data or update your daily sales.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Link href="/team-performance" passHref className="w-full">
            <Button className="w-full" variant="outline">
               <Users className="mr-2 h-4 w-4" /> Team Performance
            </Button>
          </Link>
          <Link href="/daily-sales" passHref className="w-full">
             <Button className="w-full">
               <User className="mr-2 h-4 w-4" /> Daily Sales Tracker
             </Button>
          </Link>
          <Link href="/summary" passHref className="w-full">
            <Button className="w-full" variant="secondary">
               <BarChart className="mr-2 h-4 w-4" /> Summary Performance
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

