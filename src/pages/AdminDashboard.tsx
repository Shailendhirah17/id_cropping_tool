import { useRequireAuth } from "@/hooks/useAuth";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Package, Layout, AlertCircle, Users, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { dashboardService, schoolService, orderService, studentService, templateService } from "@/services/dataService";
import { toast } from "sonner";

interface DashboardStats {
  totalSchools: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalStudents: number;
  totalTemplates: number;
  activeTemplates: number;
  newSchoolsThisMonth: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
}

const AdminDashboard = () => {
  const { user, isLoading } = useRequireAuth("/");
  const [stats, setStats] = useState<DashboardStats>({
    totalSchools: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalStudents: 0,
    totalTemplates: 0,
    activeTemplates: 0,
    newSchoolsThisMonth: 0,
    ordersThisMonth: 0,
    revenueThisMonth: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      setIsLoadingStats(true);
      try {
        // Fetch all stats from the Node.js API
        const [schools, orders, templates] = await Promise.all([
          schoolService.getAll().catch(() => []),
          orderService.getAll().catch(() => []),
          templateService.getAll().catch(() => ({ templates: [] })),
        ]);

        const schoolsList = Array.isArray(schools) ? schools : [];
        const ordersList = Array.isArray(orders) ? orders : [];
        const templatesList = Array.isArray(templates) ? templates : (templates?.templates || []);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const pendingOrders = ordersList.filter((o: any) => o.status === 'draft' || o.status === 'uploaded' || o.status === 'validated').length;
        const completedOrders = ordersList.filter((o: any) => o.status === 'generated' || o.status === 'exported').length;
        const newSchoolsThisMonth = schoolsList.filter((s: any) => new Date(s.createdAt) >= monthStart).length;
        const ordersThisMonth = ordersList.filter((o: any) => new Date(o.createdAt) >= monthStart).length;

        setStats({
          totalSchools: schoolsList.length,
          totalOrders: ordersList.length,
          pendingOrders,
          completedOrders,
          totalStudents: 0, // Students are per-school; dashboard stats come from /dashboard/stats
          totalTemplates: templatesList.length,
          activeTemplates: templatesList.filter((t: any) => t.isPublic).length,
          newSchoolsThisMonth,
          ordersThisMonth,
          revenueThisMonth: ordersThisMonth * 50,
        });

        // Also try to get accurate counts from the dashboard endpoint
        try {
          const dashStats = await dashboardService.getStats();
          setStats(prev => ({
            ...prev,
            totalStudents: dashStats.totalRecords || 0,
            totalTemplates: dashStats.totalTemplates || prev.totalTemplates,
          }));
        } catch { /* ignore if dashboard endpoint fails */ }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        toast.error('Failed to load dashboard statistics');
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  if (isLoading || isLoadingStats) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-4xl font-bold">{stats.totalSchools}</CardTitle>
                  <CardDescription>Total Schools</CardDescription>
                </div>
                <School className="w-8 h-8 text-primary/60" />
              </div>
            </CardHeader>
          </Card>
          
          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-4xl font-bold text-yellow-600">{stats.pendingOrders}</CardTitle>
                  <CardDescription>Orders Pending</CardDescription>
                </div>
                <Clock className="w-8 h-8 text-yellow-600/60" />
              </div>
            </CardHeader>
          </Card>
          
          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-4xl font-bold text-green-600">{stats.completedOrders}</CardTitle>
                  <CardDescription>Orders Completed</CardDescription>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600/60" />
              </div>
            </CardHeader>
          </Card>

          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-4xl font-bold text-blue-600">{stats.totalStudents}</CardTitle>
                  <CardDescription>Total Students</CardDescription>
                </div>
                <Users className="w-8 h-8 text-blue-600/60" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold text-orange-600">{stats.newSchoolsThisMonth}</CardTitle>
                  <CardDescription>New Schools This Month</CardDescription>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600/60" />
              </div>
            </CardHeader>
          </Card>

          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold text-indigo-600">{stats.ordersThisMonth}</CardTitle>
                  <CardDescription>Orders This Month</CardDescription>
                </div>
                <Package className="w-8 h-8 text-indigo-600/60" />
              </div>
            </CardHeader>
          </Card>

          <Card className="card-gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold text-emerald-600">₹{stats.revenueThisMonth}</CardTitle>
                  <CardDescription>Revenue This Month</CardDescription>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-600/60" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="card-hover cursor-pointer"
            onClick={() => window.location.href = '/admin/schools'}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <School className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Schools</CardTitle>
                  <CardDescription>Manage schools</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="card-hover cursor-pointer"
            onClick={() => window.location.href = '/admin/orders'}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Orders</CardTitle>
                  <CardDescription>View all orders</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>


          <Card 
            className="card-hover cursor-pointer"
            onClick={() => window.location.href = '/admin/advertisements'}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Advertisements</CardTitle>
                  <CardDescription>Manage ads</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
