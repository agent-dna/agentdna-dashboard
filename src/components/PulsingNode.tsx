import { motion } from 'framer-motion';
import { type CSSProperties } from 'react';

interface PulsingNodeProps {
  children: React.ReactNode;
  color: string;
  size?: number;
  pulseSpeed?: number;
  isActive?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PulsingNode({
  children,
  color,
  size = 60,
  pulseSpeed = 2,
  isActive = true,
  className = '',
  style = {},
}: PulsingNodeProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        ...style,
      }}
    >
      {/* Pulsing rings - multiple layers for depth */}
      {isActive && (
        <>
          <motion.div
            animate={{
              scale: [1, 2.2, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: pulseSpeed,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: `2px solid ${color}`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
          <motion.div
            animate={{
              scale: [1, 2.5, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{
              duration: pulseSpeed,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.3,
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: `2px solid ${color}`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Main node */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          boxShadow: `0 4px 20px ${color}40, 0 0 40px ${color}20`,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
