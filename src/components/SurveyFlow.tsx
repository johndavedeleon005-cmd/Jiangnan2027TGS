import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  User,
  Users,
  Minus,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldOff,
  FileText,
} from 'lucide-react';
import {
  AGE_GROUP_OPTIONS,
  COMPANION_OPTIONS,
  GENDER_OPTIONS,
  LOCATION_OPTIONS,
  OCCUPATION_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  SPEND_BRACKETS,
  TRANSPORT_OPTIONS,
  getLocalDateString,
  type CurrencyCode,
  type SurveyDraft,
  type SurveyResponse,
} from '../types/survey';
import { submitSurveyResponse } from '../utils/surveyStorage';
import {
  AgeGroupIcon,
  CompanionIcon,
  GenderIcon,
  LocationIcon,
  OccupationIcon,
  PaymentMethodIcon,
  RelationshipIcon,
  SpendTierIcon,
  TransportIcon,
  BrandLogo,
} from './Icons';

interface SurveyFlowProps {
  onSubmitted: (response: SurveyResponse) => void;
  onOpenDashboard?: () => void;
}

const INITIAL_DRAFT: SurveyDraft = {
  consent: '',
  name: '',
  gender: '',
  ageGroup: '',
  occupation: '',
  relationshipStatus: '',
  diningWith: '',
  partySize: 2,
  transportMode: '',
  origin: '',
  originOther: '',
  destination: '',
  destinationOther: '',
  currency: 'PHP',
  spendBracket: '',
  customSpend: '',
  paymentMethod: '',
  paymentOther: '',
};

interface StepMeta {
  id: string;
  number: string;
  title: string;
  question: string;
  subtitle: string;
}

const ALL_STEPS: StepMeta[] = [
  {
    id: 'consent',
    number: '01',
    title: 'Consent',
    question: 'Do you consent to participate in this marketing research survey?',
    subtitle: 'Your responses will be used strictly for marketing research purposes.',
  },
  {
    id: 'name',
    number: '02',
    title: 'Your Name',
    question: 'What is your name?',
    subtitle: 'Optional — leave blank if you prefer to stay anonymous.',
  },
  {
    id: 'gender',
    number: '03',
    title: 'Gender',
    question: 'How do you identify?',
    subtitle: 'Select the option that best describes you.',
  },
  {
    id: 'age',
    number: '04',
    title: 'Age',
    question: 'What is your age?',
    subtitle: 'Tap one age range below.',
  },
  {
    id: 'occupation',
    number: '05',
    title: 'Occupation',
    question: 'What is your current occupation status?',
    subtitle: 'Select whether you are a student, employed, or unemployed.',
  },
  {
    id: 'relationship',
    number: '06',
    title: 'Relationship Status',
    question: 'What is your relationship status?',
    subtitle: 'Tap the option that applies to you.',
  },
  {
    id: 'companion',
    number: '07',
    title: 'Dining Group',
    question: 'Are you dining solo, with friends, or with family?',
    subtitle: 'Tell us who is joining your table today.',
  },
  {
    id: 'partySize',
    number: '08',
    title: 'Group Count',
    question: 'How many people are in your group?',
    subtitle: 'Include yourself in the total headcount (pax).',
  },
  {
    id: 'transport',
    number: '09',
    title: 'Arrival Mode',
    question: 'How did you get here today?',
    subtitle: 'Choose whether you arrived by private vehicle or public transport.',
  },
  {
    id: 'origin',
    number: '10',
    title: 'Before Dining',
    question: 'Where were you before you decided to dine with us?',
    subtitle: 'Select the place you were at before deciding to dine with us.',
  },
  {
    id: 'destination',
    number: '11',
    title: 'After Dining',
    question: 'Where are you heading after dining with us?',
    subtitle: 'Select the place you plan to go after dining with us.',
  },
  {
    id: 'spend',
    number: '12',
    title: 'Budget per Pax',
    question: 'How much are you willing to spend per person?',
    subtitle: 'Pick a range or enter an exact budget per pax.',
  },
  {
    id: 'payment',
    number: '13',
    title: 'Payment Mode',
    question: 'What is your preferred mode of payment?',
    subtitle: 'Select the payment option you prefer to use when dining.',
  },
];

export function SurveyFlow({
  onSubmitted,
  onOpenDashboard,
}: SurveyFlowProps) {
  const [draft, setDraft] = useState<SurveyDraft>(INITIAL_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedResponse, setCompletedResponse] = useState<SurveyResponse | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(true);

  const visibleSteps = useMemo(() => {
    if (draft.diningWith === 'Solo') {
      return ALL_STEPS.filter((s) => s.id !== 'partySize');
    }
    return ALL_STEPS;
  }, [draft.diningWith]);

  const currentStep = visibleSteps[Math.min(stepIndex, visibleSteps.length - 1)];
  const progressPercent = Math.round(((stepIndex + 1) / visibleSteps.length) * 100);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const canProceed = useMemo(() => {
    switch (currentStep.id) {
      case 'consent':
        return draft.consent === 'Yes';
      case 'name':
        return true; // optional
      case 'gender':
        return Boolean(draft.gender);
      case 'age':
        return Boolean(draft.ageGroup);
      case 'occupation':
        return Boolean(draft.occupation);
      case 'relationship':
        return Boolean(draft.relationshipStatus);
      case 'companion':
        return Boolean(draft.diningWith);
      case 'partySize':
        return draft.partySize >= 2;
      case 'transport':
        return Boolean(draft.transportMode);
      case 'origin':
        return draft.origin === 'Other' ? draft.originOther.trim().length > 0 : Boolean(draft.origin);
      case 'destination':
        return draft.destination === 'Other'
          ? draft.destinationOther.trim().length > 0
          : Boolean(draft.destination);
      case 'spend': {
        const customNum = Number(draft.customSpend);
        return Boolean(draft.spendBracket) || (draft.customSpend.trim().length > 0 && customNum > 0);
      }
      case 'payment':
        return draft.paymentMethod === 'Other'
          ? draft.paymentOther.trim().length > 0
          : Boolean(draft.paymentMethod);
      default:
        return false;
    }
  }, [currentStep.id, draft]);

  const stepSummary = (stepId: string): string | null => {
    switch (stepId) {
      case 'consent':
        return draft.consent === 'Yes' ? 'Consented' : null;
      case 'name':
        return draft.name.trim() ? draft.name.trim() : null;
      case 'gender':
        return draft.gender || null;
      case 'age':
        return draft.ageGroup || null;
      case 'occupation':
        return draft.occupation || null;
      case 'relationship':
        return draft.relationshipStatus || null;
      case 'companion':
        return draft.diningWith
          ? draft.diningWith === 'Solo'
            ? 'Solo (1 pax)'
            : draft.diningWith
          : null;
      case 'partySize':
        return draft.diningWith && draft.diningWith !== 'Solo'
          ? `${draft.partySize} pax`
          : null;
      case 'transport':
        return draft.transportMode || null;
      case 'origin':
        if (!draft.origin) return null;
        return draft.origin === 'Other'
          ? draft.originOther.trim() || 'Other'
          : draft.origin;
      case 'destination':
        if (!draft.destination) return null;
        return draft.destination === 'Other'
          ? draft.destinationOther.trim() || 'Other'
          : draft.destination;
      case 'spend': {
        if (draft.customSpend.trim()) {
          const sym = draft.currency === 'PHP' ? '₱' : '$';
          return `${sym}${Number(draft.customSpend).toLocaleString()} / pax`;
        }
        return draft.spendBracket || null;
      }
      case 'payment':
        if (!draft.paymentMethod) return null;
        return draft.paymentMethod === 'Other'
          ? draft.paymentOther.trim() || 'Other'
          : draft.paymentMethod;
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (!canProceed) return;
    setErrorMsg(null);
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      void handleSubmit();
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const originFinal =
      draft.origin === 'Other' ? draft.originOther.trim() : draft.origin;
    const destinationFinal =
      draft.destination === 'Other' ? draft.destinationOther.trim() : draft.destination;

    let spendPerPax = draft.spendBracket;
    let spendEstimate = 0;

    if (draft.customSpend.trim()) {
      const numeric = Math.max(0, Number(draft.customSpend));
      const sym = draft.currency === 'PHP' ? '₱' : '$';
      spendPerPax = `${sym}${numeric.toLocaleString()}`;
      spendEstimate = numeric;
    } else {
      const bracket = SPEND_BRACKETS[draft.currency].find(
        (b) => b.label === draft.spendBracket
      );
      spendEstimate = bracket ? bracket.estimate : 0;
    }

    const paymentFinal =
      draft.paymentMethod === 'Other'
        ? draft.paymentOther.trim()
        : draft.paymentMethod;

    try {
      const created = await submitSurveyResponse({
        consent: draft.consent,
        name: draft.name.trim(),
        gender: draft.gender as SurveyResponse['gender'],
        ageGroup: draft.ageGroup as SurveyResponse['ageGroup'],
        occupation: draft.occupation as SurveyResponse['occupation'],
        relationshipStatus:
          draft.relationshipStatus as SurveyResponse['relationshipStatus'],
        diningWith: draft.diningWith as SurveyResponse['diningWith'],
        partySize: draft.diningWith === 'Solo' ? 1 : draft.partySize,
        transportMode: draft.transportMode as SurveyResponse['transportMode'],
        origin: originFinal,
        destination: destinationFinal,
        currency: draft.currency,
        spendPerPax,
        spendEstimate,
        paymentMethod: paymentFinal,
        clientDate: getLocalDateString(new Date()),
      });

      setCompletedResponse(created);
      onSubmitted(created);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Network error while submitting survey.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setDraft(INITIAL_DRAFT);
    setStepIndex(0);
    setErrorMsg(null);
    setCompletedResponse(null);
    setShowPrivacyModal(true);
  };

  if (completedResponse) {
    const submittedTime = new Date(completedResponse.submittedAt).toLocaleTimeString(
      'en-US',
      { hour: 'numeric', minute: '2-digit' }
    );

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-red-600 tracking-wide">
                Response Recorded
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 text-balance">
                Thank you{completedResponse.name ? `, ${completedResponse.name}` : ''}.
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-500 font-mono tabular-nums">
                <span>{completedResponse.submittedDate}</span>
                <span aria-hidden="true">·</span>
                <span>{submittedTime}</span>
                <span aria-hidden="true">·</span>
                <span>{completedResponse.id}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Profile</span>
              <span className="font-medium text-slate-900">
                {completedResponse.gender} · {completedResponse.ageGroup}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-slate-900">
                {completedResponse.occupation} · {completedResponse.relationshipStatus}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Group</span>
              <span className="font-medium text-slate-900 tabular-nums">
                {completedResponse.diningWith} ({completedResponse.partySize} pax)
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Arrival</span>
              <span className="font-medium text-slate-900">
                {completedResponse.transportMode}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Budget / Pax</span>
              <span className="font-medium text-red-600 font-mono tabular-nums">
                {completedResponse.spendPerPax}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 sm:border-b-0">
              <span className="text-slate-500">Payment Mode</span>
              <span className="font-medium text-slate-900">
                {completedResponse.paymentMethod}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 sm:col-span-2">
              <span className="text-slate-500">Journey</span>
              <span className="font-medium text-slate-900 inline-flex items-center gap-1.5">
                <span>{completedResponse.origin}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>{completedResponse.destination}</span>
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Take Another Survey</span>
            </button>
            {onOpenDashboard && (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>View in Dashboard</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const privateModes = TRANSPORT_OPTIONS.filter((t) => t.category === 'Private');
  const publicModes = TRANSPORT_OPTIONS.filter((t) => t.category === 'Public');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 lg:pb-12">
      {/* Data Privacy Notice Modal */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-notice-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-3.5">
              <BrandLogo sizeClass="w-14 h-14" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-600 tracking-wide">
                  Jiang Nan · Respondent Notice
                </p>
                <h2
                  id="privacy-notice-title"
                  className="text-xl font-bold text-slate-900 text-balance"
                >
                  Data Privacy Notice
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                Thank you for taking a moment to share your feedback. All information
                collected in this survey is used{' '}
                <span className="font-semibold text-slate-900">
                  only for marketing research purposes
                </span>
                .
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    Participation is completely voluntary and you may skip providing your
                    name to remain anonymous.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    Responses are analyzed strictly in aggregate for marketing research and
                    will never be sold or shared for unrelated purposes.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                I Understand &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Progress Bar (Mobile & Desktop) */}
      <div className="mb-5 sm:mb-6 bg-white border border-slate-200 rounded-2xl p-4 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-4 text-xs sm:text-sm mb-2.5">
          <div className="flex items-center gap-2 font-medium text-slate-900 tabular-nums">
            <span>
              Step {stepIndex + 1} of {visibleSteps.length}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">{currentStep.title}</span>
          </div>
          <span className="font-mono font-semibold text-red-600 tabular-nums">
            {progressPercent}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Survey completion progress"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}>
          {visibleSteps.map((s, idx) => {
            const answered = Boolean(stepSummary(s.id));
            const current = idx === stepIndex;
            return (
              <div
                key={s.id}
                title={s.title}
                className={`h-1 rounded-full transition-colors ${
                  current
                    ? 'bg-red-500'
                    : idx < stepIndex || answered
                    ? 'bg-red-300'
                    : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Step Rail */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="pb-5 border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>{todayFormatted}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">
                Visitor Dining Survey
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Tap any completed step to review or update your answer.
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 tabular-nums">
                  <span>Progress</span>
                  <span className="font-mono font-medium text-slate-900">
                    {stepIndex + 1}/{visibleSteps.length}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <ol className="mt-4 space-y-1">
              {visibleSteps.map((step, idx) => {
                const isActive = idx === stepIndex;
                const answer = stepSummary(step.id);
                const isReachable = idx <= stepIndex || Boolean(answer);

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={!isReachable}
                      onClick={() => isReachable && setStepIndex(idx)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors min-h-[44px] ${
                        isActive
                          ? 'bg-red-50 text-red-900'
                          : isReachable
                          ? 'hover:bg-slate-50 text-slate-700'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-mono font-semibold flex items-center justify-center shrink-0 tabular-nums ${
                            isActive
                              ? 'bg-red-500 text-white'
                              : answer
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {answer && !isActive ? (
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {step.title}
                          </div>
                          {answer && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {answer}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* Question Stage */}
        <section className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-red-600 tabular-nums">
                {currentStep.number}.
              </span>
              <span>{currentStep.title}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" />
                <span>~30 sec total</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mt-2 text-balance">
              {currentStep.question}
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">{currentStep.subtitle}</p>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step Content */}
            <div className="mt-6">
              {currentStep.id === 'consent' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, consent: 'Yes' }))
                      }
                      className={`min-h-[84px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                        draft.consent === 'Yes'
                          ? 'border-red-500 bg-red-50/70 text-slate-900'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            draft.consent === 'Yes'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">Yes, I consent</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Participate for marketing research
                          </div>
                        </div>
                      </div>
                      {draft.consent === 'Yes' && (
                        <Check
                          className="w-5 h-5 text-red-600 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, consent: 'No' }))
                      }
                      className={`min-h-[84px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                        draft.consent === 'No'
                          ? 'border-slate-900 bg-slate-100 text-slate-900'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            draft.consent === 'No'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <ShieldOff className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">No, I do not consent</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Decline without submitting data
                          </div>
                        </div>
                      </div>
                      {draft.consent === 'No' && (
                        <Check
                          className="w-5 h-5 text-slate-900 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>

                  {draft.consent === 'No' && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-600">
                      You have declined to participate. No personal or survey information will
                      be collected or saved. Select &ldquo;Yes, I consent&rdquo; anytime if you
                      would like to proceed.
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 py-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Read Data Privacy Notice</span>
                    </button>
                  </div>
                </div>
              )}

              {currentStep.id === 'name' && (
                <div className="space-y-4">
                  <div className="relative">
                    <User
                      className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, name: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNext();
                      }}
                      placeholder="Type your name (optional)"
                      maxLength={80}
                      autoFocus
                      className="w-full h-14 pl-12 pr-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    If left blank, your submission is logged as Anonymous in the CSV export.
                  </p>
                </div>
              )}

              {currentStep.id === 'gender' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GENDER_OPTIONS.map((option) => {
                    const selected = draft.gender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, gender: option.value }))
                        }
                        className={`min-h-[64px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? 'border-red-500 bg-red-50/70 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <GenderIcon gender={option.value} className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {option.label}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {option.hint}
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <Check
                            className="w-5 h-5 text-red-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentStep.id === 'age' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AGE_GROUP_OPTIONS.map((option) => {
                    const selected = draft.ageGroup === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, ageGroup: option.value }))
                        }
                        className={`min-h-[76px] p-4 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? 'border-red-500 bg-red-50/70 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <AgeGroupIcon ageGroup={option.value} className="w-4 h-4" />
                          </div>
                          {selected && (
                            <Check className="w-4 h-4 text-red-600" aria-hidden="true" />
                          )}
                        </div>
                        <div className="text-sm font-semibold font-mono tabular-nums">
                          {option.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentStep.id === 'occupation' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {OCCUPATION_OPTIONS.map((option) => {
                    const selected = draft.occupation === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, occupation: option.value }))
                        }
                        className={`min-h-[92px] p-4 rounded-xl border text-left flex sm:flex-col items-center sm:items-start justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? 'border-red-500 bg-red-50/70 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between sm:w-full gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <OccupationIcon
                              occupation={option.value}
                              className="w-5 h-5"
                            />
                          </div>
                          {selected && (
                            <Check
                              className="w-5 h-5 text-red-600 hidden sm:block"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {option.hint}
                          </div>
                        </div>
                        {selected && (
                          <Check
                            className="w-5 h-5 text-red-600 sm:hidden shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentStep.id === 'relationship' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RELATIONSHIP_STATUS_OPTIONS.map((option) => {
                    const selected = draft.relationshipStatus === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            relationshipStatus: option.value,
                          }))
                        }
                        className={`min-h-[64px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? 'border-red-500 bg-red-50/70 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <RelationshipIcon
                              status={option.value}
                              className="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {option.label}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {option.hint}
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <Check
                            className="w-5 h-5 text-red-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentStep.id === 'companion' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {COMPANION_OPTIONS.map((option) => {
                    const selected = draft.diningWith === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            diningWith: option.value,
                            partySize:
                              option.value === 'Solo'
                                ? 1
                                : Math.max(2, prev.partySize || 2),
                          }))
                        }
                        className={`min-h-[92px] p-4 rounded-xl border text-left flex sm:flex-col items-center sm:items-start justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                          selected
                            ? 'border-red-500 bg-red-50/70 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between sm:w-full gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <CompanionIcon
                              companion={option.value}
                              className="w-5 h-5"
                            />
                          </div>
                          {selected && (
                            <Check
                              className="w-5 h-5 text-red-600 hidden sm:block"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {option.hint}
                          </div>
                        </div>
                        {selected && (
                          <Check
                            className="w-5 h-5 text-red-600 sm:hidden shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentStep.id === 'partySize' && (
                <div className="space-y-6">
                  {/* Quick Select Chips */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
                    {[2, 3, 4, 5, 6, 7, 8].map((count) => {
                      const selected = draft.partySize === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({ ...prev, partySize: count }))
                          }
                          className={`min-h-[52px] rounded-xl border font-mono text-base font-semibold tabular-nums flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                            selected
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
                          }`}
                        >
                          {count}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper for custom / larger groups */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-red-600">
                        <Users className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          Exact group size
                        </div>
                        <div className="text-xs text-slate-500">
                          Dining with {draft.diningWith.toLowerCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Decrease group size"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            partySize: Math.max(2, prev.partySize - 1),
                          }))
                        }
                        className="w-11 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors"
                      >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="w-12 text-center font-mono text-xl font-bold text-slate-900 tabular-nums">
                        {draft.partySize}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase group size"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            partySize: Math.min(50, prev.partySize + 1),
                          }))
                        }
                        className="w-11 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep.id === 'transport' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 mb-3">
                      Private Vehicle
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {privateModes.map((option) => {
                        const selected = draft.transportMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                transportMode: option.value,
                              }))
                            }
                            className={`min-h-[68px] p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                              selected
                                ? 'border-red-500 bg-red-50/70 text-slate-900'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                selected
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <TransportIcon mode={option.value} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold leading-tight">
                                {option.label}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {option.hint}
                              </div>
                            </div>
                            {selected && (
                              <Check
                                className="w-4 h-4 text-red-600 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <h2 className="text-xs font-semibold text-slate-500 mb-3">
                      Public & Ride-Hailing
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {publicModes.map((option) => {
                        const selected = draft.transportMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                transportMode: option.value,
                              }))
                            }
                            className={`min-h-[68px] p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                              selected
                                ? 'border-red-500 bg-red-50/70 text-slate-900'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                selected
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <TransportIcon mode={option.value} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold leading-tight">
                                {option.label}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {option.hint}
                              </div>
                            </div>
                            {selected && (
                              <Check
                                className="w-4 h-4 text-red-600 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {(currentStep.id === 'origin' || currentStep.id === 'destination') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {LOCATION_OPTIONS.map((option) => {
                      const currentValue =
                        currentStep.id === 'origin' ? draft.origin : draft.destination;
                      const selected = currentValue === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setDraft((prev) =>
                              currentStep.id === 'origin'
                                ? { ...prev, origin: option.value }
                                : { ...prev, destination: option.value }
                            )
                          }
                          className={`min-h-[72px] p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                            selected
                              ? 'border-red-500 bg-red-50/70 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <LocationIcon location={option.value} className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold leading-tight">
                              {option.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {option.hint}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {((currentStep.id === 'origin' && draft.origin === 'Other') ||
                    (currentStep.id === 'destination' &&
                      draft.destination === 'Other')) && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        Specify location
                      </label>
                      <input
                        type="text"
                        value={
                          currentStep.id === 'origin'
                            ? draft.originOther
                            : draft.destinationOther
                        }
                        onChange={(e) =>
                          setDraft((prev) =>
                            currentStep.id === 'origin'
                              ? { ...prev, originOther: e.target.value }
                              : { ...prev, destinationOther: e.target.value }
                          )
                        }
                        placeholder="e.g. Hospital, Gym, School, Friend's house"
                        maxLength={80}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {currentStep.id === 'spend' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-slate-500">
                      Select currency & bracket
                    </span>
                    <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                      {(['PHP', 'USD'] as CurrencyCode[]).map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              currency: curr,
                              spendBracket: '',
                            }))
                          }
                          className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap ${
                            draft.currency === curr
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {curr === 'PHP' ? '₱ PHP' : '$ USD'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SPEND_BRACKETS[draft.currency].map((bracket, idx) => {
                      const selected =
                        draft.spendBracket === bracket.label &&
                        !draft.customSpend.trim();
                      return (
                        <button
                          key={bracket.label}
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              spendBracket: bracket.label,
                              customSpend: '',
                            }))
                          }
                          className={`min-h-[64px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                            selected
                              ? 'border-red-500 bg-red-50/70 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                selected
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <SpendTierIcon index={idx} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold font-mono tabular-nums">
                                {bracket.label}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {bracket.hint}
                              </div>
                            </div>
                          </div>
                          {selected && (
                            <Check
                              className="w-5 h-5 text-red-600 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Or enter an exact amount per pax ({draft.currency})
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-slate-500">
                        {draft.currency === 'PHP' ? '₱' : '$'}
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={draft.customSpend}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            customSpend: e.target.value,
                            spendBracket: e.target.value ? '' : prev.spendBracket,
                          }))
                        }
                        placeholder="e.g. 450"
                        className="w-full h-12 pl-9 pr-4 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep.id === 'payment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAYMENT_METHOD_OPTIONS.map((option) => {
                      const selected = draft.paymentMethod === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              paymentMethod: option.value,
                            }))
                          }
                          className={`min-h-[68px] p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                            selected
                              ? 'border-red-500 bg-red-50/70 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                selected
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <PaymentMethodIcon
                                method={option.value}
                                className="w-5 h-5"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {option.label}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {option.hint}
                              </div>
                            </div>
                          </div>
                          {selected && (
                            <Check
                              className="w-5 h-5 text-red-600 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {draft.paymentMethod === 'Other' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        Specify payment method
                      </label>
                      <input
                        type="text"
                        value={draft.paymentOther}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            paymentOther: e.target.value,
                          }))
                        }
                        placeholder="e.g. Sodexo voucher, Gift certificate, Apple Pay"
                        maxLength={60}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Footer Actions */}
            <div className="hidden lg:flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-3">
                {currentStep.id === 'name' && !draft.name.trim() && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Skip (Stay Anonymous)
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed || isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-45 disabled:pointer-events-none text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <span>
                    {stepIndex === visibleSteps.length - 1
                      ? isSubmitting
                        ? 'Submitting...'
                        : 'Submit Survey'
                      : 'Continue'}
                  </span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Sticky Bottom Bar (< 15% viewport height) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center justify-center gap-1 disabled:opacity-40 whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="flex-1 min-h-[44px] px-5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-45 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <span>
              {stepIndex === visibleSteps.length - 1
                ? isSubmitting
                  ? 'Saving...'
                  : 'Submit Survey'
                : currentStep.id === 'name' && !draft.name.trim()
                ? 'Skip / Continue'
                : 'Continue'}
            </span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
