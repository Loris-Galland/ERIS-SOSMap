export default function AdminScreen() {
  return (
    <div className="flex flex-col h-full w-full bg-eris-bg text-eris-text p-6 pt-12 overflow-y-auto">
      <div className="max-w-md mx-auto w-full">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-eris-danger text-3xl">
              admin_panel_settings
            </span>
            <h2 className="text-2xl font-bold">Admin Panel</h2>
          </div>
          <div className="h-1 w-16 bg-eris-danger rounded-full mb-3" />
          <p className="text-eris-text-muted text-sm">
            Restricted access — administrator only
          </p>
        </div>

        {/* Feature cards — placeholders for upcoming admin US */}
        <div className="flex flex-col gap-4">

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4">
            <span className="material-symbols-outlined text-eris-alert text-2xl">emergency</span>
            <div>
              <p className="font-semibold text-sm">SOS Alert Dashboard</p>
              <p className="text-eris-text-muted text-xs">Real-time alert monitoring</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">
              chevron_right
            </span>
          </div>

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4">
            <span className="material-symbols-outlined text-eris-primary text-2xl">group</span>
            <div>
              <p className="font-semibold text-sm">User Management</p>
              <p className="text-eris-text-muted text-xs">Users & roles</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">
              chevron_right
            </span>
          </div>

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4">
            <span className="material-symbols-outlined text-eris-success text-2xl">layers</span>
            <div>
              <p className="font-semibold text-sm">Danger Zone Publisher</p>
              <p className="text-eris-text-muted text-xs">Publish official hazard zones</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">
              chevron_right
            </span>
          </div>

          <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex items-center gap-4">
            <span className="material-symbols-outlined text-eris-text-muted text-2xl">flag</span>
            <div>
              <p className="font-semibold text-sm">Hazard Report Moderation</p>
              <p className="text-eris-text-muted text-xs">Approve / reject user reports</p>
            </div>
            <span className="material-symbols-outlined text-eris-text-subtle text-xl ml-auto">
              chevron_right
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}