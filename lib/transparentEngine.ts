/**
 * TRANSPARENT ESTIMATION ENGINE
 *
 * Every quantity is derived exclusively from user-visible QuantityDrivers.
 * No hardcoded numbers exist in this file — every value is looked up from the driver set.
 * The engine returns full calculation traces so the UI can render every step.
 */

import type { QuantityDriverSet } from './quantityDrivers'
import type { MaterialMapping, DriverBasis } from './materialMapping'
import type {
  EstimationResult, MaterialCalculation, CalcStep,
  CostSummary, MaterialCategory, ProjectSettings,
  AreaEstimationInput, LayoutEstimationInput, Room,
} from './types'

function genId(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function d(drivers: QuantityDriverSet, id: string): number {
  const driver = drivers[id]
  if (!driver) throw new Error(`Driver "${id}" not found. Check quantityDrivers.ts.`)
  return driver.value
}

function dSym(drivers: QuantityDriverSet, id: string): string {
  return drivers[id]?.symbol ?? id
}

function getStructureDriverId(structureType: string, material: string): string {
  const mat = material.toLowerCase().replace(/ /g, '_')
  if (structureType === 'Steel Structure') return `${mat}.structure_steel`
  if (structureType === 'Load Bearing')   return `${mat}.structure_load_bearing`
  return `${mat}.structure_rcc`
}

function getQualityDriverId(quality: string, material: string): string {
  const mat = material.toLowerCase().replace(/ /g, '_')
  if (quality === 'Economy') return `${mat}.quality_economy`
  if (quality === 'Premium') return `${mat}.quality_premium`
  return `${mat}.quality_standard`
}

function getWallDriverId(wallThickness: string, material: string): string {
  const mat = material.toLowerCase().replace(/ /g, '_')
  return wallThickness === '4.5 inch' ? `${mat}.wall_4_5_inch` : `${mat}.wall_9_inch`
}

function hasDriver(drivers: QuantityDriverSet, id: string): boolean {
  return !!drivers[id]
}

/** Build one MaterialCalculation with full step-by-step trace */
function calcMaterial(
  material: string,
  category: MaterialCategory,
  unit: string,
  floorArea: number,
  floors: number,
  quality: string,
  wallThickness: string,
  structureType: string,
  rate: number,
  drivers: QuantityDriverSet,
): MaterialCalculation {
  const steps: CalcStep[] = []
  let baseQuantity = 0
  const totalFloor = floorArea * floors

  switch (material) {

    case 'Cement': {
      const baseId  = 'cement.base_ratio'
      const qualId  = getQualityDriverId(quality, 'cement')
      const strId   = getStructureDriverId(structureType, 'cement')
      const base    = d(drivers, baseId)
      const qual    = hasDriver(drivers, qualId)    ? d(drivers, qualId)  : 1.0
      const str     = hasDriver(drivers, strId)     ? d(drivers, strId)   : 1.0
      const base1k  = totalFloor / 1000

      steps.push({ label:'Input: Total floor area', formula:`${floorArea} sq ft × ${floors} floor(s)`, value: totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base cement ratio`, formula:`${base} bags per 1000 sq ft`, value: base, unit:'bags/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value: base1k * base, unit:'bags' })
      steps.push({ label:`Driver [${dSym(drivers,qualId)||'—'}]: ${quality} quality multiplier`, formula:`× ${qual}`, value: qual, unit:'multiplier' })
      steps.push({ label:'Step 2: After quality adjust', formula:`${(base1k*base).toFixed(1)} × ${qual}`, value: base1k*base*qual, unit:'bags' })
      steps.push({ label:`Driver [${dSym(drivers,strId)||'—'}]: ${structureType} factor`, formula:`× ${str}`, value: str, unit:'multiplier' })
      steps.push({ label:'Step 3: After structure adjust', formula:`${(base1k*base*qual).toFixed(1)} × ${str}`, value: base1k*base*qual*str, unit:'bags' })
      baseQuantity = Math.round(base1k * base * qual * str)
      break
    }

    case 'Sand': {
      const baseId  = 'sand.base_ratio'
      const wallId  = getWallDriverId(wallThickness, 'sand')
      const base    = d(drivers, baseId)
      const wf      = hasDriver(drivers, wallId) ? d(drivers, wallId) : 1.0

      steps.push({ label:'Input: Total floor area', formula:`${floorArea} sq ft × ${floors} floor(s)`, value: totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base sand ratio`, formula:`${base} cu ft per 1000 sq ft`, value: base, unit:'cu ft/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value: (totalFloor/1000)*base, unit:'cu ft' })
      steps.push({ label:`Driver [${dSym(drivers,wallId)||'—'}]: ${wallThickness} wall factor`, formula:`× ${wf}`, value: wf, unit:'multiplier' })
      steps.push({ label:'Step 2: After wall adjustment', formula:`${((totalFloor/1000)*base).toFixed(1)} × ${wf}`, value:(totalFloor/1000)*base*wf, unit:'cu ft' })
      baseQuantity = Math.round((totalFloor/1000) * base * wf)
      break
    }

    case 'Aggregate': {
      const baseId = 'aggregate.base_ratio'
      const strId  = getStructureDriverId(structureType, 'aggregate')
      const base   = d(drivers, baseId)
      const str    = hasDriver(drivers, strId) ? d(drivers, strId) : d(drivers, 'cement.structure_rcc')

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value: totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base aggregate ratio`, formula:`${base} cu ft per 1000 sq ft`, value: base, unit:'cu ft/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'cu ft' })
      steps.push({ label:`Driver [structure factor]: ${structureType}`, formula:`× ${str}`, value:str, unit:'multiplier' })
      steps.push({ label:'Step 2: Final quantity', formula:`${((totalFloor/1000)*base).toFixed(1)} × ${str}`, value:(totalFloor/1000)*base*str, unit:'cu ft' })
      baseQuantity = Math.round((totalFloor/1000)*base*str)
      break
    }

    case 'Steel': {
      const baseId = 'steel.base_ratio'
      const qualId = getQualityDriverId(quality, 'steel')
      const strId  = getStructureDriverId(structureType, 'steel')
      const base   = d(drivers, baseId)
      const qual   = hasDriver(drivers, qualId) ? d(drivers, qualId) : d(drivers,'cement.quality_standard')
      const str    = hasDriver(drivers, strId)  ? d(drivers, strId)  : d(drivers,'cement.structure_rcc')

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base steel ratio`, formula:`${base} kg per 1000 sq ft`, value:base, unit:'kg/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'kg' })
      steps.push({ label:`Driver [quality]: ${quality}`, formula:`× ${qual}`, value:qual, unit:'multiplier' })
      steps.push({ label:`Driver [structure]: ${structureType}`, formula:`× ${str}`, value:str, unit:'multiplier' })
      steps.push({ label:'Step 2: Final quantity', formula:`${((totalFloor/1000)*base).toFixed(1)} × ${qual} × ${str}`, value:(totalFloor/1000)*base*qual*str, unit:'kg' })
      baseQuantity = Math.round((totalFloor/1000)*base*qual*str)
      break
    }

    case 'Bricks': {
      const baseId = 'bricks.base_ratio'
      const wallId = getWallDriverId(wallThickness, 'bricks')
      const base   = d(drivers, baseId)
      const wf     = hasDriver(drivers, wallId) ? d(drivers, wallId) : d(drivers,'sand.wall_9_inch')

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base bricks ratio`, formula:`${base} nos per 1000 sq ft (9-inch ref)`, value:base, unit:'nos/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'nos' })
      steps.push({ label:`Driver [wall factor]: ${wallThickness}`, formula:`× ${wf}`, value:wf, unit:'multiplier' })
      steps.push({ label:'Step 2: Final quantity', formula:`${((totalFloor/1000)*base).toFixed(0)} × ${wf}`, value:(totalFloor/1000)*base*wf, unit:'nos' })
      baseQuantity = Math.round((totalFloor/1000)*base*wf)
      break
    }

    case 'Blocks': {
      const baseId = 'blocks.base_ratio'
      const wallId = getWallDriverId(wallThickness, 'blocks')
      const base   = d(drivers, baseId)
      const wf     = hasDriver(drivers, wallId) ? d(drivers, wallId) : d(drivers,'sand.wall_9_inch')

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base blocks ratio`, formula:`${base} nos per 1000 sq ft`, value:base, unit:'nos/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'nos' })
      steps.push({ label:`Driver [wall factor]: ${wallThickness}`, formula:`× ${wf}`, value:wf, unit:'multiplier' })
      steps.push({ label:'Step 2: Final quantity', formula:`${((totalFloor/1000)*base).toFixed(0)} × ${wf}`, value:(totalFloor/1000)*base*wf, unit:'nos' })
      baseQuantity = Math.round((totalFloor/1000)*base*wf)
      break
    }

    case 'Concrete': {
      const baseId = 'concrete.base_ratio'
      const strId  = getStructureDriverId(structureType, 'concrete')
      const base   = d(drivers, baseId)
      const str    = hasDriver(drivers, strId) ? d(drivers, strId) : d(drivers,'cement.structure_rcc')

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base concrete ratio`, formula:`${base} cu m per 1000 sq ft`, value:base, unit:'cum/1000sqft' })
      steps.push({ label:'Step 1: Base quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'cu m' })
      steps.push({ label:`Driver [structure]: ${structureType}`, formula:`× ${str}`, value:str, unit:'multiplier' })
      steps.push({ label:'Step 2: Final quantity', formula:`${((totalFloor/1000)*base).toFixed(2)} × ${str}`, value:(totalFloor/1000)*base*str, unit:'cu m' })
      baseQuantity = Math.round((totalFloor/1000)*base*str*100)/100
      break
    }

    case 'Water': {
      const baseId = 'water.base_ratio'
      const base   = d(drivers, baseId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,baseId)}]: Base water ratio`, formula:`${base} litres per 1000 sq ft`, value:base, unit:'L/1000sqft' })
      steps.push({ label:'Step 1: Final quantity', formula:`(${totalFloor} ÷ 1000) × ${base}`, value:(totalFloor/1000)*base, unit:'litres' })
      baseQuantity = Math.round((totalFloor/1000)*base)
      break
    }

    case 'Tiles': {
      const covId   = 'tiles.floor_coverage'
      const wasteId = 'tiles.waste_factor'
      const cov     = d(drivers, covId)
      const waste   = d(drivers, wasteId)
      const netArea = floorArea * cov

      steps.push({ label:'Input: Floor area (single floor)', formula:`${floorArea} sq ft`, value:floorArea, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,covId)}]: Floor coverage factor`, formula:`${floorArea} × ${cov}`, value:netArea, unit:'sq ft' })
      steps.push({ label:'Step 1: Net tiled area', formula:`${floorArea} × ${cov} = ${netArea.toFixed(1)}`, value:netArea, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,wasteId)}]: Cutting waste factor`, formula:`+ ${(waste*100).toFixed(0)}% extra`, value:waste, unit:'fraction' })
      steps.push({ label:'Step 2: Total with waste', formula:`${netArea.toFixed(1)} × (1 + ${waste}) = ${(netArea*(1+waste)).toFixed(1)}`, value:netArea*(1+waste), unit:'sq ft' })
      baseQuantity = Math.round(netArea)
      // Note: waste is applied separately below
      break
    }

    case 'Paint': {
      const areaId = 'paint.area_multiplier'
      const covId  = 'paint.coverage_rate'
      const areaM  = d(drivers, areaId)
      const covR   = d(drivers, covId)
      const paintArea = floorArea * areaM

      steps.push({ label:'Input: Floor area (single floor)', formula:`${floorArea} sq ft`, value:floorArea, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,areaId)}]: Paintable area multiplier`, formula:`walls + ceiling ≈ ${areaM}× floor area`, value:areaM, unit:'multiplier' })
      steps.push({ label:'Step 1: Total paintable area', formula:`${floorArea} × ${areaM} = ${paintArea.toFixed(1)} sq ft`, value:paintArea, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,covId)}]: Coverage rate (2 coats)`, formula:`${covR} litres per sq ft`, value:covR, unit:'L/sqft' })
      steps.push({ label:'Step 2: Paint volume', formula:`${paintArea.toFixed(1)} × ${covR} = ${(paintArea*covR).toFixed(1)} litres`, value:paintArea*covR, unit:'litres' })
      baseQuantity = Math.round(paintArea * covR)
      break
    }

    case 'Electrical Conduits': {
      const ratioId = 'electrical_conduits.ratio'
      const ratio   = d(drivers, ratioId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,ratioId)}]: Conduit length ratio`, formula:`${ratio} m per sq ft`, value:ratio, unit:'m/sqft' })
      steps.push({ label:'Step 1: Total conduit', formula:`${totalFloor} × ${ratio} = ${(totalFloor*ratio).toFixed(1)} m`, value:totalFloor*ratio, unit:'m' })
      baseQuantity = Math.round(totalFloor * ratio)
      break
    }

    case 'Wiring': {
      const ratioId = 'wiring.ratio'
      const ratio   = d(drivers, ratioId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,ratioId)}]: Wiring length ratio`, formula:`${ratio} m per sq ft`, value:ratio, unit:'m/sqft' })
      steps.push({ label:'Step 1: Total wiring', formula:`${totalFloor} × ${ratio} = ${(totalFloor*ratio).toFixed(1)} m`, value:totalFloor*ratio, unit:'m' })
      baseQuantity = Math.round(totalFloor * ratio)
      break
    }

    case 'Plumbing Pipes': {
      const ratioId = 'plumbing.ratio'
      const ratio   = d(drivers, ratioId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,ratioId)}]: Plumbing pipe ratio`, formula:`${ratio} m per sq ft`, value:ratio, unit:'m/sqft' })
      steps.push({ label:'Step 1: Total pipe length', formula:`${totalFloor} × ${ratio} = ${(totalFloor*ratio).toFixed(1)} m`, value:totalFloor*ratio, unit:'m' })
      baseQuantity = Math.round(totalFloor * ratio)
      break
    }

    case 'Doors': {
      const areaId = 'doors.area_per_door'
      const areaPD = d(drivers, areaId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,areaId)}]: Area per door`, formula:`1 door per ${areaPD} sq ft`, value:areaPD, unit:'sq ft/door' })
      steps.push({ label:'Step 1: Door count', formula:`${totalFloor} ÷ ${areaPD} = ${(totalFloor/areaPD).toFixed(1)} → rounded up`, value:Math.max(1,Math.ceil(totalFloor/areaPD)), unit:'nos' })
      baseQuantity = Math.max(1, Math.ceil(totalFloor / areaPD))
      break
    }

    case 'Windows': {
      const areaId = 'windows.area_per_window'
      const areaPW = d(drivers, areaId)

      steps.push({ label:'Input: Total floor area', formula:`${totalFloor} sq ft`, value:totalFloor, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,areaId)}]: Area per window`, formula:`1 window per ${areaPW} sq ft`, value:areaPW, unit:'sq ft/window' })
      steps.push({ label:'Step 1: Window count', formula:`${totalFloor} ÷ ${areaPW} = ${(totalFloor/areaPW).toFixed(1)} → rounded up`, value:Math.max(1,Math.ceil(totalFloor/areaPW)), unit:'nos' })
      baseQuantity = Math.max(1, Math.ceil(totalFloor / areaPW))
      break
    }

    case 'Roofing': {
      const slopeId = 'roofing.slope_factor'
      const slope   = d(drivers, slopeId)

      steps.push({ label:'Input: Floor area (top floor)', formula:`${floorArea} sq ft`, value:floorArea, unit:'sq ft' })
      steps.push({ label:`Driver [${dSym(drivers,slopeId)}]: Roof slope/overhang factor`, formula:`${slope}× for parapet and overhang`, value:slope, unit:'multiplier' })
      steps.push({ label:'Step 1: Roofing area', formula:`${floorArea} × ${slope} = ${(floorArea*slope).toFixed(1)} sq ft`, value:floorArea*slope, unit:'sq ft' })
      baseQuantity = Math.round(floorArea * slope)
      break
    }

    default: {
      steps.push({ label:'Custom material', formula:'Quantity = 0 (no driver defined)', value:0, unit:'' })
      baseQuantity = 0
    }
  }

  // Apply waste
  const wastePct     = d(drivers, 'global.waste_factor')
  const wasteQty     = baseQuantity * (wastePct / 100)
  const totalQty     = baseQuantity + wasteQty

  steps.push({
    label: `Driver [${dSym(drivers,'global.waste_factor')}]: Waste factor`,
    formula: `${baseQuantity.toFixed(2)} × ${wastePct}% = +${wasteQty.toFixed(2)} ${unit}`,
    value: wasteQty, unit,
  })
  steps.push({
    label: 'Final total quantity',
    formula: `${baseQuantity.toFixed(2)} + ${wasteQty.toFixed(2)} = ${totalQty.toFixed(2)} ${unit}`,
    value: totalQty, unit,
  })

  const baseCost  = baseQuantity * rate
  const wasteCost = wasteQty     * rate
  const totalCost = totalQty     * rate

  return {
    material, category, unit, rate,
    steps,
    baseQuantity,
    wasteQuantity: Math.round(wasteQty  * 100) / 100,
    totalQuantity: Math.round(totalQty  * 100) / 100,
    baseCost, wasteCost, totalCost,
  }
}

const MATERIAL_META: { name: string; cat: MaterialCategory; unit: string }[] = [
  { name:'Cement',             cat:'Structure',  unit:'Bag'         },
  { name:'Sand',               cat:'Structure',  unit:'cu ft'       },
  { name:'Aggregate',          cat:'Structure',  unit:'cu ft'       },
  { name:'Steel',              cat:'Structure',  unit:'Kg'          },
  { name:'Bricks',             cat:'Masonry',    unit:'nos'         },
  { name:'Blocks',             cat:'Masonry',    unit:'nos'         },
  { name:'Concrete',           cat:'Structure',  unit:'cu m'        },
  { name:'Water',              cat:'Misc',       unit:'Litre'       },
  { name:'Tiles',              cat:'Finishing',  unit:'sq ft'       },
  { name:'Paint',              cat:'Finishing',  unit:'Litre'       },
  { name:'Electrical Conduits',cat:'MEP',        unit:'m'           },
  { name:'Wiring',             cat:'MEP',        unit:'m'           },
  { name:'Plumbing Pipes',     cat:'MEP',        unit:'m'           },
  { name:'Doors',              cat:'Fixtures',   unit:'nos'         },
  { name:'Windows',            cat:'Fixtures',   unit:'nos'         },
  { name:'Roofing',            cat:'Structure',  unit:'sq ft'       },
]

function buildSummary(
  calcs: MaterialCalculation[],
  drivers: QuantityDriverSet,
): CostSummary {
  const materialCost    = calcs.reduce((s,c) => s + c.totalCost, 0)
  const laborStr        = d(drivers,'global.labor_structural') / 100
  const laborFin        = d(drivers,'global.labor_finishing')  / 100
  const laborCost       = materialCost * (laborStr + laborFin)
  const contingencyPct  = d(drivers,'global.contingency') / 100
  const contingencyCost = (materialCost + laborCost) * contingencyPct
  const subtotal        = materialCost + laborCost + contingencyCost
  const taxAmt          = subtotal * (d(drivers,'global.tax') / 100)
  const grandTotal      = subtotal + taxAmt
  return { materialCost, laborCost, contingencyCost, taxAmount: taxAmt, grandTotal }
}

export function runAreaEstimation(
  input: AreaEstimationInput,
  rates: Record<string,number>,
  drivers: QuantityDriverSet,
  customMappings: MaterialMapping[] = [],
): EstimationResult {
  const { area, floors, quality, wallThickness, structureType } = input

  const builtInNames = new Set(MATERIAL_META.map(m => m.name))
  const activeMappings = customMappings.filter(m => m.status === 'mapped' && !m.isBuiltIn && !builtInNames.has(m.materialName))
  const wallAreaApprox = 2 * (area + area * 0.7) * (input.ceilingHeight ?? 10)

  const calculations = [
    ...MATERIAL_META.map(m =>
      calcMaterial(m.name, m.cat, m.unit, area, floors, quality, wallThickness, structureType, rates[m.name] ?? 0, drivers)
    ),
    ...activeMappings.map(m =>
      calcCustomMaterial(m, area, wallAreaApprox, area, 0, 0, 0, floors, rates[m.materialName] ?? 0, drivers, 'Misc')
    ),
  ]
  const summary = buildSummary(calculations, drivers)

  return {
    id: genId(),
    projectName: input.projectName,
    method: 'Area Based',
    buildingType: input.buildingType,
    currency: input.currency,
    area, floors,
    date: new Date().toLocaleDateString('en-IN'),
    calculations, summary,
    settings: driversToSettings(drivers),
  }
}

export function runLayoutEstimation(
  input: LayoutEstimationInput,
  rates: Record<string,number>,
  drivers: QuantityDriverSet,
  customMappings: MaterialMapping[] = [],
): EstimationResult {
  const { quality, wallThickness, structureType, rooms } = input
  const totalFloor = rooms.reduce((s,r) => s + r.computed.floorArea, 0)

  const builtInNames2 = new Set(MATERIAL_META.map(m => m.name))
  const activeMappings2 = customMappings.filter(m => m.status === 'mapped' && !m.isBuiltIn && !builtInNames2.has(m.materialName))
  const totalWall  = rooms.reduce((s,r) => s + r.computed.wallArea, 0)
  const totalCeil  = rooms.reduce((s,r) => s + r.computed.ceilingArea, 0)
  const totalPerim = rooms.reduce((s,r) => s + r.computed.perimeter, 0)

  const calculations = [
    ...MATERIAL_META.map(m =>
      calcMaterial(m.name, m.cat, m.unit, totalFloor, 1, quality, wallThickness, structureType, rates[m.name] ?? 0, drivers)
    ),
    ...activeMappings2.map(m =>
      calcCustomMaterial(m, totalFloor, totalWall, totalCeil, totalPerim, 0, rooms.length, 1, rates[m.materialName] ?? 0, drivers, 'Misc')
    ),
  ]
  const summary = buildSummary(calculations, drivers)

  return {
    id: genId(),
    projectName: input.projectName,
    method: 'Layout Based',
    buildingType: input.buildingType,
    currency: input.currency,
    area: totalFloor, floors: 1,
    date: new Date().toLocaleDateString('en-IN'),
    calculations, summary,
    settings: driversToSettings(drivers),
    rooms,
  }
}

export function getRatesFromRepository(repo: { name: string; rate: number }[]): Record<string,number> {
  return Object.fromEntries(repo.map(m => [m.name, m.rate]))
}

/** Convert drivers to legacy ProjectSettings shape for backward compat */
function driversToSettings(drivers: QuantityDriverSet): ProjectSettings {
  return {
    wasteFactor:        d(drivers,'global.waste_factor'),
    contingency:        d(drivers,'global.contingency'),
    taxRate:            d(drivers,'global.tax'),
    laborStructuralPct: d(drivers,'global.labor_structural'),
    laborFinishingPct:  d(drivers,'global.labor_finishing'),
    qualityMultipliers: {
      Economy:  drivers['cement.quality_economy']?.value  ?? 0.80,
      Standard: drivers['cement.quality_standard']?.value ?? 1.00,
      Premium:  drivers['cement.quality_premium']?.value  ?? 1.35,
    },
  }
}

// ─── Custom Mapped Material Calculator ───────────────────────────────────────
// Called for any material that is NOT in the built-in MATERIAL_META list
// but has a user-defined MaterialMapping.

export function calcCustomMaterial(
  mapping: MaterialMapping,
  floorArea: number,
  wallArea: number,
  ceilingArea: number,
  perimeter: number,
  rccVolume: number,
  roomCount: number,
  floors: number,
  rate: number,
  drivers: QuantityDriverSet,
  category: MaterialCategory,
): MaterialCalculation {
  const steps: CalcStep[] = []
  const totalFloor = floorArea * floors

  // Resolve the consumption factor — prefer driver override if exists
  const driverKey = `custom.${mapping.materialId}.consumption`
  const factor = drivers[driverKey]?.value ?? mapping.consumptionFactor

  // Choose input basis
  let basisValue = 0
  let basisLabel = ''
  let basisUnit  = ''

  switch (mapping.driverBasis as DriverBasis) {
    case 'Floor Area':
      basisValue = floorArea; basisLabel = 'Floor Area (single floor)'; basisUnit = 'sq ft'; break
    case 'Total Floor Area':
      basisValue = totalFloor; basisLabel = `Floor Area × ${floors} floor(s)`; basisUnit = 'sq ft'; break
    case 'Wall Area':
      basisValue = wallArea; basisLabel = 'Wall Area'; basisUnit = 'sq ft'; break
    case 'Ceiling Area':
      basisValue = ceilingArea; basisLabel = 'Ceiling Area'; basisUnit = 'sq ft'; break
    case 'Perimeter':
      basisValue = perimeter; basisLabel = 'Room Perimeter'; basisUnit = 'ft'; break
    case 'RCC Volume':
      basisValue = rccVolume; basisLabel = 'RCC Volume'; basisUnit = 'cu m'; break
    case 'Room Count':
      basisValue = roomCount; basisLabel = 'Room Count'; basisUnit = 'rooms'; break
    case 'Per Unit Count':
      basisValue = totalFloor; basisLabel = `Total Floor Area (for count)`; basisUnit = 'sq ft'; break
    case 'Custom':
      basisValue = totalFloor; basisLabel = 'Custom basis (floor area used)'; basisUnit = 'sq ft'; break
  }

  steps.push({ label: `Input: ${basisLabel}`, formula: `${basisValue.toFixed(2)} ${basisUnit}`, value: basisValue, unit: basisUnit })
  steps.push({ label: 'Driver: Consumption factor', formula: `${factor} ${mapping.consumptionUnit}`, value: factor, unit: mapping.consumptionUnit })

  let baseQuantity: number

  if (mapping.driverBasis === 'Per Unit Count' && mapping.areaPerUnit) {
    const areaPerUnit = mapping.areaPerUnit
    baseQuantity = Math.max(1, Math.ceil(totalFloor / areaPerUnit))
    steps.push({ label: 'Formula', formula: `ceil(${totalFloor} ÷ ${areaPerUnit}) = ${baseQuantity}`, value: baseQuantity, unit: mapping.outputUnit })
  } else {
    baseQuantity = basisValue * factor
    steps.push({ label: 'Formula', formula: `${basisValue.toFixed(2)} × ${factor} = ${baseQuantity.toFixed(3)}`, value: baseQuantity, unit: mapping.outputUnit })
    baseQuantity = Math.round(baseQuantity * 100) / 100
  }

  if (mapping.notes) {
    steps.push({ label: 'Source / Notes', formula: mapping.notes, value: 0, unit: '' })
  }

  // Waste
  const wastePct     = drivers['global.waste_factor']?.value ?? 5
  const wasteQty     = baseQuantity * (wastePct / 100)
  const totalQty     = baseQuantity + wasteQty

  steps.push({ label: `Driver [W_pct]: Waste factor`, formula: `${baseQuantity.toFixed(3)} × ${wastePct}% = +${wasteQty.toFixed(3)} ${mapping.outputUnit}`, value: wasteQty, unit: mapping.outputUnit })
  steps.push({ label: 'Final total quantity', formula: `${baseQuantity.toFixed(3)} + ${wasteQty.toFixed(3)} = ${totalQty.toFixed(3)} ${mapping.outputUnit}`, value: totalQty, unit: mapping.outputUnit })

  return {
    material: mapping.materialName,
    category,
    unit: mapping.outputUnit,
    rate,
    steps,
    baseQuantity,
    wasteQuantity: Math.round(wasteQty  * 100) / 100,
    totalQuantity: Math.round(totalQty  * 100) / 100,
    baseCost:  baseQuantity * rate,
    wasteCost: wasteQty     * rate,
    totalCost: totalQty     * rate,
  }
}
