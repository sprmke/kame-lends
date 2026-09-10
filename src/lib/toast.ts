import { toast as sonnerToast } from "svelte-sonner";

export const toast = {
  success: (message: string, opts?: { description?: string }) =>
    sonnerToast.success(message, opts),
  error: (message: string, opts?: { description?: string }) =>
    sonnerToast.error(message, opts),
  info: (message: string, opts?: { description?: string }) =>
    sonnerToast.message(message, opts),
};
