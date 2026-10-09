import { motion } from 'framer-motion';
import { type ReactNode, type CSSProperties } from 'react';

interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function AnimatedButton({ children, onClick, className = '', style = {}, variant = 'primary' }: AnimatedButtonProps) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      color: '#ffffff',
      border: 'none',
      shadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
      hoverShadow: '0 8px 30px rgba(99, 102, 241, 0.6)',
    },
    secondary: {
      background: 'rgba(99, 102, 241, 0.1)',
      color: '#6366F1',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      shadow: '0 2px 8px rgba(99, 102, 241, 0.1)',
      hoverShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
    },
    ghost: {
      background: 'transparent',
      color: '#6366F1',
      border: 'none',
      shadow: 'none',
      hoverShadow: '0 2px 12px rgba(99, 102, 241, 0.2)',
    },
  };

  const config = variants[variant];

  return (
    <motion.button
      className={className}
      onClick={onClick}
      style={{
        background: config.background,
        color: config.color,
        border: config.border,
        padding: '12px 24px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: config.shadow,
        ...style,
      }}
      whileHover={{
        scale: 1.05,
        boxShadow: config.hoverShadow,
      }}
      whileTap={{
        scale: 0.95,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Ripple effect background */}
      <motion.div
        initial={{ scale: 0, opacity: 0.5 }}
        whileHover={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {children}
      </span>
    </motion.button>
  );
}
