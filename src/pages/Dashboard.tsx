import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Users, FileText, CreditCard, AlertCircle, Clock,
    TrendingUp, FolderOpen, Layers, CheckCircle
} from 'lucide-react';
import { dashboardService, projectService } from '@/services/dataService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface DashboardStats {
    totalProjects: number;
    totalAdmins: number;
    totalUsers: number;
}

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalProjects: 0,
        totalAdmins: 0,
        totalUsers: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const globalStats = await dashboardService.getStats();
            
            // If the user isn't an overarching admin, they should only see Projects within their Organization.
            // Let's grab the projects array and accurately measure.
            const allProjects = await projectService.getAll();
            let safeProjectCount = globalStats.totalProjects;
            
            if (user?.role !== 'ultra-super-admin') {
                const userOrg = (user?.organization || '').trim().toLowerCase();
                safeProjectCount = allProjects.filter((p: any) => 
                    (p.organization || '').trim().toLowerCase() === userOrg
                ).length;
            }

            setStats({
                ...globalStats,
                totalProjects: safeProjectCount
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            toast.error('Failed to load real-time stats');
        } finally {
            setLoading(false);
        }
    };

    const isUser = user?.role === 'user';
    const isSubAdmin = user?.role === 'admin';

    const statCards = [
        { 
            label: 'Total Projects', 
            value: stats.totalProjects, 
            icon: FolderOpen, 
            color: 'from-blue-500 to-blue-600', 
            bg: 'bg-blue-50',
            show: true 
        },
        { 
            label: 'Total Admin', 
            value: stats.totalAdmins, 
            icon: Users, // Can distinctively use Shield or Users
            color: 'from-emerald-500 to-emerald-600', 
            bg: 'bg-emerald-50',
            show: !isUser 
        },
        { 
            label: 'Total Users', 
            value: stats.totalUsers, 
            icon: Users, 
            color: 'from-purple-500 to-purple-600', 
            bg: 'bg-purple-50',
            show: !isUser 
        }
    ].filter(card => card.show);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-bold text-gray-900"
                    >
                        Welcome back, {user?.name || 'User'} 👋
                    </motion.h1>
                    <p className="text-gray-500 mt-1">
                        Here's an overview of your GOTEK workspace.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-5`}>
                {statCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {loading ? '—' : (card.value ?? 0).toLocaleString()}
                                </p>
                            </div>
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                                <card.icon className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>



            {/* Recent Activity / Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Recent Activity
                        </h2>
                        <a href="/tracking" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All →</a>
                    </div>
                    <div className="space-y-4">
                        {[
                            { action: 'Project created', detail: 'ABC School 2026 Student IDs', time: '2 hours ago', icon: FolderOpen },
                            { action: 'Data imported', detail: '1,250 records from Excel', time: '3 hours ago', icon: FileText },
                            { action: 'Cards generated', detail: '450 ID cards in batch #12', time: '5 hours ago', icon: CreditCard },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                                    <item.icon className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{item.action}</p>
                                    <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
                    <h3 className="text-lg font-bold mb-2">Workspace Status</h3>
                    <p className="text-blue-100 text-sm mb-4">Your systems are running normally. No critical issues detected across projects.</p>
                    <button className="w-full py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors">
                        System Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
