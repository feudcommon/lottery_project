import { useEffect, useRef } from 'react';

// Payload Telegram's Login Widget passes to the onAuth callback.
// https://core.telegram.org/widgets/login#receiving-authorization-data
export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

type TelegramLoginWidgetProps = {
  botUsername: string;
  onAuth: (user: TelegramWidgetUser) => void;
  disabled?: boolean;
};

/**
 * Renders Telegram's official Login Widget (telegram-widget.js). This is
 * the browser-side equivalent of "open inside the Telegram app" - it lets
 * someone on the plain website sign in with their Telegram account without
 * ever launching the Mini App.
 *
 * Telegram's script injects its own <iframe> button into the container div
 * and calls window.onTelegramAuth(user) once the person approves the login
 * in a Telegram popup. That global callback is wired up here and torn down
 * on unmount so it never leaks across route changes.
 */
export default function TelegramLoginWidget({
  botUsername,
  onAuth,
  disabled = false,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || disabled) return;

    window.onTelegramAuth = (user: TelegramWidgetUser) => onAuth(user);

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '100');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [botUsername, onAuth, disabled]);

  if (disabled) return null;

  return <div ref={containerRef} />;
}