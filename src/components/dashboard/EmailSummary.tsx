import { Link } from 'react-router-dom';
import { Mail, Send, Inbox } from 'lucide-react';
import { Card } from '../ui';

interface EmailStatsData {
  configured: boolean;
  sent_count?: number;
  received_count?: number;
  total_count?: number;
  top_correspondents?: { email: string; count: number }[];
}

interface EmailSummaryProps {
  stats: EmailStatsData | null;
  loading?: boolean;
}

export function EmailSummary({ stats, loading = false }: EmailSummaryProps) {
  return (
    <Card padding="none">
      <Card.Header>
        <h3 className="text-heading text-base">Email Activity</h3>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : !stats?.configured ? (
          <div className="py-4 text-center">
            <Mail className="h-6 w-6 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-400">Gmail not connected</p>
            <Link to="/integrations" className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-1 inline-block">
              Connect &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Counts */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-surface-400 mb-1">
                  <Send className="h-3 w-3" />
                </div>
                <p className="text-lg font-bold text-surface-800">{stats.sent_count ?? 0}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wide">Sent</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-surface-400 mb-1">
                  <Inbox className="h-3 w-3" />
                </div>
                <p className="text-lg font-bold text-surface-800">{stats.received_count ?? 0}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wide">Received</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-surface-400 mb-1">
                  <Mail className="h-3 w-3" />
                </div>
                <p className="text-lg font-bold text-surface-800">{stats.total_count ?? 0}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wide">Total</p>
              </div>
            </div>

            {/* Top correspondents */}
            {stats.top_correspondents && stats.top_correspondents.length > 0 && (
              <div className="border-t border-surface-100 pt-2">
                <p className="text-[10px] text-surface-400 uppercase tracking-wide mb-1.5">Top Contacts (7d)</p>
                {stats.top_correspondents.slice(0, 3).map((c) => (
                  <div key={c.email} className="flex items-center justify-between py-1">
                    <span className="text-xs text-surface-600 truncate max-w-[70%]">{c.email}</span>
                    <span className="text-xs font-medium text-surface-500">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
