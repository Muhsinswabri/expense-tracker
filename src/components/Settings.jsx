import { useRef, useState } from 'react'
import { Copy, Download, FileJson, FileSpreadsheet, RefreshCw, Trash2, Upload } from 'lucide-react'
import { readBackup, saveFile, toCSV, toJSON } from '../lib/backup.js'
import { getKey, setKey } from '../lib/sync.js'
import { useStore } from '../store.jsx'
import { Confirm, useToast } from './ui.jsx'

function Row({ icon: Icon, label, onClick, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-3 px-4 text-left text-[16px] active:bg-fill-strong ${danger ? 'text-danger' : ''}`}
    >
      <Icon size={19} strokeWidth={1.9} className={danger ? '' : 'text-muted'} />
      <span className="flex-1">{label}</span>
      {children}
    </button>
  )
}

function Group({ title, footer, children }) {
  return (
    <section className="mt-6">
      <h3 className="mb-1.5 px-4 text-[13px] text-muted lowercase">{title}</h3>
      <div className="overflow-hidden rounded-[20px] bg-fill [&>*+*]:border-t-[0.5px] [&>*+*]:border-line">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
    </section>
  )
}

export default function Settings() {
  const { txs, importMany, clearAll, syncInbox } = useStore()
  const toast = useToast()
  const [key, setKeyState] = useState(getKey)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInput = useRef(null)

  const exampleUrl = `${location.origin}/api/add?key=${encodeURIComponent(key || 'YOUR_KEY')}&type=expense&amount=250&category=Food&note=Lunch`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exampleUrl)
      toast('Link copied')
    } catch {
      toast("Couldn't copy. Long-press the link instead.", 'error')
    }
  }

  const syncNow = async () => {
    try {
      const n = await syncInbox()
      toast(n ? `${n} added from Shortcuts` : 'Up to date')
    } catch (err) {
      toast(err?.unauthorized ? "Key doesn't match the server." : "Couldn't reach the server.", 'error')
    }
  }

  const doExport = async (kind) => {
    if (!txs.length) return toast('Nothing to export yet', 'error')
    try {
      if (kind === 'json') await saveFile(toJSON(txs), 'json', 'application/json')
      else await saveFile(toCSV(txs), 'csv', 'text/csv')
    } catch {
      toast("Couldn't export. Please try again.", 'error')
    }
  }

  const doImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { added, skipped } = await importMany(readBackup(await file.text()))
      toast(added ? `Imported ${added}${skipped ? ` · ${skipped} skipped` : ''}` : 'Nothing new to import')
    } catch (err) {
      toast(err?.name === 'Error' ? err.message : "Couldn't import this file.", 'error')
    }
  }

  return (
    <div className="pb-2">
      <Group
        title="Shortcuts"
        footer="Same key as SHORTCUT_TOKEN on Vercel. Transactions added from Shortcuts appear here when the app opens."
      >
        <label className="flex h-12 items-center gap-3 px-4">
          <span className="text-[16px]">key</span>
          <input
            type="password"
            autoComplete="off"
            value={key}
            placeholder="paste key"
            onChange={(e) => {
              setKeyState(e.target.value.trim())
              setKey(e.target.value.trim())
            }}
            className="min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-muted"
          />
        </label>
        <Row icon={Copy} label="copy example link" onClick={copy} />
        <Row icon={RefreshCw} label="sync now" onClick={syncNow} />
      </Group>

      <Group title="Backup" footer={`${txs.length} transaction${txs.length === 1 ? '' : 's'} stored on this device.`}>
        <Row icon={FileJson} label="export json" onClick={() => doExport('json')}>
          <Download size={16} className="text-muted" />
        </Row>
        <Row icon={FileSpreadsheet} label="export csv" onClick={() => doExport('csv')}>
          <Download size={16} className="text-muted" />
        </Row>
        <Row icon={Upload} label="import backup" onClick={() => fileInput.current?.click()} />
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={doImport} />
      </Group>

      <Group title="Data">
        <Row icon={Trash2} label="clear all data" danger onClick={() => setConfirmClear(true)} />
      </Group>

      <Confirm
        open={confirmClear}
        title="Clear all data?"
        message={`Deletes all ${txs.length} transactions from this device. Export a backup first if you might need them.`}
        confirmLabel="clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false)
          try {
            await clearAll()
            toast('All data cleared')
          } catch {
            toast("Couldn't clear data. Please try again.", 'error')
          }
        }}
      />
    </div>
  )
}
