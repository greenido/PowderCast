'use client';

import { useState } from 'react';
import { ShareIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * The async Clipboard API is denied in embedded webviews and some in-app
 * browsers, so fall back to the legacy selection-based copy there.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

interface ShareButtonProps {
  title: string;
  text: string;
}

/**
 * Share the current view. The native share sheet on phones (and Safari),
 * copy-to-clipboard everywhere else. Shares the live URL, which carries the
 * resort and elevation, so the recipient lands on exactly this view.
 */
export default function ShareButton({ title, text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // Dismissing the sheet rejects with AbortError; that is not a failure.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Clipboard blocked entirely — hand the link over to copy by hand.
      window.prompt('Copy this link', url);
    }
  }

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-lg p-2 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      aria-label={copied ? 'Link copied' : 'Share this forecast'}
      title={copied ? 'Link copied' : 'Share'}
    >
      {copied ? (
        <>
          <CheckIcon className="h-5 w-5 text-emerald-400 sm:h-6 sm:w-6" />
          <span className="text-xs font-semibold text-emerald-400">Copied</span>
        </>
      ) : (
        <ShareIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      )}
    </button>
  );
}
