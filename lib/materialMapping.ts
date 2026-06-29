/**
 * MATERIAL CALCULATION MAPPING
 *
 * Every material in the repository must have a mapping before it is
 * included in estimates. A mapping defines:
 *   - What quantity driver (input surface) to use
 *   - The consumption factor (how much per unit of that surface)
 *   - The formula expressed in human-readable form
 *   - The unit of measurement for the output quantity
 *
 * Built-in materials ship with pre-defined mappings.
 * User-added materials require a mapping to be defined before they
 * become "active" and appear in calculations.
 */

// ─── Driver Basis ────────────────────────────────────────────────────────────
// What input surface/quantity the consumption factor is applied to.

export type DriverBasis =
  | 'Floor Area'      // sq ft of floor area per floor
  | 'Total Floor Area'// sq ft × floors
  | 'Wall Area'       // sq ft of wall area
  | 'Ceiling Area'    // sq ft of ceiling area
  | 'Perimeter'       // linear ft of room perimeter
  | 'RCC Volume'      // cu m of concrete volume
  | 'Room Count'      // number of rooms
  | 'Per Unit Count'  // direct count (1 per X sq ft)
  | 'Custom'          // user defines the formula fully

export const DRIVER_BASIS_OPTIONS: DriverBasis[] = [
  'Floor Area',
  'Total Floor Area',
  'Wall Area',
  'Ceiling Area',
  'Perimeter',
  'RCC Volume',
  'Room Count',
  'Per Unit Count',
  'Custom',
]

export const DRIVER_BASIS_DESCRIPTIONS: Record<DriverBasis, string> = {
  'Floor Area':       'Floor area of one floor (sq ft). For finishes applied per floor.',
  'Total Floor Area': 'Floor area × number of floors (sq ft). For structural materials spanning all floors.',
  'Wall Area':        'Total wall surface area (sq ft). For paints, plaster, cladding.',
  'Ceiling Area':     'Ceiling area (same as floor area). For ceiling finishes.',
  'Perimeter':        'Room perimeter in linear feet. For skirting, cornices, border tiles.',
  'RCC Volume':       'Volume of concrete in cu m. For materials tied to concrete work.',
  'Room Count':       'Number of rooms. For fixtures counted per room.',
  'Per Unit Count':   '1 item per X sq ft of floor area. For doors, windows, light points.',
  'Custom':           'User writes the full formula description manually.',
}

// ─── Mapping Status ──────────────────────────────────────────────────────────

export type MappingStatus = 'mapped' | 'unmapped' | 'inactive'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MaterialMapping {
  materialId:        string        // links to RepositoryMaterial.id
  materialName:      string        // denormalized for display
  status:            MappingStatus

  // What the user defines
  outputUnit:        string        // unit of the calculated quantity (Bag, kg, m, etc.)
  driverBasis:       DriverBasis   // which input surface to use
  consumptionFactor: number        // e.g. 0.40 m per sq ft
  consumptionUnit:   string        // unit of the factor (e.g. "m / sq ft")
  formula:           string        // human-readable: e.g. "Total Floor Area × 0.40 m/sqft"
  notes:             string        // user's optional explanation / source

  // For 'Per Unit Count' basis
  areaPerUnit?:      number        // e.g. 120 sq ft per door

  // For 'Custom' basis
  customFormula?:    string        // free-text formula

  // Metadata
  createdAt:         string
  updatedAt:         string
  isBuiltIn:         boolean       // true = shipped with the system, cannot be deleted
}

// ─── Built-in Mappings ───────────────────────────────────────────────────────
// One mapping per built-in material. These are pre-defined and locked,
// but the consumption factors can be overridden via the Quantity Drivers panel.

export const BUILTIN_MAPPINGS: MaterialMapping[] = [
  {
    materialId: 'cement', materialName: 'Cement', status: 'mapped',
    outputUnit: 'Bag', driverBasis: 'Total Floor Area',
    consumptionFactor: 0.40, consumptionUnit: 'Bags / sq ft',
    formula: 'Total Floor Area × 0.40 Bags/sqft × Quality Multiplier × Structure Factor',
    notes: 'IS:456:2000 M20 mix. Factor adjustable via Quantity Drivers → cement.base_ratio (currently per 1000 sqft, so effective rate = base_ratio/1000).',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'sand', materialName: 'Sand', status: 'mapped',
    outputUnit: 'cu ft', driverBasis: 'Total Floor Area',
    consumptionFactor: 1.80, consumptionUnit: 'cu ft / sq ft',
    formula: 'Total Floor Area × 1.80 cu ft/sqft × Wall Thickness Factor',
    notes: 'IS:2116:1980. Covers masonry mortar, plaster, and concrete sand. Adjustable via sand.base_ratio driver.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'aggregate', materialName: 'Aggregate', status: 'mapped',
    outputUnit: 'cu ft', driverBasis: 'Total Floor Area',
    consumptionFactor: 2.20, consumptionUnit: 'cu ft / sq ft',
    formula: 'Total Floor Area × 2.20 cu ft/sqft × Structure Factor',
    notes: '20mm downgraded coarse aggregate. IS:456 M20 mix 1:1.5:3. Adjustable via aggregate.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'steel', materialName: 'Steel', status: 'mapped',
    outputUnit: 'Kg', driverBasis: 'Total Floor Area',
    consumptionFactor: 4.00, consumptionUnit: 'Kg / sq ft',
    formula: 'Total Floor Area × 4.00 Kg/sqft × Quality Multiplier × Structure Factor',
    notes: 'TMT Fe-500 bars. IS:456:2000, SP:34. Typical residential RCC. Adjustable via steel.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'bricks', materialName: 'Bricks', status: 'mapped',
    outputUnit: 'nos', driverBasis: 'Total Floor Area',
    consumptionFactor: 8.00, consumptionUnit: 'nos / sq ft',
    formula: 'Total Floor Area × 8.00 nos/sqft × Wall Thickness Factor',
    notes: 'Standard modular 190×90×90mm brick. IS:1905:1987. Adjustable via bricks.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'blocks', materialName: 'Blocks', status: 'mapped',
    outputUnit: 'nos', driverBasis: 'Total Floor Area',
    consumptionFactor: 2.00, consumptionUnit: 'nos / sq ft',
    formula: 'Total Floor Area × 2.00 nos/sqft × Wall Thickness Factor',
    notes: 'AAC/Hollow concrete blocks 600×200×200mm. Adjustable via blocks.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'concrete', materialName: 'Concrete', status: 'mapped',
    outputUnit: 'cu m', driverBasis: 'Total Floor Area',
    consumptionFactor: 0.12, consumptionUnit: 'cu m / sq ft',
    formula: 'Total Floor Area × 0.12 cu m/sqft × Structure Factor',
    notes: 'RMC/site concrete for footings, columns, beams, slabs. IS:456. Adjustable via concrete.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'water', materialName: 'Water', status: 'mapped',
    outputUnit: 'Litre', driverBasis: 'Total Floor Area',
    consumptionFactor: 15.00, consumptionUnit: 'Litres / sq ft',
    formula: 'Total Floor Area × 15.00 L/sqft',
    notes: '28-day curing + mixing water. IS:456:2000. Adjustable via water.base_ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'tiles', materialName: 'Tiles', status: 'mapped',
    outputUnit: 'sq ft', driverBasis: 'Floor Area',
    consumptionFactor: 0.85, consumptionUnit: 'sq ft tiled / sq ft floor',
    formula: 'Floor Area × 0.85 (coverage) × (1 + 0.10 waste)',
    notes: '85% of floor area is tiled. 10% cutting waste. Adjustable via tiles.floor_coverage and tiles.waste_factor.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'paint', materialName: 'Paint', status: 'mapped',
    outputUnit: 'Litre', driverBasis: 'Floor Area',
    consumptionFactor: 3.50, consumptionUnit: 'paintable sq ft / floor sq ft',
    formula: 'Floor Area × 3.50 (walls + ceiling) × 0.14 L/sqft',
    notes: 'Walls + ceiling ≈ 3.5× floor area. 0.14 L/sqft for 2 coats primer + finish. Adjustable via paint drivers.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'electrical-conduits', materialName: 'Electrical Conduits', status: 'mapped',
    outputUnit: 'm', driverBasis: 'Total Floor Area',
    consumptionFactor: 0.40, consumptionUnit: 'm / sq ft',
    formula: 'Total Floor Area × 0.40 m/sqft',
    notes: 'PVC conduit for light + power points. NBC 2016 Part 8. Adjustable via electrical_conduits.ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'wiring', materialName: 'Wiring', status: 'mapped',
    outputUnit: 'm', driverBasis: 'Total Floor Area',
    consumptionFactor: 0.80, consumptionUnit: 'm / sq ft',
    formula: 'Total Floor Area × 0.80 m/sqft',
    notes: 'Electrical cable (2.5mm² + 1.5mm²). NBC 2016 Part 8. Adjustable via wiring.ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'plumbing-pipes', materialName: 'Plumbing Pipes', status: 'mapped',
    outputUnit: 'm', driverBasis: 'Total Floor Area',
    consumptionFactor: 0.25, consumptionUnit: 'm / sq ft',
    formula: 'Total Floor Area × 0.25 m/sqft',
    notes: 'CPVC/uPVC supply + drainage. NBC 2016 Part 9. Adjustable via plumbing.ratio.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'doors', materialName: 'Doors', status: 'mapped',
    outputUnit: 'nos', driverBasis: 'Per Unit Count',
    consumptionFactor: 1, consumptionUnit: 'per 120 sq ft',
    formula: 'ceil(Total Floor Area ÷ 120)',
    notes: '1 door per 120 sq ft. Adjustable via doors.area_per_door.',
    areaPerUnit: 120,
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'windows', materialName: 'Windows', status: 'mapped',
    outputUnit: 'nos', driverBasis: 'Per Unit Count',
    consumptionFactor: 1, consumptionUnit: 'per 80 sq ft',
    formula: 'ceil(Total Floor Area ÷ 80)',
    notes: '1 window per 80 sq ft. NBC 2016 Part 3. Adjustable via windows.area_per_window.',
    areaPerUnit: 80,
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
  {
    materialId: 'roofing', materialName: 'Roofing', status: 'mapped',
    outputUnit: 'sq ft', driverBasis: 'Floor Area',
    consumptionFactor: 1.05, consumptionUnit: 'sq ft / sq ft floor',
    formula: 'Floor Area × 1.05 (slope + parapet allowance)',
    notes: '5% extra for flat roof parapet and overhang. Adjustable via roofing.slope_factor.',
    createdAt: '2024-01-01', updatedAt: '2024-01-01', isBuiltIn: true,
  },
]
