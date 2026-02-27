import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  HardDrive,
  Mail,
  Calendar,
  Mic,
  BookOpen,
  Settings,
  AlertTriangle,
  Folder,
  FileText,
  ArrowUpRight,
  Users,
  Clock,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button, Card, Spinner, StatCard, Tabs, Table } from '../components/ui';
import apiClient from '../lib/api';
import { colors } from '../styles/tokens';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ServiceStatus {
  name: string;
  key: string;
  icon: React.ReactNode;
  configured: boolean;
  loading: boolean;
}

/* Gmail volume trend */
interface VolumeTrendDay {
  date: string;
  sent: number;
  received: number;
}

interface GmailVolumeData {
  configured: boolean;
  period_days?: number;
  trend: VolumeTrendDay[];
}

/* Gmail stats */
interface GmailStatsData {
  configured: boolean;
  message?: string;
  sent_count?: number;
  received_count?: number;
  top_correspondents?: { email: string; count: number }[];
}

/* Calendar density */
interface CalendarDensityData {
  configured: boolean;
  meetings_per_day?: number;
  busiest_day?: { date: string; meetings: number } | string | null;
  total_meetings?: number;
  total_meeting_hours?: number;
  daily_breakdown?: { date: string; meetings: number }[];
}

/* Calendar meetings */
interface CalendarMeeting {
  summary: string;
  start: string;
  end: string;
  attendees?: number;
}

interface CalendarMeetingsData {
  configured: boolean;
  meetings: CalendarMeeting[];
  count: number;
}

/* Drive files */
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

interface DriveFilesData {
  files: DriveFile[];
  count: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatFileSize(sizeStr: string | undefined): string {
  if (!sizeStr) return '--';
  const bytes = parseInt(sizeStr, 10);
  if (isNaN(bytes)) return sizeStr;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectEmailCreep(trend: VolumeTrendDay[]): { detected: boolean; message: string } {
  if (trend.length < 14) return { detected: false, message: '' };

  // Compare last 7 days volume to the previous 7 days
  const recent = trend.slice(-7);
  const previous = trend.slice(-14, -7);

  const recentTotal = recent.reduce((sum, d) => sum + d.sent + d.received, 0);
  const previousTotal = previous.reduce((sum, d) => sum + d.sent + d.received, 0);

  if (previousTotal === 0) return { detected: false, message: '' };

  const increase = ((recentTotal - previousTotal) / previousTotal) * 100;

  if (increase > 15) {
    return {
      detected: true,
      message: `Email volume up ${Math.round(increase)}% vs previous week (${recentTotal} vs ${previousTotal} emails)`,
    };
  }

  return { detected: false, message: '' };
}

function mimeTypeIcon(mimeType: string): React.ReactNode {
  if (mimeType.includes('folder')) return <Folder className="h-4 w-4 text-accent-500" />;
  if (mimeType.includes('spreadsheet')) return <FileText className="h-4 w-4 text-success-500" />;
  if (mimeType.includes('document')) return <FileText className="h-4 w-4 text-primary-500" />;
  if (mimeType.includes('presentation')) return <FileText className="h-4 w-4 text-warning-500" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-danger-500" />;
  return <FileText className="h-4 w-4 text-surface-400" />;
}

/* -------------------------------------------------------------------------- */
/*  IntegrationsPage                                                           */
/* -------------------------------------------------------------------------- */

export default function IntegrationsPage() {
  /* ---- Integration status state ---- */
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Sage', key: 'sage', icon: <Cloud className="h-6 w-6" />, configured: false, loading: true },
    { name: 'Read AI', key: 'readai', icon: <BookOpen className="h-6 w-6" />, configured: false, loading: true },
    { name: 'Fireflies', key: 'fireflies', icon: <Mic className="h-6 w-6" />, configured: false, loading: true },
    { name: 'Google Drive', key: 'drive', icon: <HardDrive className="h-6 w-6" />, configured: false, loading: true },
    { name: 'Gmail', key: 'gmail', icon: <Mail className="h-6 w-6" />, configured: false, loading: true },
    { name: 'Calendar', key: 'calendar', icon: <Calendar className="h-6 w-6" />, configured: false, loading: true },
  ]);

  /* ---- Communication overhead state ---- */
  const [volumeData, setVolumeData] = useState<GmailVolumeData | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [densityData, setDensityData] = useState<CalendarDensityData | null>(null);
  const [densityLoading, setDensityLoading] = useState(true);

  /* ---- Connected service detail state ---- */
  const [activeTab, setActiveTab] = useState('drive');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [emailStats, setEmailStats] = useState<GmailStatsData | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [calendarMeetings, setCalendarMeetings] = useState<CalendarMeeting[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  /* ---- Fetch integration statuses ---- */
  const fetchStatuses = useCallback(async () => {
    // Sage status
    const sageP = apiClient
      .get<{ success: boolean; data: { connected: boolean } }>('/sage/status')
      .then((res) => ({ key: 'sage', configured: res.data?.connected ?? false }))
      .catch(() => ({ key: 'sage', configured: false }));

    // Read AI + Fireflies status (via meetings status endpoint)
    const meetingsP = apiClient
      .get<{ success: boolean; data: { readai_configured: boolean; fireflies_configured: boolean } }>('/meetings/status')
      .then((res) => [
        { key: 'readai', configured: res.data?.readai_configured ?? false },
        { key: 'fireflies', configured: res.data?.fireflies_configured ?? false },
      ])
      .catch(() => [
        { key: 'readai', configured: false },
        { key: 'fireflies', configured: false },
      ]);

    // Drive status
    const driveP = apiClient
      .get<{ success: boolean; data: { configured: boolean } }>('/integrations/drive/status')
      .then((res) => ({ key: 'drive', configured: res.data?.configured ?? false }))
      .catch(() => ({ key: 'drive', configured: false }));

    // Gmail status
    const gmailP = apiClient
      .get<{ success: boolean; data: { configured: boolean } }>('/integrations/gmail/status')
      .then((res) => ({ key: 'gmail', configured: res.data?.configured ?? false }))
      .catch(() => ({ key: 'gmail', configured: false }));

    // Calendar status
    const calendarP = apiClient
      .get<{ success: boolean; data: { configured: boolean } }>('/integrations/calendar/status')
      .then((res) => ({ key: 'calendar', configured: res.data?.configured ?? false }))
      .catch(() => ({ key: 'calendar', configured: false }));

    const [sage, meetingsArr, drive, gmail, calendar] = await Promise.allSettled([
      sageP,
      meetingsP,
      driveP,
      gmailP,
      calendarP,
    ]);

    const statusMap: Record<string, boolean> = {};

    if (sage.status === 'fulfilled') statusMap[sage.value.key] = sage.value.configured;
    if (meetingsArr.status === 'fulfilled') {
      for (const item of meetingsArr.value) statusMap[item.key] = item.configured;
    }
    if (drive.status === 'fulfilled') statusMap[drive.value.key] = drive.value.configured;
    if (gmail.status === 'fulfilled') statusMap[gmail.value.key] = gmail.value.configured;
    if (calendar.status === 'fulfilled') statusMap[calendar.value.key] = calendar.value.configured;

    setServices((prev) =>
      prev.map((s) => ({
        ...s,
        configured: statusMap[s.key] ?? false,
        loading: false,
      })),
    );
  }, []);

  /* ---- Fetch communication overhead data ---- */
  const fetchVolumeData = useCallback(async () => {
    setVolumeLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: GmailVolumeData }>(
        '/integrations/gmail/volume?days=30',
      );
      setVolumeData(res.data);
    } catch {
      setVolumeData(null);
    } finally {
      setVolumeLoading(false);
    }
  }, []);

  const fetchDensityData = useCallback(async () => {
    setDensityLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: CalendarDensityData }>(
        '/integrations/calendar/density?days=30',
      );
      setDensityData(res.data);
    } catch {
      setDensityData(null);
    } finally {
      setDensityLoading(false);
    }
  }, []);

  /* ---- Fetch tab data ---- */
  const fetchDriveFiles = useCallback(async () => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const res = await apiClient.get<{ success: boolean; data: DriveFilesData }>(
        '/integrations/drive/files',
      );
      setDriveFiles(res.data.files);
    } catch {
      setDriveError('Unable to load Drive files. The service may not be configured.');
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const fetchEmailStats = useCallback(async () => {
    setEmailLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: GmailStatsData }>(
        '/integrations/gmail/stats?days=30',
      );
      setEmailStats(res.data);
    } catch {
      setEmailStats(null);
    } finally {
      setEmailLoading(false);
    }
  }, []);

  const fetchCalendarMeetings = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: CalendarMeetingsData }>(
        '/integrations/calendar/meetings?days_ahead=14&days_back=0',
      );
      setCalendarMeetings(res.data.meetings);
    } catch {
      setCalendarMeetings([]);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  /* ---- Initial data fetch ---- */
  useEffect(() => {
    fetchStatuses();
    fetchVolumeData();
    fetchDensityData();
  }, [fetchStatuses, fetchVolumeData, fetchDensityData]);

  /* ---- Load tab data on tab change ---- */
  useEffect(() => {
    if (activeTab === 'drive') fetchDriveFiles();
    else if (activeTab === 'email') fetchEmailStats();
    else if (activeTab === 'calendar') fetchCalendarMeetings();
  }, [activeTab, fetchDriveFiles, fetchEmailStats, fetchCalendarMeetings]);

  /* ---- Email creep detection ---- */
  const emailCreep = volumeData?.trend ? detectEmailCreep(volumeData.trend) : { detected: false, message: '' };

  /* ---- Max volume for bar chart scaling ---- */
  const maxDailyVolume =
    volumeData?.trend?.reduce((max, d) => Math.max(max, d.sent + d.received), 0) || 1;

  /* ---- Tab definitions ---- */
  const tabs = [
    { id: 'drive', label: 'Google Drive', icon: <HardDrive className="h-4 w-4" /> },
    { id: 'email', label: 'Email Stats', icon: <Mail className="h-4 w-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
  ];

  /* ---- Free time summary ---- */
  const upcomingCount = calendarMeetings.length;

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Integrations</h1>
        <p className="text-body mt-1">
          Manage external service connections and monitor communication overhead.
        </p>
      </div>

      {/* ================================================================ */}
      {/*  Integration Status Cards                                         */}
      {/* ================================================================ */}
      <div
        className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 animate-up"
        style={{ animationDelay: '100ms' }}
      >
        {services.map((service) => (
          <Card key={service.key} className="text-center">
            <div className="flex flex-col items-center gap-3 py-2">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: service.configured
                    ? `${colors.success[500]}15`
                    : `${colors.surface[400]}15`,
                  color: service.configured ? colors.success[500] : colors.surface[400],
                }}
              >
                {service.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-800">{service.name}</p>
                {service.loading ? (
                  <Spinner size="sm" />
                ) : (
                  <Badge
                    variant={service.configured ? 'success' : 'default'}
                    dot
                    size="sm"
                    className="mt-1"
                  >
                    {service.configured ? 'Connected' : 'Not Connected'}
                  </Badge>
                )}
              </div>
              <Button variant="secondary" size="sm">
                {service.configured ? 'Configure' : 'Connect'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ================================================================ */}
      {/*  Communication Overhead                                           */}
      {/* ================================================================ */}
      <div className="mt-8 animate-up" style={{ animationDelay: '200ms' }}>
        <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-500" />
          Communication Overhead
        </h2>

        {/* Email volume creep warning */}
        {emailCreep.detected && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-warning-50 border border-warning-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-warning-800">Email Volume Creep Detected</p>
              <p className="text-sm text-warning-700">{emailCreep.message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Email volume bar chart */}
          <Card padding="md" className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-surface-600">Email Volume (30 days)</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: colors.primary[500] }}
                  />
                  Received
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: colors.accent[500] }}
                  />
                  Sent
                </span>
              </div>
            </div>
            {volumeLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : !volumeData?.configured ? (
              <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                <Mail className="h-8 w-8 mb-2" />
                <p className="text-sm">Gmail not configured</p>
              </div>
            ) : (
              <div className="flex items-end gap-px h-40">
                {volumeData.trend.slice(-30).map((day, idx) => {
                  const total = day.sent + day.received;
                  const height = maxDailyVolume > 0 ? (total / maxDailyVolume) * 100 : 0;
                  const receivedPct =
                    total > 0 ? (day.received / total) * 100 : 50;
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end group relative"
                      title={`${formatDate(day.date)}: ${day.received} received, ${day.sent} sent`}
                    >
                      <div
                        className="w-full rounded-t-sm overflow-hidden"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      >
                        <div
                          className="w-full"
                          style={{
                            height: `${receivedPct}%`,
                            backgroundColor: colors.primary[500],
                          }}
                        />
                        <div
                          className="w-full"
                          style={{
                            height: `${100 - receivedPct}%`,
                            backgroundColor: colors.accent[500],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Meeting density stats */}
          <Card padding="md">
            <p className="text-sm font-semibold text-surface-600 mb-4">Meeting Density</p>
            {densityLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : !densityData?.configured ? (
              <div className="flex flex-col items-center justify-center py-10 text-surface-400">
                <Calendar className="h-8 w-8 mb-2" />
                <p className="text-sm">Calendar not configured</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-surface-500">Meetings / Day</p>
                  <p className="text-3xl font-bold text-surface-900 mt-1">
                    {densityData.meetings_per_day?.toFixed(1) ?? '--'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-surface-500">Total This Month</p>
                  <p className="text-xl font-bold text-surface-800 mt-1">
                    {densityData.total_meetings ?? '--'}
                  </p>
                  {densityData.total_meeting_hours !== undefined && (
                    <p className="text-xs text-surface-400 mt-0.5">
                      {densityData.total_meeting_hours.toFixed(1)} hours in meetings
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-surface-500">Busiest Day</p>
                  <p className="text-sm font-semibold text-primary-600 mt-1">
                    {densityData.busiest_day
                      ? typeof densityData.busiest_day === 'string'
                        ? DAY_LABELS[densityData.busiest_day] || densityData.busiest_day
                        : `${densityData.busiest_day.date} (${densityData.busiest_day.meetings})`
                      : '--'}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Connected Services Detail (Tabs)                                 */}
      {/* ================================================================ */}
      <div className="mt-8 animate-up" style={{ animationDelay: '300ms' }}>
        <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-surface-500" />
          Connected Services
        </h2>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {/* ---- Google Drive Tab ---- */}
          {activeTab === 'drive' && (
            <Card padding="none">
              {driveLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : driveError ? (
                <div className="flex flex-col items-center justify-center py-12 text-surface-400">
                  <HardDrive className="h-8 w-8 mb-2" />
                  <p className="text-sm">{driveError}</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-surface-400">
                  <Folder className="h-8 w-8 mb-2" />
                  <p className="text-sm">No files found in Drive</p>
                </div>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Modified</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Size</Table.HeaderCell>
                      <Table.HeaderCell className="w-16" />
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {driveFiles.map((file) => (
                      <Table.Row key={file.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            {mimeTypeIcon(file.mimeType)}
                            <span className="font-medium text-surface-800">{file.name}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {file.modifiedTime ? formatDate(file.modifiedTime) : '--'}
                        </Table.Cell>
                        <Table.Cell className="text-right tabular-nums">
                          {file.mimeType.includes('folder') ? '--' : formatFileSize(file.size)}
                        </Table.Cell>
                        <Table.Cell>
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-500 hover:text-primary-700"
                              title="Open in Drive"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Card>
          )}

          {/* ---- Email Stats Tab ---- */}
          {activeTab === 'email' && (
            <div>
              {emailLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : !emailStats?.configured ? (
                <Card>
                  <div className="flex flex-col items-center justify-center py-12 text-surface-400">
                    <Mail className="h-8 w-8 mb-2" />
                    <p className="text-sm">Gmail not configured</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Sent / Received ratio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                      title="Emails Received (30d)"
                      value={String(emailStats.received_count ?? 0)}
                      icon={<Mail className="h-5 w-5" />}
                    />
                    <StatCard
                      title="Emails Sent (30d)"
                      value={String(emailStats.sent_count ?? 0)}
                      icon={<TrendingUp className="h-5 w-5" />}
                    />
                  </div>

                  {/* Sent/Received ratio bar */}
                  <Card padding="md">
                    <p className="text-sm font-semibold text-surface-600 mb-3">Sent / Received Ratio</p>
                    {(() => {
                      const sent = emailStats.sent_count ?? 0;
                      const received = emailStats.received_count ?? 0;
                      const total = sent + received;
                      const sentPct = total > 0 ? (sent / total) * 100 : 50;
                      return (
                        <div>
                          <div className="h-5 rounded overflow-hidden flex">
                            <div
                              className="h-full"
                              style={{
                                width: `${100 - sentPct}%`,
                                backgroundColor: colors.primary[500],
                              }}
                            />
                            <div
                              className="h-full"
                              style={{
                                width: `${sentPct}%`,
                                backgroundColor: colors.accent[500],
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5 text-xs text-surface-500">
                            <span>Received: {received}</span>
                            <span>Sent: {sent}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </Card>

                  {/* Top correspondents */}
                  <Card padding="none">
                    <div className="px-4 py-3 border-b border-surface-200">
                      <p className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Top Correspondents
                      </p>
                    </div>
                    {(!emailStats.top_correspondents || emailStats.top_correspondents.length === 0) ? (
                      <div className="px-4 py-8 text-center text-sm text-surface-400">No data</div>
                    ) : (
                      <Table>
                        <Table.Head>
                          <Table.Row>
                            <Table.HeaderCell className="w-10">#</Table.HeaderCell>
                            <Table.HeaderCell>Email</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Messages</Table.HeaderCell>
                          </Table.Row>
                        </Table.Head>
                        <Table.Body>
                          {emailStats.top_correspondents.slice(0, 10).map((c, idx) => (
                            <Table.Row key={idx}>
                              <Table.Cell>
                                <Badge
                                  variant={idx === 0 ? 'primary' : idx === 1 ? 'success' : idx === 2 ? 'warning' : 'default'}
                                  size="sm"
                                >
                                  {idx + 1}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell className="font-medium">{c.email}</Table.Cell>
                              <Table.Cell className="text-right tabular-nums">{c.count}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    )}
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ---- Calendar Tab ---- */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {calendarLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : calendarMeetings.length === 0 ? (
                <Card>
                  <div className="flex flex-col items-center justify-center py-12 text-surface-400">
                    <Calendar className="h-8 w-8 mb-2" />
                    <p className="text-sm">No upcoming meetings or calendar not configured</p>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                      title="Upcoming Meetings"
                      value={String(upcomingCount)}
                      icon={<Calendar className="h-5 w-5" />}
                    />
                    <StatCard
                      title="Next 2 Weeks"
                      value={`${upcomingCount} scheduled`}
                      icon={<Clock className="h-5 w-5" />}
                    />
                  </div>

                  {/* Meeting list */}
                  <Card padding="none">
                    <div className="px-4 py-3 border-b border-surface-200">
                      <p className="text-sm font-semibold text-surface-700">Upcoming Schedule</p>
                    </div>
                    <Table>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell>Meeting</Table.HeaderCell>
                          <Table.HeaderCell>When</Table.HeaderCell>
                          <Table.HeaderCell className="text-right">Attendees</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {calendarMeetings.map((meeting, idx) => (
                          <Table.Row key={idx}>
                            <Table.Cell>
                              <span className="font-medium text-surface-800">
                                {meeting.summary || 'Untitled'}
                              </span>
                            </Table.Cell>
                            <Table.Cell>{formatDateTime(meeting.start)}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">
                              {meeting.attendees ?? '--'}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
