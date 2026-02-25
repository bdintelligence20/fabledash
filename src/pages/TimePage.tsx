import { useState, useEffect, type FormEvent } from 'react';
import { Button, Card, Input, Select } from '../components/ui';
import type { SelectOption } from '../components/ui';
import apiClient, { ApiError } from '../lib/api';

interface ClientItem {
  id: string;
  name: string;
}

interface TaskItem {
  id: string;
  title: string;
}

interface ApiListResponse<T> {
  success: boolean;
  data: T[];
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return '\u2014';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return '\u2014';
  const diff = endMin - startMin;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TimePage() {
  // Form state
  const [date, setDate] = useState(todayISO());
  const [clientId, setClientId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data state
  const [clients, setClients] = useState<SelectOption[]>([]);
  const [tasks, setTasks] = useState<SelectOption[]>([]);

  // Fetch clients on mount
  useEffect(() => {
    apiClient
      .get<ApiListResponse<ClientItem>>('/clients')
      .then((res) => {
        setClients(
          res.data.map((c) => ({ value: c.id, label: c.name })),
        );
      })
      .catch(() => {
        // Silently fail — clients dropdown will be empty
      });
  }, []);

  // Fetch tasks when client changes
  useEffect(() => {
    if (!clientId) {
      setTasks([]);
      setTaskId('');
      return;
    }
    apiClient
      .get<ApiListResponse<TaskItem>>(`/tasks?client_id=${clientId}`)
      .then((res) => {
        setTasks(
          res.data.map((t) => ({ value: t.id, label: t.title })),
        );
      })
      .catch(() => {
        setTasks([]);
      });
    setTaskId('');
  }, [clientId]);

  const duration = formatDuration(startTime, endTime);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await apiClient.post('/time-logs', {
        date,
        client_id: clientId,
        task_id: taskId || null,
        description,
        start_time: startTime,
        end_time: endTime,
        is_billable: isBillable,
      });

      setSuccess('Time entry logged successfully.');
      // Clear fields except date and client for quick re-entry
      setTaskId('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setIsBillable(true);

      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Time Tracking</h1>
      <p className="mt-1 text-sm text-surface-500">
        Log time entries across clients and tasks.
      </p>

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date */}
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          {/* Client */}
          <Select
            label="Client"
            options={clients}
            placeholder="Select a client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          />

          {/* Task (optional) */}
          <Select
            label="Task"
            options={tasks}
            placeholder={clientId ? 'Select a task (optional)' : 'Select a client first'}
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            disabled={!clientId}
          />

          {/* Description */}
          <Input
            label="Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on?"
            required
          />

          {/* Start / End Time row */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          {/* Duration display */}
          <div>
            <span className="block text-label mb-1.5">Duration</span>
            <span className="text-sm font-medium text-surface-700">{duration}</span>
          </div>

          {/* Billable toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-surface-700">Billable</span>
          </label>

          {/* Error / Success messages */}
          {error && (
            <p className="text-sm text-danger-600">{error}</p>
          )}
          {success && (
            <p className="text-sm text-success-600">{success}</p>
          )}

          {/* Submit */}
          <Button type="submit" loading={loading}>
            Log Time
          </Button>
        </form>
      </Card>
    </div>
  );
}
