/*
 * Real-time SOS alert dashboard for admins (US38 & US39).
 * Displays all SOS alerts fetched and subscribed via useSOSAlerts, with
 * status-based filtering and an accordion layout for per-alert details.
 * Admins can update alert status (pending -> in_progress -> resolved) directly
 * from this screen; changes are written back to Supabase optimistically.
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSOSAlerts } from '../hooks/useSOSAlerts';
import type { AlertStatus, SOSAlertAdmin } from '../hooks/useSOSAlerts';

// ─── HELPERS ───
function getStatusBadge(status: string, t: any): { label: string; classes: string } {
  switch (status) {
    case 'pending':
      return {
        label: t('admin.statusPending', 'Pending'),
        classes: 'text-eris-alert bg-eris-alert/10 border border-eris-alert/30',
      };
    case 'in_progress':
      return {
        label: t('admin.statusInProgress', 'In Progress'),
        classes: 'text-eris-primary bg-eris-primary/10 border border-eris-primary/30',
      };
    case 'resolved':
      return {
        label: t('admin.statusResolved', 'Resolved'),
        classes: 'text-eris-success bg-eris-success/10 border border-eris-success/30',
      };
    case 'delivered':
      return {
        label: t('admin.statusDelivered', 'Delivered'),
        classes: 'text-eris-success bg-eris-success/10 border border-eris-success/30',
      };
    case 'queued':
      return {
        label: t('admin.statusQueued', 'Queued'),
        classes: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
      };
    default:
      return {
        label: t('admin.statusUnknown', 'Unknown'),
        classes: 'text-eris-text-muted bg-eris-surface border border-eris-border/50',
      };
  }
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-eris-alert animate-pulse';
    case 'in_progress':
      return 'bg-eris-primary animate-pulse';
    case 'resolved':
    case 'delivered':
      return 'bg-eris-success';
    case 'queued':
      return 'bg-orange-400 animate-pulse';
    default:
      return 'bg-eris-text-subtle';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMapsLink(lat: number, lng: number): string {
  return `http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`;
}

// ─── CARTE EXPANDABLE (Mode Accordéon) ───
interface AlertCardProps {
  alert: SOSAlertAdmin;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: AlertStatus) => Promise<boolean>;
}

function AlertCard({ alert, isExpanded, onToggle, onUpdateStatus }: AlertCardProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [updating, setUpdating] = useState(false);
  const badge = getStatusBadge(alert.status, t);

  // Auto-scroll intelligent quand la carte s'ouvre
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 320); // Attend la fin de l'animation CSS (300ms) pour bien calculer la hauteur
    }
  }, [isExpanded]);

  const handleStatus = async (status: AlertStatus) => {
    setUpdating(true);
    await onUpdateStatus(alert.id, status);
    setUpdating(false);
  };

  return (
    <div
      ref={cardRef}
      // scroll-mt-24 permet de ne pas cacher le haut de la carte sous l'en-tête collant
      className={`scroll-mt-24 bg-eris-surface border transition-all duration-300 rounded-2xl overflow-hidden shadow-sm shrink-0 ${isExpanded ? 'border-eris-primary/50' : 'border-eris-border/50'}`}
    >
      {/* En-tête de la carte (Toujours visible) */}
      <button
        className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${isExpanded ? 'bg-eris-surface-alt/30' : 'hover:bg-eris-surface-alt/20'}`}
        onClick={onToggle}
      >
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getStatusDot(alert.status)}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-semibold text-sm truncate text-eris-text">
              {alert.first_name} {alert.last_name}
            </p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${badge.classes}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-eris-text-muted text-xs">{formatDate(alert.created_at)}</p>
        </div>

        <span
          className={`material-symbols-outlined text-eris-text-subtle text-lg flex-shrink-0 mt-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {/* Contenu Déroulant (Style Premium) */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-eris-border/30 pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Lien GPS */}
          <a
            href={getMapsLink(alert.latitude, alert.longitude)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 bg-eris-primary/10 border border-eris-primary/20 rounded-xl p-3 text-eris-primary text-sm font-medium hover:bg-eris-primary/20 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-eris-primary flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-base">location_on</span>
            </div>
            <div className="flex flex-col">
              <span>{t('admin.openMaps', 'Open in Maps')}</span>
              <span className="text-xs opacity-80">
                {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
              </span>
            </div>
          </a>

          {/* Infos médicales */}
          <div className="bg-eris-bg border border-eris-border/50 rounded-xl p-4 flex flex-col gap-2.5">
            <p className="text-[10px] font-bold text-eris-text-subtle uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">medical_services</span>
              {t('admin.medInfo', 'Medical Info')}
            </p>
            <p className="text-sm text-eris-text-muted">
              <span className="text-eris-text font-medium">{t('admin.bloodType', 'Blood type: ')} </span>
              {alert.blood_type || '--'}
            </p>
            <p className="text-sm text-eris-text-muted">
              <span className="text-eris-text font-medium">{t('admin.allergies', 'Allergies: ')} </span>
              {alert.allergies || '--'}
            </p>
            <p className="text-sm text-eris-text-muted">
              <span className="text-eris-text font-medium">{t('admin.conditions', 'Conditions: ')} </span>
              {alert.medical_conditions || '--'}
            </p>
            <p className="text-sm text-eris-text-muted">
              <span className="text-eris-text font-medium">{t('admin.currentState', 'Current state: ')} </span>
              {alert.current_condition || '--'}
            </p>
          </div>

          {/* Notes additionnelles */}
          {alert.notes && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                Notes
              </p>
              <p className="text-eris-text text-sm italic">"{alert.notes}"</p>
            </div>
          )}

          {/* Batterie et Transmission */}
          <div className="flex items-center gap-6 pb-2">
            <div className="flex items-center gap-2 text-sm text-eris-text-muted">
              <span
                className={`material-symbols-outlined text-lg ${alert.battery_level < 20 ? 'text-eris-danger' : ''}`}
              >
                {alert.battery_level < 20 ? 'battery_alert' : 'battery_std'}
              </span>
              {alert.battery_level}%
            </div>
            <div className="flex items-center gap-2 text-sm text-eris-text-muted">
              <span className="material-symbols-outlined text-lg">wifi</span>
              {alert.transmission_method}
            </div>
          </div>

          {/* Actions de statut */}
          {alert.status !== 'resolved' && (
            <div className="pt-2 border-t border-eris-border/30 flex gap-3">
              {alert.status === 'pending' && (
                <button
                  onClick={() => handleStatus('in_progress')}
                  disabled={updating}
                  className="flex-1 bg-eris-primary/10 border border-eris-primary/30 text-eris-primary text-sm font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  )}
                  {t('admin.markInProgress', 'Mark In Progress')}
                </button>
              )}
              <button
                onClick={() => handleStatus('resolved')}
                disabled={updating}
                className="flex-1 bg-eris-success/10 border border-eris-success/30 text-eris-success text-sm font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t('admin.markResolved', 'Mark Resolved')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL (Dashboard) ───
interface SOSAlertDashboardProps {
  onBack: () => void;
}

export default function SOSAlertDashboard({ onBack }: SOSAlertDashboardProps) {
  const { t } = useTranslation();
  const { alerts, loading, error, updateAlertStatus, refetch } = useSOSAlerts();

  const [filter, setFilter] = useState<AlertStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter);

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;

  const filters = [
    { key: 'all', label: t('admin.statusAll', 'All') },
    { key: 'pending', label: t('admin.statusPending', 'Pending') },
    { key: 'in_progress', label: t('admin.statusInProgress', 'In Progress') },
    { key: 'resolved', label: t('admin.statusResolved', 'Resolved') },
  ];

  // Gère l'accordéon : Si on clique sur celui déjà ouvert, on le ferme. Sinon on l'ouvre.
  const toggleExpand = (id: string) => {
    setExpandedId((prevId) => (prevId === id ? null : id));
  };

  return (
    // FIX SCROLL: absolute inset-0 et overflow-hidden forcent l'app à ne scroller que dans la liste
    <div className="flex flex-col absolute inset-0 bg-eris-bg text-eris-text overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-eris-border/50 bg-eris-bg/80 backdrop-blur-md z-10 shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-90 transition-transform shadow-sm"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-base">{t('admin.sosTitle', 'SOS Alert Dashboard')}</h2>
          <p className="text-eris-text-muted text-[11px] font-medium">
            {loading
              ? t('admin.loading', 'Loading...')
              : t('admin.sosStats', { total: alerts.length, pending: pendingCount })}
          </p>
        </div>
        <button
          onClick={refetch}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-90 transition-transform shadow-sm"
        >
          <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      {/* Onglets de filtrage */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto border-b border-eris-border/30 bg-eris-bg/50 shrink-0 [&::-webkit-scrollbar]:hidden">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key as AlertStatus | 'all');
              setExpandedId(null); // Ferme l'accordéon quand on change de filtre
            }}
            className={`flex-shrink-0 text-[11px] font-bold px-4 py-1.5 rounded-full transition-all active:scale-95 ${
              filter === key
                ? 'bg-eris-primary text-white shadow-md shadow-eris-primary/20'
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

      {/* Liste des alertes scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="material-symbols-outlined animate-spin text-eris-primary text-4xl">sync</span>
            <p className="text-eris-text-muted text-sm font-medium">{t('admin.loading', 'Loading...')}</p>
          </div>
        )}

        {error && (
          <div className="bg-eris-danger/10 border border-eris-danger/30 rounded-2xl p-4 text-eris-danger text-sm flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            {t('admin.errorAlerts', 'Error loading alerts:')} {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-60">
            <span className="material-symbols-outlined text-eris-text-subtle text-5xl">inventory_2</span>
            <p className="text-eris-text-muted text-sm font-medium">
              {t('admin.noAlerts', 'No alerts for this filter')}
            </p>
          </div>
        )}

        {filtered.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            isExpanded={expandedId === alert.id}
            onToggle={() => toggleExpand(alert.id)}
            onUpdateStatus={updateAlertStatus}
          />
        ))}

        {/* Espace de sécurité pour scroller tout en bas */}
        <div className="h-10 shrink-0"></div>
      </div>
    </div>
  );
}
