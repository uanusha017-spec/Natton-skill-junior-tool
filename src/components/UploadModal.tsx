import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { SchoolRecord, PriorityLevel } from '../types/school';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  Sparkles,
  FileCheck2,
  RefreshCw
} from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  onSuccess: (count: number, filename: string, records: SchoolRecord[], csvText: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [allRawRows, setAllRawRows] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rawCsvText, setRawCsvText] = useState<string>('');

  // Detect which row contains the actual table headers
  const findBestHeaderRow = (rows: any[][]): number => {
    let bestRow = 0;
    let highestScore = -1;

    const headerKeywords = [
      'name', 'school', 'schools', 'institution', 'college', 'academy', 'vidyalaya',
      'sl', 'sno', 'no', 'code', 'udise', 'area', 'locality', 'route', 'corridor',
      'hubli', 'dharwad', 'address', 'phone', 'contact', 'board', 'lab', 'computer'
    ];

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r] || [];
      const nonBlank = row.filter((c: any) => c !== undefined && String(c).trim() !== '');
      if (nonBlank.length < 2) continue; // Skip title banners with only 1 column

      // If the first cell is a raw numeric index like 1, 2, 3 and no header keywords in row 0, it's likely a data row
      const firstCell = String(row[0] || '').trim();
      const isFirstCellPureNumber = /^\d+$/.test(firstCell);

      let score = nonBlank.length * 2;
      for (const cell of nonBlank) {
        const text = String(cell).toLowerCase();
        if (headerKeywords.some((kw) => text.includes(kw))) {
          score += 15;
        }
      }

      // Penalize rows where column 0 is a number and no header labels exist
      if (isFirstCellPureNumber) {
        score -= 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestRow = r;
      }
    }

    return bestRow;
  };

  // Auto-map columns from headers & sample values
  const autoMapColumns = (rawHeaders: string[], dataRows: any[][]): Record<string, string> => {
    const mapping: Record<string, string> = {};

    rawHeaders.forEach((header) => {
      const h = header.toLowerCase().trim();

      // School Name
      if (
        !mapping['name'] &&
        (
          /\b(schools?|institutions?|campuss?|colleges?|academ(?:y|ies)|vidyalayas?|shalas?|institutes?|centers?|centres?|particulars|names?)\b/i.test(h) ||
          /school|institution|college|academy|vidyalaya|particulars/i.test(h) ||
          /ಶಾಲೆಯ|ಶಾಲೆ|ವಿದ್ಯಾಲಯ|ಹೆಸರು|ಸ್ಕೂಲ್|ಸಂಸ್ಥೆ|ವಿವರ|ವಿದ್ಯಾನಿಕೇತನ|shale/i.test(h) ||
          /स्कूल|विद्यालय|नाम/i.test(h)
        ) &&
        !/contact.*name|principal|headmaster|headmistress|incharge|officer|owner|father|student/i.test(h)
      ) {
        mapping['name'] = header;
      }

      // UDISE / Code
      if (
        !mapping['code'] &&
        (/udise|school.*code|school.*id|\bcode\b|reg.*no|sl.*no|s\.no|\bsl\b|\bno\b|\b#\b|roll/i.test(h))
      ) {
        mapping['code'] = header;
      }

      // Area / Locality / Route
      if (
        !mapping['area'] &&
        (/area|locality|location|route|hubli|dharwad|place|taluk|district|cluster|block|address|corridor|zone/i.test(h))
      ) {
        mapping['area'] = header;
      }

      // Board
      if (
        !mapping['board'] &&
        (/board|curriculum|affiliation|category|type|medium/i.test(h))
      ) {
        mapping['board'] = header;
      }

      // City
      if (
        !mapping['city'] &&
        (/city|town|district|taluk/i.test(h))
      ) {
        mapping['city'] = header;
      }

      // Computer Lab
      if (
        !mapping['computerLab'] &&
        (/(?:computer|ict|it)[\s_-]*lab|computer[\s_-]*facility|\blab\b/i.test(h)) &&
        !/source|url|date|note/i.test(h)
      ) {
        mapping['computerLab'] = header;
      }

      // Website
      if (
        !mapping['website'] &&
        (/website|web|url|domain|portal|link/i.test(h))
      ) {
        mapping['website'] = header;
      }

      // Phone
      if (
        !mapping['phone'] &&
        (/phone|mobile|contact.*no|cell|tel|telephone/i.test(h))
      ) {
        mapping['phone'] = header;
      }

      // Contact Person
      if (
        !mapping['contact'] &&
        (/contact.*person|principal|headmaster|headmistress|incharge|hm\b/i.test(h))
      ) {
        mapping['contact'] = header;
      }
    });

    // If School Name is still not detected, scan sample row values across columns
    if (!mapping['name'] && rawHeaders.length > 0) {
      let bestNameCol = -1;
      let highestNameScore = -1;

      if (dataRows && dataRows.length > 0) {
        for (let col = 0; col < rawHeaders.length; col++) {
          let schoolWordMatches = 0;
          let totalLength = 0;
          let count = 0;

          for (let row = 0; row < Math.min(dataRows.length, 15); row++) {
            const val = String(dataRows[row]?.[col] || '').trim();
            if (!val) continue;
            count++;
            totalLength += val.length;

            if (
              /\b(school|vidyalaya|academy|high|primary|convent|kps|ghps|glps|college|institute|hubli|dharwad|public|english|kannada|medium|samiti|trust|shikshana)\b/i.test(val)
            ) {
              schoolWordMatches += 6;
            }
          }

          const avgLen = count > 0 ? totalLength / count : 0;
          const lengthScore = avgLen >= 12 && avgLen <= 90 ? 4 : avgLen > 3 ? 1 : 0;
          const score = schoolWordMatches + lengthScore;

          if (score > highestNameScore) {
            highestNameScore = score;
            bestNameCol = col;
          }
        }
      }

      if (bestNameCol !== -1 && highestNameScore > 0) {
        mapping['name'] = rawHeaders[bestNameCol];
      } else {
        // Fallback to column 1 if column 0 is numeric/short, else column 0
        const defaultIdx = rawHeaders.length > 1 ? 1 : 0;
        mapping['name'] = rawHeaders[defaultIdx];
      }
    } else if (!mapping['name'] && rawHeaders.length > 0) {
      mapping['name'] = rawHeaders[rawHeaders.length > 1 ? 1 : 0];
    }

    return mapping;
  };

  const processWorkbookRows = (rows: any[][], customHeaderIdx?: number) => {
    if (!rows || rows.length === 0) return;

    const bestRow = customHeaderIdx !== undefined ? customHeaderIdx : findBestHeaderRow(rows);
    setHeaderRowIdx(bestRow);

    // Extract headers from bestRow
    const rawHeaderRow = rows[bestRow] || [];
    const sanitizedHeaders: string[] = [];
    const seen = new Set<string>();

    for (let c = 0; c < rawHeaderRow.length; c++) {
      let h = String(rawHeaderRow[c] || '').trim();
      if (!h) h = `Column ${c + 1}`;
      let uniqueH = h;
      let counter = 2;
      while (seen.has(uniqueH.toLowerCase())) {
        uniqueH = `${h} (${counter++})`;
      }
      seen.add(uniqueH.toLowerCase());
      sanitizedHeaders.push(uniqueH);
    }

    // Extract data rows beneath header
    const dataRows = rows.slice(bestRow + 1).filter((r) =>
      r && r.some((c: any) => c !== undefined && String(c).trim() !== '')
    );

    setHeaders(sanitizedHeaders);
    setParsedRows(dataRows);

    const mapping = autoMapColumns(sanitizedHeaders, dataRows);
    setDetectedColumns(mapping);
    setError('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!jsonRows || jsonRows.length < 2) {
          setError('The uploaded spreadsheet contains no data rows or missing headers.');
          setIsProcessing(false);
          return;
        }

        setAllRawRows(jsonRows);
        processWorkbookRows(jsonRows);

        const csv = XLSX.utils.sheet_to_csv(worksheet);
        setRawCsvText(csv);
        setIsProcessing(false);
      } catch (err: any) {
        setError(`Failed to parse file: ${err?.message || 'Unsupported format'}`);
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Could not read the uploaded file.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleHeaderRowChange = (newIdx: number) => {
    setHeaderRowIdx(newIdx);
    if (allRawRows.length > 0) {
      processWorkbookRows(allRawRows, newIdx);
    }
  };

  const handleColumnMappingChange = (fieldKey: string, selectedHeader: string) => {
    setDetectedColumns((prev) => ({
      ...prev,
      [fieldKey]: selectedHeader,
    }));
    if (fieldKey === 'name' && selectedHeader) {
      setError('');
    }
  };

  const handleConfirmImport = () => {
    if (!parsedRows.length) {
      setError('No school rows found in this sheet.');
      return;
    }

    // Auto-resolve School Name column: never block with an error!
    let schoolNameHeader = detectedColumns['name'];
    if (!schoolNameHeader || headers.indexOf(schoolNameHeader) === -1) {
      schoolNameHeader = headers[1] || headers[0];
      setDetectedColumns((prev) => ({ ...prev, name: schoolNameHeader }));
    }

    const nameColIdx = headers.indexOf(schoolNameHeader);

    const newSchools: SchoolRecord[] = parsedRows.map((row, idx) => {
      const getVal = (fieldKey: string) => {
        const colHeader = detectedColumns[fieldKey];
        if (!colHeader) return '';
        const colIdx = headers.indexOf(colHeader);
        return colIdx !== -1 && row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
      };

      const extractedName = nameColIdx !== -1 && row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : '';
      const rawName = extractedName || `School ${idx + 1}`;
      const code = getVal('code') || `SCH-${Date.now()}-${idx + 1}`;
      const area = getVal('area') || (fileName.toLowerCase().includes('hubli') ? 'Hubli' : 'Hubli-Dharwad');
      const city = getVal('city') || (fileName.toLowerCase().includes('hubli') ? 'Hubli' : 'Hubli-Dharwad');
      const board = getVal('board') || 'State Board / CBSE';
      const website = getVal('website');
      const rawLab = getVal('computerLab');

      // Preserve all original columns in uploadedData
      const uploadedData: Record<string, string> = {};
      headers.forEach((h, cIdx) => {
        if (row[cIdx] !== undefined) {
          uploadedData[h] = String(row[cIdx]).trim();
        }
      });

      // Priority calculation
      const priorityLevel: PriorityLevel = idx < 12 ? 'P1_CRITICAL' : idx < 28 ? 'P2_HIGH' : 'P3_MEDIUM';
      const priorityScore = Math.max(40, 100 - idx * 2);

      let parsedLab: 'Yes' | 'No' | undefined = undefined;
      if (rawLab) {
        if (/yes|available|present|true|1/i.test(rawLab)) parsedLab = 'Yes';
        else if (/no|absent|none|nil|false|0/i.test(rawLab)) parsedLab = 'No';
      }

      return {
        id: `sch-imp-${Date.now()}-${idx + 1}`,
        code,
        name: rawName,
        board,
        category: 'Secondary / High School',
        industry: 'Education',
        area,
        city,
        state: 'Karnataka',
        pincode: getVal('pincode') || '580020',
        website: website || undefined,
        mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${rawName} ${area} ${city}`)}`,
        contactPerson: getVal('contact') || 'Principal Office',
        contactPhone: getVal('phone') || '+91 836 000 0000',
        totalVisitsCount: 0,
        daysSinceLastVisit: 65,
        studentEnrollment: 1250,
        priorityLevel,
        priorityScore,
        targetPriorityReason: `Uploaded in ${fileName}. Queued for automated computer lab verification and route planning.`,
        computerLab: parsedLab,
        computerLabCheckStatus: 'QUEUED',
        uploadedReviewCount: 'Pending',
        uploadedData,
        source: 'USER_UPLOAD',
      };
    });

    onSuccess(newSchools.length, fileName, newSchools, rawCsvText);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Sl No': '1',
        'School Name': 'K.L.E. Society English Medium School',
        'UDISE Code': '29090101101',
        'Area': 'Vidyanagar',
        'City': 'Hubli',
        'Board': 'CBSE',
        'Computer Lab': 'Yes',
        'Website': 'https://kleschoolhubli.edu.in',
        'Contact Person': 'S. R. Patil',
        'Phone': '+91 836 237 2200',
      },
      {
        'Sl No': '2',
        'School Name': 'St. Pauls High School',
        'UDISE Code': '29090101102',
        'Area': 'Keshwapur',
        'City': 'Hubli',
        'Board': 'State Board',
        'Computer Lab': 'Yes',
        'Website': '',
        'Contact Person': 'Fr. Joseph',
        'Phone': '+91 836 226 3450',
      },
      {
        'Sl No': '3',
        'School Name': 'Government Model High School (GMHS Hubli)',
        'UDISE Code': '29090101103',
        'Area': 'Old Hubli',
        'City': 'Hubli',
        'Board': 'State Board',
        'Computer Lab': 'No',
        'Website': '',
        'Contact Person': 'Headmaster',
        'Phone': '+91 836 228 1122',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hubli_Schools');
    XLSX.writeFile(wb, 'Sample_Hubli_Schools_Template.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Import School Register (.xlsx / .csv)</h2>
              <p className="text-xs text-slate-400">
                Upload your school list to automatically discover computer labs & build roadmaps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Dropzone / File Status Card */}
          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-all group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs mb-2">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800 text-sm">
                Click or drag Excel / CSV file here to import
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, and .csv formats</p>
            </div>
          ) : (
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-slate-900 text-xs sm:text-sm break-all">
                    {fileName}
                  </div>
                  <div className="text-[11px] text-blue-700 font-bold flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    <span>{parsedRows.length} School Records Ready to Import</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setFileName('');
                  setParsedRows([]);
                  setHeaders([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="self-end sm:self-center px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Change File</span>
              </button>
            </div>
          )}

          {/* If file is uploaded, show Column Mapping Card */}
          {parsedRows.length > 0 && headers.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    Column Mapping & Verification Settings
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Auto-Configured
                </span>
              </div>

              {/* Header Row Selector */}
              {allRawRows.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Header Row in File:</span>
                    <span className="text-[10px] text-slate-500">
                      Row {headerRowIdx + 1} contains column headers
                    </span>
                  </div>
                  <select
                    value={headerRowIdx}
                    onChange={(e) => handleHeaderRowChange(parseInt(e.target.value, 10))}
                    className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 text-xs cursor-pointer max-w-full sm:max-w-[260px] truncate"
                  >
                    {allRawRows.slice(0, 8).map((_, rIdx) => (
                      <option key={rIdx} value={rIdx}>
                        Row {rIdx + 1}: {allRawRows[rIdx]?.filter(Boolean).slice(0, 3).join(', ')}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Selectors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Primary: School Name Column */}
                <div className="p-3 bg-white border-2 border-blue-500 rounded-xl space-y-1 shadow-2xs">
                  <label className="font-bold text-blue-950 text-xs flex items-center justify-between">
                    <span>School Name Column *</span>
                    <span className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" /> Auto-Selected
                    </span>
                  </label>
                  <select
                    value={detectedColumns['name'] || headers[1] || headers[0] || ''}
                    onChange={(e) => handleColumnMappingChange('name', e.target.value)}
                    className="w-full p-2 bg-blue-50/50 border border-blue-400 rounded-lg font-bold text-slate-900 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Sample: {parsedRows[0]?.[headers.indexOf(detectedColumns['name'] || headers[1] || headers[0])] || 'DPS, KLE Society...'}
                  </span>
                </div>

                {/* Area / Route Column */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    Area / Route / Locality Column
                  </label>
                  <select
                    value={detectedColumns['area'] || ''}
                    onChange={(e) => handleColumnMappingChange('area', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs cursor-pointer"
                  >
                    <option value="">-- Optional (Auto-detect) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Neighborhood corridor or Hubli route
                  </span>
                </div>

                {/* UDISE / Code Column */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    UDISE / Code Column
                  </label>
                  <select
                    value={detectedColumns['code'] || ''}
                    onChange={(e) => handleColumnMappingChange('code', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs cursor-pointer"
                  >
                    <option value="">-- Optional (Auto-generate) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Computer Lab Column */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">
                    Computer Lab Status Column
                  </label>
                  <select
                    value={detectedColumns['computerLab'] || ''}
                    onChange={(e) => handleColumnMappingChange('computerLab', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs cursor-pointer"
                  >
                    <option value="">-- Auto-verify via Web if blank --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Rows Preview */}
              <div className="space-y-1.5 pt-1">
                <span className="font-bold text-slate-600 text-[11px] block">
                  First 3 Schools Preview:
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">School Name</th>
                        <th className="p-2">Area / Route</th>
                        <th className="p-2">Lab Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 3).map((r, i) => {
                        const nameHeader = detectedColumns['name'] || headers[1] || headers[0];
                        const areaHeader = detectedColumns['area'];
                        const labHeader = detectedColumns['computerLab'];

                        const nameIdx = headers.indexOf(nameHeader);
                        const areaIdx = areaHeader ? headers.indexOf(areaHeader) : -1;
                        const labIdx = labHeader ? headers.indexOf(labHeader) : -1;

                        return (
                          <tr key={i}>
                            <td className="p-2 font-mono text-slate-400">{i + 1}</td>
                            <td className="p-2 font-bold text-slate-900">
                              {nameIdx !== -1 && r[nameIdx] ? String(r[nameIdx]) : `School ${i + 1}`}
                            </td>
                            <td className="p-2 text-slate-600">
                              {areaIdx !== -1 && r[areaIdx] ? String(r[areaIdx]) : 'Hubli'}
                            </td>
                            <td className="p-2 text-slate-500">
                              {labIdx !== -1 && r[labIdx] ? String(r[labIdx]) : 'Auto-verify'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Download Sample */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-100 rounded-2xl text-xs">
            <span className="text-slate-600 font-medium">Need a sample Hubli route spreadsheet?</span>
            <button
              onClick={handleDownloadSample}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 font-bold rounded-xl text-blue-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Hubli Sample</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parsedRows.length || isProcessing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Confirm & Import {parsedRows.length > 0 ? `(${parsedRows.length} Schools)` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
