// app/src/features/admin/components/SOSAlertDashboard.tsx
// Real-time SOS alert dashboard for admins — US38 & US39

import { useState } from 'react';
import { useSOSAlerts } from '../hooks/useSOSAlerts';
import type { AlertStatus, SOSAlertAdmin } from '../hooks/useSOSAlerts';

// Returns badge styles based on alert status — handles all possible DB values
function getStatusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', classes: 'text-eris-alert bg-eris-alert/10 border border-eris-alert/30' };
    case 'in_progress':
      return { label: 'In Progress', classes: 'text-eris-primary bg-eris-primary/10 border border-eris-primary/30' };
    case 'resolved':
      return { label: 'Resolved', classes: 'text-eris-success bg-eris-success/10 border border-eris-success/30' };
    case 'delivered':
      return { label: 'Delivered', classes: 'text-eris-success bg-eris-success/10 border border-eris-success/30' };
    case 'queued':
      return { label: 'Queued', classes: 'text-orange-400 bg-orange-400/10 border border-orange-400/30' };
    default:
      return { label: status ?? 'Unknown', classes: 'text-eris-text-muted bg-eris-surface border border-eris-border/50' };
  }
}

// Returns a dot color for the status indicator
function getStatusDot(status: string): string {
  switch (status) {
    case 'pending': return 'bg-eris-alert animate-pulse';
    case 'in_progress': return 'bg-eris-primary animate-pulse';
    case 'resolved': return 'bg-eris-success';
    case 'delivered': return 'bg-eris-success';
    case 'queued': return 'bg-orange-400 animate-pulse';
    default: return 'bg-eris-text-subtle';
  }
}

// Formats an ISO date string to a readable short format
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Builds a Google Maps link from coordinates
function getMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

interface AlertCardProps {
  alert: SOSAlertAdmin;
  onUpdateStatus: (id: string, status: AlertStatus) => Promise<boolean>;
}

// Individual alert card with status controls and expandable details
function AlertCard({ alert, onUpdateStatus }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const badge = getStatusBadge(alert.status);

  const handleStatus = async (status: AlertStatus) => {
    setUpdating(true);
    await onUpdateStatus(alert.id, status);
    setUpdating(false);
  };

  return (
    <div className="bg-eris-surface border border-eris-border/50 rounded-2xl overflow-hidden">

      {/* Card header — always visible */}
      <button
        className="w-full p-4 flex items-start gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getStatusDot(alert.status)}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-semibold text-sm truncate">
              {alert.first_name} {alert.last_name}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.classes}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-eris-text-muted text-xs">{formatDate(alert.created_at)}</p>
          {alert.notes && (
            <p className="text-eris-text-subtle text-xs mt-1 truncate">"{alert.notes}"</p>
          )}
        </div>

        <span className="material-symbols-outlined text-eris-text-subtle text-lg flex-shrink-0">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-eris-border/30 pt-3 flex flex-col gap-3">

          {/* Location */}
          <a
            href={getMapsLink(alert.latitude, alert.longitude)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-eris-primary text-xs font-medium"
          >
            <span className="material-symbols-outlined text-base">location_on</span>
            {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)} — Open in Maps
          </a>

          {/* Medical info */}
          <div className="bg-eris-bg rounded-xl p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold text-eris-text-subtle uppercase tracking-widest mb-1">
              Medical Info
            </p>
            <p className="text-xs text-eris-text-muted">
              <span className="text-eris-text font-medium">Blood type: </span>{alert.blood_type}
            </p>
            <p className="text-xs text-eris-text-muted">
              <span className="text-eris-text font-medium">Allergies: </span>{alert.allergies}
            </p>
            <p className="text-xs text-eris-text-muted">
              <span className="text-eris-text font-medium">Conditions: </span>{alert.medical_conditions}
            </p>
            <p className="text-xs text-eris-text-muted">
              <span className="text-eris-text font-medium">Current state: </span>{alert.current_condition}
            </p>
          </div>

          {/* Battery & transmission */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-eris-text-muted">
              <span className="material-symbols-outlined text-base">battery_std</span>
              {alert.battery_level}%
            </div>
            <div className="flex items-center gap-1.5 text-xs text-eris-text-muted">
              <span className="material-symbols-outlined text-base">wifi</span>
              {alert.transmission_method}
            </div>
          </div>

          {/* Status action buttons — US39 */}
          {alert.status !== 'resolved' && (
            <div className="flex gap-2 mt-1">
              {alert.status === 'pending' && (
                <button
                  onClick={() => handleStatus('in_progress')}
                  disabled={updating}
                  className="flex-1 bg-eris-primary/10 border border-eris-primary/30 text-eris-primary text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  Mark In Progress
                </button>
              )}
              <button
                onClick={() => handleStatus('resolved')}
                disabled={updating}
                className="flex-1 bg-eris-success/10 border border-eris-success/30 text-eris-success text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                Mark Resolved
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// Filter tab options
const FILTERS: { key: AlertStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

interface SOSAlertDashboardProps {
  onBack: () => void;
}

export default function SOSAlertDashboard({ onBack }: SOSAlertDashboardProps) {
  const { alerts, loading, error, updateAlertStatus, refetch } = useSOSAlerts();
  const [filter, setFilter] = useState<AlertStatus | 'all'>('all');

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.status === filter);

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;

  return (
    <div className="flex flex-col h-full w-full bg-eris-bg text-eris-text">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-eris-border/50">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-base">SOS Alert Dashboard</h2>
          <p className="text-eris-text-muted text-xs">
            {loading ? 'Loading...' : `${alerts.length} total — ${pendingCount} pending`}
          </p>
        </div>
        <button
          onClick={refetch}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">refresh</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto border-b border-eris-border/30">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
              filter === key
                ? 'bg-eris-primary text-white'
                : 'bg-eris-surface text-eris-text-muted border border-eris-border/50'
            }`}
          >
            {label}
            {key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-eris-alert text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-eris-text-subtle text-3xl">sync</span>
          </div>
        )}

        {error && (
          <div className="bg-eris-danger/10 border border-eris-danger/30 rounded-2xl p-4 text-eris-danger text-sm">
            Error loading alerts: {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-eris-text-subtle text-4xl">check_circle</span>
            <p className="text-eris-text-muted text-sm">No alerts for this filter</p>
          </div>
        )}

        {filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onUpdateStatus={updateAlertStatus} />
        ))}
      </div>
    </div>
  );
}