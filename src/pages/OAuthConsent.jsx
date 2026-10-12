import React, { useEffect, useState } from 'react';
import { appParams } from '@/lib/app-params';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';

export default function OAuthConsent() {
  const ctx = new URLSearchParams(window.location.search).get('ctx');
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decided, setDecided] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!ctx) {
          setError('This authorization link is invalid or has expired.');
          setChecking(false);
          return;
        }
        setInfo({
          client_name: 'AI Agent',
          app_name: 'Poker Action Tracker',
          authenticated: true,
          tools: [{ name: 'view_table', title: 'View Table State', description: 'Read current active hand, pot, and stacks' }]
        });
        setChecking(false);
      } catch {
        setError('Could not load authorization request.');
        setChecking(false);
      }
    })();
  }, [ctx]);

  const respond = async (action) => {
    setSubmitting(true);
    setDecided(action);
    setSubmitting(false);
  };

  if (checking) {
    return (
      <AuthLayout icon={ShieldCheck} title="Authorize access">
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
          Loading...
        </div>
      </AuthLayout>
    );
  }

  if (decided) {
    return (
      <AuthLayout
        icon={ShieldCheck}
        title={decided === 'approve' ? 'Access granted' : 'Access denied'}
        subtitle="You can return to your application."
      />
    );
  }

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Authorize access"
      subtitle="Connect with Poker Action Tracker"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/40 text-rose-300 text-sm border border-rose-800">
          {error}
        </div>
      )}
      <p className="text-sm text-slate-300 mb-6">
        An external tool is requesting permission to access your table session.
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 font-medium cursor-pointer"
          disabled={submitting}
          onClick={() => respond('deny')}
        >
          Deny
        </Button>
        <Button
          className="flex-1 h-12 font-medium cursor-pointer"
          disabled={submitting}
          onClick={() => respond('approve')}
        >
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Approve
        </Button>
      </div>
    </AuthLayout>
  );
}
