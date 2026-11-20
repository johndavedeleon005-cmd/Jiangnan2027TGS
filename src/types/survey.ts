export const BRANCH_OPTIONS = [
  'BANAWE',
  'BF HOMES',
  'NU MOA',
  'HOLY SPIRIT',
  'HEMADY',
  'PASEO CENTER',
  'FAME MALL',
  'SM EAST ORTIGAS',
  'SM MARILAO',
  'SM MARIKINA',
  'SM FAIRVIEW',
  'STA ROSA',
  'SMDC TAGAYTAY',
  'SM SUCAT',
  'GIL FERNANDO',
  'ORTIGAS CENTER',
  'EASTWOOD CITY',
  'SM CLARK',
  'SM NORTH EDSA',
  'GH PROMENADE',
  'SOUTHMALL',
] as const;

export type BranchOption = (typeof BRANCH_OPTIONS)[number];

export function isValidBranchOption(value: unknown): value is BranchOption {
  return (
    typeof value === 'string' &&
    (BRANCH_OPTIONS as readonly string[]).includes(value)
  );
}

export function normalizeBranchName(raw?: string | null): BranchOption | '' {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  const match = BRANCH_OPTIONS.find((b) => b === cleaned);
  return match ?? '';
}

export type GenderOption = 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';

export type AgeGroupOption =
  | 'Under 18'
  | '18–24'
  | '25–34'
  | '35–44'
  | '45–54'
  | '55+';

export type OccupationOption = 'Student' | 'Employed' | 'Unemployed';

export type RelationshipStatusOption =
  | 'Single'
  | 'In a Relationship'
  | 'Married'
  | 'Prefer not to say';

export type DiningCompanionOption = 'Solo' | 'Friends' | 'Family';

export type TransportCategory = 'Private' | 'Public' | 'On Foot';

export type TransportModeOption =
  | 'Private Car'
  | 'Private Motorcycle'
  | 'Private Tricycle'
  | 'Public Mototaxi'
  | 'Public Tricycle'
  | 'Ride-Hailing App (Grab)'
  | 'Walked Only';

export type LocationOption =
  | 'Home'
  | 'Office'
  | 'Church'
  | 'Supermarket'
  | 'Department Store'
  | 'Airport'
  | 'Other';

export type CurrencyCode = 'PHP' | 'USD';

export type PaymentMethodOption =
  | 'Cash'
  | 'E-Wallet (GCash / Maya)'
  | 'Credit / Debit Card'
  | 'Bank Transfer'
  | 'Other';

export type ConsentOption = 'Yes' | 'No';

export type VisitFrequencyOption = 'First Time' | '2nd Time' | '3 or More Times';

export type OnlineSoloAwarenessOption = 'Yes' | 'No';

export interface SurveyDraft {
  consent: ConsentOption | '';
  branch: BranchOption | '';
  name: string;
  gender: GenderOption | '';
  ageGroup: AgeGroupOption | '';
  occupation: OccupationOption | '';
  relationshipStatus: RelationshipStatusOption | '';
  diningWith: DiningCompanionOption | '';
  visitFrequency: VisitFrequencyOption | '';
  partySize: number;
  transportMode: TransportModeOption | '';
  origin: string;
  originOther: string;
  destination: string;
  destinationOther: string;
  currency: CurrencyCode;
  spendBracket: string;
  customSpend: string;
  orderedTakeout: boolean;
  paymentMethod: PaymentMethodOption | '';
  paymentOther: string;
  awareOnlineSoloMeal: OnlineSoloAwarenessOption | '';
}

export interface SurveyResponse {
  id: string;
  submittedAt: string; // ISO timestamp
  submittedDate: string; // YYYY-MM-DD in local time of submission
  branch?: BranchOption;
  consent?: ConsentOption;
  name: string; // empty string or 'Anonymous' displayed if omitted
  gender: GenderOption;
  ageGroup: AgeGroupOption;
  occupation?: OccupationOption;
  relationshipStatus?: RelationshipStatusOption;
  diningWith: DiningCompanionOption;
  visitFrequency?: VisitFrequencyOption;
  partySize: number;
  transportCategory: TransportCategory;
  transportMode: TransportModeOption;
  origin: string;
  destination: string;
  currency: CurrencyCode;
  spendPerPax: string;
  spendEstimate: number;
  orderedTakeout?: boolean;
  paymentMethod?: string;
  awareOnlineSoloMeal?: OnlineSoloAwarenessOption;
}

export const GENDER_OPTIONS: { value: GenderOption; label: string; hint: string }[] = [
  { value: 'Male', label: 'Male', hint: 'Man / Male' },
  { value: 'Female', label: 'Female', hint: 'Woman / Female' },
  { value: 'Non-binary', label: 'Non-binary', hint: 'Other gender identity' },
  { value: 'Prefer not to say', label: 'Prefer not to say', hint: 'Keep private' },
];

export const AGE_GROUP_OPTIONS: { value: AgeGroupOption; label: string }[] = [
  { value: 'Under 18', label: 'Under 18' },
  { value: '18–24', label: '18–24' },
  { value: '25–34', label: '25–34' },
  { value: '35–44', label: '35–44' },
  { value: '45–54', label: '45–54' },
  { value: '55+', label: '55+' },
];

export const OCCUPATION_OPTIONS: {
  value: OccupationOption;
  label: string;
  hint: string;
}[] = [
  { value: 'Student', label: 'Student', hint: 'High school, college, or grad' },
  { value: 'Employed', label: 'Employed', hint: 'Working or self-employed' },
  { value: 'Unemployed', label: 'Unemployed', hint: 'Currently not working' },
];

export const RELATIONSHIP_STATUS_OPTIONS: {
  value: RelationshipStatusOption;
  label: string;
  hint: string;
}[] = [
  { value: 'Single', label: 'Single', hint: 'Unmarried / not partnered' },
  { value: 'In a Relationship', label: 'In a Relationship', hint: 'Dating or partnered' },
  { value: 'Married', label: 'Married', hint: 'With spouse' },
  { value: 'Prefer not to say', label: 'Prefer not to say', hint: 'Keep private' },
];

export const COMPANION_OPTIONS: {
  value: DiningCompanionOption;
  label: string;
  hint: string;
}[] = [
  { value: 'Solo', label: 'Solo', hint: 'Dining on your own (1 pax)' },
  { value: 'Friends', label: 'With Friends', hint: 'Social outing or hangout' },
  { value: 'Family', label: 'With Family', hint: 'Parents, kids, or relatives' },
];

export const VISIT_FREQUENCY_OPTIONS: {
  value: VisitFrequencyOption;
  label: string;
  hint: string;
}[] = [
  {
    value: 'First Time',
    label: 'First Time',
    hint: 'My first time dining at Jiang Nan',
  },
  {
    value: '2nd Time',
    label: '2nd Time',
    hint: 'My second visit dining with us',
  },
  {
    value: '3 or More Times',
    label: '3 or More Times',
    hint: 'Returning / regular diner',
  },
];

export const TRANSPORT_OPTIONS: {
  value: TransportModeOption;
  category: TransportCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: 'Private Car',
    category: 'Private',
    label: 'Private Car',
    hint: 'Own or family vehicle',
  },
  {
    value: 'Private Motorcycle',
    category: 'Private',
    label: 'Private Motorcycle',
    hint: 'Personal motorbike / scooter',
  },
  {
    value: 'Private Tricycle',
    category: 'Private',
    label: 'Private Tricycle',
    hint: 'Personal / family tricycle',
  },
  {
    value: 'Public Mototaxi',
    category: 'Public',
    label: 'Public Mototaxi',
    hint: 'Habal-habal / Angkas / JoyRide',
  },
  {
    value: 'Public Tricycle',
    category: 'Public',
    label: 'Public Tricycle',
    hint: 'Toda / street-hailed tricycle',
  },
  {
    value: 'Ride-Hailing App (Grab)',
    category: 'Public',
    label: 'Car Ride-Hailing (Grab)',
    hint: 'GrabCar / TNVS booking',
  },
  {
    value: 'Walked Only',
    category: 'On Foot',
    label: 'Walked Only',
    hint: 'Arrived on foot / walked from nearby',
  },
];

export const LOCATION_OPTIONS: {
  value: LocationOption;
  label: string;
  hint: string;
}[] = [
  { value: 'Home', label: 'Home', hint: 'Residence / condo' },
  { value: 'Office', label: 'Office', hint: 'Workplace / school' },
  { value: 'Church', label: 'Church', hint: 'Parish / place of worship' },
  { value: 'Supermarket', label: 'Supermarket', hint: 'Grocery / market run' },
  { value: 'Department Store', label: 'Department Store', hint: 'Mall / retail shopping' },
  { value: 'Airport', label: 'Airport', hint: 'Flight arrival or departure' },
  { value: 'Other', label: 'Other Place', hint: 'Specify another location' },
];

export const SPEND_BRACKETS: Record<
  CurrencyCode,
  { label: string; estimate: number; hint: string }[]
> = {
  PHP: [
    {
      label: '699-799 Hotpot Only',
      estimate: 749,
      hint: '₱699 – ₱799 per pax · Unlimited hotpot dining package',
    },
    {
      label: '899-999 Hotpot with Grill',
      estimate: 949,
      hint: '₱899 – ₱999 per pax · Unlimited hotpot & tabletop grill',
    },
    {
      label: 'Hotpot with Ala Carte Drinks 699-899',
      estimate: 799,
      hint: '₱699 – ₱899 per pax · Hotpot + a la carte beverages',
    },
  ],
  USD: [
    {
      label: '699-799 Hotpot Only',
      estimate: 749,
      hint: '₱699 – ₱799 per pax · Unlimited hotpot dining package',
    },
    {
      label: '899-999 Hotpot with Grill',
      estimate: 949,
      hint: '₱899 – ₱999 per pax · Unlimited hotpot & tabletop grill',
    },
    {
      label: 'Hotpot with Ala Carte Drinks 699-899',
      estimate: 799,
      hint: '₱699 – ₱899 per pax · Hotpot + a la carte beverages',
    },
  ],
};

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethodOption;
  label: string;
  hint: string;
}[] = [
  { value: 'Cash', label: 'Cash', hint: 'Physical bills or coins' },
  {
    value: 'E-Wallet (GCash / Maya)',
    label: 'E-Wallet (GCash / Maya)',
    hint: 'QRPh or mobile wallet scan',
  },
  {
    value: 'Credit / Debit Card',
    label: 'Credit / Debit Card',
    hint: 'Visa, Mastercard, tap-to-pay',
  },
  {
    value: 'Bank Transfer',
    label: 'Bank Transfer',
    hint: 'InstaPay / PESONet / online',
  },
  { value: 'Other', label: 'Other Method', hint: 'Voucher, gift card, or other' },
];

export const ONLINE_SOLO_AWARENESS_OPTIONS: {
  value: OnlineSoloAwarenessOption;
  label: string;
  hint: string;
}[] = [
  {
    value: 'Yes',
    label: "Yes, I'm aware",
    hint: 'I already knew I can order a Hot Pot Solo meal online thru your website',
  },
  {
    value: 'No',
    label: 'No, this is new to me',
    hint: "I wasn't aware it can be ordered online thru the website",
  },
];

export function getTransportCategory(mode: TransportModeOption): TransportCategory {
  const found = TRANSPORT_OPTIONS.find((item) => item.value === mode);
  return found ? found.category : 'Public';
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSurveyCsv(responses: SurveyResponse[]): string {
  const headers = [
    'Response ID',
    'Date',
    'Time',
    'Submitted At (ISO)',
    'Branch',
    'Marketing Research Consent',
    'Name',
    'Gender',
    'Age',
    'Occupation',
    'Relationship Status',
    'Dining Companion',
    'Visit Frequency',
    'Party Size (Pax)',
    'Transport Category',
    'Transport Mode',
    'Where Before (Origin)',
    'Where Heading Next (Destination)',
    'Currency',
    'Budget Per Pax',
    'Estimated Spend Per Pax',
    'Ordered for Takeout',
    'Preferred Mode of Payment',
    'Aware of Online Hot Pot Solo Meal',
  ];

  const rows = responses.map((r) => {
    const dt = new Date(r.submittedAt);
    const timeStr = Number.isNaN(dt.getTime())
      ? ''
      : dt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

    return [
      r.id,
      r.submittedDate,
      timeStr,
      r.submittedAt,
      r.branch || 'Unassigned',
      r.consent || 'Yes',
      r.name || 'Anonymous',
      r.gender,
      r.ageGroup,
      r.occupation || 'Unspecified',
      r.relationshipStatus || 'Unspecified',
      r.diningWith,
      r.visitFrequency || 'Unspecified',
      r.partySize,
      r.transportCategory,
      r.transportMode,
      r.origin,
      r.destination,
      r.currency,
      r.spendPerPax,
      r.spendEstimate,
      r.orderedTakeout ? 'Yes' : 'No',
      r.paymentMethod || 'Unspecified',
      r.awareOnlineSoloMeal || 'Unspecified',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // Prefix UTF-8 BOM so Excel opens currency symbols like ₱ cleanly
  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
