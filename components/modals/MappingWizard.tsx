'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import {
  DRIVER_BASIS_OPTIONS, DRIVER_BASIS_DESCRIPTIONS,
  type MaterialMapping, type DriverBasis,
} from '@/lib/materialMapping'
import { UNIT_OPTIONS } from '@/lib/constants'
import { today, cn } from '@/lib/utils'
import { X, ChevronRight, ChevronLeft, CheckCircle, Info, Calculator, BookOpen } from 'lucide-react'

interface Props {
  materialId:   string
  materialName: string
  defaultUnit?: string
  onClose:      () => void
  onComplete:   (mapping: MaterialMapping) => void
}

type Step = 1 | 2 | 3 | 4
const STEP_LABELS = ['Unit', 'Driver Basis', 'Factor & Formula', 'Review']

export function MappingWizard({ materialId, materialName, defaultUnit = '', onClose, onComplete }: Props) {
  const { addMapping } = useAppStore()
  const [step,   setStep]   = useState<Step>(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [outputUnit,        setOutputUnit]        = useState(defaultUnit)
  const [driverBasis,       setDriverBasis]       = useState<DriverBasis>('Total Floor Area')
  const [consumptionFactor, setConsumptionFactor] = useState<string>('')
  const [consumptionUnit,   setConsumptionUnit]   = useState('')
  const [areaPerUnit,       setAreaPerUnit]        = useState<string>('100')
  const [formula,           setFormula]           = useState('')
  const [notes,             setNotes]             = useState('')

  function handleBasisChange(b: DriverBasis) {
    setDriverBasis(b)
    const suggestions: Partial<Record<DriverBasis, string>> = {
      'Floor Area': `${outputUnit||'unit'} / sq ft`,
      'Total Floor Area': `${outputUnit||'unit'} / sq ft`,
      'Wall Area': `${outputUnit||'unit'} / sq ft`,
      'Ceiling Area': `${outputUnit||'unit'} / sq ft`,
      'Perimeter': `${outputUnit||'unit'} / lin ft`,
      'RCC Volume': `${outputUnit||'unit'} / cu m`,
      'Room Count': `${outputUnit||'unit'} / room`,
    }
    setConsumptionUnit(suggestions[b] ?? '')
  }

  function buildFormulaPreview(): string {
    const factor = consumptionFactor || '?'
    const unit = outputUnit || 'units'
    if (driverBasis === 'Per Unit Count') return `ceil(Total Floor Area ÷ ${areaPerUnit||'X'}) → ${unit}`
    if (driverBasis === 'Custom') return formula || '(define in notes)'
    const basisLabels: Partial<Record<DriverBasis,string>> = {
      'Floor Area':'Floor Area (sq ft)','Total Floor Area':'(Floor Area × Floors)',
      'Wall Area':'Wall Area (sq ft)','Ceiling Area':'Ceiling Area (sq ft)',
      'Perimeter':'Perimeter (lin ft)','RCC Volume':'RCC Volume (cu m)','Room Count':'Room Count',
    }
    return `${basisLabels[driverBasis]||driverBasis} × ${factor} ${consumptionUnit} → ${unit}`
  }

  function validate(atStep: Step): boolean {
    const e: Record<string,string> = {}
    if (atStep >= 1 && !outputUnit.trim()) e.outputUnit = 'Unit is required'
    if (atStep >= 3) {
      if (driverBasis !== 'Per Unit Count' && driverBasis !== 'Custom') {
        const f = parseFloat(consumptionFactor)
        if (!consumptionFactor || isNaN(f) || f <= 0) e.consumptionFactor = 'Enter a positive number'
      }
      if (driverBasis === 'Per Unit Count') {
        const a = parseFloat(areaPerUnit)
        if (!areaPerUnit || isNaN(a) || a <= 0) e.areaPerUnit = 'Enter sq ft per unit'
      }
    }
    setErrors(e); return Object.keys(e).length === 0
  }

  function handleNext() { if (validate(step) && step < 4) setStep(s => (s+1) as Step) }
  function handleBack() { if (step > 1) setStep(s => (s-1) as Step) }

  function handleSave() {
    if (!validate(4)) return
    const mapping: MaterialMapping = {
      materialId, materialName, status: 'mapped',
      outputUnit, driverBasis,
      consumptionFactor: parseFloat(consumptionFactor)||0,
      consumptionUnit, formula: formula.trim()||buildFormulaPreview(), notes,
      areaPerUnit: driverBasis==='Per Unit Count'?parseFloat(areaPerUnit):undefined,
      customFormula: driverBasis==='Custom'?formula:undefined,
      createdAt: today(), updatedAt: today(), isBuiltIn: false,
    }
    addMapping(mapping); onComplete(mapping)
  }

  const brandStyle = { borderColor:'#C65911', color:'#C65911', background:'#fdf3ee' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{backdropFilter:'blur(4px)'}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-orange-100" style={{background:'#fdf3ee'}}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{color:'#C65911'}}>Quantity Mapping Wizard</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{materialName}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10"><X className="h-4 w-4 text-gray-600"/></button>
        </div>

        {/* Progress */}
        <div className="flex px-6 pt-4 pb-1 gap-2">
          {STEP_LABELS.map((label,i) => {
            const s=(i+1) as Step; const done=step>s; const cur=step===s
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className="h-1.5 w-full rounded-full" style={{background:done?'#22c55e':cur?'#C65911':'#e5e7eb'}}/>
                <span className="text-[10px] font-medium" style={{color:cur?'#C65911':done?'#16a34a':'#9ca3af'}}>
                  {done?'✓ ':''}{label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[300px]">

          {step===1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-blue-700">Once mapped, <strong>{materialName}</strong> will be included in all estimates, reports, and Excel exports with a full calculation trace.</p>
              </div>
              <div>
                <label className="label">Output unit of measurement *</label>
                <input className={cn('input-field', errors.outputUnit&&'border-red-400')} value={outputUnit}
                  onChange={e=>setOutputUnit(e.target.value)} list="unit-opts" placeholder="e.g. Bag, Kg, m, nos, sq ft"/>
                <datalist id="unit-opts">{UNIT_OPTIONS.map(u=><option key={u} value={u}/>)}</datalist>
                {errors.outputUnit && <p className="mt-1 text-xs text-red-500">{errors.outputUnit}</p>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['Bag','Kg','m','nos','sq ft','litres','cu m','Ton'].map(u=>(
                  <button key={u} type="button" onClick={()=>setOutputUnit(u)}
                    className="py-2 rounded-lg border text-xs font-medium transition-colors"
                    style={outputUnit===u?brandStyle:{}}>{u}</button>
                ))}
              </div>
            </div>
          )}

          {step===2 && (
            <div className="space-y-3">
              <div><p className="h3 mb-0.5">What drives this quantity?</p>
                <p className="text-xs text-gray-400">Which surface or count is the consumption factor applied to?</p></div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {DRIVER_BASIS_OPTIONS.map(basis=>(
                  <button key={basis} type="button" onClick={()=>handleBasisChange(basis)}
                    className="w-full text-left rounded-xl border p-3 transition-colors"
                    style={driverBasis===basis?brandStyle:{}}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold" style={driverBasis===basis?{color:'#C65911'}:{}}>{basis}</span>
                      {driverBasis===basis && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{color:'#C65911'}}/>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{DRIVER_BASIS_DESCRIPTIONS[basis]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step===3 && (
            <div className="space-y-4">
              <div><p className="h3 mb-0.5">Consumption factor</p>
                <p className="text-xs text-gray-400">How much <strong>{outputUnit}</strong> per unit of <strong>{driverBasis}</strong>?</p></div>

              {driverBasis==='Per Unit Count' ? (
                <div>
                  <label className="label">Sq ft per {outputUnit} *</label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-gray-500">1 {outputUnit} per</span>
                    <input type="number" className={cn('input-field w-28',errors.areaPerUnit&&'border-red-400')}
                      value={areaPerUnit} min="1" onChange={e=>setAreaPerUnit(e.target.value)}/>
                    <span className="text-sm text-gray-500">sq ft</span>
                  </div>
                  {errors.areaPerUnit&&<p className="mt-1 text-xs text-red-500">{errors.areaPerUnit}</p>}
                </div>
              ) : driverBasis==='Custom' ? (
                <div>
                  <label className="label">Custom formula *</label>
                  <textarea className="input-field resize-none" rows={3} value={formula}
                    onChange={e=>setFormula(e.target.value)} placeholder="Describe formula..."/>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Consumption factor *</label>
                    <input type="number" className={cn('input-field',errors.consumptionFactor&&'border-red-400')}
                      value={consumptionFactor} min="0" step="0.001" placeholder="e.g. 0.40"
                      onChange={e=>setConsumptionFactor(e.target.value)}/>
                    {errors.consumptionFactor&&<p className="mt-1 text-xs text-red-500">{errors.consumptionFactor}</p>}
                  </div>
                  <div>
                    <label className="label">Factor unit</label>
                    <input className="input-field" value={consumptionUnit}
                      onChange={e=>setConsumptionUnit(e.target.value)} placeholder={`${outputUnit}/sq ft`}/>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calculator className="h-3.5 w-3.5" style={{color:'#C65911'}}/>
                  <span className="text-xs font-semibold" style={{color:'#C65911'}}>Formula preview</span>
                </div>
                <code className="text-sm text-gray-800 font-mono">{buildFormulaPreview()}</code>
              </div>

              <div>
                <label className="label">Source / notes (optional)</label>
                <input className="input-field" value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="e.g. IS:456:2000, site experience, CPWD DSR 2023"/>
              </div>
            </div>
          )}

          {step===4 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-green-700">Review below. Once saved, <strong>{materialName}</strong> becomes active in all estimates.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  ['Material', materialName],
                  ['Output unit', outputUnit],
                  ['Driver basis', driverBasis],
                  ['Consumption', driverBasis==='Per Unit Count'?`1 ${outputUnit} per ${areaPerUnit} sq ft`:driverBasis==='Custom'?'Custom formula':`${consumptionFactor} ${consumptionUnit}`],
                  ['Formula', formula.trim()||buildFormulaPreview()],
                  ['Source', notes||'—'],
                ].map(([label,value])=>(
                  <div key={label} className="flex gap-3 py-2">
                    <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0">{label}</span>
                    <span className="text-xs text-gray-900 flex-1">{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-3 border border-orange-200" style={{background:'#fdf3ee'}}>
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen className="h-3.5 w-3.5" style={{color:'#C65911'}}/>
                  <span className="text-xs font-semibold" style={{color:'#C65911'}}>After saving</span>
                </div>
                <ul className="text-xs space-y-1" style={{color:'#7c3811'}}>
                  <li>✦ A Quantity Driver is created for the consumption factor</li>
                  <li>✦ {materialName} appears in all estimate calculations</li>
                  <li>✦ Full step-by-step trace shown in Reports</li>
                  <li>✦ Included in Excel export (all 6 sheets)</li>
                  <li>✦ Editable any time in the Qty Drivers panel</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={step===1?onClose:handleBack} className="btn-secondary text-sm">
            <ChevronLeft className="h-4 w-4"/>{step===1?'Cancel':'Back'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Step {step} of 4</span>
            {step<4 ? (
              <button onClick={handleNext} className="btn-primary text-sm">Next <ChevronRight className="h-4 w-4"/></button>
            ) : (
              <button onClick={handleSave} className="btn-primary text-sm" style={{background:'#16a34a',borderColor:'#16a34a'}}>
                <CheckCircle className="h-4 w-4"/>Save & activate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
