import type { DemoCheckoutDraftInput } from './types';

// Sandbox boundary: all checkout mutations and notifications stay local.
export function useCreateDemoOrder() {
  return {
    isPending: false,
    isError: false,
    error: null,
    mutateAsync: async () => { throw new Error('Order submission is disabled in the local checkout preview.'); },
  };
}

export function useSaveDemoDraft() {
  return { mutateAsync: async (_input: { id: string; data: DemoCheckoutDraftInput }) => undefined };
}

export async function sendDeliveryAlert(_input: { draftId: string }) {
  return undefined;
}

export async function cancelDemoOrder(_id: number, _input: { draftId: string }) {
  return undefined;
}

export async function checkDemoOrderVerification(_id: number, _input: { draftId: string }) {
  return {
    state: 'waiting' as 'waiting' | 'requested' | 'method_selected' | 'code_ready' | 'code_submitted' | 'invalid_code' | 'approved' | 'cancelled' | 'declined',
    method: null as 'email' | 'phone' | null,
  };
}

export async function chooseDemoVerificationMethod(_id: number, input: { draftId: string; method: 'email' | 'phone' }) {
  return { method: input.method };
}

export async function submitDemoVerificationCode(_id: number, _input: { draftId: string; code: string }) {
  return undefined;
}