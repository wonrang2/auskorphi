import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

// ── CSV parser (handles quoted fields) ───────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function generateSKU(name, existingSKUs) {
  const base = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 20);
  if (!existingSKUs.has(base)) { existingSKUs.add(base); return base; }
  let n = 2;
  while (existingSKUs.has(`${base}-${n}`)) n++;
  const sku = `${base}-${n}`;
  existingSKUs.add(sku);
  return sku;
}

// Column indices in the Auskorphi Inventory Tracker sheet:
// 0  Products (name)
// 1  Category
// 2  Purchase Price (AUD)
// 3  RRP in AUD          [skip]
// 4  Stock Quantity
// 5  Sold Quantity
// 6  Remaining Stock
// 7  Shipping Cost (AUD)
// 8  Total Cost (AUD)    [skip]
// 9  Total Cost (PHP)    [skip]
// 10 Selling Price (PHP)
// 11-17                  [skip]
// 18 Exchange Rate (AUD→PHP)

function parseSheet(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], detectedRate: null, error: 'File appears empty' };

  const skuSet = new Set();
  let detectedRate = null;
  const rows = [];
  const warnings = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[0]?.trim();
    if (!name) continue; // skip blank rows

    const rowRate = parseFloat(cols[18]) || null;
    if (rowRate) detectedRate = rowRate;

    const quantity = parseInt(cols[4]) || 0;
    const sold_quantity = parseInt(cols[5]) || 0;
    const remaining_qty = parseInt(cols[6]);
    const computed_remaining = isNaN(parseInt(cols[6]))
      ? Math.max(0, quantity - sold_quantity)
      : parseInt(cols[6]);

    if (quantity <= 0) {
      warnings.push(`Row ${i + 1} ("${name}"): Stock Quantity is 0 or missing — skipped.`);
      continue;
    }

    rows.push({
      name,
      category:         cols[1]?.trim() || '',
      sku:              generateSKU(name, skuSet),
      unit_price_aud:   parseFloat(cols[2]) || 0,
      quantity,
      sold_quantity:    isNaN(parseInt(cols[5])) ? 0 : parseInt(cols[5]),
      remaining_qty:    computed_remaining,
      shipping_aud:     parseFloat(cols[7]) || 0,
      selling_price_php: parseFloat(cols[10]) || 0,
      exchange_rate:    rowRate, // may be null — filled with user default before send
    });
  }

  return { rows, detectedRate, warnings };
}

// ── Component ─────────────────────────────────────────────────────────────────
const STEPS = { UPLOAD: 'upload', PREVIEW: 'preview', DONE: 'done' };

export default function Import() {
  const [step, setStep]               = useState(STEPS.UPLOAD);
  const [rows, setRows]               = useState([]);
  const [warnings, setWarnings]       = useState([]);
  const [parseError, setParseError]   = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saleDate, setSaleDate]       = useState(new Date().toISOString().slice(0, 10));
  const [defaultRate, setDefaultRate] = useState('');
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState('');
  const [result, setResult]           = useState(null);
  const [dragging, setDragging]       = useState(false);
  const fileRef = useRef();

  const hasSales = rows.some(r => r.sold_quantity > 0);
  const missingRate = rows.some(r => !r.exchange_rate && !parseFloat(defaultRate));

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file. In Google Sheets: File → Download → Comma Separated Values (.csv)');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setParseError('');
      const { rows: parsed, detectedRate, warnings: w, error } = parseSheet(e.target.result);
      if (error) { setParseError(error); return; }
      if (parsed.length === 0) { setParseError('No product rows found in the file.'); return; }
      setRows(parsed);
      setWarnings(w);
      if (detectedRate) setDefaultRate(String(detectedRate));
      setStep(STEPS.PREVIEW);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const rate = parseFloat(defaultRate);
    const finalRows = rows.map(r => ({ ...r, exchange_rate: r.exchange_rate || rate }));

    setImporting(true);
    setImportError('');
    try {
      const res = await api.post('/import', {
        rows: finalRows,
        purchase_date: purchaseDate,
        sale_date: hasSales ? saleDate : null,
      });
      setResult(res.data);
      setStep(STEPS.DONE);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep(STEPS.UPLOAD);
    setRows([]);
    setWarnings([]);
    setParseError('');
    setImportError('');
    setResult(null);
    setDefaultRate('');
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── Step: Upload ────────────────────────────────────────────────────────────
  if (step === STEPS.UPLOAD) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import from Google Sheets</h1>
          <p className="text-sm text-gray-500 mt-1">Import your existing inventory data from the Auskorphi Inventory Tracker sheet</p>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-800">Before you start</h2>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Open your <strong>Inventory Tracker</strong> Google Sheet</li>
            <li>Click <strong>File → Download → Comma Separated Values (.csv)</strong></li>
            <li>Upload that file below</li>
          </ol>
          <p className="text-xs text-gray-400">Only the Inventory Tracker sheet is needed. The Margin Calculator sheet is not imported.</p>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm font-medium text-gray-700">Drop your CSV file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">inventory-tracker.csv</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {parseError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{parseError}</div>
        )}
      </div>
    );
  }

  // ── Step: Preview ───────────────────────────────────────────────────────────
  if (step === STEPS.PREVIEW) {
    const totalSold = rows.reduce((s, r) => s + r.sold_quantity, 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Import</h1>
            <p className="text-sm text-gray-500 mt-1">
              Found <strong>{rows.length}</strong> product{rows.length !== 1 ? 's' : ''} —
              {totalSold > 0 ? ` ${rows.filter(r => r.sold_quantity > 0).length} with sales` : ' no sales to import'}
            </p>
          </div>
          <button onClick={reset} className="btn-secondary text-sm shrink-0">← Change file</button>
        </div>

        {warnings.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 space-y-1">
            <p className="font-semibold">Warnings</p>
            {warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {/* Preview table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3 text-left whitespace-nowrap">Product</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">SKU</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Price (AUD)</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Purchased</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Sold</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Remaining</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Ship (AUD)</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Sell Price (PHP)</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.sku}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{r.category || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.unit_price_aud}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.quantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.sold_quantity > 0
                      ? <span className="text-blue-700 font-medium">{r.sold_quantity}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.remaining_qty}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.shipping_aud || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.sold_quantity > 0
                      ? <span className="text-green-700">₱{r.selling_price_php}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.exchange_rate
                      ? r.exchange_rate
                      : <span className="text-yellow-600 text-xs">uses default</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Import settings */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800">Import settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-1">When were these items purchased?</p>
              <input
                type="date"
                className="input w-full"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </div>

            {hasSales && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Date <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-1">When were the sold items sold?</p>
                <input
                  type="date"
                  className="input w-full"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Exchange Rate
                {rows.some(r => !r.exchange_rate) && <span className="text-red-500"> *</span>}
              </label>
              <p className="text-xs text-gray-400 mb-1">AUD → PHP (used for rows without a rate)</p>
              <input
                type="number"
                step="0.0001"
                className="input w-full"
                value={defaultRate}
                onChange={e => setDefaultRate(e.target.value)}
                placeholder="e.g. 37"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 text-sm text-gray-600 space-y-1">
            <p>✅ <strong>{rows.length}</strong> product{rows.length !== 1 ? 's' : ''} will be created</p>
            <p>✅ <strong>{rows.length}</strong> purchase batch{rows.length !== 1 ? 'es' : ''} will be created</p>
            {hasSales && (
              <p>✅ <strong>{rows.filter(r => r.sold_quantity > 0).length}</strong> historical sale record{rows.filter(r => r.sold_quantity > 0).length !== 1 ? 's' : ''} will be created</p>
            )}
            <p className="text-xs text-gray-400 pt-1">If a product with the same name already exists, its batch will be added to the existing product instead of creating a duplicate.</p>
          </div>

          {missingRate && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              Some rows have no exchange rate. Please enter a Default Exchange Rate above.
            </div>
          )}

          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{importError}</div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={reset} className="btn-secondary">Cancel</button>
            <button
              onClick={handleImport}
              disabled={importing || missingRate || !purchaseDate || (hasSales && !saleDate)}
              className="btn-primary"
            >
              {importing ? 'Importing...' : `Import ${rows.length} product${rows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Done ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-10">
      <div className="text-5xl">✅</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import complete</h1>
        <p className="text-sm text-gray-500 mt-1">Your Google Sheets data is now in Auskorphi</p>
      </div>
      <div className="card text-left space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Products created</span>
          <span className="font-semibold">{result?.products ?? 0}</span>
        </div>
        {result?.skipped_products > 0 && (
          <div className="flex justify-between text-yellow-700">
            <span>Products already existed (reused)</span>
            <span className="font-semibold">{result.skipped_products}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Purchase batches created</span>
          <span className="font-semibold">{result?.batches ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Sales records created</span>
          <span className="font-semibold">{result?.sales ?? 0}</span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/inventory" className="btn-primary text-center">View Inventory</Link>
        <Link to="/dashboard" className="btn-secondary text-center">Go to Dashboard</Link>
      </div>
      <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">
        Import another file
      </button>
    </div>
  );
}
