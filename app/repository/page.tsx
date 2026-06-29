'use client'
import { useState, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { MATERIAL_CATEGORIES, UNIT_OPTIONS, CATEGORY_BADGE } from '@/lib/constants'
import type { MaterialCategory, RepositoryMaterial } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MappingWizard } from '@/components/modals/MappingWizard'
import type { MaterialMapping } from '@/lib/materialMapping'
import {
  Plus, Trash2, Archive, Search, Upload, Download,
  ChevronDown, ChevronUp, TrendingUp, AlertTriangle,
  CheckCircle, Map, Link2
} from 'lucide-react'

const EMPTY: Omit<RepositoryMaterial,'id'|'dateUpdated'|'archived'|'rateHistory'|'mappingId'> = {
  name:'', category:'Misc', unit:'Bag', rate:0, supplier:'', notes:'',
}

export default function RepositoryPage() {
  const {
    repository, addMaterial, updateMaterial, deleteMaterial,
    archiveMaterial, bulkImportMaterials, currency,
    mappings, addMapping, updateMapping, deleteMapping,
  } = useAppStore()

  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState<MaterialCategory|'All'>('All')
  const [showArchived,setShowArchived]= useState(false)
  const [showAdd,     setShowAdd]     = useState(false)
  const [form,        setForm]        = useState({ ...EMPTY })
  const [formErrs,    setFormErrs]    = useState<Record<string,string>>({})
  const [editId,      setEditId]      = useState<string|null>(null)
  const [expandedId,  setExpandedId]  = useState<string|null>(null)
  const [bulkStatus,  setBulkStatus]  = useState<string|null>(null)
  const [wizardMat,   setWizardMat]   = useState<RepositoryMaterial|null>(null)
  const [filterStatus,setFilterStatus]= useState<'all'|'mapped'|'unmapped'>('all')
  const fileRef = useRef<HTMLInputElement>(null)

  // Enrich repository items with mapping status
  const enriched = repository.map(m => ({
    ...m,
    mapping: mappings.find(mp => mp.materialId === m.id),
    isMapped: mappings.some(mp => mp.materialId === m.id && mp.status === 'mapped'),
  }))

  const filtered = enriched.filter(m => {
    if (!showArchived && m.archived) return false
    if (catFilter !== 'All' && m.category !== catFilter) return false
    if (filterStatus === 'mapped'   && !m.isMapped) return false
    if (filterStatus === 'unmapped' &&  m.isMapped) return false
    const q = search.toLowerCase()
    if (q && !m.name.toLowerCase().includes(q) && !(m.supplier??'').toLowerCase().includes(q)) return false
    return true
  })

  const unmappedCount  = enriched.filter(m => !m.archived && !m.isMapped).length
  const mappedCount    = enriched.filter(m => !m.archived &&  m.isMapped).length

  function validateForm() {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Required'
    else if (!editId && repository.some(m => m.name.toLowerCase() === form.name.toLowerCase())) e.name = 'Already exists'
    if (form.rate < 0) e.rate = 'Cannot be negative'
    setFormErrs(e); return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validateForm()) return
    if (editId) {
      updateMaterial(editId, { ...form }); setEditId(null)
    } else {
      // Add material first, then prompt for mapping
      addMaterial({ ...form })
      const newMat = { ...form, id: '', dateUpdated:'', archived:false, rateHistory:[] } as RepositoryMaterial
      // Find the just-added material by name
      setTimeout(() => {
        const added = useAppStore.getState().repository.find(m => m.name === form.name)
        if (added) setWizardMat(added)
      }, 50)
    }
    setForm({ ...EMPTY }); setShowAdd(false); setFormErrs({})
  }

  function handleEdit(m: RepositoryMaterial) {
    setForm({ name:m.name, category:m.category, unit:m.unit, rate:m.rate, supplier:m.supplier??'', notes:m.notes??'' })
    setEditId(m.id); setShowAdd(true)
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBulkStatus('Parsing file…')
    try {
      const XLSX = (await import('xlsx')).default
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type:'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string,string|number>>(ws)
      const items = rows
        .filter(r => r['Material']||r['Name'])
        .map(r => ({
          name:     String(r['Material']??r['Name']??'').trim(),
          unit:     String(r['Unit']??'Bag').trim(),
          rate:     Number(r['Rate']??0),
          category: (r['Category'] as MaterialCategory)??'Misc',
        }))
        .filter(r => r.name)
      bulkImportMaterials(items)
      setBulkStatus(`Imported ${items.length} materials — define mappings for any new ones below`)
      setTimeout(() => setBulkStatus(null), 5000)
    } catch {
      setBulkStatus('Failed to parse. Use .xlsx/.csv with columns: Material, Unit, Rate')
      setTimeout(() => setBulkStatus(null), 5000)
    }
    e.target.value = ''
  }

  async function downloadTemplate() {
    const XLSX = (await import('xlsx')).default
    const ws = XLSX.utils.aoa_to_sheet([
      ['Material','Unit','Rate','Category'],
      ['Cement','Bag',420,'Structure'],
      ['Steel','Kg',70,'Structure'],
      ['Tiles','sq ft',80,'Finishing'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Materials')
    XLSX.writeFile(wb, 'material_import_template.xlsx')
  }

  function handleWizardComplete(mapping: MaterialMapping) {
    setWizardMat(null)
  }

  return (
    <div className="max-w-6xl space-y-5">
      {/* Mapping wizard */}
      {wizardMat && (
        <MappingWizard
          materialId={wizardMat.id}
          materialName={wizardMat.name}
          defaultUnit={wizardMat.unit}
          onClose={() => setWizardMat(null)}
          onComplete={handleWizardComplete}
        />
      )}

      {/* Status banner for unmapped materials */}
      {unmappedCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {unmappedCount} material{unmappedCount > 1 ? 's' : ''} without a quantity mapping
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These materials will not appear in estimates until a Quantity Mapping is defined.
              Click <strong>Define mapping</strong> on each row below.
            </p>
          </div>
          <button
            className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap"
            onClick={() => setFilterStatus('unmapped')}
          >
            Show unmapped →
          </button>
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-900">{enriched.filter(m=>!m.archived).length}</span> materials
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="font-semibold">{mappedCount}</span> mapped
          </span>
          {unmappedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-semibold">{unmappedCount}</span> unmapped
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary text-xs" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" />Template
          </button>
          <button className="btn-secondary text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />Bulk import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleBulkUpload} />
          <button className="btn-primary text-xs" onClick={() => { setShowAdd(true); setEditId(null); setForm({...EMPTY}) }}>
            <Plus className="h-3.5 w-3.5" />Add material
          </button>
        </div>
      </div>

      {bulkStatus && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          bulkStatus.startsWith('Imported') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>{bulkStatus}</div>
      )}

      {/* Add / edit form */}
      {showAdd && (
        <div className="card-padded border border-orange-200 bg-orange-50/30">
          <p className="h3 mb-4">{editId ? 'Edit material' : 'Add new material'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Material name *</label>
              <input
                className={cn('input-field', formErrs.name && 'border-red-400')}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Waterproofing Compound"
                disabled={!!editId}
              />
              {formErrs.name && <p className="mt-1 text-xs text-red-500">{formErrs.name}</p>}
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select-field" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as MaterialCategory }))}>
                {MATERIAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <input className="input-field" list="units-dl" value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              <datalist id="units-dl">{UNIT_OPTIONS.map(u => <option key={u} value={u} />)}</datalist>
            </div>
            <div>
              <label className="label">Unit rate ({currency})</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currency}</span>
                <input type="number" className="input-field pl-7" value={form.rate} min="0" step="0.01"
                  onChange={e => setForm(f => ({ ...f, rate: parseFloat(e.target.value)||0 }))} />
              </div>
            </div>
            <div>
              <label className="label">Supplier</label>
              <input className="input-field" value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input-field" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          {!editId && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                <strong>After saving</strong>, you will be prompted to define a Quantity Mapping so this material
                appears in calculations. You can skip the wizard and define the mapping later.
              </p>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={handleSubmit}>
              {editId ? 'Save changes' : 'Add & define mapping →'}
            </button>
            <button className="btn-secondary"
              onClick={() => { setForm({...EMPTY}); setEditId(null); setShowAdd(false); setFormErrs({}) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search name or supplier…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Mapping status filter */}
        <div className="flex gap-1">
          {(['all','mapped','unmapped'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filterStatus===s ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
              )}
              style={filterStatus===s ? {background:'#C65911',borderColor:'#C65911'} : {}}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          {(['All',...MATERIAL_CATEGORIES] as const).map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat as MaterialCategory|'All')}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                catFilter===cat ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
              )}
              style={catFilter===cat ? {background:'#C65911',borderColor:'#C65911'} : {}}>
              {cat}
            </button>
          ))}
        </div>
        <button className="btn-ghost text-xs" onClick={() => setShowArchived(s => !s)}>
          {showArchived ? 'Hide' : 'Show'} archived
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-header">Material</th>
                <th className="table-header">Mapping status</th>
                <th className="table-header">Category</th>
                <th className="table-header">Unit</th>
                <th className="table-header">Rate</th>
                <th className="table-header">Formula</th>
                <th className="table-header">Supplier</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(m => (
                <>
                  <tr
                    key={m.id}
                    className={cn('hover:bg-gray-50 transition-colors', m.archived && 'opacity-50')}
                  >
                    {/* Name */}
                    <td className="table-cell font-medium text-gray-900">
                      <button
                        className="flex items-center gap-1.5 text-left hover:text-brand"
                        onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                        style={{color: expandedId===m.id ? '#C65911' : ''}}
                      >
                        {m.name}
                        {expandedId===m.id
                          ? <ChevronUp className="h-3 w-3 text-gray-400"/>
                          : <ChevronDown className="h-3 w-3 text-gray-400"/>}
                      </button>
                    </td>

                    {/* Mapping status */}
                    <td className="table-cell">
                      {m.isMapped ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1">
                          <CheckCircle className="h-3 w-3" /> Mapped
                        </span>
                      ) : (
                        <button
                          onClick={() => setWizardMat(m)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors"
                        >
                          <AlertTriangle className="h-3 w-3" /> Define mapping →
                        </button>
                      )}
                    </td>

                    {/* Category */}
                    <td className="table-cell">
                      <span className={cn('badge', CATEGORY_BADGE[m.category])}>{m.category}</span>
                    </td>

                    {/* Unit */}
                    <td className="table-cell text-gray-400 text-xs">{m.unit}</td>

                    {/* Rate — inline editable */}
                    <td className="table-cell-num">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">{currency}</span>
                        <input
                          type="number"
                          className="w-20 text-sm font-semibold bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-brand rounded numeric"
                          value={m.rate}
                          min="0"
                          step="0.01"
                          onChange={e => updateMaterial(m.id, { rate: parseFloat(e.target.value)||0 })}
                        />
                        {m.rateHistory.length > 1 && (
                          <span className={cn('text-[10px]',
                            m.rate > (m.rateHistory[m.rateHistory.length-2]?.rate??m.rate) ? 'text-red-500' : 'text-green-600')}>
                            {m.rate > (m.rateHistory[m.rateHistory.length-2]?.rate??m.rate) ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Formula (from mapping) */}
                    <td className="table-cell">
                      {m.mapping ? (
                        <span className="text-xs text-gray-500 font-mono truncate max-w-[180px] block" title={m.mapping.formula}>
                          {m.mapping.formula.length > 40 ? m.mapping.formula.slice(0,38)+'…' : m.mapping.formula}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">No formula</span>
                      )}
                    </td>

                    {/* Supplier */}
                    <td className="table-cell text-gray-400 text-xs">{m.supplier||'—'}</td>

                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {m.isMapped ? (
                          <button
                            onClick={() => setWizardMat(m)}
                            className="p-1.5 rounded text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors"
                            title="Edit mapping"
                          >
                            <Map className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setWizardMat(m)}
                            className="p-1.5 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            title="Define mapping"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(m)}
                          className="p-1.5 rounded text-gray-400 hover:text-brand hover:bg-orange-50 transition-colors"
                          title="Edit rate / details"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => archiveMaterial(m.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                          title={m.archived ? 'Unarchive' : 'Archive'}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${m.name}"?`)) deleteMaterial(m.id) }}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded: mapping detail + rate history */}
                  {expandedId === m.id && (
                    <tr key={`${m.id}-exp`}>
                      <td colSpan={8} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {/* Mapping detail */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Quantity mapping
                            </p>
                            {m.mapping ? (
                              <div className="space-y-2">
                                {[
                                  ['Driver basis', m.mapping.driverBasis],
                                  ['Output unit', m.mapping.outputUnit],
                                  ['Consumption', m.mapping.driverBasis==='Per Unit Count'
                                    ? `1 ${m.mapping.outputUnit} per ${m.mapping.areaPerUnit} sq ft`
                                    : `${m.mapping.consumptionFactor} ${m.mapping.consumptionUnit}`],
                                  ['Formula', m.mapping.formula],
                                  ['Source', m.mapping.notes||'—'],
                                  ['Built-in', m.mapping.isBuiltIn ? 'Yes (system default)' : 'No (user-defined)'],
                                ].map(([label, value]) => (
                                  <div key={label} className="flex gap-3">
                                    <span className="text-[11px] font-semibold text-gray-400 w-24 flex-shrink-0 uppercase tracking-wide">{label}</span>
                                    <span className="text-xs text-gray-700">{value}</span>
                                  </div>
                                ))}
                                {!m.mapping.isBuiltIn && (
                                  <button
                                    onClick={() => { if (confirm('Remove this mapping? The material will be excluded from estimates.')) deleteMapping(m.id) }}
                                    className="mt-1 text-xs text-red-500 hover:underline"
                                  >
                                    Remove mapping
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-start gap-2">
                                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                  No mapping defined — this material is excluded from estimates.
                                </p>
                                <button
                                  onClick={() => setWizardMat(m)}
                                  className="btn-primary text-xs"
                                >
                                  <Link2 className="h-3.5 w-3.5" /> Define mapping now
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Rate history */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Rate history</p>
                            {m.notes && <p className="text-xs text-gray-500 mb-2">Notes: {m.notes}</p>}
                            <div className="flex gap-2 flex-wrap">
                              {m.rateHistory.map((h, i) => (
                                <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
                                  <p className="text-[10px] text-gray-400">{h.date}</p>
                                  <p className="text-sm font-bold text-gray-900 numeric">{currency}{h.rate}</p>
                                  {h.note && <p className="text-[10px] text-gray-400">{h.note}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                    No materials found. Adjust filters or add a material.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
