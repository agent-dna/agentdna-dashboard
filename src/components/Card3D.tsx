import { motion } from 'framer-motion';
import { useState, type ReactNode, type CSSProperties } from 'react';

interface Card3DProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  glassEffect?: boolean;
  hoverScale?: number;
}

export function Card3D({ children, className = '', style = {}, glassEffect = false, hoverScale = 1.02 }: Card3DProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXValue = ((y - centerY) / centerY) * -10;
    const rotateYValue = ((x - centerX) / centerX) * 10;

    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovering(false);
  };

  const glassStyle: CSSProperties = glassEffect ? {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  } : {};

  return (
    <motion.div
      className={className}
      style={{
        ...style,
        ...glassStyle,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        position: 'relative',
      }}
      animate={{
        rotateX,
        rotateY,
        scale: isHovering ? hoverScale : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shine effect */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%)',
          borderRadius: 'inherit',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
        animate={{
          opacity: isHovering ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Content with subtle depth */}
      <div style={{ transform: 'translateZ(20px)', position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </motion.div>
  );
}
