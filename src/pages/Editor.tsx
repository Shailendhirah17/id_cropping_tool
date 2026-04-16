import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileEdit, Grid3x3 } from 'lucide-react';
import PDFEditorTab from '@/components/editor/PDFEditorTab';
import CardGroupingTab from '@/components/editor/CardGroupingTab';

type TabId = 'pdf-editor' | 'card-grouping';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'pdf-editor',
    label: 'PDF Editor',
    icon: FileEdit,
    description: 'Upload and edit ID card PDFs — fix text, images, or mistakes and download the corrected file.',
  },
  {
    id: 'card-grouping',
    label: 'ID Card Grouping',
    icon: Grid3x3,
    description: 'Merge multiple ID card PDF last pages — fill empty slots and output on A3 sheets.',
  },
];

const Editor = () => {
  const [activeTab, setActiveTab] = useState<TabId>('pdf-editor');
  const activeTabData = tabs.find(t => t.id === activeTab)!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editor</h1>
        <p className="text-gray-500 mt-1 text-sm">{activeTabData.description}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeEditorTab"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Icon size={16} />
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'pdf-editor' && <PDFEditorTab />}
        {activeTab === 'card-grouping' && <CardGroupingTab />}
      </motion.div>
    </div>
  );
};

export default Editor;
