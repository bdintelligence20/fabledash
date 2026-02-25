import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Users,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Clock,
  Tag,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Tabs,
  Spinner,
  Select,
} from '../components/ui';
import type { Tab, SelectOption } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MeetingResponse {
  id: string;
  title: string;
  date: string;
  duration_minutes: number | null;
  participants: string[];
  source: 'read_ai' | 'fireflies' | 'manual';
  source_id: string | null;
  client_id: string | null;
  client_name: string | null;
  task_ids: string[];
  notes: string | null;
  has_transcript: boolean;
  action_items: string[];
  key_topics: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingSingleResponse {
  success: boolean;
  data: MeetingResponse;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  start_time: number | null;
  end_time: number | null;
}

interface TranscriptResponse {
  id: string;
  meeting_id: string;
  segments: TranscriptSegment[];
  full_text: string;
  word_count: number;
  created_at: string;
}

interface TranscriptSingleResponse {
  success: boolean;
  data: TranscriptResponse;
}

interface MeetingBriefing {
  id: string;
  meeting_id: string;
  content: string;
  format: string;
  generated_at: string;
  generated_by: string;
}

interface BriefingListResponse {
  success: boolean;
  data: MeetingBriefing[];
}

interface BriefingSingleResponse {
  success: boolean;
  data: MeetingBriefing;
}

interface ProcessResponse {
  success: boolean;
  data: {
    summary: string | null;
    action_items: string[];
    matched_client: string | null;
    matched_tasks: string[];
  };
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const SOURCE_BADGE_VARIANT: Record<string, 'primary' | 'success' | 'default'> = {
  read_ai: 'primary',
  fireflies: 'success',
  manual: 'default',
};

const SOURCE_LABELS: Record<string, string> = {
  read_ai: 'Read AI',
  fireflies: 'Fireflies',
  manual: 'Manual',
};

const FORMAT_BADGE_VARIANT: Record<string, 'primary' | 'success' | 'warning' | 'default'> = {
  formal: 'primary',
  summary: 'success',
  dispatch: 'warning',
};

const FORMAT_LABELS: Record<string, string> = {
  formal: 'Formal',
  summary: 'Summary',
  dispatch: 'Dispatch',
};

const BRIEFING_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'summary', label: 'Summary' },
  { value: 'dispatch', label: 'Dispatch' },
];

const DETAIL_TABS: Tab[] = [
  { id: 'summary', label: 'Summary', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'transcript', label: 'Transcript', icon: <FileText className="h-4 w-4" /> },
  { id: 'briefings', label: 'Briefings', icon: <MessageSquare className="h-4 w-4" /> },
];

/* -------------------------------------------------------------------------- */
/*  MeetingDetailPage                                                          */
/* -------------------------------------------------------------------------- */

export default function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>();

  // Data state
  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResponse | null>(null);
  const [briefings, setBriefings] = useState<MeetingBriefing[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [briefingFormat, setBriefingFormat] = useState('formal');
  const [briefingError, setBriefingError] = useState('');

  /* ---- Fetch helpers ---- */

  async function fetchMeeting() {
    if (!meetingId) return;
    try {
      const res = await apiClient.get<MeetingSingleResponse>(`/meetings/${meetingId}`);
      setMeeting(res.data);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setNotFound(true);
      } else {
        throw err;
      }
    }
  }

  async function fetchTranscript() {
    if (!meetingId) return;
    try {
      const res = await apiClient.get<TranscriptSingleResponse>(`/meetings/${meetingId}/transcript`);
      setTranscript(res.data);
    } catch {
      // 404 is expected — no transcript available
      setTranscript(null);
    }
  }

  async function fetchBriefings() {
    if (!meetingId) return;
    try {
      const res = await apiClient.get<BriefingListResponse>(`/meetings/${meetingId}/briefings`);
      setBriefings(res.data);
    } catch {
      // Endpoint may not exist yet
      setBriefings([]);
    }
  }

  async function fetchAll() {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      await Promise.all([fetchMeeting(), fetchTranscript(), fetchBriefings()]);
    } catch (err) {
      if (!notFound) {
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [meetingId]);

  /* ---- Process transcript ---- */

  async function handleProcess() {
    if (!meetingId) return;
    setProcessing(true);
    setProcessMessage('');
    try {
      const res = await apiClient.post<ProcessResponse>(`/meetings/${meetingId}/process`);
      setProcessMessage(
        res.data.summary
          ? 'Transcript processed successfully'
          : 'Processing complete — no summary generated',
      );
      // Refresh meeting data to get updated summary/action items
      await fetchMeeting();
    } catch (err) {
      setProcessMessage(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  }

  /* ---- Generate briefing ---- */

  async function handleGenerateBriefing() {
    if (!meetingId) return;
    setGeneratingBriefing(true);
    setBriefingError('');
    try {
      const res = await apiClient.post<BriefingSingleResponse>(`/meetings/${meetingId}/briefing`, {
        meeting_id: meetingId,
        format: briefingFormat,
        include_action_items: true,
      });
      setBriefings((prev) => [res.data, ...prev]);
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setGeneratingBriefing(false);
    }
  }

  /* ---- Helpers ---- */

  function formatDuration(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '--';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  function formatDateTime(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Loading / Error / Not Found states                                     */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-surface-400">
        <p className="text-lg font-medium">Meeting not found</p>
        <Link to="/meetings" className="mt-4 text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Meetings
        </Link>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error || 'An unexpected error occurred'}
        </div>
        <Link to="/meetings" className="text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Meetings
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Main render                                                            */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-primary-600 transition-default"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Meetings
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-surface-900">{meeting.title}</h1>
          <Badge variant={SOURCE_BADGE_VARIANT[meeting.source] ?? 'default'}>
            {SOURCE_LABELS[meeting.source] ?? meeting.source}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {meeting.client_id && (
            <Link to={`/clients/${meeting.client_id}`}>
              <Button variant="secondary" size="sm">
                {meeting.client_name ?? 'View Client'}
              </Button>
            </Link>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={() => {
              setActiveTab('briefings');
              handleGenerateBriefing();
            }}
          >
            Generate Briefing
          </Button>
        </div>
      </div>

      {/* Meta line */}
      <div className="flex items-center gap-4 text-sm text-surface-500">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatDate(meeting.date)}
        </span>
        {meeting.duration_minutes !== null && (
          <span>{formatDuration(meeting.duration_minutes)}</span>
        )}
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Info card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-surface-500">Participants</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {meeting.participants.length > 0 ? (
                meeting.participants.map((p, i) => (
                  <Badge key={i} variant="default">{p}</Badge>
                ))
              ) : (
                <span className="text-surface-400 text-sm">None listed</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-surface-500">Client</p>
            <p className="font-medium text-surface-900 mt-1">
              {meeting.client_id ? (
                <Link
                  to={`/clients/${meeting.client_id}`}
                  className="text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {meeting.client_name ?? meeting.client_id}
                </Link>
              ) : (
                <span className="text-surface-400">--</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Linked Tasks</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {meeting.task_ids.length > 0 ? (
                meeting.task_ids.map((tid) => (
                  <Link key={tid} to={`/tasks/${tid}`}>
                    <Badge variant="primary">{tid.slice(0, 8)}...</Badge>
                  </Link>
                ))
              ) : (
                <span className="text-surface-400 text-sm">None linked</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-surface-500">Key Topics</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {meeting.key_topics.length > 0 ? (
                meeting.key_topics.map((topic, i) => (
                  <Badge key={i} variant="warning">
                    <Tag className="h-3 w-3 mr-1" />
                    {topic}
                  </Badge>
                ))
              ) : (
                <span className="text-surface-400 text-sm">None identified</span>
              )}
            </div>
          </div>
          {meeting.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-surface-500">Notes</p>
              <p className="text-sm text-surface-700 mt-1 whitespace-pre-wrap">{meeting.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ---- Summary tab ---- */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {processMessage && (
            <div className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
              {processMessage}
            </div>
          )}

          {meeting.summary ? (
            <Card>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-2">
                    AI Summary
                  </h3>
                  <p className="text-sm text-surface-700 whitespace-pre-wrap">{meeting.summary}</p>
                </div>

                {meeting.action_items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-2">
                      Action Items
                    </h3>
                    <ul className="space-y-2">
                      {meeting.action_items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-surface-700">
                          <CheckCircle2 className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="min-h-[200px] flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-surface-300" />
                <p className="text-lg font-medium text-surface-500">No summary available</p>
                <p className="text-sm text-surface-400 mt-1 mb-4">
                  Process the meeting transcript to generate an AI summary
                </p>
                <Button
                  variant="primary"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={handleProcess}
                  loading={processing}
                >
                  Process Transcript
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---- Transcript tab ---- */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          {transcript && transcript.segments.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-surface-500">
                <FileText className="h-4 w-4" />
                <span>{transcript.word_count.toLocaleString()} words</span>
              </div>
              <div className="space-y-0 rounded-lg border border-surface-200 overflow-hidden">
                {transcript.segments.map((segment, i) => (
                  <div
                    key={i}
                    className={`px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-50'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary-600">
                        {segment.speaker}
                      </span>
                      {segment.start_time !== null && (
                        <span className="text-xs text-surface-400">
                          {Math.floor(segment.start_time / 60)}:{String(Math.floor(segment.start_time % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-700">{segment.text}</p>
                  </div>
                ))}
              </div>
            </>
          ) : transcript && transcript.full_text ? (
            <Card>
              <div className="flex items-center gap-2 text-sm text-surface-500 mb-3">
                <FileText className="h-4 w-4" />
                <span>{transcript.word_count.toLocaleString()} words</span>
              </div>
              <p className="text-sm text-surface-700 whitespace-pre-wrap">
                {transcript.full_text}
              </p>
            </Card>
          ) : (
            <Card className="min-h-[200px] flex items-center justify-center">
              <div className="text-center text-surface-400">
                <FileText className="h-10 w-10 mx-auto mb-3" />
                <p className="text-lg font-medium">No transcript available</p>
                <p className="text-sm mt-1">
                  Transcripts are synced automatically from Read AI and Fireflies
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---- Briefings tab ---- */}
      {activeTab === 'briefings' && (
        <div className="space-y-4">
          {/* Generate new briefing controls */}
          <div className="flex items-center gap-3">
            <div className="w-40">
              <Select
                value={briefingFormat}
                onChange={(e) => setBriefingFormat(e.target.value)}
                options={BRIEFING_FORMAT_OPTIONS}
              />
            </div>
            <Button
              variant="primary"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleGenerateBriefing}
              loading={generatingBriefing}
            >
              Generate New
            </Button>
          </div>

          {briefingError && (
            <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {briefingError}
            </div>
          )}

          {/* Briefing list */}
          {briefings.length > 0 ? (
            <div className="space-y-4">
              {briefings.map((briefing) => (
                <Card key={briefing.id}>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant={FORMAT_BADGE_VARIANT[briefing.format] ?? 'default'}>
                      {FORMAT_LABELS[briefing.format] ?? briefing.format}
                    </Badge>
                    <span className="text-xs text-surface-400">
                      {formatDateTime(briefing.generated_at)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 whitespace-pre-wrap">
                    {briefing.content}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="min-h-[200px] flex items-center justify-center">
              <div className="text-center text-surface-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3" />
                <p className="text-lg font-medium">No briefings generated</p>
                <p className="text-sm mt-1">
                  Select a format and click "Generate New" to create a briefing
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
