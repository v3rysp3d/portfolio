/*
 * Interview chat — progressive enhancement. Without JS the composer form posts
 * normally and the server re-renders the transcript (Post/Redirect/Get). With
 * JS we POST via fetch and append the reply inline, with no full reload.
 * Same-origin only; the API key lives server-side and is never referenced here.
 */

interface MessageMeta {
  tier: string;
  model: string;
  outputTokens: number;
  latencyMs: number;
  cacheReadTokens: number;
  refused: boolean;
  guardrailFlags: string[];
}

interface MessageResponse {
  ok?: boolean;
  reply?: string;
  remainingTurns?: number;
  meta?: MessageMeta;
  error?: string;
  reason?: string;
}

/** Prepends the telemetry line + state modifiers a server-rendered turn gets. */
function applyMeta(msg: HTMLElement, meta: MessageMeta): void {
  const blocked = meta.tier === 'none';
  if (blocked) msg.classList.add('chat-msg--blocked');
  else if (meta.refused) msg.classList.add('chat-msg--refusal');
  if (meta.tier === 'sonnet') msg.classList.add('chat-msg--escalated');

  const line = document.createElement('div');
  line.className = 'chat-msg__meta';

  const tier = document.createElement('span');
  tier.className = `tier-tag tier-tag--${meta.tier}`;
  tier.textContent = blocked ? 'GUARDRAIL' : meta.tier.toUpperCase();
  line.appendChild(tier);

  if (!blocked) {
    const numbers = document.createElement('span');
    numbers.textContent =
      `${meta.outputTokens} TOK · ${meta.latencyMs}MS` + (meta.cacheReadTokens > 0 ? ' · CACHED' : '');
    line.appendChild(numbers);
  }
  const badge = (cls: string, text: string): void => {
    const el = document.createElement('span');
    el.className = `badge ${cls}`;
    el.textContent = text;
    line.appendChild(el);
  };
  if (meta.guardrailFlags.includes('injection')) badge('badge--revoked', '⌗ injection blocked');
  if (meta.guardrailFlags.includes('pii')) badge('badge--declined', '⌗ personal-data blocked');

  msg.insertBefore(line, msg.firstChild);
}

export function initInterviewChat(): void {
  const root = document.querySelector<HTMLElement>('[data-interview-chat]');
  if (!root) return;

  const form = root.querySelector<HTMLFormElement>('[data-interview-form]');
  const log = root.querySelector<HTMLElement>('[data-chat-log]');
  const input = root.querySelector<HTMLTextAreaElement>('[data-chat-input]');
  const sendBtn = root.querySelector<HTMLButtonElement>('[data-chat-send]');
  const note = root.querySelector<HTMLElement>('[data-chat-note]');
  const counter = root.querySelector<HTMLElement>('.chat__counter');
  const counterNum = root.querySelector<HTMLElement>('.chat__counter-num');
  const csrfInput = form?.querySelector<HTMLInputElement>('input[name="_csrf"]') ?? null;
  if (!form || !log || !input || !csrfInput) return;

  function scrollToBottom(): void {
    log!.scrollTop = log!.scrollHeight;
  }

  function addMessage(role: 'user' | 'assistant', text: string, opts?: { pending?: boolean }): HTMLElement {
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg--${role}${opts?.pending ? ' is-pending' : ''}`;
    const body = document.createElement('div');
    body.className = 'chat-msg__body';
    body.textContent = text;
    msg.appendChild(body);
    log!.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function setRemaining(n: number): void {
    if (counter) counter.setAttribute('data-remaining', String(n));
    if (counterNum) counterNum.textContent = String(n);
  }

  function lockComposer(message?: string): void {
    input!.value = '';
    input!.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    input!.setAttribute('placeholder', 'No questions remaining.');
    if (note && message) note.textContent = message;
  }

  function enable(enabled: boolean): void {
    input!.disabled = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
  }

  scrollToBottom();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = (input.value || '').trim();
    if (!text || input.disabled) return;

    addMessage('user', text);
    const pending = addMessage('assistant', '…', { pending: true });
    input.value = '';
    enable(false);

    fetch('/interview/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-CSRF-Token': csrfInput.value,
      },
      body: 'message=' + encodeURIComponent(text),
    })
      .then((res) => res.json().then((data: MessageResponse) => ({ status: res.status, data })))
      .then((result) => {
        const data = result.data || {};
        const body = pending.querySelector<HTMLElement>('.chat-msg__body');
        if (data.ok) {
          pending.classList.remove('is-pending');
          if (body) body.textContent = data.reply ?? '';
          if (data.meta) applyMeta(pending, data.meta);
          setRemaining(data.remainingTurns ?? 0);
          if ((data.remainingTurns ?? 0) <= 0) {
            lockComposer("You've used all your questions for this interview. Thanks for your time!");
          } else {
            enable(true);
            input.focus();
          }
          scrollToBottom();
          return;
        }

        // Not OK — replace the pending bubble with the server's note.
        pending.classList.remove('is-pending');
        if (body) body.textContent = data.error || 'Sorry, something went wrong.';
        if (data.reason === 'limit') {
          lockComposer(data.error);
        } else if (data.reason === 'error' || data.reason === 'capacity') {
          enable(true); // retryable
          if (note && data.error) note.textContent = data.error;
        } else {
          // expired / revoked / disabled / invalid — session is over.
          lockComposer(data.error);
        }
      })
      .catch(() => {
        pending.classList.remove('is-pending');
        const body = pending.querySelector<HTMLElement>('.chat-msg__body');
        if (body) body.textContent = 'Network error — please try again.';
        enable(true);
      });
  });

  // Suggested-question chips → drop the text into the composer (don't auto-send).
  // AI-themed chips (data-ai-q) additionally pop the "How this AI works" diagram,
  // so an interviewer sees the routing visual immediately — at zero token cost —
  // and can still hit Send to hear it in my own words.
  root.querySelectorAll<HTMLButtonElement>('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.hasAttribute('data-ai-q')) openModal();
      if (input.disabled) return;
      input.value = chip.getAttribute('data-q') || '';
      input.focus();
    });
  });

  // "How this AI works" popout.
  const modal = root.querySelector<HTMLElement>('[data-ai-modal]');
  const infoBtn = root.querySelector<HTMLButtonElement>('[data-ai-info]');
  function openModal(): void {
    if (modal) {
      modal.hidden = false;
      document.body.classList.add('modal-open');
    }
  }
  function closeModal(): void {
    if (modal) {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  }
  if (infoBtn) infoBtn.addEventListener('click', openModal);
  if (modal) {
    modal.querySelectorAll<HTMLElement>('[data-modal-close]').forEach((closer) => {
      closer.addEventListener('click', closeModal);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}
