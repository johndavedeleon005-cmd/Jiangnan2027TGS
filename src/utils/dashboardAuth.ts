import { isValidBranchOption, type BranchOption } from '../types/survey';

export type DashboardAccount = 'HEAD_OFFICE' | BranchOption;

const HEAD_OFFICE_PASSWORD = 'JiangNanTGS2027';

const BRANCH_PASSWORDS: Record<BranchOption, string> = {
  BANAWE: 'JiangNANTGS100',
  'BF HOMES': 'JiangNANTGS105',
  'NU MOA': 'JiangNANTGS110',
  'HOLY SPIRIT': 'JiangNANTGS115',
  HEMADY: 'JiangNANTGS120',
  'PASEO CENTER': 'JiangNANTGS125',
  'FAME MALL': 'JiangNANTGS130',
  'SM EAST ORTIGAS': 'JiangNANTGS135',
  'SM MARILAO': 'JiangNANTGS140',
  'SM MARIKINA': 'JiangNANTGS145',
  'SM FAIRVIEW': 'JiangNANTGS150',
  'STA ROSA': 'JiangNANTGS155',
  'SMDC TAGAYTAY': 'JiangNANTGS160',
  'SM SUCAT': 'JiangNANTGS165',
  'GIL FERNANDO': 'JiangNANTGS170',
  'ORTIGAS CENTER': 'JiangNANTGS175',
  'EASTWOOD CITY': 'JiangNANTGS180',
  'SM CLARK': 'JiangNANTGS185',
  'SM NORTH EDSA': 'JiangNANTGS190',
  'GH PROMENADE': 'JiangNANTGS195',
  SOUTHMALL: 'JiangNANTGS200',
};

const SESSION_STORAGE_KEY = 'jiangnan_dashboard_account_v2';
const LEGACY_UNLOCK_KEY = 'jiangnan_dashboard_unlocked_v1';

export function verifyDashboardCredentials(
  account: DashboardAccount,
  password: string
): boolean {
  if (account === 'HEAD_OFFICE') {
    return password === HEAD_OFFICE_PASSWORD;
  }
  return BRANCH_PASSWORDS[account] === password;
}

export function getDashboardAccountLabel(account: DashboardAccount): string {
  return account === 'HEAD_OFFICE' ? 'Head Office' : account;
}

export function readStoredDashboardAccount(): DashboardAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    window.sessionStorage.removeItem(LEGACY_UNLOCK_KEY);
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return null;
    if (saved === 'HEAD_OFFICE') return 'HEAD_OFFICE';
    if (isValidBranchOption(saved)) return saved;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredDashboardAccount(account: DashboardAccount | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (account) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, account);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}
