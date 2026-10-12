import React, { useState, useEffect, useRef } from 'react';
import { money } from '@/lib/poker';

export default function AnimatedAmount({ value, currency, animate, className, formatter }) {
  const [revealed, setRevealed] = useState(0);
  const [typing, setTyping] = useState(false);
  const prevRef = useRef(value);
  const timerRef = useRef(null);

  const format = (v, c) => (formatter ? formatter(v, c) : money(v, c));

  useEffect(() => {
    if (!animate || value === prevRef.current) {
      prevRef.current = value;
      setRevealed(0);
      setTyping(false);
      return;
    }
    prevRef.current = value;
    const target = format(value, currency);
    const len = target.length;
    setRevealed(1);
    setTyping(true);
    const charDelay = 44;
    let i = 1;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= len) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setTyping(false);
      }
    }, charDelay);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [value, animate, currency, formatter]);

  if (!typing) {
    return <span className={className}>{format(value, currency)}</span>;
  }
  const fullStr = format(value, currency);
  const visible = fullStr.slice(0, revealed);
  const hidden = fullStr.slice(revealed);
  return (
    <span className={className} style={{ whiteSpace: 'pre' }}>
      <span>{visible}</span>
      <span style={{ opacity: 0 }}>{hidden}</span>
    </span>
  );
}
