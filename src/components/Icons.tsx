import React from 'react';
import {
  Baby,
  Bike,
  Briefcase,
  Building2,
  Car,
  CarFront,
  Church,
  Coffee,
  Compass,
  CreditCard,
  Crown,
  Flame,
  GraduationCap,
  Heart,
  HeartHandshake,
  Home,
  Landmark,
  MapPin,
  Plane,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  User,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  Banknote,
  Coins,
  Gem,
} from 'lucide-react';
import { getBaseAppUrl } from '../utils/surveyStorage';
import type {
  AgeGroupOption,
  DiningCompanionOption,
  GenderOption,
  OccupationOption,
  RelationshipStatusOption,
  TransportModeOption,
} from '../types/survey';

export function TricycleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Sidecar canopy & cab */}
      <path d="M5 10h8l1.5 5H4.5L5 10Z" />
      <path d="M6 10V7a1 1 0 0 1 1-1h5l2 4" />
      {/* Handlebar / front fork */}
      <path d="M15 6h2.5l1.5 9" />
      {/* Wheels */}
      <circle cx="6.5" cy="17.5" r="2.2" />
      <circle cx="18.5" cy="17.5" r="2.2" />
      <path d="M8.7 17.5h7.6" />
    </svg>
  );
}

export function MototaxiIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Rider helmet + passenger */}
      <circle cx="14.5" cy="5.5" r="1.75" />
      <path d="M12.5 10.5l2-2.5 2.5 2" />
      {/* Moto frame */}
      <path d="M5 14h9l2.5-3.5" />
      <path d="M16.5 7.5h2" />
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M8 17.5h8" />
    </svg>
  );
}

export function GenderIcon({
  gender,
  className = 'w-5 h-5',
}: {
  gender: GenderOption;
  className?: string;
}) {
  switch (gender) {
    case 'Male':
      return <User className={className} aria-hidden="true" />;
    case 'Female':
      return <UserRound className={className} aria-hidden="true" />;
    case 'Non-binary':
      return <Users className={className} aria-hidden="true" />;
    case 'Prefer not to say':
      return <Shield className={className} aria-hidden="true" />;
  }
}

export function AgeGroupIcon({
  ageGroup,
  className = 'w-5 h-5',
}: {
  ageGroup: AgeGroupOption;
  className?: string;
}) {
  switch (ageGroup) {
    case 'Under 18':
      return <Baby className={className} aria-hidden="true" />;
    case '18–24':
      return <GraduationCap className={className} aria-hidden="true" />;
    case '25–34':
      return <Flame className={className} aria-hidden="true" />;
    case '35–44':
      return <Briefcase className={className} aria-hidden="true" />;
    case '45–54':
      return <UserCheck className={className} aria-hidden="true" />;
    case '55+':
      return <Crown className={className} aria-hidden="true" />;
  }
}

export function OccupationIcon({
  occupation,
  className = 'w-5 h-5',
}: {
  occupation: OccupationOption;
  className?: string;
}) {
  switch (occupation) {
    case 'Student':
      return <GraduationCap className={className} aria-hidden="true" />;
    case 'Employed':
      return <Briefcase className={className} aria-hidden="true" />;
    case 'Unemployed':
      return <Coffee className={className} aria-hidden="true" />;
  }
}

export function RelationshipIcon({
  status,
  className = 'w-5 h-5',
}: {
  status: RelationshipStatusOption;
  className?: string;
}) {
  switch (status) {
    case 'Single':
      return <User className={className} aria-hidden="true" />;
    case 'In a Relationship':
      return <Heart className={className} aria-hidden="true" />;
    case 'Married':
      return <HeartHandshake className={className} aria-hidden="true" />;
    case 'Prefer not to say':
      return <Shield className={className} aria-hidden="true" />;
  }
}

export function CompanionIcon({
  companion,
  className = 'w-5 h-5',
}: {
  companion: DiningCompanionOption;
  className?: string;
}) {
  switch (companion) {
    case 'Solo':
      return <User className={className} aria-hidden="true" />;
    case 'Friends':
      return <Users className={className} aria-hidden="true" />;
    case 'Family':
      return <HeartHandshake className={className} aria-hidden="true" />;
  }
}

export function TransportIcon({
  mode,
  className = 'w-5 h-5',
}: {
  mode: TransportModeOption;
  className?: string;
}) {
  switch (mode) {
    case 'Private Car':
      return <Car className={className} aria-hidden="true" />;
    case 'Private Motorcycle':
      return <Bike className={className} aria-hidden="true" />;
    case 'Private Tricycle':
      return <TricycleIcon className={className} />;
    case 'Public Mototaxi':
      return <MototaxiIcon className={className} />;
    case 'Public Tricycle':
      return <TricycleIcon className={className} />;
    case 'Ride-Hailing App (Grab)':
      return <CarFront className={className} aria-hidden="true" />;
  }
}

export function LocationIcon({
  location,
  className = 'w-5 h-5',
}: {
  location: string;
  className?: string;
}) {
  switch (location) {
    case 'Home':
      return <Home className={className} aria-hidden="true" />;
    case 'Office':
      return <Building2 className={className} aria-hidden="true" />;
    case 'Church':
      return <Church className={className} aria-hidden="true" />;
    case 'Supermarket':
      return <ShoppingCart className={className} aria-hidden="true" />;
    case 'Department Store':
      return <ShoppingBag className={className} aria-hidden="true" />;
    case 'Airport':
      return <Plane className={className} aria-hidden="true" />;
    default:
      return <MapPin className={className} aria-hidden="true" />;
  }
}

export function SpendTierIcon({
  index,
  className = 'w-5 h-5',
}: {
  index: number;
  className?: string;
}) {
  if (index <= 1) return <Coins className={className} aria-hidden="true" />;
  if (index <= 3) return <Banknote className={className} aria-hidden="true" />;
  if (index === 4) return <Wallet className={className} aria-hidden="true" />;
  return <Gem className={className} aria-hidden="true" />;
}

export function PaymentMethodIcon({
  method,
  className = 'w-5 h-5',
}: {
  method: string;
  className?: string;
}) {
  switch (method) {
    case 'Cash':
      return <Banknote className={className} aria-hidden="true" />;
    case 'E-Wallet (GCash / Maya)':
      return <Smartphone className={className} aria-hidden="true" />;
    case 'Credit / Debit Card':
      return <CreditCard className={className} aria-hidden="true" />;
    case 'Bank Transfer':
      return <Landmark className={className} aria-hidden="true" />;
    default:
      return <Wallet className={className} aria-hidden="true" />;
  }
}

export function BrandLogo({
  sizeClass = 'w-9 h-9',
}: {
  sizeClass?: string;
}) {
  const base = typeof window !== 'undefined' ? getBaseAppUrl() : './';
  const primarySrc = `${base}assets/aistudio/JIANGNAN_LOGO_RBLACK_TRANSPARENT_781766e1.png`;
  const fallbackSrc = `${base}public/assets/aistudio/JIANGNAN_LOGO_RBLACK_TRANSPARENT_781766e1.png`;
  const githubRawSrc =
    'https://raw.githubusercontent.com/johndavedeleon005-cmd/Jiangnan2027TGS/main/public/assets/aistudio/JIANGNAN_LOGO_RBLACK_TRANSPARENT_781766e1.png';

  return (
    <img
      src={primarySrc}
      alt="Jiang Nan logo"
      onError={(e) => {
        const img = e.currentTarget;
        const step = img.getAttribute('data-fallback-step');
        if (!step) {
          img.setAttribute('data-fallback-step', '1');
          img.src = fallbackSrc;
        } else if (step === '1') {
          img.setAttribute('data-fallback-step', '2');
          img.src = githubRawSrc;
        }
      }}
      className={`${sizeClass} rounded-lg object-contain shrink-0 bg-white`}
    />
  );
}

export { Compass, Smartphone, Sparkles };
