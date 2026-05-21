const TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1ollK2VBWk2UOFFHw-CK2LK39EL3SaJDO1slgd6ji6Mo/copy'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
        <h2 style={{
          fontSize: 14, fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 32px' }} />
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 4 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Code({ children }) {
  return (
    <code style={{
      fontFamily: 'var(--mono)', fontSize: 11,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      padding: '1px 5px',
      color: 'var(--text)',
    }}>
      {children}
    </code>
  )
}

export function UserGuide({ open, onClose }) {
  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '60%', maxWidth: 720, minWidth: 480,
        maxHeight: '80vh',
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          flex: '0 0 auto',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>User Guide</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', fontSize: 18, lineHeight: 1,
              padding: '2px 6px', borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 40px' }}>

          <Section title="Template">
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 10px', lineHeight: 1.6 }}>
              Start from the official template to get the correct column layout and sample rows already set up.
            </p>
            <a
              href={TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13, fontWeight: 600,
                color: 'var(--accent)', textDecoration: 'none',
              }}
            >
              Open template ↗
            </a>
          </Section>

          <Divider />

          <Section title="Your Sheet">
            <BulletList items={[
              <>Keep your sheet shared as <strong>Anyone with the link → Viewer</strong>. The app reads it via CSV on every load — making it private will break reads.</>,
              <>Your spreadsheet needs two tabs: your <strong>main tab</strong> (any name) and a tab named exactly <strong>Archived</strong>. The app detects the archived tab by that name.</>,
              <>Do not add, remove, or reorder columns — the app reads all columns by position.</>,
              <><strong>Column A (ID)</strong> is hidden and managed automatically. Leave it blank when entering data; the app assigns a unique ID on the next sync.</>,
              <>Timeline date format: <Code>YYYY/MM/DD-YYYY/MM/DD</Code> (e.g. <Code>2026/06/01-2026/06/14</Code>). Wrong format causes the timeline to silently show as empty.</>,
              <>Rows are auto-grouped by <strong>Product</strong> and <strong>Market</strong> in the board view.</>,
            ]} />
          </Section>

          <Divider />

          <Section title="Two Views">
            <BulletList items={[
              <>The board shows your <strong>active features</strong>. The archive view shows features in your Archived tab. Toggle between them with the <strong>Archive</strong> button in the top right.</>,
              <>These views map directly to two tabs in your Google Sheet.</>,
            ]} />
          </Section>

          <Divider />

          <Section title="Stage">
            <BulletList items={[
              <>You can manually set a feature's stage to <strong>Pipeline</strong>, <strong>FRF</strong>, or <strong>PRD</strong>.</>,
              <>Set it to <strong>Scheduled</strong> when timelines are planned but work hasn't started. The app also sets this automatically when timeline data is present and no start date has passed yet.</>,
              <>Once a timeline start date is reached, the stage advances automatically — <strong>Dev → QA → UAT → Live</strong>. No manual updates needed.</>,
              <>If a feature has no Live Testing or Greyscale timeline, it is auto-archived after its Live end date. Otherwise it advances into post-live stages.</>,
            ]} />
          </Section>

          <Divider />

          <Section title="Archive vs Delete">
            <BulletList items={[
              <><strong>Archive</strong> moves the feature to your Archived tab. Stage and timeline data are discarded; only Product, Market, Name, FRF, PRD, and Jira are kept. Recoverable — unarchiving restores the feature to Pipeline.</>,
              <><strong>Delete</strong> removes the feature permanently from both the UI and your sheet. Cannot be undone.</>,
              <>After any archive, unarchive, or delete: <strong>sync before performing another write action</strong> (another archive/unarchive/delete).</>,
            ]} />
          </Section>

        </div>
      </div>
    </div>
  )
}
