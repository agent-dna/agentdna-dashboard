import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  duration = 1,
  className = '',
  style = {},
  prefix = '',
  suffix = ''
}: AnimatedCounterProps) {
  const spring = useSpring(0, { duration: duration * 1000 });
  const display = useTransform(spring, (current) => Math.floor(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span
      className={className}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </motion.span>
  );
}
