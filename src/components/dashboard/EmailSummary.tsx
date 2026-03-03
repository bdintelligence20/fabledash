import { Link } from 'react-router-dom';
import { Mail, Send, Inbox, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card } from '../ui';

interface RecentEmail {
  id?: string;
  subject: string;
  date: string;
  direction: 'sent' | 'received';
  from_addr?: string;
  to_addr?: string;
  snippet?: string;
}

interface EmailStatsData {
  configured: boolean;
  sent_count?: number;
  received_count?: number;
  total_count?: number;
  top_correspondents?: { email: string; count: number }[];
  recent_emails?: RecentEmail[];
}

interface EmailSummaryProps {
  stats: EmailStatsData | null;
  loading?: boolean;
}

function formatEmailDate(ts: string | number): string {
  if (!ts) return '';
  try {
    const d =
      typeof ts === 'number'
        ? new Date(ts < 1e12 ? ts * 1000 : ts)
        : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function extractDisplayAddr(addr: string): string {
  if (!addr) return '';
  const match = addr.match(/^(.+?)\s*</);
  if (match) return match[1].trim();
  const atIdx = addr.indexOf('@');
  return atIdx > 0 ? addr.slice(0, atIdx) : addr;
}

export function EmailSummary({ stats, loading = false }: EmailSummaryProps) {
  const emails = stats?.recent_emails ?? [];

  return (
    <Card padding="none">
      <Card.Header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-surface-400" />
          <h3 className="text-heading text-base">Email Activity</h3>
        </div>
        {stats?.configured && (
          <span className="text-xs text-surface-400">30d</span>
        )}
      </Card.Header>

      <Card.Body className="pt-0">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : !stats?.configured ? (
          <div className="py-4 text-center">
            <Mail className="h-6 w-6 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-400">Gmail not connected</p>
            <Link
              to="/integrations"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-1 inline-block"
            >
              Connect &rarr;
            </Link>
          </div>
        ) : (
          <div>
            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-emerald-50 p-2.5 text-center">
                <div className="flex items-center justify-center mb-0.5">
                  <Send className="h-3 w-3 text-emerald-600" />
                </div>
                <p className="text-lg font-bold text-emerald-700">{stats.sent_count ?? 0}</p>
                <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">
                  Sent
                </p>
              </div>
              <div className="rounded-lg bg-primary-50 p-2.5 text-center">
                <div className="flex items-center justify-center mb-0.5">
                  <Inbox className="h-3 w-3 text-primary-600" />
                </div>
                <p className="text-lg font-bold text-primary-700">{stats.received_count ?? 0}</p>
                <p className="text-[10px] text-primary-600 uppercase tracking-wide font-semibold">
                  Received
                </p>
              </div>
              <div className="rounded-lg bg-surface-100 p-2.5 text-center">
                <div className="flex items-center justify-center mb-0.5">
                  <Mail className="h-3 w-3 text-surface-500" />
                </div>
                <p className="text-lg font-bold text-surface-700">{stats.total_count ?? 0}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wide font-semibold">
                  Total
                </p>
              </div>
            </div>

            {/* Recent emails list */}
            {emails.length > 0 ? (
              <div>
                <p className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold mb-2">
                  Recent
                </p>
                <div className="space-y-0.5">
                  {emails.slice(0, 8).map((email, idx) => (
                    <div
                      key={email.id ?? idx}
                      className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-surface-50 transition-colors group"
                    >
                      {/* Direction icon */}
                      <div
                        className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${
                          email.direction === 'sent'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-primary-100 text-primary-600'
                        }`}
                      >
                        {email.direction === 'sent' ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-semibold text-surface-800 truncate leading-tight">
                            {email.subject || '(no subject)'}
                          </p>
                          <span className="text-[10px] text-surface-400 flex-shrink-0 tabular-nums">
                            {formatEmailDate(email.date)}
                          </span>
                        </div>
                        <p className="text-[11px] text-surface-400 truncate">
                          {email.direction === 'received'
                            ? extractDisplayAddr(email.from_addr ?? '')
                            : `To: ${extractDisplayAddr(email.to_addr ?? '')}`}
                        </p>
                        {email.snippet && (
                          <p className="text-[11px] text-surface-400 truncate mt-0.5 max-h-0 overflow-hidden group-hover:max-h-4 transition-all duration-200">
                            {email.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-xs text-surface-400">No recent emails found</p>
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
