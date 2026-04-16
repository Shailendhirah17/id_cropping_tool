import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, FileText, CreditCard, Download, Printer, ArrowRight, ChevronRight, Package } from 'lucide-react';

const STAGES = [
    { key: 'draft', label: 'Draft', icon: FileText },
    { key: 'uploaded', label: 'Uploaded', icon: Package },
    { key: 'validated', label: 'Validated', icon: CheckCircle },
    { key: 'approved', label: 'Approved', icon: CreditCard },
    { key: 'generated', label: 'Generated', icon: Printer },
    { key: 'exported', label: 'Exported', icon: Download },
];

const REQUESTS = [
    { id: 'REQ-001', project: 'ABC International School 2026', cards: 1250, currentStage: 4, createdAt: '2026-03-01', updatedAt: '2 hours ago', assignee: 'Admin User' },
    { id: 'REQ-002', project: 'XYZ College Faculty IDs', cards: 320, currentStage: 3, createdAt: '2026-02-20', updatedAt: '1 day ago', assignee: 'School Operator' },
    { id: 'REQ-003', project: 'TechCorp Employee Badges', cards: 85, currentStage: 1, createdAt: '2026-03-08', updatedAt: '5 hours ago', assignee: 'Admin User' },
    { id: 'REQ-004', project: 'City General Hospital Staff', cards: 450, currentStage: 5, createdAt: '2026-01-15', updatedAt: '1 week ago', assignee: 'School Operator' },
    { id: 'REQ-005', project: 'Government Office IDs - Q1', cards: 200, currentStage: 2, createdAt: '2026-02-10', updatedAt: '3 days ago', assignee: 'Admin User' },
];

const RequestTracking = () => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Request Tracking</h1>
                <p className="text-gray-500 mt-1">Track the lifecycle of all ID card generation requests.</p>
            </div>

            {/* Pipeline overview */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Overview</h2>
                <div className="flex items-center justify-between gap-1">
                    {STAGES.map((stage, i) => {
                        const count = REQUESTS.filter(r => r.currentStage === i).length;
                        return (
                            <div key={stage.key} className="flex items-center gap-1 flex-1">
                                <div className="flex-1 text-center">
                                    <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${count > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                        <stage.icon className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-medium text-gray-700 mt-1.5">{stage.label}</p>
                                    <p className="text-lg font-bold text-gray-900">{count}</p>
                                </div>
                                {i < STAGES.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-[-16px]" />}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Request cards */}
            <div className="space-y-4">
                {REQUESTS.map((req, i) => (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                        <div className="p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-gray-900">{req.project}</h3>
                                            <span className="text-xs font-mono text-gray-400">{req.id}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                            <span>{req.cards.toLocaleString()} cards</span>
                                            <span>•</span>
                                            <span>{req.assignee}</span>
                                            <span>•</span>
                                            <span>{req.updatedAt}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                                        {STAGES[req.currentStage].label}
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === req.id ? 'rotate-90' : ''}`} />
                                </div>
                            </div>
                        </div>

                        {/* Expanded timeline */}
                        {expandedId === req.id && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-gray-100 px-5 py-4">
                                <div className="flex items-center gap-0">
                                    {STAGES.map((stage, si) => {
                                        const done = si <= req.currentStage;
                                        const current = si === req.currentStage;
                                        return (
                                            <div key={stage.key} className="flex items-center flex-1">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? (current ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-emerald-500 text-white') : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                        {done && !current ? <CheckCircle className="w-4 h-4" /> : <stage.icon className="w-4 h-4" />}
                                                    </div>
                                                    <span className={`text-[10px] mt-1 font-medium ${done ? 'text-gray-700' : 'text-gray-400'}`}>{stage.label}</span>
                                                </div>
                                                {si < STAGES.length - 1 && (
                                                    <div className={`flex-1 h-0.5 mx-1 rounded ${si < req.currentStage ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default RequestTracking;
