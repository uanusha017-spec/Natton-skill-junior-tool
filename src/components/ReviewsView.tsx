import React, { useState } from 'react';
import { SchoolRecord, SchoolReview, UserSession } from '../types/school';
import { store } from '../services/store';
import { Star, Plus, CheckCircle2, MessageSquare, ShieldCheck } from 'lucide-react';

interface ReviewsViewProps {
  schools: SchoolRecord[];
  reviews: SchoolReview[];
  session: UserSession | null;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({ schools, reviews, session }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.id || '');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [labVerified, setLabVerified] = useState<boolean>(true);
  const [success, setSuccess] = useState<string>('');

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return;

    store.addReview({
      schoolId: selectedSchool.id,
      schoolName: selectedSchool.name,
      reviewerName: session?.name || 'Field Officer',
      reviewerRole: session?.designation || 'Field Outreach Executive',
      rating,
      comment: comment || 'Verified campus facilities and computer laboratory.',
      computerLabVerified: labVerified,
    });

    setSuccess(`Review saved for ${selectedSchool.name}!`);
    setTimeout(() => setSuccess(''), 3000);
    setComment('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Field Observations & Quality Audits</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            School Reviews & Infrastructure Ratings
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl">
            Audit logs from field representatives evaluating campus readiness, computer lab hardware condition, and institutional receptivity.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 bg-slate-100 rounded-xl text-slate-700">
          {reviews.length} Verified Reviews
        </span>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 font-bold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Review Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-black text-slate-900">Add Field Review & Lab Rating</h2>

          <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Select School</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.area})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Infrastructure Rating (1-5)</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-600 ml-2">{rating} / 5 Stars</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border rounded-2xl">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={labVerified}
                  onChange={(e) => setLabVerified(e.target.checked)}
                  className="rounded"
                />
                <span>Computer Lab was physically inspected during this visit</span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Review Feedback & Lab Assessment</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Observed 30 systems, internet was working, met IT teacher..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Post Field Review
            </button>
          </form>
        </div>

        {/* Reviews Feed */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">
            Published Field Reviews
          </h2>

          <div className="space-y-3 overflow-y-auto max-h-[600px]">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-4 rounded-2xl border bg-slate-50/50 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">{rev.schoolName}</h3>
                    <p className="text-[11px] text-slate-500">
                      Reviewed by {rev.reviewerName} ({rev.reviewerRole})
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100">
                  "{rev.comment}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-emerald-700 font-bold">
                    {rev.computerLabVerified ? '✓ Computer Lab Checked' : 'General Campus Review'}
                  </span>
                  <span>{new Date(rev.reviewedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
