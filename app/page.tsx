import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCachedAuth } from '@/auth';
import { LandingPage } from '@/components/landing';
import { APP_NAME } from '@/lib/brand';
import { SHOW_TRANSACTIONS_UI } from '@/lib/feature-flags';

export const metadata: Metadata = {
  title: `${APP_NAME} — Smart Lending Management`,
  description: SHOW_TRANSACTIONS_UI
    ? 'Track loans, manage investors, and monitor transactions in one modern platform built for lending teams.'
    : 'Track loans, manage investors, and monitor borrowings in one modern platform built for lending teams.',
};

export default async function HomePage() {
  const session = await getCachedAuth();

  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
