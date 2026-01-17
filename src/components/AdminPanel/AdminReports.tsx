import React, { useState } from 'react'; // ✅ useState ADDED
import { reportService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminReportsProps {
  reports: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminReports: React.FC<AdminReportsProps> = ({ reports, showToast }) => {
  const [processing, setProcessing] = useState<string | null>(null);

  const openReports = reports.filter(r => r.status === 'open');
  const resolvedReports = reports.filter(r => r.status === 'resolved');

  const handleResolveReport = async (reportId: string) => {
    setProcessing(reportId);
    try {
      await reportService.resolveReport(reportId, 'admin-id');
      showToast('Report marked as resolved', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to resolve report', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    
    setProcessing(reportId);
    try {
      await reportService.deleteReport(reportId);
      showToast('Report deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete report', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Open Reports */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-white italic px-2 tracking-tighter uppercase">
          Incident Reports (Inbox)
        </h3>
        
        {openReports.length === 0 ? (
          <div className="text-center py-12">
            <ICONS.Check className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 text-sm font-black uppercase">Inbox Clear</p>
          </div>
        ) : (
          openReports.map(report => (
            <div key={report.id} className="glass-panel p-6 rounded-[32px] border-l-4 border-l-red-500 space-y-2 shadow-2xl animate-slide relative group">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                  Incident @{report.username}
                </p>
                <p className="text-[8px] text-slate-500 font-bold">
                  {formatDate(report.timestamp)}
                </p>
              </div>
              
              <p className="text-sm text-white italic leading-relaxed font-medium">
                "{report.message}"
              </p>
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => handleResolveReport(report.id)}
                  disabled={processing === report.id}
                  className="text-[8px] font-black uppercase text-green-400 tracking-widest bg-green-400/5 px-4 py-2 rounded-lg border border-green-400/10 hover:bg-green-400 hover:text-black transition-all disabled:opacity-50"
                >
                  {processing === report.id ? 'Processing...' : 'Mark as Resolved'}
                </button>
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  disabled={processing === report.id}
                  className="text-[8px] font-black uppercase text-red-400 tracking-widest bg-red-400/5 px-4 py-2 rounded-lg border border-red-400/10 hover:bg-red-400 hover:text-black transition-all disabled:opacity-50"
                >
                  Delete Report
                </button>
              </div>
              
              <div className="absolute top-4 right-4 text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                <ICONS.Users className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolved Reports (Collapsible) */}
      {resolvedReports.length > 0 && (
        <div className="space-y-4">
          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer list-none">
              <h3 className="text-lg font-black text-white italic">
                Resolved Reports ({resolvedReports.length})
              </h3>
              <ICONS.ChevronDown className="w-5 h-5 text-slate-600 group-open:rotate-180 transition-transform" />
            </summary>
            
            <div className="mt-4 space-y-4">
              {resolvedReports.map(report => (
                <div key={report.id} className="glass-panel p-6 rounded-[32px] border-l-4 border-l-green-500 space-y-2 opacity-70">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                      Resolved @{report.username}
                    </p>
                    <p className="text-[8px] text-slate-500 font-bold">
                      {formatDate(report.resolvedAt || report.timestamp)}
                    </p>
                  </div>
                  
                  <p className="text-sm text-white italic leading-relaxed font-medium">
                    "{report.message}"
                  </p>
                  
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="text-[7px] font-black uppercase text-slate-400 tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
