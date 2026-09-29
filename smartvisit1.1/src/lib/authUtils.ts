import { User, UserRole } from '../types';

/**
 * Checks if user is a Diretor (Global access to all branches, settings, and records).
 */
export function isDiretor(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'diretor';
}

/**
 * Checks if user is a Gestor / Gerente (Restricted to their specific branch/filial).
 */
export function isGestor(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'gestor' || user.role === 'gerente';
}

/**
 * Checks if user is a Vendedor (Operational access, own quotes only, read-only feed).
 */
export function isVendedor(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'vendedor';
}

/**
 * Returns formatted role display label in Portuguese.
 */
export function getRoleLabel(role?: UserRole | string): string {
  switch (role) {
    case 'diretor':
      return 'Diretor';
    case 'gestor':
    case 'gerente':
      return 'Gestor';
    case 'vendedor':
      return 'Vendedor';
    default:
      return 'Usuário';
  }
}

/**
 * Returns role badge styling classes for consistent visual identity.
 */
export function getRoleBadgeClasses(role?: UserRole | string): { bg: string; text: string; border: string } {
  switch (role) {
    case 'diretor':
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
      };
    case 'gestor':
    case 'gerente':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200'
      };
    case 'vendedor':
    default:
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
      };
  }
}
