import { motion } from 'framer-motion';
import { type ReactNode, type CSSProperties } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: 'default' | 'strong' | 'subtle';
  gradient?: boolean;
}

export function GlassCard({ children, className = '', style = {}, variant = 'default', gradient = false }: GlassCardProps) {
  const variants = {
    default: {
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      blur: 'blur(16px)',
      shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
    },
    strong: {
      background: 'rgba(255, 255, 255, 0.12)',
      border: '1px solid rgba(255, 255, 255, 0.25)',
      blur: 'blur(24px)',
      shadow: '0 12px 48px 0 rgba(0, 0, 0, 0.18)',
    },
    subtle: {
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      blur: 'blur(12px)',
      shadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08)',
    },
  };

  const config = variants[variant];

  const gradientBg = gradient
    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)'
    : config.background;

  return (
    <motion.div
      className={className}
      style={{
        background: gradientBg,
        backdropFilter: config.blur,
        WebkitBackdropFilter: config.blur,
        border: config.border,
        boxShadow: config.shadow,
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{
        scale: 1.01,
        boxShadow: '0 16px 56px 0 rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.div>
  );
}
