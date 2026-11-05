import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SchoolRecord, UserSession } from '../types/school';
import { MapPin, Calendar, Download, Printer, ExternalLink, Clock, Compass } from 'lucide-react';

interface RoadmapExportsViewProps {
  schools: SchoolRecord[];
  session: UserSession | null;
}

export const RoadmapExportsView: React.FC<RoadmapExportsViewProps> = ({ schools, session }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('November 2026');
  const [weeklyTarget, setWeeklyTarget] = useState<number>(session?.weeklyTarget || 6);
  const [visitWindowStart, setVisitWindowStart] = useState<string>('09:00');
  const [visitWindowEnd, setVisitWindowEnd] = useState<string>('15:00');

  // Generate weekly grouped plan from schools
  const totalSchools = schools.length;
  const schoolsPerWeek = weeklyTarget;
  const totalWeeks = Math.ceil(totalSchools / schoolsPerWeek) || 0;

  const weeks = totalSchools === 0 ? [] : Array.from({ length: Math.min(totalWeeks, 4) }, (_, wIdx) => {
    const startIdx = wIdx * schoolsPerWeek;
    const weekSchools = schools.slice(startIdx, startIdx + schoolsPerWeek);
    return {
      weekNumber: wIdx + 1,
      dates: `Week ${wIdx + 1} (${new Date().toLocaleString('default', { month: 'short' })} Day ${wIdx * 7 + 1} - ${wIdx * 7 + 7})`,
      schools: weekSchools,
    };
  });

  const handleExportRoadmapExcel = () => {
    const rows = schools.map((s, idx) => ({
      'Roadmap Stop': idx + 1,
      'School Name': s.name,
      'Corridor / Area': s.area,
      'City': s.city,
      'Board': s.board,
      'Enrollment': s.studentEnrollment,
      'Computer Lab Status': s.computerLab || 'Unverified',
      'Computers Count': s.labComputersCount || (s.computerLab === 'Yes' ? 'Available' : '0'),
      'Assigned Officer': s.assignedOfficerName || session?.name || 'Field Officer',
      'Suggested Week': `Week ${Math.floor(idx / weeklyTarget) + 1}`,
      'Maps Link': s.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(`${s.name} ${s.area}`)}`,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Field_Roadmap');
    XLSX.writeFile(wb, `Natton_SkillX_Roadmap_${selectedMonth.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Field Travel & Roadmap Planner</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Monthly, Weekly & Daily School Roadmap
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Calculated route schedules based on corridor proximity, priority rankings, and verified computer lab inspection quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportRoadmapExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Roadmap (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Quota & Capacity Controls */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">Target Planning Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
          >
            <option value="November 2026">November 2026</option>
            <option value="December 2026">December 2026</option>
            <option value="January 2027">January 2027</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">Weekly Quota (Schools / Week)</label>
          <input
            type="number"
            min="1"
            max="25"
            value={weeklyTarget}
            onChange={(e) => setWeeklyTarget(parseInt(e.target.value, 10) || 6)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
          />
        </div>

        <div className="space-y-1">
          <label className="font-bold text-slate-600 block">Daily Field Window</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={visitWindowStart}
              onChange={(e) => setVisitWindowStart(e.target.value)}
              className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="text"
              value={visitWindowEnd}
              onChange={(e) => setVisitWindowEnd(e.target.value)}
              className="w-1/2 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center"
            />
          </div>
        </div>
      </div>

      {/* Weekly Itinerary Cards */}
      <div className="space-y-4">
        {weeks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            No school routes scheduled yet. Upload your school register to generate driving roadmaps.
          </div>
        ) : (
          weeks.map((week) => (
          <div
            key={week.weekNumber}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">{week.dates}</h2>
                <p className="text-xs text-slate-500">
                  {week.schools.length} Campuses scheduled for on-site DPR & computer lab inspection
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-xl">
                {week.schools.filter((s) => s.computerLab === 'Yes').length} Labs Confirmed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 font-bold text-slate-600 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Day Schedule</th>
                    <th className="p-2.5">School Name</th>
                    <th className="p-2.5">Area</th>
                    <th className="p-2.5">Computer Lab</th>
                    <th className="p-2.5">Officer</th>
                    <th className="p-2.5 text-right">Route Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {week.schools.map((school, sIdx) => {
                    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sIdx % 6];
                    return (
                      <tr key={school.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold text-slate-700">
                          {dayName} ({visitWindowStart})
                        </td>
                        <td className="p-2.5 font-black text-slate-900">{school.name}</td>
                        <td className="p-2.5 text-slate-600">{school.area}</td>
                        <td className="p-2.5">
                          {school.computerLab === 'Yes' ? (
                            <span className="text-emerald-700 font-bold">✓ Verified Lab</span>
                          ) : school.computerLab === 'No' ? (
                            <span className="text-rose-700 font-bold">✗ No Lab</span>
                          ) : (
                            <span className="text-amber-700 font-medium">? Unverified</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {school.assignedOfficerName || session?.name || 'Rohan Verma'}
                        </td>
                        <td className="p-2.5 text-right">
                          <a
                            href={school.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(school.name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 font-bold hover:underline inline-flex items-center gap-1"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  );
};
