import React, { useState, useEffect, useRef } from 'react';
import { money } from '@/lib/poker';

export default function AnimatedAmount({ value, currency, animate, className, formatter }) {
  const [revealed, setRevealed] = useState(0);
  const [typing, setTyping] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState('');

  const formatterRef = useRef(formatter);
  formatterRef.current = formatter;

  const prevValueRef = useRef(value);
  const isInitialMount = useRef(true);
  const timerRef = useRef(null);

  const format = (v, c) => (formatterRef.current ? formatterRef.current(v, c) : money(v, c));

  useEffect(() => {
    const target = format(value, currency);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevValueRef.current = value;
      setCurrentDisplay(target);
      return;
    }

    if (!animate || value === prevValueRef.current) {
      prevValueRef.current = value;
      setCurrentDisplay(target);
      setTyping(false);
      return;
    }

    prevValueRef.current = value;
    setCurrentDisplay(target);
    const len = target.length;
    setRevealed(1);
    setTyping(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Typewriter animation lasting ~400ms total (min 15ms per char)
    const charDelay = Math.max(15, Math.round(400 / Math.max(1, len)));
    let i = 1;
    timerRef.current = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= len) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setTyping(false);
      }
    }, charDelay);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, currency, animate]);

  const target = format(value, currency);

  if (!typing) {
    return <span className={className}>{target}</span>;
  }

  const visible = currentDisplay.slice(0, revealed);
  const hidden = currentDisplay.slice(revealed);

  return (
    <span className={className} style={{ whiteSpace: 'pre' }}>
      <span>{visible}</span>
      <span style={{ opacity: 0 }}>{hidden}</span>
    </span>
  );
}
