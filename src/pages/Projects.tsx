import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
    FolderOpen, Plus, Search, MoreVertical, Users, CheckCircle,
    AlertCircle, Clock, Layers, CreditCard, Calendar, Trash2, Pencil,
    ChevronRight, XCircle, AlertTriangle, X, UserPlus, Shield, Settings, FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrder } from '@/hooks/useOrder';
import { useConfiguratorStore } from '@/store/useConfiguratorStore';
import { projectService } from '@/services/dataService';
import { authService } from '@/services/authService';
import { Project, User, RecordIssue } from '@/types';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
    active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' },
    validated: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Validated' },
    generating: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Generating' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
};

const Projects = () => {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'ultra-super-admin';
    const isAdmin = user?.role === 'super-admin' || isSuperAdmin;
    const isSubAdmin = user?.role === 'admin';
    const isUser = user?.role === 'user';
    const canManageProjects = isAdmin || isSuperAdmin;

    const [projects, setProjects] = useState<Project[]>([]);
    const [subAdmins, setSubAdmins] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning'>('all');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [projectIssuesMap, setProjectIssuesMap] = useState<Record<string, RecordIssue[]>>({});
    const [loadingIssues, setLoadingIssues] = useState<Record<string, boolean>>({});
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [activeProjectForAssign, setActiveProjectForAssign] = useState<string | null>(null);
    const [newProject, setNewProject] = useState({ name: '', org: '', template: 'School' });
    const [customTemplate, setCustomTemplate] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const navigate = useNavigate();
    const { setOrder } = useOrder();
    const setField = useConfiguratorStore(state => state.setField);

    useEffect(() => {
        fetchProjects();
        if (canManageProjects) fetchSubAdmins();
    }, []);

    const fetchSubAdmins = async () => {
        try {
            const users = await authService.getUsers();
            setSubAdmins(users.filter(u => u.role === 'admin'));
        } catch (error) {
            console.error('Failed to load admins', error);
        }
    };

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const data = await projectService.getAll();
            setProjects(data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const toggleProject = async (projectId: string) => {
        const isCurrentlyExpanded = expandedProjects.has(projectId);
        
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (isCurrentlyExpanded) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });

        // Fetch issues if expanding and not already loaded
        if (!isCurrentlyExpanded && !projectIssuesMap[projectId]) {
            fetchProjectIssues(projectId);
        }
    };

    const fetchProjectIssues = async (projectId: string) => {
        try {
            setLoadingIssues(prev => ({ ...prev, [projectId]: true }));
            const issues = await projectService.getIssues(projectId);
            setProjectIssuesMap(prev => ({ ...prev, [projectId]: issues }));
        } catch (error) {
            console.error('Failed to fetch project issues:', error);
        } finally {
            setLoadingIssues(prev => ({ ...prev, [projectId]: false }));
        }
    };

    const handleCreateProject = async () => {
        try {
            const finalOrg = isSuperAdmin ? newProject.org : (user?.organization || 'GOTEK');
            const data = {
                ...newProject,
                organization: finalOrg,
                status: 'draft',
                total_records: 0,
                valid_records: 0,
                invalid_records: 0,
            };
            const created = await projectService.create(data);
            setProjects([created, ...projects]);
            setIsNewProjectModalOpen(false);
            setNewProject({ name: '', org: '', template: 'School' });
            setCustomTemplate('');
            toast.success('Project created successfully');
        } catch (error) {
            console.error('Failed to create project:', error);
            toast.error('Failed to create project');
        }
    };

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            setIsDeleting(true);
            const projectId = projectToDelete.id || projectToDelete._id;
            await projectService.delete(projectId);
            setProjects(projects.filter(p => (p.id !== projectId && p._id !== projectId)));
            setIsDeleteModalOpen(false);
            setProjectToDelete(null);
            toast.success('Project deleted successfully');
        } catch (error: any) {
            console.error('Failed to delete project:', error);
            const msg = error.response?.data?.message || 'Failed to delete project';
            toast.error(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAssignProject = async (projectId: string, subAdminId: string, subAdminName: string) => {
        try {
            await projectService.update(projectId, { assignedTo: subAdminId, assignedToName: subAdminName });
            setProjects(projects.map(p => {
                if (p.id === projectId || p._id === projectId) {
                    return { ...p, assignedTo: subAdminId, assignedToName: subAdminName } as Project;
                }
                return p;
            }));
            toast.success(`Project assigned to ${subAdminName}`);
            setIsAssignModalOpen(false);
        } catch (error: any) {
            console.error('Failed to assign project', error);
            const msg = error.response?.data?.error || error.response?.data?.message || error.message;
            toast.error(`Failed to assign project: ${msg}`);
        }
    };

    const handleSelectProject = async (project: any) => {
        try {
            // 1. Set selected project in global store
            setField('idCard.selected', project.id);
            
            // 2. Initialize or set the 'order' session for validation hub
            // We use a simplified mock order if one doesn't exist for the project
            setOrder({
                id: `order-${project.id}`,
                projectId: project.id,
                templateId: project.template,
                status: project.status || 'draft',
                totalCards: project.total_records || 0,
                generatedCards: 0,
                createdAt: project.created_at,
                updatedAt: new Date().toISOString()
            });
            
            toast.success(`Project "${project.name}" selected`);
            
            // 3. Navigate to Validation Hub
            if (isUser) {
                navigate(`/validation?orderId=${project.id}`);
            } else {
                navigate(`/validation?orderId=${project.id}`);
            }
        } catch (error: any) {
            console.error('Error selecting project:', error);
            toast.error('Failed to select project');
        }
    };

    const filtered = projects.filter(p => {
        if (!isSuperAdmin) {
            // Normalize strings for deep matching (trim and lowercase)
            const userOrg = (user?.organization || '').trim().toLowerCase();
            const projectOrg = (p.organization || '').trim().toLowerCase();
            
            // If they don't match, hidden
            if (userOrg !== projectOrg) return false;
        }
        
        const pName = p.name || '';
        const pOrg = p.organization || '';
        return pName.toLowerCase().includes(search.toLowerCase()) || 
               pOrg.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
                    <p className="text-gray-500 mt-1">
                        {isSubAdmin ? 'Projects assigned to you' : 'Manage your ID card projects and template mappings.'}
                    </p>
                </div>
                {isAdmin && (
                    <button 
                        onClick={() => setIsNewProjectModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New Project
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Projects', value: projects.length, icon: FolderOpen, color: 'text-blue-600 bg-blue-50' },
                    { label: 'Active', value: projects.filter(p => p.status === 'active').length, icon: Clock, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Total Records', value: projects.reduce((s, p) => s + (p.total_records || 0), 0), icon: Users, color: 'text-violet-600 bg-violet-50' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900">{(stat.value ?? 0).toLocaleString()}</p>
                            <p className="text-xs text-gray-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {(['all', 'error', 'warning'] as const).map(f => (
                        <button key={f} onClick={() => setIssueFilter(f)}
                            className={`px-4 py-2.5 text-sm font-medium capitalize ${issueFilter === f ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                            {f === 'all' ? 'All Issues' : f + 's'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="mt-4 text-sm text-gray-500">Loading projects...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
                        <p className="text-gray-500 mt-1">Create your first project to get started.</p>
                    </div>
                ) : filtered.map((project, i) => {
                    const status = STATUS_STYLES[project.status] || STATUS_STYLES.draft;
                    const totalRecords = project.total_records || 0;
                    const validRecords = project.valid_records || 0;
                    const progress = totalRecords > 0 ? Math.round((validRecords / totalRecords) * 100) : 0;
                    
                    const projectIssues: any[] = []; // In a real app, you would fetch this from PHP backend

                    return (
                        <motion.div
                            key={project.id || project._id || i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (project.color || '#3B82F6') + '15' }}>
                                        <FolderOpen className="w-6 h-6" style={{ color: project.color || '#3B82F6' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base font-semibold text-gray-900">{project.name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.text}`}>
                                                {status.label}
                                            </span>
                                            {project.assignedToName && !isSubAdmin && (
                                                <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-full font-bold uppercase tracking-tight flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> {project.assignedToName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">{project.organization}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {project.template}</span>
                                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(project.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <div className="hidden sm:grid grid-cols-4 gap-4 text-center mr-2">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">{(totalRecords ?? 0).toLocaleString()}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">Records</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-emerald-600">{(validRecords ?? 0).toLocaleString()}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">Valid</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-red-500">{project.invalid_records || 0}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">Invalid</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-amber-500">{project.missing_photos || 0}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">No Photo</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isAdmin && (
                                            <button 
                                                onClick={() => {
                                                    setActiveProjectForAssign(project.id);
                                                    setIsAssignModalOpen(true);
                                                }}
                                                title="Assign to Admin"
                                                className="p-2.5 rounded-xl hover:bg-blue-50 text-blue-600 border border-blue-100 transition-colors"
                                            >
                                                <UserPlus className="w-5 h-5" />
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button 
                                                onClick={() => {
                                                    setProjectToDelete(project);
                                                    setIsDeleteModalOpen(true);
                                                }}
                                                title="Delete Project"
                                                className="p-2.5 rounded-xl hover:bg-red-50 text-red-600 border border-red-100 transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                        {isUser ? (
                                            <button 
                                                onClick={() => handleSelectProject(project)}
                                                title="View PDF / Exports"
                                                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-95"
                                            >
                                                <FileText className="w-4 h-4" /> Download PDF
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleSelectProject(project)}
                                                title="Configure Project"
                                                className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                            >
                                                <Settings className="w-4 h-4" /> Configure
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => toggleProject(project.id || project._id || '')} 
                                            className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors bg-gray-50 flex items-center justify-center border border-gray-200 group"
                                        >
                                            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform group-hover:text-gray-700 ${expandedProjects.has(project.id || project._id || '') ? 'rotate-90' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-gray-500">Validation progress</span>
                                    <span className="font-medium text-gray-700">{progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            {expandedProjects.has(project.id || project._id || '') && (
                                <div className="mt-5 pt-5 border-t border-gray-100">
                                    {loadingIssues[project.id || project._id || ''] ? (
                                        <div className="py-4 text-center">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        </div>
                                    ) : (projectIssuesMap[project.id || project._id || '']?.length || 0) > 0 ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-3 text-sm font-medium text-gray-700">
                                                <span>Validation Issues ({projectIssuesMap[project.id || project._id || '']?.length})</span>
                                            </div>
                                            {projectIssuesMap[project.id || project._id || '']?.map((issue, issueIndex) => (
                                                <motion.div 
                                                    key={issue.id} 
                                                    initial={{ opacity: 0, y: 5 }} 
                                                    animate={{ opacity: 1, y: 0 }} 
                                                    transition={{ delay: issueIndex * 0.05 }}
                                                    className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-4 hover:bg-gray-100 transition-colors">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                        issue.severity === 'error' ? 'bg-red-100' : 'bg-amber-100'
                                                    }`}>
                                                        {issue.severity === 'error' ? 
                                                            <XCircle className="w-4 h-4 text-red-600" /> : 
                                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                        }
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-medium text-gray-900">{issue.record}</h4>
                                                            <span className="text-xs text-gray-400 font-mono">{issue.recordId}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-0.5">{issue.message}</p>
                                                    </div>
                                                    {issue.fixable && (
                                                        <button 
                                                            onClick={() => navigate(`/validation?orderId=${project.id || project._id}`)}
                                                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-white border border-blue-100 rounded-lg shadow-sm"
                                                        >
                                                            Fix Issue
                                                        </button>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center bg-emerald-50 rounded-xl border border-emerald-100">
                                            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                            <p className="text-sm font-medium text-emerald-800">All Clear!</p>
                                            <p className="text-xs text-emerald-600">No validation issues found in this project.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence>
                {isNewProjectModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNewProjectModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
                                <button onClick={() => setIsNewProjectModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project Name</label>
                                    <input type="text" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="e.g. Student IDs 2026" 
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization</label>
                                    {isSuperAdmin ? (
                                        <input 
                                            type="text"
                                            value={newProject.org}
                                            onChange={e => setNewProject({...newProject, org: e.target.value})}
                                            placeholder="Enter Organization..."
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                        />
                                    ) : (
                                        <input 
                                            type="text"
                                            value={user?.organization || 'GOTEK'}
                                            readOnly
                                            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 text-sm cursor-not-allowed"
                                        />
                                    )}
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button onClick={() => setIsNewProjectModalOpen(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                                    <button onClick={handleCreateProject} disabled={!newProject.name || (!isSuperAdmin ? false : !newProject.org)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200">Create Project</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAssignModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900">Assign Project</h2>
                                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X className="w-5 h-5" /></button>
                            </div>
                            <p className="text-sm text-gray-500 mb-6">Select an Admin to handle the editor portal for this project.</p>
                            
                            <div className="space-y-2">
                                                {subAdmins.map((subAdmin) => {
                                                    const currentProject = projects.find(p => p.id === activeProjectForAssign || p._id === activeProjectForAssign);
                                                    const isSelected = currentProject?.assignedTo === subAdmin._id || currentProject?.assignedTo === subAdmin.id;
                                                    
                                                    return (
                                                        <div key={subAdmin._id || subAdmin.id} 
                                                            className={cn(
                                                                "p-4 border-2 rounded-xl flex items-center justify-between group cursor-pointer transition-all",
                                                                isSelected ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-gray-50 hover:bg-gray-100/80"
                                                            )}
                                                            onClick={() => activeProjectForAssign && handleAssignProject(activeProjectForAssign, subAdmin._id || subAdmin.id || '', subAdmin.name)}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                                                                    isSelected ? "bg-blue-600 text-white" : "bg-white text-gray-400 group-hover:text-gray-600"
                                                                )}>
                                                                    {subAdmin.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className={cn("text-sm font-bold", isSelected ? "text-blue-900" : "text-gray-900")}>{subAdmin.name}</p>
                                                                    <p className="text-[11px] text-gray-500">{subAdmin.email}</p>
                                                                </div>
                                                            </div>
                                                            {isSelected ? (
                                                                <CheckCircle className="w-5 h-5 text-blue-600" />
                                                            ) : (
                                                                <ChevronRight className="w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {subAdmins.length === 0 && (
                                                    <p className="text-sm text-gray-500 text-center py-4">No admins found. Create one in Settings first.</p>
                                                )}
                                            </div>
                            <div className="mt-6">
                                <button onClick={() => setIsAssignModalOpen(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-hidden">
                            <div className="flex items-center gap-3 text-red-600 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <h2 className="text-xl font-bold">Delete Project?</h2>
                            </div>
                            
                            <p className="text-sm text-gray-500 mb-6">
                                Are you sure you want to delete <span className="font-bold text-gray-900">"{projectToDelete?.name}"</span>? 
                                This action cannot be undone and will delete all associated student records.
                            </p>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteProject}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Projects;
