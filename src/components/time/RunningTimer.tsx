import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Button, Card, Input, Select } from '../ui';
import type { SelectOption } from '../ui';

export interface TimerStopData {
  description: string;
  clientId: string;
  taskId: string | null;
  isBillable: boolean;
  startTime: string;
  endTime: string;
}

interface RunningTimerProps {
  clients: SelectOption[];
  tasks: SelectOption[];
  onClientChange: (clientId: string) => void;
  onStop: (data: TimerStopData) => Promise<void>;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function RunningTimer({ clients, tasks, onClientChange, onStop }: RunningTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  function handleStart() {
    setStartedAt(new Date());
    setElapsedSeconds(0);
    setIsRunning(true);
  }

  async function handleStop() {
    if (!startedAt) return;
    setIsRunning(false);

    const now = new Date();
    setSaving(true);
    try {
      await onStop({
        description,
        clientId: selectedClientId,
        taskId: selectedTaskId || null,
        isBillable,
        startTime: timeHHMM(startedAt),
        endTime: timeHHMM(now),
      });

      // Reset timer state after successful save
      setStartedAt(null);
      setElapsedSeconds(0);
      setDescription('');
      setSelectedTaskId('');
      setIsBillable(true);
    } catch {
      // If save fails, keep the data so user can try again
      setIsRunning(true);
    } finally {
      setSaving(false);
    }
  }

  function handleClientChange(e: ChangeEvent<HTMLSelectElement>) {
    setSelectedClientId(e.target.value);
    setSelectedTaskId('');
    onClientChange(e.target.value);
  }

  const borderColor = isRunning ? 'border-l-success-500' : 'border-l-surface-300';

  return (
    <Card className={`border-l-4 ${borderColor}`} padding="sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
        {/* Timer display */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-500" />
            </span>
          )}
          <span className="font-mono text-lg font-semibold text-surface-900 tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>

        {/* Description input */}
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="!py-2"
          />
        </div>

        {/* Client select */}
        <div className="w-full lg:w-44 shrink-0">
          <Select
            options={clients}
            placeholder="Client"
            value={selectedClientId}
            onChange={handleClientChange}
          />
        </div>

        {/* Task select */}
        <div className="w-full lg:w-44 shrink-0">
          <Select
            options={tasks}
            placeholder={selectedClientId ? 'Task (optional)' : 'Select client first'}
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            disabled={!selectedClientId}
          />
        </div>

        {/* Billable toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={isBillable}
            onChange={(e) => setIsBillable(e.target.checked)}
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-xs text-surface-600">Billable</span>
        </label>

        {/* Start / Stop button */}
        <div className="shrink-0">
          {isRunning ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              loading={saving}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              disabled={!description || !selectedClientId}
            >
              Start
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
